import { expect, test } from '@playwright/test';
import { confirmarModal, expectToast, login } from './helpers';

// Drawer com envio por fetch: erro do servidor mantém o painel aberto com o que foi digitado,
// e fechar com alterações não salvas pede confirmação. Usa o cadastro de clientes.
test.describe('Drawer', () => {
  test('erro de validação preserva o painel e o conteúdo; corrigido, salva', async ({ page }) => {
    await login(page);
    await page.goto('/clientes');
    const nome = `Cliente Drawer E2E ${Date.now()}`;
    const drawer = page.locator('#drawer-cliente');

    await page.getByRole('button', { name: 'Novo cliente' }).click();
    await page.selectOption('#cli-tipo', 'PF');
    await page.fill('#cli-nome', nome);
    await page.fill('#cli-documento', '123.456.789-00');
    await page.fill('#cli-endereco', 'Rua das Flores, 10');
    await drawer.getByRole('button', { name: 'Salvar' }).click();

    // Continua aberto, com o erro junto do campo e tudo o que foi digitado
    await expect(drawer.locator('.field-erro')).toHaveText('CPF/CNPJ inválido.');
    await expect(page.locator('#cli-documento')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#cli-nome')).toHaveValue(nome);
    await expect(page.locator('#cli-endereco')).toHaveValue('Rua das Flores, 10');

    // Corrigir o campo tira o destaque; salvar fecha e recarrega com o aviso
    await page.fill('#cli-documento', '');
    await expect(drawer.locator('.field-erro')).toHaveCount(0);
    await drawer.getByRole('button', { name: 'Salvar' }).click();
    await expectToast(page, 'Cliente cadastrado.');

    // Limpeza
    await page.locator('tr', { hasText: nome }).getByRole('button', { name: 'Editar' }).click();
    await drawer.getByRole('button', { name: 'Excluir' }).click();
    await confirmarModal(page);
    await expectToast(page, 'Cliente removido.');
    await expect(page.locator('tr', { hasText: nome })).toHaveCount(0);
  });

  test('fechar com alterações pede confirmação', async ({ page }) => {
    await login(page);
    await page.goto('/clientes');
    const drawer = page.locator('#drawer-cliente');

    await page.getByRole('button', { name: 'Novo cliente' }).click();
    await page.fill('#cli-nome', 'Rascunho');
    await page.keyboard.press('Escape');
    const modal = page.locator('dialog.confirmar[open]');
    await expect(modal).toContainText('Descartar as alterações?');
    await modal.getByRole('button', { name: 'Continuar editando' }).click();
    await expect(drawer).toHaveClass(/open/);
    await expect(page.locator('#cli-nome')).toHaveValue('Rascunho');

    await drawer.getByRole('button', { name: 'Fechar' }).click();
    await modal.getByRole('button', { name: 'Descartar' }).click();
    await expect(drawer).toBeHidden();

    // Sem alterações, fecha direto
    await page.getByRole('button', { name: 'Novo cliente' }).click();
    await drawer.getByRole('button', { name: 'Fechar' }).click();
    await expect(drawer).toBeHidden();
  });

  test('prende o foco no painel e o devolve a quem abriu; menu do usuário fecha com Esc', async ({ page }) => {
    await login(page);
    await page.goto('/clientes');
    await page.getByRole('button', { name: 'Novo cliente' }).click();
    const drawer = page.locator('#drawer-cliente');
    await expect(drawer).toHaveClass(/open/);

    // Tab circula só pelos controles do painel (o fundo fica inerte)
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab');
      expect(await drawer.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    }

    // Esc fecha e o foco volta ao botão que abriu
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(page.getByRole('button', { name: 'Novo cliente' })).toBeFocused();

    // Menu do usuário: botão de verdade, abre e fecha com Esc devolvendo o foco
    const usuario = page.locator('#user-profile-btn');
    await usuario.click();
    await expect(usuario).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('menuitem', { name: 'Sair' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(usuario).toHaveAttribute('aria-expanded', 'false');
    await expect(usuario).toBeFocused();
  });
});
