import { expect, test } from '@playwright/test';
import { confirmarModal, expectToast, login, waitForIslands } from './helpers';

test.describe('Cardápio', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('cria, edita, duplica e exclui uma opção de cardápio pelo editor', async ({ page }) => {
    const nome = `E2E Coquetel ${Date.now()}`;
    await page.goto('/cardapio/opcoes');
    await waitForIslands(page);
    await page.getByRole('button', { name: 'Nova opção de cardápio' }).click();

    const editor = page.locator('.ed-drawer');
    await expect(editor).toBeVisible();
    await editor.getByLabel('Nome do cardápio').fill(nome);
    await editor.getByLabel('Preço base por pessoa').fill('45,90');
    // O rótulo traz a contagem de itens, que varia com o catálogo
    const opcaoCoquetel = editor.getByLabel('Seção do catálogo').locator('option', { hasText: /^Coquetel \(/ });
    const itensCoquetel = Number((await opcaoCoquetel.textContent())!.match(/\((\d+) itens\)/)![1]);
    await editor.getByLabel('Seção do catálogo').selectOption((await opcaoCoquetel.getAttribute('value'))!);
    await editor.getByRole('button', { name: /Adicionar seção/ }).click();

    const secao = editor.locator('.ed-secao').first();
    await expect(secao).toContainText('Coquetel');
    // Todos os itens ativos entram marcados; desmarca um
    await secao.getByLabel('Steak tartar').uncheck();
    await secao.getByLabel('Quantidade de itens que o cliente escolhe').fill('3');
    await editor.getByRole('button', { name: 'Salvar' }).click();

    await expectToast(page, 'Cardápio criado.');
    const card = page.locator('.info-card', { hasText: nome });
    await expect(card).toContainText('R$ 45,90');
    await expect(card).toContainText(String(itensCoquetel - 1).padStart(2, '0')); // itens da seção Coquetel menos o desmarcado

    // Edita: remove a seção e tenta salvar sem seções (deve recusar)
    await card.getByRole('button', { name: 'Editar' }).click();
    await expect(editor.getByLabel('Nome do cardápio')).toHaveValue(nome);
    await editor.locator('.ed-secao').first().getByRole('button', { name: /Remover/ }).click();
    await editor.getByRole('button', { name: 'Salvar' }).click();
    await expectToast(page, 'Adicione pelo menos uma seção ao cardápio.');

    // Duplica e depois exclui as duas
    await editor.getByRole('button', { name: 'Duplicar' }).click();
    await expectToast(page, 'Cardápio duplicado.');
    for (const titulo of [`${nome} (cópia)`, nome]) {
      await waitForIslands(page);
      await page.locator('.info-card', { hasText: titulo }).last().getByRole('button', { name: 'Editar' }).click();
      await page.locator('.ed-drawer').getByRole('button', { name: 'Excluir' }).click();
      await confirmarModal(page);
      await expectToast(page, 'Cardápio removido.');
    }
    await expect(page.locator('.info-card', { hasText: nome })).toHaveCount(0);
  });

  test('cria e remove um item pelo drawer', async ({ page }) => {
    const nome = `E2E Coxinha ${Date.now()}`;
    await page.goto('/cardapio/itens');
    await page.getByRole('button', { name: 'Novo item' }).click();
    const drawer = page.locator('#drawer-item');
    await drawer.getByLabel('Nome do item*').fill(nome);
    await drawer.getByLabel('Seção*').selectOption({ label: 'Coquetel' });
    await drawer.getByLabel('Preço de venda (R$)').fill('9,90');
    await drawer.getByLabel('Sem lactose').check();
    await drawer.getByRole('button', { name: 'Salvar' }).click();
    await expectToast(page, 'Item criado.');

    await page.getByPlaceholder(/Pesquisar/).fill(nome);
    await page.getByPlaceholder(/Pesquisar/).press('Enter');
    const linha = page.locator('tr', { hasText: nome }).filter({ hasNotText: 'cópia' });
    await expect(linha).toContainText('R$ 9,90');

    // Duplicar: cópia na mesma seção, com os mesmos dados
    await linha.getByRole('button', { name: 'Editar' }).click();
    await expect(drawer.locator('.drawer-title')).toHaveText(`Editar item · ${nome}`);
    await drawer.getByRole('button', { name: 'Duplicar' }).click();
    await expectToast(page, `Item duplicado como "${nome} (cópia)".`);
    const copia = page.locator('tr', { hasText: `${nome} (cópia)` });
    await expect(copia).toContainText('R$ 9,90');
    await copia.getByRole('button', { name: 'Editar' }).click();
    await expect(drawer.getByLabel('Sem lactose')).toBeChecked();
    await drawer.getByRole('button', { name: 'Excluir' }).click();
    await confirmarModal(page);
    await expectToast(page, 'Item removido.');

    await linha.getByRole('button', { name: 'Editar' }).click();
    await expect(drawer.getByLabel('Sem lactose')).toBeChecked();
    await drawer.getByRole('button', { name: 'Excluir' }).click();
    await confirmarModal(page);
    await expectToast(page, 'Item removido.');
    await expect(page.locator('tr', { hasText: nome })).toHaveCount(0);
  });
});
