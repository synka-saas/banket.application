import { expect, test } from '@playwright/test';
import { confirmarModal, excluirEvento, expectToast, login, waitForIslands } from './helpers';

// Documentos: modelo com variáveis e campo extra (editor com barra de formatação e prévia), geração no evento
// com preenchimento do campo, PDF numerado, envio pelo Inbox e exclusão.

const sufixo = Date.now();
const NOME = `E2E Termo ${sufixo}`;

test.describe('Documentos', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('cria o modelo, gera o documento no evento, baixa o PDF, envia e exclui', async ({ page }) => {
    test.setTimeout(150_000);
    // Modelo: a barra de formatação aplica a marcação e a prévia mostra os dados de exemplo
    await page.goto('/documentos/novo');
    await page.getByLabel('Nome do modelo*').fill(NOME);
    await page.getByLabel('Título do documento*').fill('Termo de reserva – {evento}');
    const corpo = page.getByLabel('Conteúdo', { exact: false }).first();
    const area = page.locator('textarea[name="corpo"]');
    await area.fill('Cliente {cliente} reserva a data {data_evento_extenso} em {numero_parcelas} parcelas.\nValor: {valor_total}');
    await area.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(0, 7));
    await page.getByRole('button', { name: 'Negrito' }).click();
    await expect(area).toHaveValue(/^\*\*Cliente\*\* \{cliente\}/);
    await expect(page.locator('[data-previa-corpo]')).toContainText('Ana Souza reserva a data 20 de novembro de 2027 em [Numero parcelas] parcelas.');
    await expect(page.locator('[data-campos-extras]')).toContainText('Numero parcelas');
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expectToast(page, 'Modelo criado.');
    await expect(page).toHaveURL(/\/documentos\/[0-9a-f-]{36}$/);
    const modeloUrl = page.url();
    expect(corpo).toBeTruthy();

    // PDF de exemplo
    const exemplo = await page.request.get(`${modeloUrl}/exemplo`);
    expect(exemplo.status()).toBe(200);
    expect(exemplo.headers()['content-type']).toContain('application/pdf');
    expect((await exemplo.body()).subarray(0, 4).toString()).toBe('%PDF');

    // Evento com orçamento, para as variáveis terem valor
    await page.goto('/eventos/novo');
    await page.getByLabel('Cliente*').selectOption({ label: 'Maria Eduarda Silva' });
    await page.getByLabel('Título do evento').fill(`E2E Documento ${sufixo}`);
    await page.getByLabel('Convidados', { exact: true }).fill('50');
    await page.getByLabel('Data', { exact: true }).fill('2027-03-20');
    await page.getByRole('button', { name: 'Criar evento' }).first().click();
    await expectToast(page, 'Evento criado.');
    const eventoUrl = page.url();
    await page.getByRole('button', { name: 'Criar orçamento' }).click();
    await expectToast(page, 'Orçamento iniciado');
    await waitForIslands(page);

    // Gerar: o campo extra é obrigatório e aparece ao escolher o modelo
    await page.goto(`${eventoUrl}/documentos`);
    await page.getByRole('button', { name: 'Gerar documento' }).first().click();
    const drawer = page.locator('#drawer-gerar-doc');
    await drawer.getByLabel('Modelo*').selectOption({ label: NOME });
    await expect(drawer.getByLabel('Numero parcelas*')).toBeVisible();
    await drawer.getByLabel('Numero parcelas*').fill('3 (três)');
    await drawer.getByRole('button', { name: 'Gerar PDF' }).click();
    await expect(page.locator('.toast').filter({ hasText: /Documento \d{4}\/\d{4} gerado/ })).toBeVisible({ timeout: 30_000 });
    const linha = page.locator('tbody tr').first();
    await expect(linha).toContainText(`Termo de reserva – E2E Documento ${sufixo}`);
    await expect(linha).toContainText(NOME);

    // PDF do documento
    const href = await linha.getByRole('link', { name: 'Baixar' }).getAttribute('href');
    const pdf = await page.request.get(href!);
    expect(pdf.status()).toBe(200);
    expect((await pdf.body()).subarray(0, 4).toString()).toBe('%PDF');

    // Linha do tempo registra a geração
    await page.goto(`${eventoUrl}/linha-do-tempo`);
    await expect(page.locator('main')).toContainText('gerado: Termo de reserva');

    // Enviar por e-mail (domínio reservado: fica no log) abre a conversa no Inbox
    await page.goto(`${eventoUrl}/documentos`);
    await page.locator('tbody tr').first().getByRole('button', { name: 'Enviar' }).click();
    const envio = page.locator('#drawer-enviar-doc');
    await envio.getByLabel('Para*').fill('cliente-doc@example.com');
    await envio.getByLabel('Mensagem*').fill('Segue o termo de reserva para assinatura.');
    await envio.getByRole('button', { name: 'Enviar', exact: true }).click();
    await expectToast(page, /Envio registrado|Documento enviado/);
    await page.goto(`${eventoUrl}/mensagens`);
    await expect(page.locator('.mensagem-anexo')).toContainText('Termo de reserva');

    // Excluir o documento
    await page.goto(`${eventoUrl}/documentos`);
    await page.locator('tbody tr').first().getByRole('button', { name: 'Excluir' }).click();
    await confirmarModal(page);
    await expectToast(page, 'Documento excluído.');
    await expect(page.locator('main')).toContainText('Nenhum documento gerado');

    // Limpeza: evento e modelo
    await excluirEvento(page, eventoUrl);
    await page.goto(modeloUrl);
    await page.getByRole('button', { name: 'Excluir' }).click();
    await confirmarModal(page);
    await expectToast(page, 'Modelo excluído.');
  });

  test('usuário comum não edita modelos, mas vê a lista', async ({ page }) => {
    await page.context().clearCookies();
    await login(page, { email: 'operacao@banket.com.br', senha: 'Banket.2026' });
    await page.goto('/documentos');
    await expect(page.locator('main')).toContainText('Contrato de prestação de serviços');
    await expect(page.getByRole('link', { name: 'Novo modelo' })).toHaveCount(0);
    await page.goto('/documentos/novo');
    await expect(page).toHaveURL(/\/documentos$/);
    await expectToast(page, 'Só proprietários e administradores editam');
  });
});
