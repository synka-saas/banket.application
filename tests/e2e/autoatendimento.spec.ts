import { execFileSync, spawnSync } from 'node:child_process';
import { expect, test, type Page } from '@playwright/test';

// Fluxo self-service completo. Sem RESEND_API_KEY os e-mails vão para o log do contêiner,
// de onde o teste lê os links (só funciona no ambiente local com Docker).
const CONTAINER = process.env.E2E_CONTAINER ?? 'application-webapp-1';
const SHOTS = process.env.SHOTS;
const shot = (page: Page, nome: string) => (SHOTS ? page.screenshot({ path: `${SHOTS}/${nome}.png`, fullPage: true }) : null);

function ultimoLink(caminho: string, email: string): string {
  // Só o fim do log (no Docker Desktop, --tail grande devolve um trecho antigo); stdout e stderr separados
  const r = spawnSync('docker', ['logs', '--tail', '150', CONTAINER], { encoding: 'utf8' });
  const log = `${r.stdout}\n${r.stderr}`;
  const blocos = log.split('[mail:dev]').filter((b) => b.includes(`Para: ${email}`));
  const url = blocos.at(-1)?.match(new RegExp(`https?://\\S+${caminho}\\?token=[\\w-]+`))?.[0];
  if (!url) throw new Error(`Link ${caminho} para ${email} não encontrado no log`);
  return new URL(url).pathname + new URL(url).search;
}

function psql(sql: string): string {
  return execFileSync('docker', ['exec', 'application-postgres-1', 'sh', '-c', `psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "${sql}"`], {
    encoding: 'utf8',
  }).trim();
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
    await page.getByLabel('NOME E SOBRENOME').fill('Teste Autoatendimento');
    await page.getByLabel('E-MAIL').fill(email);
    await page.locator('#senha').fill('fraca');
    await page.getByLabel('CONFIRME SUA SENHA').fill('fraca');
    await page.locator('label[for=termos]').click();
    // Senha fraca: o navegador bloqueia pelo minlength; remove para validar o servidor
    await page.locator('#senha').evaluate((el) => el.removeAttribute('minlength'));
    await page.getByRole('button', { name: 'CRIAR CONTA' }).click();
    await expect(page.locator('.auth-alert-error')).toContainText('8 caracteres');
    await expect(page.getByLabel('E-MAIL')).toHaveValue(email);

    await page.locator('#senha').fill(SENHA);
    await page.getByLabel('CONFIRME SUA SENHA').fill(SENHA);
    await page.locator('label[for=termos]').click();
    await page.getByRole('button', { name: 'CRIAR CONTA' }).click();
    await expect(page).toHaveURL(/\/auth\/validacao/);
    await expect(page.locator('main, body')).toContainText(email);
    await shot(page, 'auth-validacao');

    // Antes de confirmar, o login manda de volta para a validação
    await page.goto('/auth/login');
    await page.getByLabel('E-MAIL').fill(email);
    await page.locator('#senha').fill(SENHA);
    await page.getByRole('button', { name: 'ENTRAR', exact: true }).click();
    await expect(page).toHaveURL(/\/auth\/validacao/);
    await expect(page.locator('.auth-alert-error')).toContainText('Confirme seu e-mail');

    // Reenvio gera um novo link; o anterior deixa de valer
    await page.getByRole('button', { name: 'REENVIAR E-MAIL DE CONFIRMAÇÃO' }).click();
    await expect(page.locator('.auth-alert-success')).toBeVisible();

    await page.goto(ultimoLink('/auth/verificar', email));
    await expect(page).toHaveURL(/\/auth\/cadastro-complemento\?validado=1/);
    await expect(page.getByRole('heading', { name: 'E-mail Validado' })).toBeVisible();
    await expect(page.getByLabel('E-MAIL')).toHaveValue(email);

    // CNPJ inválido
    await page.getByLabel('CELULAR').fill('11987654321');
    await page.getByLabel('RAZÃO SOCIAL').fill('Buffet Teste E2E Ltda');
    await page.getByLabel('CNPJ').fill('11.222.333/0001-00');
    await page.getByLabel('ENDEREÇO COMERCIAL').fill('Rua das Flores, 100 - São Paulo/SP');
    await page.getByRole('button', { name: 'FINALIZAR E ACESSAR A PLATAFORMA' }).click();
    await expect(page.locator('.auth-alert-error')).toContainText('CNPJ inválido');
    // O rascunho volta preenchido
    await expect(page.getByLabel('RAZÃO SOCIAL')).toHaveValue('Buffet Teste E2E Ltda');
    await shot(page, 'auth-complemento');

    await page.getByLabel('CNPJ').fill(cnpjAleatorio());
    await page.getByLabel('NOME DO BUFFET (OPCIONAL)').fill('Buffet E2E');
    await page.getByRole('button', { name: 'FINALIZAR E ACESSAR A PLATAFORMA' }).click();
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
    await page.getByLabel('E-MAIL').fill(email);
    await page.getByRole('button', { name: 'ENVIAR' }).click();
    await expect(page.locator('.auth-alert-success')).toContainText(email);

    const link = ultimoLink('/auth/redefinir', email);
    await page.goto(link);
    await page.locator('#senha').fill(NOVA_SENHA);
    await page.getByLabel('CONFIRME A NOVA SENHA').fill(NOVA_SENHA);
    await page.getByRole('button', { name: 'SALVAR NOVA SENHA' }).click();
    await expect(page.locator('.auth-alert-success')).toContainText('Senha alterada');

    // Link de uso único
    await page.goto(link);
    await expect(page.getByRole('heading', { name: 'Link inválido ou expirado' })).toBeVisible();

    await page.goto('/auth/login');
    await page.getByLabel('E-MAIL').fill(email);
    await page.locator('#senha').fill(SENHA);
    await page.getByRole('button', { name: 'ENTRAR', exact: true }).click();
    await expect(page.locator('.auth-alert-error')).toContainText('incorretos');
    await page.locator('#senha').fill(NOVA_SENHA);
    await page.getByRole('button', { name: 'ENTRAR', exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('entra com link de acesso por e-mail', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByRole('link', { name: 'ENTRAR COM LINK DE ACESSO POR E-MAIL' }).click();
    await page.getByLabel('E-MAIL').fill(email);
    await page.getByRole('button', { name: 'ENVIAR LINK DE ACESSO' }).click();
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
});
