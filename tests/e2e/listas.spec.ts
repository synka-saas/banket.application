import { expect, test } from '@playwright/test';
import { login } from './helpers';

// Listagens: ordenação por coluna (só colunas permitidas pelo servidor) e itens por página.
test.describe('Listas', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('ordena clientes pelo cabeçalho, alternando a direção', async ({ page }) => {
    await page.goto('/clientes');
    const cabecalho = page.getByRole('columnheader', { name: /Nome/ });
    await cabecalho.getByRole('link').click();
    await expect(page).toHaveURL(/ordem=nome/);
    await expect(cabecalho).toHaveAttribute('aria-sort', 'ascending');
    const nomes = async () => (await page.locator('tbody tr td:first-child').allTextContents()).map((t) => t.trim());
    const asc = await nomes();
    expect(asc).toEqual([...asc].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })));

    await cabecalho.getByRole('link').click();
    await expect(cabecalho).toHaveAttribute('aria-sort', 'descending');
    const desc = await nomes();
    expect(desc).toEqual([...desc].sort((a, b) => b.localeCompare(a, 'pt-BR', { sensitivity: 'base' })));

    // Terceiro clique volta à ordem padrão
    await cabecalho.getByRole('link').click();
    await expect(page).not.toHaveURL(/ordem=/);
  });

  test('parâmetros de ordenação e página inválidos são ignorados', async ({ page }) => {
    for (const rota of ['/clientes?ordem=nome;drop%20table%20clientes&dir=desc', '/eventos?view=lista&ordem=senha', '/cardapio/itens?por=5000']) {
      const res = await page.goto(rota);
      expect(res?.status(), rota).toBe(200);
      await expect(page.locator('table')).toBeVisible();
    }
  });
});
