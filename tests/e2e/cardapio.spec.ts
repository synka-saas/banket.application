import { expect, test } from '@playwright/test';
import { expectToast, login, waitForIslands } from './helpers';

test.describe('Cardápio', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('cria, edita, duplica e exclui uma opção de cardápio pelo editor', async ({ page }) => {
    const nome = `E2E Coquetel ${Date.now()}`;
    await page.goto('/cardapio/opcoes');
    await waitForIslands(page);
    await page.getByRole('button', { name: 'Criar cardápio' }).click();

    const editor = page.locator('.ed-drawer');
    await expect(editor).toBeVisible();
    await editor.getByLabel('Nome do cardápio').fill(nome);
    await editor.getByLabel('Preço base por pessoa').fill('45,90');
    await editor.getByLabel('Sessão do catálogo').selectOption({ label: 'Coquetel (7 itens)' });
    await editor.getByRole('button', { name: /Adicionar sessão/ }).click();

    const secao = editor.locator('.ed-secao').first();
    await expect(secao).toContainText('Coquetel');
    // Todos os itens ativos entram marcados; desmarca um
    await secao.getByLabel('Steak tartar').uncheck();
    await secao.getByLabel('Quantidade de itens que o cliente escolhe').fill('3');
    await editor.getByRole('button', { name: 'Salvar' }).click();

    await expectToast(page, 'Cardápio criado.');
    const card = page.locator('.info-card', { hasText: nome });
    await expect(card).toContainText('R$ 45,90');
    await expect(card).toContainText('06'); // 7 itens da sessão Coquetel menos 1

    // Edita: remove a sessão e tenta salvar sem sessões (deve recusar)
    await card.getByRole('button', { name: 'Editar' }).click();
    await expect(editor.getByLabel('Nome do cardápio')).toHaveValue(nome);
    await editor.locator('.ed-secao').first().getByRole('button', { name: /Remover/ }).click();
    await editor.getByRole('button', { name: 'Salvar' }).click();
    await expectToast(page, 'Adicione pelo menos uma sessão ao cardápio.');

    // Duplica e depois exclui as duas
    await editor.getByRole('button', { name: 'Duplicar' }).click();
    await expectToast(page, 'Cardápio duplicado.');
    for (const titulo of [`${nome} (cópia)`, nome]) {
      await waitForIslands(page);
      page.once('dialog', (d) => d.accept());
      await page.locator('.info-card', { hasText: titulo }).last().getByRole('button', { name: 'Editar' }).click();
      await page.locator('.ed-drawer').getByRole('button', { name: 'Excluir' }).click();
      await expectToast(page, 'Cardápio removido.');
    }
    await expect(page.locator('.info-card', { hasText: nome })).toHaveCount(0);
  });

  test('cria e remove um item pelo drawer', async ({ page }) => {
    const nome = `E2E Coxinha ${Date.now()}`;
    await page.goto('/cardapio/itens');
    await page.getByRole('button', { name: 'Adicionar item' }).click();
    const drawer = page.locator('#drawer-item');
    await drawer.getByLabel('Nome do item*').fill(nome);
    await drawer.getByLabel('Sessão*').selectOption({ label: 'Coquetel' });
    await drawer.getByLabel('Preço de venda (R$)').fill('9,90');
    await drawer.getByLabel('Sem lactose').check();
    await drawer.getByRole('button', { name: 'Salvar' }).click();
    await expectToast(page, 'Item criado.');

    await page.getByPlaceholder(/Pesquisar/).fill(nome);
    await page.getByPlaceholder(/Pesquisar/).press('Enter');
    const linha = page.locator('tr', { hasText: nome });
    await expect(linha).toContainText('R$ 9,90');
    await linha.getByRole('button', { name: 'Editar' }).click();
    await expect(drawer.getByLabel('Sem lactose')).toBeChecked();
    page.once('dialog', (d) => d.accept());
    await drawer.getByRole('button', { name: 'Excluir' }).click();
    await expectToast(page, 'Item removido.');
  });
});
