import { expect, test, type Page } from '@playwright/test';
import { login, psql } from './helpers';

// Banket Busca, fase 4: cadastro gratuito pela vitrine e onboarding do perfil em 6 etapas (sem pacotes nem preço).
// Cria uma empresa nova no plano Busca (e-mail @example.com: nada é enviado) e a remove no fim. O plano pago (captura
// dos dados da conta e grupos de fotos) usa o buffet de demonstração Mesa Posta (seed 011, PJ no plano Essencial).

const ts = Date.now();
const EMAIL = `e2e.busca.${ts}@example.com`;
const SENHA = 'Banket.2026!';
const NOME = `E2E Buffet Onboarding ${ts}`;
const TENANT = `(SELECT tenant_id FROM tenant_usuarios WHERE usuario_id = (SELECT id FROM usuarios WHERE email = '${EMAIL}'))`;

/** CNPJ válido a partir de 12 dígitos */
function cnpj(base: string): string {
  const d = base.split('').map(Number);
  const dv = (pesos: number[]) => {
    const s = d.reduce((a, n, i) => a + n * pesos[i], 0) % 11;
    return s < 2 ? 0 : 11 - s;
  };
  d.push(dv([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]));
  d.push(dv([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]));
  return d.join('');
}
const CNPJ = cnpj(String(ts).slice(-12).padStart(12, '7'));

// PNG 2×2 válido (as fotos do teste)
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR42mP8z8DwnwEJMDHgAkwMDAAZnwIHxkmEJwAAAABJRU5ErkJggg==', 'base64');
const foto = (n: number) => ({ name: `foto-${n}.png`, mimeType: 'image/png', buffer: PNG });

async function etapa(page: Page, n: number) {
  await page.goto(`/busca?etapa=${n}`);
}
async function continuar(page: Page) {
  await page.getByRole('button', { name: /Continuar/ }).click();
}

