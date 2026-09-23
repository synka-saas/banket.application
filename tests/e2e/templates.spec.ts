import { expect, test, type Page } from '@playwright/test';
import { excluirEvento, expectToast, login, waitForIslands } from './helpers';

const SHOTS = process.env.SHOTS;
const shot = (page: Page, nome: string) => (SHOTS ? page.screenshot({ path: `${SHOTS}/${nome}.png`, fullPage: true }) : null);

// PNG 1×1 para o upload de logo
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

test.describe('Templates, blocos e PDF', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('cria, edita, duplica e exclui template; PDF de exemplo', async ({ page, request }) => {
    const nome = `E2E Template ${Date.now()}`;
    await page.goto('/templates');
    await shot(page, 'templates-lista');
    await page.getByRole('link', { name: /Criar novo template/i }).click();
    await page.getByLabel('Nome do template').fill(nome);
    await page.getByLabel('Descrição').fill('Criado pelo teste');
    await page.getByLabel('Título capa').fill('Proposta E2E');
    await page.locator('input[name=logo_path]').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: PNG });
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expectToast(page, 'Template criado.');
    await expect(page.getByLabel('Nome do template')).toHaveValue(nome);
    // A logo enviada aparece na pré-visualização
    await expect(page.locator('.preview.capa img[data-img=logo_path]').first()).toBeVisible();
    await shot(page, 'template-editor');
    const templateUrl = page.url();

    // PDF de exemplo
    const pdf = await page.request.get(`${templateUrl}/exemplo`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()['content-type']).toContain('application/pdf');
    expect((await pdf.body()).subarray(0, 4).toString()).toBe('%PDF');

    // Duplicar e excluir a cópia
    await page.getByRole('button', { name: 'Duplicar' }).click();
    await expectToast(page, 'Template duplicado.');
    expect(page.url()).not.toBe(templateUrl);
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Excluir' }).click();
    await expectToast(page, 'Template excluído.');

    // Excluir o original
    await page.goto(templateUrl);
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Excluir' }).click();
    await expectToast(page, 'Template excluído.');
    await expect(page.locator('main')).not.toContainText(nome);

    // A rota de impressão não abre sem token válido
    const print = await request.get(`/print/template/${templateUrl.split('/').pop()}?token=invalido`);
    expect(print.status()).toBe(401);
  });

  test('CRUD de blocos de informação com pré-visualização', async ({ page }) => {
    const titulo = `E2E Bloco ${Date.now()}`;
    await page.goto('/templates/blocos?novo=1');
    await page.getByLabel('Título*').fill(titulo);
    await page.getByLabel('Conteúdo').fill('## Subtítulo\n- item **forte**');
    await expect(page.locator('[data-previa] h4')).toHaveText('Subtítulo');
    await expect(page.locator('[data-previa] strong')).toHaveText('forte');
    await page.getByLabel('Página a ser inserido').selectOption('condicoes');
    await page.getByLabel('Incluído por padrão em novos orçamentos').uncheck();
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expectToast(page, 'Bloco criado.');
    await expect(page.locator('.chip-bloco.atual')).toHaveText(new RegExp(titulo, 'i'));
    await shot(page, 'template-blocos');

    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Excluir' }).click();
    await expectToast(page, 'Bloco removido.');
    await expect(page.locator('.chip-bloco', { hasText: titulo })).toHaveCount(0);
  });

  test('textos da proposta, PDF da versão e reaproveitamento na versão congelada', async ({ page }) => {
    await page.goto('/eventos/novo');
    await page.getByLabel('Cliente*').selectOption({ label: 'Maria Eduarda Silva' });
    await page.getByLabel('Título do evento').fill(`E2E PDF ${Date.now()}`);
    await page.getByLabel('Convidados', { exact: true }).fill('60');
    await page.getByRole('button', { name: 'Criar evento' }).first().click();
    await expectToast(page, 'Evento criado.');
    await page.getByRole('button', { name: 'Confeccionar orçamento' }).click();
    await expectToast(page, 'Orçamento iniciado');
    const base = page.url().replace(/\?.*$/, '');
    const eventoBase = base.replace(/\/orcamento$/, '');

    // Template da proposta
    const select = page.getByLabel('Template da proposta');
    await expect(select).toBeVisible();

    // Textos: desmarca e remarca um bloco na aba Condições gerais
    await page.goto(`${eventoBase}/condicoes-gerais`);
    await waitForIslands(page);
    const primeiro = page.locator('.textos-proposta .texto-item input[type=checkbox]').first();
    const marcado = await primeiro.isChecked();
    await primeiro.setChecked(!marcado);
    await expect(page.locator('.textos-proposta .orc-estado')).toHaveText('Todas as alterações salvas', { timeout: 10_000 });
    await page.reload();
    await waitForIslands(page);
    await expect(page.locator('.textos-proposta .texto-item input[type=checkbox]').first()).toBeChecked({ checked: !marcado });
    await shot(page, 'condicoes-textos');

    // PDF da versão atual
    const v1 = await page.request.get(`${base}/pdf?versao=1`);
    expect(v1.status()).toBe(200);
    expect(v1.headers()['content-type']).toContain('application/pdf');
    expect(v1.headers()['content-disposition']).toContain('attachment');
    const corpo1 = await v1.body();
    expect(corpo1.subarray(0, 4).toString()).toBe('%PDF');

    // Nova versão congela a 01; o PDF dela passa a ser o arquivo salvo
    await page.goto(base);
    await waitForIslands(page);
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Criar nova versão' }).click();
    await expectToast(page, 'Versão 02 criada.');
    const congelada = await page.request.get(`${base}/pdf?versao=1`);
    expect(congelada.status()).toBe(200);
    expect((await congelada.body()).equals(corpo1)).toBe(true);

    // Botão do cabeçalho baixa o PDF da versão atual
    await waitForIslands(page);
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Salvar e baixar PDF' }).click()]);
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
    await shot(page, 'orcamento-pdf');

    await excluirEvento(page, eventoBase);
  });
});
