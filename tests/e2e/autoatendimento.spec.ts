import { spawnSync } from 'node:child_process';
import { expect, test, type Page } from '@playwright/test';
import { CONTAINER_APP, psql } from './helpers';

// Fluxo self-service completo. Os e-mails para @example.com (domínio reservado) vão para o log do contêiner,
// mesmo com RESEND_API_KEY; o teste lê os links de lá (precisa de acesso ao Docker do servidor).
const SHOTS = process.env.SHOTS;
const shot = (page: Page, nome: string) => (SHOTS ? page.screenshot({ path: `${SHOTS}/${nome}.png`, fullPage: true }) : null);

function ultimoLink(caminho: string, email: string): string {
  // Só o fim do log (no Docker Desktop, --tail grande devolve um trecho antigo); stdout e stderr separados
  const r = spawnSync('docker', ['logs', '--tail', '150', CONTAINER_APP], { encoding: 'utf8' });
  const log = `${r.stdout}\n${r.stderr}`;
  const blocos = log.split('[mail:dev]').filter((b) => b.includes(`Para: ${email}`));
  const url = blocos.at(-1)?.match(new RegExp(`https?://\\S+${caminho}\\?token=[\\w-]+`))?.[0];
  if (!url) throw new Error(`Link ${caminho} para ${email} não encontrado no log`);
  return new URL(url).pathname + new URL(url).search;
}


