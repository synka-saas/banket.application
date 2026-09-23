import { expect, test } from '@playwright/test';
import { expectToast, login } from './helpers';

test.describe('Staff', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('serviço: simula o dimensionamento, cria, valida e exclui', async ({ page }) => {
    const funcao = `E2E Recepcionista ${Date.now()}`;
    await page.goto('/staff/servicos');
    await page.getByRole('button', { name: 'Adicionar serviço' }).click();
    const drawer = page.locator('#drawer-servico');

    await drawer.getByLabel('Função*').fill(funcao);
    await drawer.getByLabel('Cachê / diária (R$)*').fill('200,00');
    await drawer.getByLabel('Auxílio (R$)').fill('50');
    await drawer.getByLabel('1 profissional a cada (convidados)').fill('40');
    await drawer.locator('#sv-sim').fill('100');
    // 100 / 40 = 2,5 → 3 profissionais × R$ 250,00
    await expect(drawer.locator('[data-sim-resultado]')).toHaveText(/3 profissionais × R\$\s250,00 = R\$\s750,00/);

    // Regra por evento esconde a proporção e usa quantidade fixa
    await drawer.getByLabel('Quantidade fixa por evento').check();
    await expect(drawer.getByLabel('1 profissional a cada (convidados)')).toBeHidden();
    await drawer.getByLabel('Profissionais por evento').fill('2');
    await expect(drawer.locator('[data-sim-resultado]')).toHaveText(/2 profissionais × R\$\s250,00 = R\$\s500,00/);

    await drawer.getByRole('button', { name: 'Salvar' }).click();
    await expectToast(page, 'Serviço criado.');
    const card = page.locator('.info-card', { hasText: funcao });
    await expect(card).toContainText('02 profissionais');

    await card.getByRole('button', { name: 'Editar' }).click();
    page.once('dialog', (d) => d.accept());
    await drawer.getByRole('button', { name: 'Excluir' }).click();
    await expectToast(page, 'Serviço removido.');
    await expect(page.locator('.info-card', { hasText: funcao })).toHaveCount(0);
  });

  test('profissional: cadastra, troca especialidade inline e rejeita CPF inválido', async ({ page }) => {
    const nome = `E2E Profissional ${Date.now()}`;
    await page.goto('/staff/profissionais');
    await page.getByRole('button', { name: 'Adicionar profissional' }).click();
    const drawer = page.locator('#drawer-profissional');
    await drawer.getByLabel('Nome*').fill(nome);
    await drawer.getByLabel('CPF').fill('111.111.111-11');
    await drawer.getByRole('button', { name: 'Salvar' }).click();
    await expectToast(page, 'CPF inválido.');

    await page.getByRole('button', { name: 'Adicionar profissional' }).click();
    await drawer.getByLabel('Nome*').fill(nome);
    await drawer.getByLabel('Especialidade').selectOption({ label: 'Garçom' });
    await drawer.getByRole('button', { name: 'Salvar' }).click();
    await expectToast(page, 'Profissional cadastrado.');

    await page.getByPlaceholder('Pesquisar').fill(nome);
    await page.getByPlaceholder('Pesquisar').press('Enter');
    await page.getByLabel(`Especialidade de ${nome}`).selectOption({ label: 'Copeira' });
    await expectToast(page, 'Especialidade atualizada.');
    await expect(page.getByLabel(`Especialidade de ${nome}`)).toHaveValue(/.+/);
    await expect(page.getByLabel(`Especialidade de ${nome}`).locator('option:checked')).toHaveText('Copeira');

    await page.locator('tr', { hasText: nome }).getByRole('button', { name: 'Editar' }).click();
    page.once('dialog', (d) => d.accept());
    await drawer.getByRole('button', { name: 'Excluir' }).click();
    await expectToast(page, 'Profissional removido.');
  });
});
