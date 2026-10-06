import { expect, test } from '@playwright/test';
import { confirmarModal, excluirEvento, expectToast, login, waitForIslands } from './helpers';

// Modelos de e-mail (Configurações): CRUD, um único padrão e o select "Modelo" no envio da proposta.

const sufixo = Date.now();
const NOME = `E2E Lembrete ${sufixo}`;

test.describe('Modelos de e-mail', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('cria um modelo, define como padrão, usa no envio e remove', async ({ page }) => {
    await page.goto('/configuracoes/modelos-email');
    await expect(page.locator('main')).toContainText('Proposta padrão');

    await page.getByRole('button', { name: 'Novo modelo' }).first().click();
    const drawer = page.locator('#drawer-modelo');
    await expect(drawer).toBeVisible();
    await drawer.getByLabel('Nome do modelo*').fill(NOME);
    await drawer.getByLabel('Assunto*').fill(`Lembrete: proposta para {evento} ${sufixo}`);
    await drawer.getByLabel('Mensagem*').fill('Olá {nome_cliente}, a proposta de {valor_total} vale até breve.');
    // Chip insere a variável no cursor e a prévia mostra o exemplo
    await drawer.getByRole('button', { name: '{empresa}' }).click();
    await expect(drawer.getByLabel('Mensagem*')).toHaveValue(/\{empresa\}$/);
    await expect(drawer.locator('[data-previa-corpo]')).toContainText('Olá Maria Souza, a proposta de R$ 25.400,00');
    await drawer.getByRole('button', { name: 'Salvar' }).click();
    await expectToast(page, 'Modelo criado.');
    await expect(page.locator('main')).toContainText(NOME);

    // Definir como padrão: só um padrão por empresa
    const linha = page.locator('tbody tr', { hasText: NOME });
    await linha.getByRole('button', { name: 'Definir como padrão' }).click();
    await expectToast(page, 'Modelo padrão atualizado.');
    await expect(page.locator('tbody tr', { hasText: NOME })).toContainText('Padrão');
    await expect(page.locator('tbody .badge-accent')).toHaveCount(1);

    // No envio da proposta, o modelo padrão preenche o assunto com as variáveis aplicadas
    await page.goto('/eventos/novo');
    await page.getByLabel('Cliente*').selectOption({ label: 'Maria Eduarda Silva' });
    await page.getByLabel('Título do evento').fill(`E2E Modelo ${sufixo}`);
    await page.getByLabel('Convidados', { exact: true }).fill('50');
    await page.getByRole('button', { name: 'Criar evento' }).first().click();
    await expectToast(page, 'Evento criado.');
    const eventoUrl = page.url();
    await page.getByRole('button', { name: 'Criar orçamento' }).click();
    await expectToast(page, 'Orçamento iniciado');
    await waitForIslands(page);
    await page.getByRole('button', { name: 'Enviar ao cliente' }).click();
    const envio = page.locator('#drawer-enviar');
    await expect(envio).toBeVisible();
    await expect(envio.getByLabel('Modelo')).toHaveValue(/[0-9a-f-]{36}/);
    await expect(envio.getByLabel('Assunto*')).toHaveValue(new RegExp(`^Lembrete: proposta para .+ ${sufixo}$`));
    await expect(envio.getByLabel('Mensagem*')).toHaveValue(/^Olá .+, a proposta de R\$\s.+ vale até breve\./);
    // Trocar para o modelo original preenche de novo
    await envio.getByLabel('Modelo').selectOption({ label: 'Proposta padrão' });
    await expect(envio.getByLabel('Assunto*')).toHaveValue(/^Proposta de orçamento - /);

    await excluirEvento(page, eventoUrl);

    // Remover: o padrão volta para o modelo restante
    await page.goto('/configuracoes/modelos-email');
    await page.locator('tbody tr', { hasText: NOME }).getByRole('button', { name: 'Editar' }).click();
    await drawer.getByRole('button', { name: 'Excluir' }).click();
    await confirmarModal(page);
    await expectToast(page, 'Modelo removido.');
    await expect(page.locator('main')).not.toContainText(NOME);
    await expect(page.locator('tbody tr', { hasText: 'Proposta padrão' })).toContainText('Padrão');
  });
});
