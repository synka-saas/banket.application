import { expect, test } from '@playwright/test';
import { expectToast, login } from './helpers';

// Minha conta (UX-154): perfil, troca de senha e empresas do usuário.
test.describe('Minha conta', () => {
  test('atualiza o telefone, recusa senha atual errada e lista as empresas', async ({ page }) => {
    await login(page);
    await page.locator('#user-profile-btn').click();
    await page.getByRole('menuitem', { name: 'Minha conta' }).click();
    await expect(page).toHaveURL(/\/conta$/);
    await expect(page.locator('#ct-email')).toHaveValue('leandro@banket.com.br');

    // Perfil
    const original = await page.locator('#ct-telefone').inputValue();
    await page.locator('#ct-telefone').fill('11987654321');
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expectToast(page, 'Dados da conta atualizados.');
    await expect(page.locator('#ct-telefone')).toHaveValue('(11) 98765-4321');

    // Senha atual errada não troca a senha
    await page.locator('#ct-senha-atual').fill('senha-errada-123!');
    await page.locator('#ct-senha').fill('Banket.2027!');
    await page.locator('#ct-confirma').fill('Banket.2027!');
    await page.getByRole('button', { name: 'Alterar senha' }).click();
    await expectToast(page, 'A senha atual não confere.');

    // Empresas da conta
    await expect(page.locator('.empresas')).toContainText('Banket');
    await expect(page.locator('.empresas')).toContainText('Empresa atual');

    // Restaura o telefone
    await page.locator('#ct-telefone').fill(original);
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expectToast(page, 'Dados da conta atualizados.');
  });
});
