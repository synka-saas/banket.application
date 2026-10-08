import { expect, test } from '@playwright/test';
import { criarEventoE2E as criarEvento, expectToast, login, psql, removerEventoBanco as removerEvento } from './helpers';

// Financeiro: plano de pagamento no fechamento (etapa aprovado) → contas a receber, baixa, conta a pagar, refazer plano,
// menu Financeiro, compra do estoque com conta a pagar e restrição a owner/admin.

test.describe('Financeiro', () => {
  test('fechamento cadastra o plano de pagamento e as contas do evento', async ({ page }) => {
    test.setTimeout(120_000);
    await login(page);
    const titulo = `E2E Financeiro ${Date.now()}`;
    const eventoUrl = await criarEvento(page, titulo);
    try {
      // Etapa "Aprovado" oferece cadastrar o plano em seguida
      await page.locator('#status-evento').selectOption({ label: 'Aprovado' });
      const dialogo = page.locator('[data-etapa-dialogo]');
      await expect(dialogo.locator('#etapa-plano')).toBeChecked();
      await dialogo.getByRole('button', { name: 'Confirmar fechamento' }).click();
      await page.waitForURL(/\/financas$/);
      const plano = page.locator('#drawer-plano');
      await expect(plano).toBeVisible();

      await plano.locator('#pl-total').fill('3000,00');
      await plano.locator('#pl-entrada').fill('1000,00');
      await plano.locator('#pl-entrada-venc').fill('2026-10-10');
      await plano.locator('#pl-parcelas').fill('2');
      await plano.locator('#pl-primeiro').fill('2026-11-10');
      await plano.locator('#pl-forma').selectOption('pix');
      await expect(plano.locator('[data-plano-previa]')).toContainText('Parcela 2/2 · 10/12/2026');
      await plano.getByRole('button', { name: 'Gerar contas a receber' }).click();
      await expectToast(page, 'Plano de pagamento cadastrado: 3 contas a receber.');

      const tabelas = page.locator('.table-card');
      const receber = tabelas.first();
      await expect(receber.locator('tbody tr')).toHaveCount(3);
      await expect(receber).toContainText('Entrada');
      await expect(receber).toContainText('Parcela 2/2');

      // Baixa da entrada
      await receber.locator('tr', { hasText: 'Entrada' }).getByRole('button', { name: 'Receber' }).click();
      const baixa = page.locator('#drawer-baixa');
      await expect(baixa.locator('.drawer-title')).toHaveText('Registrar recebimento');
      await baixa.getByRole('button', { name: 'Registrar' }).click();
      await expectToast(page, 'Recebimento registrado.');
      await expect(page.locator('.fin-resumo')).toContainText('Recebido R$ 1.000,00');

      // Conta a pagar do evento
      await page.getByRole('button', { name: 'Nova conta a pagar' }).first().click();
      const conta = page.locator('#drawer-conta-pagar');
      await conta.locator('[name=descricao]').fill('Equipe de garçons E2E');
      await conta.locator('[name=valor]').fill('500,00');
      await conta.locator('[name=fornecedor]').fill('Agência E2E');
      await conta.getByRole('button', { name: 'Salvar' }).click();
      await expectToast(page, 'Conta a pagar cadastrada.');
      await expect(page.locator('.fin-resumo')).toContainText('R$ 2.500,00');

      // Refazer o plano: as parcelas em aberto são substituídas; a entrada recebida fica
      await page.getByRole('button', { name: 'Refazer plano' }).click();
      await plano.locator('#pl-total').fill('2000,00');
      await plano.locator('#pl-entrada').fill('');
      await plano.locator('#pl-parcelas').fill('1');
      await plano.locator('#pl-primeiro').fill('2026-12-01');
      await plano.getByRole('button', { name: 'Gerar contas a receber' }).click();
      await expectToast(page, 'Plano de pagamento cadastrado: 1 conta a receber.');
      await expect(receber.locator('tbody tr')).toHaveCount(2);
      await expect(receber).toContainText('Parcela única');
      await expect(receber.locator('tr', { hasText: 'Entrada' })).toContainText('Recebida');

      // Menu Financeiro: contas a receber filtradas pelo evento, visão geral e exportação
      const eventoId = new URL(eventoUrl).pathname.split('/')[2];
      await page.goto(`/financeiro/receber?evento=${eventoId}&situacao=todas`);
      await expect(page.locator('.data-table tbody tr')).toHaveCount(2);
      const csv = await page.request.get(`/financeiro/exportar?tipo=receber&evento=${eventoId}&situacao=todas`);
      expect(await csv.text()).toContain('Parcela única');
      await page.goto('/financeiro');
      await expect(page.locator('.section-card', { hasText: 'Fluxo de caixa' })).toContainText('Entradas (recebido + a receber)');

      // Linha do tempo registra o plano e o recebimento
      await page.goto(`${eventoUrl}/linha-do-tempo`);
      await expect(page.locator('.timeline')).toContainText('Plano de pagamento cadastrado');
      await expect(page.locator('.timeline')).toContainText('Recebimento registrado');
    } finally {
      removerEvento(eventoUrl);
    }
  });

  test('compra no estoque lança a conta a pagar', async ({ page }) => {
    test.setTimeout(90_000);
    await login(page);
    const nome = `E2E Vinho ${Date.now()}`;
    try {
      await page.goto('/estoque');
      await page.getByRole('button', { name: 'Novo item' }).first().click();
      await page.locator('#es-nome').fill(nome);
      await page.locator('#drawer-estoque').getByRole('button', { name: 'Salvar' }).click();
      await expectToast(page, 'Item adicionado ao estoque.');

      await page.goto(`/estoque?q=${encodeURIComponent(nome)}`);
      await page.getByRole('button', { name: 'Movimentar' }).last().click();
      const drawer = page.locator('#drawer-movimento');
      await drawer.locator('#mv-razao').selectOption('compra');
      await drawer.locator('#mv-qtd').fill('6');
      await drawer.locator('#mv-custo').fill('40,00');
      await drawer.locator('#mv-fornecedor').fill('Adega E2E');
      await drawer.locator('#mv-documento').fill('NF-777');
      await drawer.locator('[data-fin-lancar]').check();
      await expect(drawer.locator('#mv-fin-valor')).toHaveValue('240,00');
      await drawer.getByRole('button', { name: 'Registrar' }).click();
      await expectToast(page, 'conta a pagar lançada');

      await page.goto(`/financeiro/pagar?q=${encodeURIComponent(nome)}&situacao=todas`);
      const linha = page.locator('.data-table tbody tr', { hasText: nome });
      await expect(linha).toContainText('R$ 240,00');
      await expect(linha).toContainText('Estoque');
      await expect(linha).toContainText('Adega E2E');
    } finally {
      psql(`DELETE FROM fin_contas WHERE descricao LIKE '%${nome}%'`);
      psql(`DELETE FROM estoque_itens WHERE nome = '${nome}'`);
    }
  });

  test('usuário comum não vê o financeiro', async ({ page }) => {
    await login(page, { email: 'operacao@banket.com.br', senha: 'Banket.2026' });
    await page.goto('/financeiro');
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('.sidebar')).not.toContainText('Financeiro');
  });
});
