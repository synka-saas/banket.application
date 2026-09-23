import { expect, test, type Page } from '@playwright/test';
import { expectToast, login, waitForIslands } from './helpers';

// Valores esperados com os dados de referência (seeds): 100 convidados, local "no nosso espaço".
// Staff padrão para 100 convidados: Garçom 7×250 + Maître 1×450 + Copeira 2×200 + Aux. cozinha 4×200
// + Cozinheiro 2×250 + Chef 1×450 = 4.350 · Locação (81 a 110 convidados) = 2.500.

async function criarEvento(page: Page, convidados: number): Promise<string> {
  await page.goto('/eventos/novo');
  await page.getByLabel('Cliente*').selectOption({ label: 'Maria Eduarda Silva' });
  await page.getByLabel('Título do evento').fill(`E2E Orçamento ${Date.now()}`);
  await page.getByLabel('Convidados', { exact: true }).fill(String(convidados));
  await page.getByLabel('Sem glúten').check();
  await page.getByRole('button', { name: 'Criar evento' }).first().click();
  await expectToast(page, 'Evento criado.');
  return page.url();
}

const resumo = (page: Page) => page.locator('.orc-cabecalho');

async function aguardarSalvo(page: Page) {
  await expect(page.locator('.orc-estado')).toHaveText('Todas as alterações salvas', { timeout: 10_000 });
}

test.describe('Orçamento', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('monta, calcula, ajusta manualmente, versiona e persiste', async ({ page }) => {
    const eventoUrl = await criarEvento(page, 100);

    // Confeccionar orçamento a partir do Resumo move o evento para "Em negociação"
    await page.getByRole('button', { name: 'Confeccionar orçamento' }).click();
    await expectToast(page, 'O evento passou para "Em negociação"');
    await waitForIslands(page);
    await expect(resumo(page)).toContainText('Versão: 01');
    // Serviços de staff cadastrados além dos de referência (seed) saem do orçamento, para os valores serem estáveis
    const REFERENCIA = ['Garçom', 'Maître', 'Copeira', 'Auxiliar de cozinha', 'Cozinheiro', 'Chef de cozinha'];
    const funcoes = await page.locator('.acordeao', { hasText: 'Staff' }).locator('tbody td:first-child strong').allTextContents();
    for (const funcao of funcoes.filter((f) => !REFERENCIA.includes(f))) {
      await page.getByRole('button', { name: `Remover ${funcao}`, exact: true }).click();
    }
    // Só staff padrão + locação: 4.350 + 2.500
    await expect(resumo(page)).toContainText('R$ 6.850,00');

    // Cardápio Brunch (R$ 250/pessoa × 100)
    await page.getByLabel('Cardápio a adicionar').selectOption({ label: 'Brunch · R$ 250,00/pessoa' });
    await page.getByRole('button', { name: /Adicionar cardápio/ }).click();
    await expect(page.locator('.cardapio-subtotal')).toContainText('R$ 25.000,00');

    // 10 crianças pagando meia → 95 pagantes
    await page.getByLabel('Crianças que pagam meia').fill('10');
    await page.getByLabel('Crianças que pagam meia').blur();
    await expect(page.locator('.orc-equivalentes')).toContainText('95');
    await expect(page.locator('.cardapio-subtotal')).toContainText('R$ 23.750,00');

    // Pacote de soft drinks por pessoa (R$ 20 × 95 = 1.900)
    await page.locator('.acordeao-cabecalho', { hasText: 'Bebidas' }).click();
    await page.getByLabel('Bebida a adicionar').selectOption({ label: 'Pacote Soft drinks · R$ 20,00 /pessoa' });
    await page.getByRole('button', { name: 'Adicionar bebida' }).click();

    // 23.750 + 1.900 + 4.350 + 2.500 = 32.500
    await expect(resumo(page)).toContainText('R$ 32.500,00');
    await aguardarSalvo(page);

    // Ajuste manual do preço por pessoa (240 × 95 = 22.800) → total 31.550
    await page.getByLabel('Preço por pessoa de Brunch', { exact: true }).fill('240');
    await page.getByLabel('Preço por pessoa de Brunch', { exact: true }).blur();
    await expect(resumo(page)).toContainText('R$ 31.550,00');
    await aguardarSalvo(page);

    // Persistiu no servidor (o servidor recalcula o mesmo total)
    await page.reload();
    await waitForIslands(page);
    await expect(resumo(page)).toContainText('R$ 31.550,00');
    await expect(page.getByLabel('Preço por pessoa de Brunch', { exact: true })).toHaveValue('240,00');
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/orcamento.png`, fullPage: true });

    // Informações complementares: linha automática de restrição (itens sem glúten do Brunch)
    await page.goto(`${eventoUrl}/informacoes-complementares`);
    await waitForIslands(page);
    await expect(page.getByLabel('Valor de Sem glúten')).toHaveValue(/\d+ opç(ão|ões)/);
    await page.getByLabel('Valor de Limite para desmontagem').fill('02:00');
    await page.getByLabel('Valor de Limite para desmontagem').blur();
    await expect(page.locator('.orc-estado')).toHaveText('Todas as alterações salvas', { timeout: 10_000 });
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/informacoes.png`, fullPage: true });

    // Nova versão congela a anterior
    await page.goto(`${eventoUrl}/orcamento`);
    await waitForIslands(page);
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Criar nova versão' }).click();
    await expectToast(page, 'Versão 02 criada.');
    await waitForIslands(page);
    await expect(resumo(page)).toContainText('Versão: 02');
    await expect(resumo(page)).toContainText('R$ 31.550,00');

    // Versão 01 fica somente leitura
    await page.locator('.versao-card', { hasText: 'Versão: 01' }).getByRole('link', { name: 'Acessar' }).click();
    await waitForIslands(page);
    await expect(page.locator('.selo-congelada')).toBeVisible();
    await expect(page.getByLabel('Preço por pessoa de Brunch', { exact: true })).toBeDisabled();
    const congelada = await page.request.put(`${new URL(eventoUrl).pathname.replace('/eventos/', '/api/orcamentos/')}/versoes/1`, {
      data: { total_manual: 1 },
    });
    expect(congelada.status()).toBe(400);
    expect((await congelada.json()).error).toContain('congelada');

    // Informações complementares da versão 02 herdaram a edição
    await page.goto(`${eventoUrl}/informacoes-complementares`);
    await expect(page.getByLabel('Valor de Limite para desmontagem')).toHaveValue('02:00');

    // Kanban mostra o evento em negociação com o valor do orçamento
    await page.goto(`/eventos/${new URL(eventoUrl).pathname.split('/')[2]}/linha-do-tempo`);
    await expect(page.locator('.timeline')).toContainText('Orçamento iniciado (versão 01)');
    await expect(page.locator('.timeline')).toContainText('Nova versão do orçamento criada (versão 02)');

    // Limpeza
    await page.goto(eventoUrl);
    await expect(page.locator('.cabecalho-card')).toContainText('R$ 31.550,00');
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Excluir evento' }).click();
    await expectToast(page, 'Evento excluído.');
  });
});
