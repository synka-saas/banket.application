import { expect, test, type Page } from '@playwright/test';
import { excluirEvento, expectToast, login, waitForIslands } from './helpers';

// Porção por pessoa no item do cardápio → quantidade total por evento → lista de compras com ajuste manual.
// Usa o item "Bruschetta de tomate, manjericão e parmesão" dos seeds (seção Coquetel); a porção é removida ao final.
const ITEM = 'Bruschetta de tomate, manjericão e parmesão';

async function definirPorcao(page: Page, item: string, qtd: string) {
  await page.goto(`/cardapio/itens?q=${encodeURIComponent(item)}`);
  await page.getByRole('button', { name: 'Editar' }).first().click();
  await page.getByLabel('Porção por pessoa').fill(qtd);
  await page.getByLabel('Unidade da porção').selectOption('g');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expectToast(page, 'Item atualizado.');
}

test.describe('Lista de compras', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('porção × convidados vira a lista de compras, com ajuste manual persistido e CSV', async ({ page }) => {
    test.setTimeout(120_000);
    await definirPorcao(page, ITEM, '80');
    await expect(page.locator('.data-table')).toContainText('80 g/pessoa');

    // Evento com 50 convidados + orçamento + cardápio do zero com a seção Coquetel
    await page.goto('/eventos/novo');
    await page.getByLabel('Cliente*').selectOption({ label: 'Maria Eduarda Silva' });
    await page.getByLabel('Título do evento').fill(`E2E Compras ${Date.now()}`);
    await page.getByLabel('Convidados', { exact: true }).fill('50');
    await page.getByRole('button', { name: 'Criar evento' }).first().click();
    await expectToast(page, 'Evento criado.');
    const eventoUrl = page.url();
    try {
      await page.getByRole('button', { name: 'Criar orçamento' }).click();
      await expectToast(page, 'Orçamento iniciado');
      await waitForIslands(page);
      await page.getByRole('button', { name: /Adicionar cardápio/ }).click();
      await page.getByRole('combobox', { name: /Adicionar cardápio/ }).fill('zero');
      await page.keyboard.press('Enter');
      await page.getByRole('button', { name: /Adicionar seção/ }).click();
      await page.getByRole('combobox', { name: /Adicionar seção/ }).fill('coquetel');
      await page.keyboard.press('Enter');
      await expect(page.locator('.orc-estado')).toHaveText('Todas as alterações salvas', { timeout: 10_000 });

      // Aba Lista de compras: 80 g × 50 = 4.000 g (4 kg)
      await page.getByRole('link', { name: 'Lista de compras' }).click();
      await waitForIslands(page);
      await expect(page.locator('.compras-resumo')).toContainText('50 convidados');
      const linha = page.locator('.compras-tabela tbody tr', { hasText: ITEM });
      await expect(linha).toContainText('80 g');
      await expect(linha).toContainText('4 kg');
      await expect(linha.getByLabel(`Quantidade de ${ITEM}`)).toHaveAttribute('placeholder', '4000');
      // Itens da seção sem porção aparecem com aviso
      await expect(page.locator('.compras-aviso')).toContainText('sem porção cadastrada');

      // Ajuste manual, comprado e observação persistem após recarregar
      await linha.getByLabel(`Quantidade de ${ITEM}`).fill('4500');
      await page.keyboard.press('Enter');
      await linha.getByLabel(`${ITEM} comprado`).check();
      await linha.getByLabel(`Observação de ${ITEM}`).fill('Padaria Central');
      await page.keyboard.press('Tab');
      await expect(page.locator('.orc-estado')).toHaveText('Todas as alterações salvas', { timeout: 10_000 });
      await page.reload();
      await waitForIslands(page);
      const linha2 = page.locator('.compras-tabela tbody tr', { hasText: ITEM });
      await expect(linha2.getByLabel(`Quantidade de ${ITEM}`)).toHaveValue('4500');
      await expect(linha2.getByLabel(`${ITEM} comprado`)).toBeChecked();
      await expect(linha2.getByLabel(`Observação de ${ITEM}`)).toHaveValue('Padaria Central');
      await expect(linha2).toContainText('4,5 kg');

      // Linha avulsa
      await page.getByRole('button', { name: 'Adicionar linha avulsa' }).click();
      await page.getByLabel('Nome do item').fill('Gelo');
      await page.keyboard.press('Tab');
      await expect(page.locator('.orc-estado')).toHaveText('Todas as alterações salvas', { timeout: 10_000 });
      await expect(page.locator('.compras-resumo')).toContainText('01 comprados');

      // CSV
      const download = page.waitForEvent('download');
      await page.getByRole('link', { name: 'Exportar CSV' }).click();
      const arquivo = await download;
      expect(arquivo.suggestedFilename()).toBe('lista-de-compras-v01.csv');
      const conteudo = (await (await arquivo.createReadStream()).toArray()).join('');
      expect(conteudo).toContain(`${ITEM};Coquetel;80;4000;4500;g;Sim;Padaria Central`);
      expect(conteudo).toContain('Gelo;Avulso');
    } finally {
      await excluirEvento(page, eventoUrl);
      await page.goto(`/cardapio/itens?q=${encodeURIComponent(ITEM)}`);
      await page.getByRole('button', { name: 'Editar' }).first().click();
      await page.getByLabel('Porção por pessoa').fill('');
      await page.getByRole('button', { name: 'Salvar' }).click();
      await expectToast(page, 'Item atualizado.');
    }
  });
});

test.describe('Reuniões (sem Google configurado)', () => {
  test('telas avisam que o agendamento depende da conta Google', async ({ page }) => {
    await login(page);
    await page.goto('/reunioes');
    await expect(page.getByText('Nenhuma reunião agendada')).toBeVisible();
    await expect(page.getByText('O login com o Google não está configurado neste servidor.')).toBeVisible();
    await page.goto('/conta');
    await expect(page.getByText('Conta Google')).toBeVisible();
    await page.goto('/agenda');
    await expect(page.getByRole('link', { name: 'Reuniões' })).toBeVisible();
  });
});
