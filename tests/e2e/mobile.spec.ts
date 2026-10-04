import { expect, test } from '@playwright/test';
import { confirmarModal, expectToast, login } from './helpers';

// Versão mobile (≤768px): barra inferior, painel "Mais", funil com uma etapa por vez e drawer em tela cheia.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

test.describe('Versão mobile', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('barra inferior navega e o painel "Mais" abre os demais módulos', async ({ page }) => {
    const barra = page.locator('.mnav');
    await expect(barra).toBeVisible();
    await expect(page.locator('.sidebar')).toBeHidden();

    await barra.getByRole('link', { name: 'Clientes' }).click();
    await expect(page).toHaveURL(/\/clientes$/);

    await barra.getByRole('button', { name: 'Mais' }).click();
    const painel = page.locator('#mnav-painel');
    await expect(painel).toBeVisible();
    await painel.getByRole('link', { name: 'Configurações' }).click();
    await expect(page).toHaveURL(/\/configuracoes\/usuarios$/);

    // Esc fecha o painel
    await page.locator('[data-mnav-mais]').click();
    await expect(page.locator('#mnav-painel')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#mnav-painel')).toBeHidden();
  });

  test('cria evento, funil mostra uma etapa por vez e o card move pelo menu', async ({ page }) => {
    const sufixo = Date.now();
    const cliente = `E2E Mobile ${sufixo}`;

    // Formulário do evento em uma coluna
    await page.goto('/eventos/novo');
    await page.getByRole('button', { name: '+ Cadastrar novo cliente' }).click();
    await page.getByLabel('Nome / razão social*').fill(cliente);
    // Com data: o filtro por período do funil (usado abaixo) só mostra eventos datados
    await page.getByLabel('Data', { exact: true }).fill('2027-05-20');
    await page.getByRole('button', { name: 'Criar evento' }).first().click();
    await expectToast(page, 'Evento criado.');

    // Funil: chips de etapa, uma coluna visível por vez
    await page.goto(`/eventos?q=${encodeURIComponent(cliente)}&de=2000-01-01`);
    const chips = page.locator('[data-etapa-chip]');
    await expect(chips.first()).toBeVisible();
    const colunaEntrada = page.locator('.kanban-col[data-status-nome="Novo orçamento"]');
    const colunaNegociacao = page.locator('.kanban-col[data-status-nome="Em negociação"]');
    await expect(colunaEntrada).toBeVisible();
    await expect(colunaNegociacao).toBeHidden();

    await page.locator('[data-etapa-chip]', { hasText: 'Em negociação' }).click();
    await expect(colunaNegociacao).toBeVisible();
    await expect(colunaEntrada).toBeHidden();
    await page.locator('[data-etapa-chip]', { hasText: 'Novo orçamento' }).click();
    await expect(colunaEntrada).toBeVisible();

    // Mover pelo menu ⋯ (sem arrastar); a contagem do chip acompanha
    const card = colunaEntrada.locator('.evento-card', { hasText: cliente });
    await card.locator('[data-card-menu] summary').click();
    await card.getByRole('button', { name: 'Em negociação' }).click();
    await expectToast(page, 'Evento movido para "Em negociação".');
    await page.locator('[data-etapa-chip]', { hasText: 'Em negociação' }).click();
    await expect(colunaNegociacao.locator('.evento-card', { hasText: cliente })).toBeVisible();

    // Limpeza: exclui o evento e o cliente criados
    await colunaNegociacao.locator('.evento-card', { hasText: cliente }).locator('.evento-card-link').click();
    await page.getByRole('button', { name: 'Excluir evento' }).click();
    await confirmarModal(page);
    await expectToast(page, 'Evento excluído.');
    await page.goto('/clientes');
    await page.getByPlaceholder(/Pesquisar/).fill(cliente);
    await page.getByPlaceholder(/Pesquisar/).press('Enter');
    await page.locator('tr', { hasText: cliente }).getByRole('button', { name: 'Editar' }).click();
    await page.locator('#drawer-cliente').getByRole('button', { name: 'Excluir' }).click();
    await confirmarModal(page);
    await expectToast(page, 'Cliente removido.');
  });

  test('drawer abre em tela cheia e salva', async ({ page }) => {
    await page.goto('/clientes');
    await page.getByRole('button', { name: 'Novo cliente' }).click();
    const drawer = page.locator('#drawer-cliente .drawer');
    await expect(drawer).toBeVisible();
    const caixa = await drawer.boundingBox();
    expect(caixa!.width).toBeGreaterThanOrEqual(388);

    const nome = `E2E Mobile Drawer ${Date.now()}`;
    await page.fill('#cli-nome', nome);
    await page.locator('#drawer-cliente').getByRole('button', { name: 'Salvar' }).click();
    await expectToast(page, 'Cliente cadastrado.');

    // Limpeza (a lista é paginada: busca antes)
    await page.getByPlaceholder(/Pesquisar/).fill(nome);
    await page.getByPlaceholder(/Pesquisar/).press('Enter');
    await page.locator('tr', { hasText: nome }).getByRole('button', { name: 'Editar' }).click();
    await page.locator('#drawer-cliente').getByRole('button', { name: 'Excluir' }).click();
    await confirmarModal(page);
    await expectToast(page, 'Cliente removido.');
  });
});