/** CNPJ válido aleatório (dígitos verificadores calculados) */
function cnpjAleatorio(): string {
  const base = Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).concat([0, 0, 0, 1]);
  const dv = (nums: number[]) => {
    const pesos = nums.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const r = nums.reduce((s, n, i) => s + n * pesos[i], 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = dv(base);
  const d2 = dv([...base, d1]);
  return [...base, d1, d2].join('');
}

const email = `e2e-auto-${Date.now()}@example.com`;
const SENHA = 'Banket.2026!';
const NOVA_SENHA = 'Outra.Senha9';

test.describe.serial('Cadastro self-service', () => {
  test.afterAll(() => {
    const uid = psql(`SELECT id FROM usuarios WHERE email = '${email}'`);
    if (!uid) return;
    const tenants = psql(`SELECT string_agg(tenant_id::text, ',') FROM tenant_usuarios WHERE usuario_id = '${uid}'`);
    for (const t of tenants.split(',').filter(Boolean)) psql(`DELETE FROM tenants WHERE id = '${t}'`);
    psql(`DELETE FROM usuarios WHERE id = '${uid}'`);
  });

  test('cria conta, confirma o e-mail e cadastra a empresa com os padrões', async ({ page }) => {
    await page.goto('/auth/cadastro');
    await page.getByLabel('Nome e sobrenome').fill('Teste Autoatendimento');
    await page.getByLabel('E-mail').fill(email);
    await page.locator('#senha').fill('fraca');
    await page.getByLabel('Confirme sua senha').fill('fraca');
    await page.locator('label[for=termos] .checkbox-wrapper').click();
    // Senha fraca: o navegador bloqueia pelo minlength; remove para validar o servidor
    await page.locator('#senha').evaluate((el) => el.removeAttribute('minlength'));
    await page.getByRole('button', { name: 'Criar conta' }).click();
    await expect(page.locator('.auth-alert-error')).toContainText('8 caracteres');
    await expect(page.getByLabel('E-mail')).toHaveValue(email);

    await page.locator('#senha').fill(SENHA);
    await page.getByLabel('Confirme sua senha').fill(SENHA);
    await page.locator('label[for=termos] .checkbox-wrapper').click();
    await page.getByRole('button', { name: 'Criar conta' }).click();
    await expect(page).toHaveURL(/\/auth\/validacao/);
    await expect(page.locator('main, body')).toContainText(email);
    await shot(page, 'auth-validacao');

    // Antes de confirmar, o login manda de volta para a validação
    await page.goto('/auth/login');
    await page.getByLabel('E-mail').fill(email);
    await page.locator('#senha').fill(SENHA);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page).toHaveURL(/\/auth\/validacao/);
    await expect(page.locator('.auth-alert-error')).toContainText('Confirme seu e-mail');

    // Reenvio gera um novo link; o anterior deixa de valer
    await page.getByRole('button', { name: 'Reenviar e-mail de confirmação' }).click();
    await expect(page.locator('.auth-alert-success')).toBeVisible();

    await page.goto(ultimoLink('/auth/verificar', email));
    await expect(page).toHaveURL(/\/auth\/cadastro-complemento\?validado=1/);
    await expect(page.getByRole('heading', { name: 'E-mail validado' })).toBeVisible();
    await expect(page.getByLabel('E-mail')).toHaveValue(email);

    // Nenhum tipo vem pré-selecionado; os campos aparecem depois da escolha
    await expect(page.getByLabel('CNPJ')).toBeHidden();
    await page.getByText('Pessoa jurídica').click();

    // CNPJ inválido
    await page.getByLabel('Celular').fill('11987654321');
    await page.getByLabel('Razão social').fill('Buffet Teste E2E Ltda');
    await page.getByLabel('CNPJ').fill('11.222.333/0001-00');
    await page.getByLabel('Nome do buffet').fill('Buffet E2E');
    await page.getByLabel('Endereço comercial').fill('Rua das Flores, 100 - São Paulo/SP');
    await page.getByRole('button', { name: 'Finalizar e acessar a plataforma' }).click();
    await expect(page.locator('.auth-alert-error')).toContainText('CNPJ inválido');
    // O rascunho volta preenchido (inclusive o tipo escolhido)
    await expect(page.getByLabel('Razão social')).toHaveValue('Buffet Teste E2E Ltda');
    await shot(page, 'auth-complemento');

    await page.getByLabel('CNPJ').fill(cnpjAleatorio());
    await page.getByLabel('Nome do buffet').fill('Buffet E2E');
    await page.getByRole('button', { name: 'Finalizar e acessar a plataforma' }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    await expect(page.locator('.user-role')).toContainText('Proprietário');

    // Padrões da empresa nova: Kanban, template e blocos da proposta
    await page.goto('/eventos');
    await expect(page.locator('main')).toContainText('Novo');
    await page.goto('/templates');
    await expect(page.locator('main')).toContainText('Template padrão');
    await page.goto('/configuracoes/empresa');
    await expect(page.locator('input[name=nome]')).toHaveValue('Buffet E2E');
  });

  test('recupera a senha pelo link e entra com a nova senha', async ({ page }) => {
    await page.goto('/auth/recuperacao');
    await page.getByLabel('E-mail').fill(email);
    await page.getByRole('button', { name: 'Enviar' }).click();
    await expect(page.locator('.auth-alert-success')).toContainText(email);

    const link = ultimoLink('/auth/redefinir', email);
    await page.goto(link);
    await page.locator('#senha').fill(NOVA_SENHA);
    await page.getByLabel('Confirme a nova senha').fill(NOVA_SENHA);
    await page.getByRole('button', { name: 'Salvar nova senha' }).click();
    await expect(page.locator('.auth-alert-success')).toContainText('Senha alterada');

    // Link de uso único
    await page.goto(link);
    await expect(page.getByRole('heading', { name: 'Link inválido ou expirado' })).toBeVisible();

    await page.goto('/auth/login');
    await page.getByLabel('E-mail').fill(email);
    await page.locator('#senha').fill(SENHA);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.locator('.auth-alert-error')).toContainText('incorretos');
    await page.locator('#senha').fill(NOVA_SENHA);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('entra com link de acesso por e-mail', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByRole('link', { name: 'Entrar com link de acesso por e-mail' }).click();
    await page.getByLabel('E-mail').fill(email);
    await page.getByRole('button', { name: 'Enviar link de acesso' }).click();
    await expect(page.locator('.auth-alert-success')).toBeVisible();
    const link = ultimoLink('/auth/entrar', email);
    await page.goto(link);
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('.user-name')).toContainText('Teste Autoatendimento');

    // Uso único
    await page.goto('/auth/logout');
    await page.goto(link);
    await expect(page).toHaveURL(/\/auth\/link-acesso/);
    await expect(page.locator('.auth-alert-error')).toContainText('inválido');
  });
  test('empresa nova: todas as telas abrem vazias, sem erro', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByLabel('E-mail').fill(email);
    await page.locator('#senha').fill(NOVA_SENHA);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    const telas = [
      '/dashboard', '/eventos', '/eventos?view=lista', '/eventos/novo', '/agenda', '/clientes',
      '/cardapio/itens', '/cardapio/secoes', '/cardapio/opcoes', '/staff/profissionais', '/staff/servicos',
      '/templates', '/templates/blocos', '/documentos', '/documentos/novo', '/formularios', '/espacos', '/inbox', '/configuracoes/usuarios',
      '/configuracoes/categorias', '/configuracoes/status-orcamento', '/configuracoes/formatos-servico',
      '/configuracoes/modelos-email', '/configuracoes/empresa',
    ];
    for (const tela of telas) {
      const res = await page.goto(tela);
      expect(res?.status(), tela).toBe(200);
      await expect(page.locator('main'), tela).not.toContainText(/undefined|NaN|\[object Object\]|Algo deu errado/);
      await shot(page, `vazio${tela.replace(/[/?=]/g, '-')}`);
    }
  });
});
