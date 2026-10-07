import { expect, test, type Page } from '@playwright/test';
import { confirmarModal, excluirEvento, expectToast, login, waitForIslands } from './helpers';

// Estoque: cadastro, movimentações com motivo e campos obrigatórios, item do cardápio gerenciado e lista de compras.
const ITEM_CARDAPIO = 'Bruschetta de tomate, manjericão e parmesão';

async function abrirMovimento(page: Page, item: string) {
  await page.goto(`/estoque?q=${encodeURIComponent(item)}`);
  await page.getByRole('button', { name: 'Movimentar' }).last().click();
  await expect(page.locator('#drawer-movimento')).toBeVisible();
}

async function excluirItemEstoque(page: Page, nome: string) {
  await page.goto(`/estoque?q=${encodeURIComponent(nome)}&situacao=`);
  const linha = page.locator('.data-table tbody tr', { hasText: nome }).first();
  if (!(await linha.count())) return;
  await linha.getByRole('button', { name: 'Editar' }).click();
  await page.locator('#drawer-estoque').getByRole('button', { name: 'Excluir' }).click();
  await confirmarModal(page);
  await expectToast(page, 'Item removido do estoque.');
}

test.describe('Estoque', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('cadastra, movimenta com motivos e exige os campos de cada motivo', async ({ page }) => {
    test.setTimeout(90_000);
    const nome = `E2E Farinha ${Date.now()}`;
    try {
      await page.goto('/estoque');
      await page.getByRole('button', { name: 'Novo item' }).first().click();
      const novo = page.locator('#drawer-estoque');
      await novo.locator('#es-nome').fill(nome);
      await novo.locator('#es-categoria').fill('Secos');
      await novo.locator('#es-unidade').selectOption('kg');
      await novo.locator('#es-qtd').fill('10');
      await novo.locator('#es-minimo').fill('2');
      await novo.getByRole('button', { name: 'Salvar' }).click();
      await expectToast(page, 'Item adicionado ao estoque.');
      await page.goto(`/estoque?q=${encodeURIComponent(nome)}`);
      await expect(page.locator('.data-table tbody tr', { hasText: nome })).toContainText('10 kg');

      // Compra exige fornecedor e nota fiscal
      await abrirMovimento(page, nome);
      const drawer = page.locator('#drawer-movimento');
      await drawer.locator('#mv-razao').selectOption('compra');
      await expect(drawer.locator('#mv-fornecedor')).toBeVisible();
      await expect(drawer.locator('#mv-evento')).toBeHidden();
      await drawer.locator('#mv-qtd').fill('5');
      await drawer.locator('#mv-custo').fill('6,00');
      await drawer.locator('#mv-fornecedor').fill('Atacadão E2E');
      await drawer.locator('#mv-documento').fill('NF-123');
      await drawer.getByRole('button', { name: 'Registrar' }).click();
      await expectToast(page, `Saldo de ${nome}: 15 kg`);

      // Perda exige justificativa (validação do servidor também, com o required removido)
      await abrirMovimento(page, nome);
      await page.locator('#drawer-movimento input[name=tipo][value=saida]').check();
      await drawer.locator('#mv-razao').selectOption('perda');
      await drawer.locator('#mv-qtd').fill('1');
      await page.keyboard.press('Tab');
      await expect(drawer.locator('#mv-obs')).toBeVisible();
      await expect(drawer.locator('#mv-obs')).toHaveAttribute('required', '');
      await drawer.locator('#mv-obs').evaluate((el) => ((el as HTMLInputElement).required = false));
      await drawer.getByRole('button', { name: 'Registrar' }).click();
      await expect(drawer).toContainText('Descreva a justificativa.');
      await drawer.locator('#mv-obs').fill('Embalagem rasgada');
      await drawer.getByRole('button', { name: 'Registrar' }).click();
      await expectToast(page, `Saldo de ${nome}: 14 kg`);

      // Saída maior que o saldo é recusada
      await abrirMovimento(page, nome);
      await page.locator('#drawer-movimento input[name=tipo][value=saida]').check();
      await drawer.locator('#mv-razao').selectOption('consumo_interno');
      await drawer.locator('#mv-qtd').fill('100');
      await drawer.getByRole('button', { name: 'Registrar' }).click();
      await expect(drawer).toContainText('Saída maior que o saldo');
      await page.keyboard.press('Escape');

      // Contagem física define o saldo
      await abrirMovimento(page, nome);
      await page.locator('#drawer-movimento input[name=tipo][value=ajuste]').check();
      await expect(drawer.locator('#mv-razao')).toBeHidden();
      await drawer.locator('#mv-qtd').fill('12,5');
      await drawer.getByRole('button', { name: 'Registrar' }).click();
      await expectToast(page, `Saldo de ${nome}: 12,5 kg`);

      // Histórico com motivo, fornecedor/NF e custo médio (10 kg sem custo + 5 kg a R$ 6 → R$ 6)
      await page.goto(`/estoque/movimentos?q=${encodeURIComponent(nome)}`);
      const tabela = page.locator('.data-table');
      await expect(tabela).toContainText('Compra / nota fiscal de fornecedor');
      await expect(tabela).toContainText('Atacadão E2E · NF NF-123');
      await expect(tabela).toContainText('Perda / vencimento / descarte');
      await expect(tabela).toContainText('Embalagem rasgada');
      await expect(tabela).toContainText('Contagem física (inventário)');
    } finally {
      await excluirItemEstoque(page, nome);
    }
  });

  test('item do cardápio gerenciado no estoque marca a lista de compras', async ({ page }) => {
    test.setTimeout(120_000);
    let eventoUrl: string | null = null;
    try {
      // Liga "Gerenciado no estoque" no item do cardápio (porção 2 un/pessoa nos dados atuais)
      await page.goto(`/cardapio/itens?q=${encodeURIComponent(ITEM_CARDAPIO)}`);
      await page.getByRole('button', { name: 'Editar' }).first().click();
      await page.getByLabel('Porção por pessoa').fill('2');
      await page.getByLabel('Unidade da porção').selectOption('un');
      await page.getByLabel('Gerenciado no estoque').check();
      await page.getByRole('button', { name: 'Salvar' }).click();
      await expectToast(page, 'Item atualizado.');

      await page.goto(`/estoque?q=${encodeURIComponent(ITEM_CARDAPIO)}`);
      const linha = page.locator('.data-table tbody tr', { hasText: ITEM_CARDAPIO });
      await expect(linha).toContainText('Cardápio');
      await abrirMovimento(page, ITEM_CARDAPIO);
      await page.locator('#drawer-movimento input[name=tipo][value=ajuste]').check();
      await page.locator('#drawer-movimento #mv-qtd').fill('200');
      await page.locator('#drawer-movimento').getByRole('button', { name: 'Registrar' }).click();
      await expectToast(page, '200 un');

      // Evento com 50 convidados e a seção Coquetel: 2 un × 50 = 100 ≤ 200 em estoque
      await page.goto('/eventos/novo');
      await page.getByLabel('Cliente*').selectOption({ label: 'Maria Eduarda Silva' });
      await page.getByLabel('Título do evento').fill(`E2E Estoque ${Date.now()}`);
      await page.getByLabel('Convidados', { exact: true }).fill('50');
      await page.getByRole('button', { name: 'Criar evento' }).first().click();
      await expectToast(page, 'Evento criado.');
      eventoUrl = page.url();
      await page.getByRole('button', { name: 'Criar orçamento' }).click();
      await waitForIslands(page);
      await page.getByRole('button', { name: /Adicionar cardápio/ }).click();
      await page.getByRole('combobox', { name: /Adicionar cardápio/ }).fill('zero');
      await page.keyboard.press('Enter');
      await page.getByRole('button', { name: /Adicionar seção/ }).click();
      await page.getByRole('combobox', { name: /Adicionar seção/ }).fill('coquetel');
      await page.keyboard.press('Enter');
      await expect(page.locator('.orc-estado')).toHaveText('Todas as alterações salvas', { timeout: 10_000 });

      await page.getByRole('link', { name: 'Lista de compras' }).click();
      await waitForIslands(page);
      const compra = page.locator('.compras-tabela tbody tr', { hasText: ITEM_CARDAPIO });
      await expect(compra.locator('.compras-estoque')).toContainText('Em estoque');
      // Ajustar para 250 passa do saldo: faltam 50
      await compra.getByLabel(`Quantidade de ${ITEM_CARDAPIO}`).fill('250');
      await page.keyboard.press('Enter');
      await expect(compra.locator('.compras-estoque')).toContainText('Faltam 50 un');
    } finally {
      if (eventoUrl) await excluirEvento(page, eventoUrl);
      // Excluir o item de estoque desliga o "Gerenciado no estoque" do item do cardápio
      await excluirItemEstoque(page, ITEM_CARDAPIO);
      await page.goto(`/cardapio/itens?q=${encodeURIComponent(ITEM_CARDAPIO)}`);
      await page.getByRole('button', { name: 'Editar' }).first().click();
      await expect(page.getByLabel('Gerenciado no estoque')).not.toBeChecked();
    }
  });
});