test.describe.serial('Banket Busca: cadastro gratuito e onboarding', () => {
  test.afterAll(() => {
    psql(`DELETE FROM tenants WHERE id = ${TENANT}; DELETE FROM usuarios WHERE email = '${EMAIL}';`);
  });

  test('cadastro pela vitrine nasce no plano Busca e cai no Banket Busca', async ({ page }) => {
    await page.goto('/auth/cadastro?plano=busca');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Banket Busca');
    await page.fill('#nome', 'Bruna Onboarding');
    await page.fill('#email', EMAIL);
    await page.fill('#senha', SENHA);
    await page.fill('#confirma_senha', SENHA);
    await page.locator('#termos').evaluate((el: HTMLInputElement) => { el.checked = true; });
    await page.getByRole('button', { name: 'Criar conta' }).click();
    await page.waitForURL(/\/auth\/validacao/);
    expect(psql(`SELECT origem_cadastro FROM usuarios WHERE email = '${EMAIL}'`)).toBe('busca');

    // Confirmação do e-mail (o link fica no log do contêiner; aqui marcamos direto no banco)
    psql(`UPDATE usuarios SET email_verificado_em = now() WHERE email = '${EMAIL}'`);
    await page.goto('/auth/login');
    await page.fill('#email', EMAIL);
    await page.fill('#senha', SENHA);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForURL(/cadastro-complemento/);
    await page.getByText('Pessoa jurídica').click();
    await page.fill('#celular', '11987654321');
    await page.fill('#razao_social', `${NOME} Ltda`);
    await page.fill('#cnpj', CNPJ);
    await page.fill('#nome_empresa', NOME);
    await page.getByRole('button', { name: 'Finalizar e acessar a plataforma' }).click();
    await page.waitForURL(/\/busca$/);
    await expect(page.locator('.onb-principal form').first()).toBeVisible(); // o formulário é a própria página
    expect(psql(`SELECT p.slug || '|' || t.origem_cadastro FROM tenants t JOIN planos p ON p.id = t.plano_id WHERE t.id = ${TENANT}`)).toBe('busca|busca');
    await expect(page.locator('[data-situacao]')).toContainText('Rascunho');
    await expect(page.locator('[data-situacao]')).toContainText('0 de 5 etapas');
    // Plano gratuito: endereço = id do perfil, sem campo para trocar
    await expect(page.locator('#e-endereco')).toHaveCount(0);
    expect(psql(`SELECT (slug = id::text)::text FROM busca_perfis WHERE tenant_id = ${TENANT}`)).toBe('true');
    // Os dados da empresa vêm do cadastro (sem pedir de novo) e não há etapa de pacotes
    await expect(page.locator('.onb-empresa')).toContainText(NOME);
    await expect(page.locator('#e-nome, #e-doc, #e-email, #e-whats')).toHaveCount(0);
    await expect(page.locator('.onb-etapas')).not.toContainText('Pacotes');
  });

  test('etapas 1 a 4 com validação e o limite de 3 tipos no plano gratuito', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('#email', EMAIL);
    await page.fill('#senha', SENHA);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForURL(/\/busca/);

    // Etapa 1: nome, CNPJ, e-mail e WhatsApp vêm do cadastro da empresa; aqui só a descrição (mínimo de 80)
    await etapa(page, 1);
    await expect(page.locator('.onb-empresa')).toContainText(NOME);
    await expect(page.locator('.onb-empresa-falta')).toHaveCount(0);
    await page.fill('#e-desc', 'Curta demais.');
    await continuar(page);
    await expect(page.locator('.toast').first()).toContainText('80 caracteres');
    await page.fill('#e-desc', 'Buffet de teste com salão próprio no ABC, cozinha própria e equipe treinada para festas de todos os tamanhos.');
    await continuar(page);
    await page.waitForURL(/etapa=2/);

    // Etapa 2: no gratuito, o 4º tipo fica indisponível; forçar pelo servidor dá erro de plano
    const eventos = page.locator('[data-grupo="tipos_evento"]');
    for (const t of ['casamento', 'aniversario', 'infantil']) await eventos.locator(`label.onb-tile:has(input[value="${t}"])`).click();
    await expect(eventos.locator('input[value="formatura"]')).toBeDisabled();
    await expect(eventos.locator('[data-uso]')).toHaveText('3 de 3');
    await page.locator('[data-grupo="tipos_servico"] label.onb-tile:has(input[value="buffet_completo"])').click();
    await continuar(page);
    await page.waitForURL(/etapa=3/);

    // Etapa 3: cidade + espaço próprio
    await page.fill('#r-cidade', 'santo andre');
    await page.locator('.fbusca-sugestao', { hasText: 'Santo André · SP' }).click();
    await page.locator('input[name="espaco_proprio"]').check();
    await page.fill('#r-log', 'Rua das Figueiras');
    await page.fill('#r-num', '1240');
    await page.fill('#r-bairro', 'Vila Assunção');
    await continuar(page);
    await page.waitForURL(/etapa=4/);

    // Etapa 4: mínimo maior que o máximo é recusado
    await page.fill('#c-min', '300');
    await page.fill('#c-max', '200');
    await continuar(page);
    await expect(page.locator('.toast').first()).toContainText('mínimo não pode passar do máximo');
    await page.fill('#c-min', '40');
    await page.fill('#c-max', '250');
    await continuar(page);
    await page.waitForURL(/etapa=5/);
    expect(psql(`SELECT etapa_concluida FROM busca_perfis WHERE tenant_id = ${TENANT}`)).toBe('4');
  });

  test('limite de tipos conferido no servidor', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('#email', EMAIL);
    await page.fill('#senha', SENHA);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForURL(/\/busca/);
    await etapa(page, 2);
    // Habilita à força a 4ª opção no navegador e envia: o servidor recusa e abre o upsell
    await page.locator('input[value="formatura"]').evaluate((el: HTMLInputElement) => { el.disabled = false; el.checked = true; });
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.locator('dialog[data-upsell]')).toBeVisible();
    await expect(page.locator('dialog[data-upsell]')).toContainText('Apareça em mais buscas');
    await expect(page.locator('.toast').first()).toContainText('até 3 tipos de evento');
    expect(psql(`SELECT array_length(tipos_evento, 1) FROM busca_perfis WHERE tenant_id = ${TENANT}`)).toBe('3');
  });

  test('fotos com limite de 5, prévia só para o dono e publicação', async ({ page, browser }) => {
    test.setTimeout(60_000);
    await page.goto('/auth/login');
    await page.fill('#email', EMAIL);
    await page.fill('#senha', SENHA);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForURL(/\/busca/);

    // Cardápios e Disponibilidade com cadeado no plano gratuito
    await etapa(page, 5);
    await page.locator('.onb-etapas [data-bloqueado="busca_cardapios"]').click();
    await expect(page.locator('dialog[data-upsell]')).toContainText('Cardápios detalhados no seu perfil');
    await page.locator('dialog[data-upsell]').getByRole('button', { name: 'Fechar' }).click();

    // Etapa 5: 6 fotos de uma vez → só 5 cabem (o navegador corta; o servidor confere); sem grupos no gratuito
    await expect(page.locator('#f-grupo')).toHaveCount(0);
    await page.locator('[data-fotos-input]').setInputFiles([1, 2, 3, 4, 5, 6].map(foto));
    await expect(page.locator('[data-fotos-status]')).toContainText('Só 5 cabem');
    await page.getByRole('button', { name: 'Enviar fotos' }).click();
    await expect(page.locator('.onb-foto')).toHaveCount(5);
    await expect(page.locator('.onb-foto').first()).toContainText('Capa');
    await expect(page.locator('[data-fotos-form]')).toContainText('limite de 5 fotos');
    await expect(page.locator('.onb-foto').first()).toContainText('Grupos de fotos por evento: exclusivo Banket');

    // Prévia antes de publicar: o dono vê; anônimo recebe 404. Nenhuma menção a preço
    const slug = psql(`SELECT slug FROM busca_perfis WHERE tenant_id = ${TENANT}`);
    await page.goto(`/vitrine/buffet/${slug}?previa=1`);
    await expect(page.locator('.vp-previa')).toContainText('ainda não publicado');
    await expect(page.locator('main')).not.toContainText('R$');
    await expect(page.locator('main')).not.toContainText('por pessoa');
    const anonimo = await browser.newContext();
    expect((await anonimo.request.get(`${new URL(page.url()).origin}/vitrine/buffet/${slug}?previa=1`)).status()).toBe(404);
    await anonimo.close();

    // Etapa 6: publicar exige o aceite
    await etapa(page, 6);
    await expect(page.locator('.onb-item .onb-falta')).toHaveCount(0);
    await page.getByLabel(/termos de uso/).check();
    await page.getByRole('button', { name: 'Publicar perfil' }).click();
    await page.waitForURL(/\/busca\?etapa=6/);
    await expect(page.locator('[data-situacao]')).toContainText('Publicado');
    await page.goto(`/vitrine/buscar?tipo=infantil&cidade=santo-andre-sp&convidados=80`);
    await expect(page.locator(`[data-buffet="${slug}"]`)).toBeVisible();
    await expect(page.locator(`[data-buffet="${slug}"]`)).not.toContainText('Cliente Banket');
    await expect(page.locator(`[data-buffet="${slug}"]`)).not.toContainText('R$');

    // Excluir fotos até ficar abaixo do mínimo despublica o perfil
    await etapa(page, 5);
    for (let i = 0; i < 3; i++) {
      await page.locator('.onb-foto').last().getByRole('button', { name: 'Excluir foto' }).click();
      await page.locator('dialog.confirmar[open] [data-confirmar-ok]').click();
      await expect(page.locator('.onb-foto')).toHaveCount(4 - i);
    }
    await expect(page.locator('.toast').last()).toContainText('voltou a rascunho');
    expect(psql(`SELECT publicado::text FROM busca_perfis WHERE tenant_id = ${TENANT}`)).toBe('false');
  });

  test('plano pago: perfil acompanha o cadastro da empresa e agrupa fotos por evento', async ({ page }) => {
    const MESA = `(SELECT id FROM tenants WHERE nome = 'Mesa Posta Catering')`;
    const GRUPO = `E2E Casamento ${ts}`;
    await login(page, { email: 'contato@mesaposta.test', senha: 'Banket.2026' });
    // O perfil volta a ter os dados do cadastro da empresa ao abrir a área do Busca
    psql(`UPDATE busca_perfis SET email_contato = 'outro@example.com' WHERE tenant_id = ${MESA}`);
    await etapa(page, 1);
    await expect(page.locator('.onb-empresa')).toContainText('41.111.111/0001-03');
    await expect(page.locator('.onb-empresa')).toContainText('contato@mesaposta.test');
    expect(psql(`SELECT email_contato FROM busca_perfis WHERE tenant_id = ${MESA}`)).toBe('contato@mesaposta.test');

    // Endereço próprio (plano pago): inválido é recusado; o novo vale e o anterior redireciona
    await page.fill('#e-endereco', 'ab');
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.locator('.toast').first()).toContainText('ao menos 3');
    await page.fill('#e-endereco', `Mesa Posta E2E ${ts}`);
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.locator('#e-endereco')).toHaveValue(`mesa-posta-e2e-${ts}`);
    const r1 = await page.request.get(`/vitrine/buffet/mesa-posta-catering`, { maxRedirects: 0 });
    expect(r1.status()).toBe(301);
    expect(r1.headers().location).toContain(`/buffet/mesa-posta-e2e-${ts}`);
    await page.fill('#e-endereco', 'mesa-posta-catering');
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.locator('#e-endereco')).toHaveValue('mesa-posta-catering');
    psql(`UPDATE busca_perfis SET slugs_antigos = array_remove(slugs_antigos, 'mesa-posta-e2e-${ts}') WHERE tenant_id = ${MESA}`);

    // Fotos: sem limite e com grupo; no perfil público o grupo aparece separado
    await etapa(page, 5);
    await page.locator('[data-fotos-input]').setInputFiles([foto(1), foto(2)]);
    await page.fill('#f-grupo', GRUPO);
    await page.getByRole('button', { name: 'Enviar fotos' }).click();
    await expect(page.locator('.onb-grupo-titulo', { hasText: GRUPO })).toContainText('02');
    await page.goto('/vitrine/buffet/mesa-posta-catering');
    await expect(page.locator('.vp-fotos-grupo', { hasText: GRUPO })).toBeVisible();
    await expect(page.locator('main')).not.toContainText('R$');
    psql(`DELETE FROM busca_fotos WHERE tenant_id = ${MESA} AND '${GRUPO}' = ANY(tags)`);
  });
});
