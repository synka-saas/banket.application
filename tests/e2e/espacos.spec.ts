import { expect, test, type Page } from '@playwright/test';
import { confirmarModal, excluirEvento, expectToast, login, waitForIslands } from './helpers';

// Espaços: cadastro de espaço próprio (com faixas de locação) e de terceiro (valor de referência),
// escolha no evento, cálculo da locação no orçamento e troca do espaço pela seção Locação.
// Staff padrão dos seeds para 100 convidados = 4.350 (ver orcamento.spec.ts).

const sufixo = Date.now();
const PROPRIO = `E2E Salão ${sufixo}`;
const TERCEIRO = `E2E Clube ${sufixo}`;

async function abrirEspaco(page: Page, nome: string) {
  await page.goto('/espacos');
  await page.getByPlaceholder('Pesquisar por nome, cidade ou endereço').fill(nome);
  await page.getByPlaceholder('Pesquisar por nome, cidade ou endereço').press('Enter');
  await page.getByRole('link', { name: nome, exact: true }).click();
  await expect(page).toHaveURL(/\/espacos\/[0-9a-f-]{36}$/);
}

async function excluirEspaco(page: Page, nome: string) {
  await abrirEspaco(page, nome);
  await page.getByRole('button', { name: 'Excluir' }).click();
  await confirmarModal(page);
  await expectToast(page, 'Espaço removido.');
}

test.describe('Espaços', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('cadastra espaço próprio com faixas, espaço de terceiro, usa no evento e no orçamento', async ({ page }) => {
    // Espaço próprio: o cadastro abre o detalhe para as faixas de locação
    await page.goto('/espacos');
    await page.getByRole('button', { name: 'Novo espaço' }).first().click();
    const drawer = page.locator('#drawer-espaco');
    await expect(drawer).toBeVisible();
    await drawer.getByLabel('Nome*').fill(PROPRIO);
    await drawer.getByLabel('Capacidade mínima').fill('20');
    await drawer.getByLabel('Capacidade máxima').fill('200');
    await drawer.getByLabel('Cidade', { exact: true }).fill('Campinas');
    await drawer.getByRole('button', { name: 'Salvar' }).click();
    await expectToast(page, 'Espaço cadastrado.');
    await expect(page).toHaveURL(/\/espacos\/[0-9a-f-]{36}$/);
    await expect(page.locator('main')).toContainText('Nosso espaço');
    await expect(page.locator('main')).toContainText('20 a 200 convidados');

    // Faixas de locação: até 50 = 800; sobreposição é recusada; a partir de 51 = 1.200
    const faixa = page.locator('#drawer-faixa');
    await page.getByRole('button', { name: 'Nova faixa' }).first().click();
    await faixa.getByLabel('Mínimo de convidados*').fill('0');
    await faixa.getByLabel('Máximo de convidados').fill('50');
    await faixa.getByLabel('Valor da locação (R$)*').fill('800,00');
    await faixa.getByRole('button', { name: 'Salvar' }).click();
    await expectToast(page, 'Faixa criada.');
    await expect(page.locator('main')).toContainText('Até 50 convidados');

    await page.getByRole('button', { name: 'Nova faixa' }).first().click();
    await faixa.getByLabel('Mínimo de convidados*').fill('40');
    await faixa.getByLabel('Máximo de convidados').fill('100');
    await faixa.getByLabel('Valor da locação (R$)*').fill('1.000,00');
    await faixa.getByRole('button', { name: 'Salvar' }).click();
    await expect(faixa).toContainText('se sobrepõe');
    await faixa.getByLabel('Mínimo de convidados*').fill('51');
    await faixa.getByLabel('Máximo de convidados').fill('');
    await faixa.getByLabel('Valor da locação (R$)*').fill('1.200,00');
    await faixa.getByRole('button', { name: 'Salvar' }).click();
    await expectToast(page, 'Faixa criada.');
    await expect(page.locator('main')).toContainText('A partir de 51 convidados');

    // Espaço de terceiro: contato e valor de referência
    await page.goto('/espacos');
    await page.getByRole('button', { name: 'Novo espaço' }).first().click();
    await drawer.getByText('Espaço de terceiro', { exact: true }).click();
    await drawer.getByLabel('Nome*').fill(TERCEIRO);
    await drawer.getByLabel('Contato', { exact: true }).fill('Patrícia');
    await drawer.getByLabel('Valor de referência da locação (R$)').fill('3.000,00');
    await drawer.getByRole('button', { name: 'Salvar' }).click();
    await expectToast(page, 'Espaço cadastrado.');
    await expect(page).toHaveURL(/\/espacos$/);
    await expect(page.locator('main')).toContainText(TERCEIRO);
    await expect(page.locator('main')).toContainText('R$ 3.000,00');

    // Evento no espaço de terceiro: o resumo mostra o espaço e o orçamento usa o valor de referência
    await page.goto('/eventos/novo');
    await page.getByLabel('Cliente*').selectOption({ label: 'Maria Eduarda Silva' });
    await page.getByLabel('Título do evento').fill(`E2E Espaço ${sufixo}`);
    await page.getByLabel('Convidados', { exact: true }).fill('100');
    await page.getByLabel('Espaço', { exact: true }).selectOption({ label: TERCEIRO });
    await page.getByRole('button', { name: 'Criar evento' }).first().click();
    await expectToast(page, 'Evento criado.');
    const eventoUrl = page.url();
    await expect(page.locator('main')).toContainText(TERCEIRO);
    await expect(page.locator('main')).toContainText('Espaço de terceiro');

    await page.getByRole('button', { name: 'Criar orçamento' }).click();
    await expectToast(page, 'Orçamento iniciado');
    await waitForIslands(page);
    const REFERENCIA = ['Garçom', 'Maître', 'Copeira', 'Auxiliar de cozinha', 'Cozinheiro', 'Chef de cozinha'];
    const funcoes = await page.locator('.acordeao', { hasText: 'Staff' }).locator('tbody td:first-child strong').allTextContents();
    for (const funcao of funcoes.filter((f) => !REFERENCIA.includes(f))) {
      await page.getByRole('button', { name: `Remover ${funcao}`, exact: true }).click();
    }
    const resumo = page.locator('.orc-cabecalho');
    // Staff 4.350 + valor de referência 3.000
    await expect(resumo).toContainText('R$ 7.350,00');
    await expect(page.locator('.locacao-detalhe')).toContainText('Valor de referência do espaço');

    // Trocar para o espaço próprio na seção Locação: faixa 51+ = 1.200 e o evento acompanha
    await page.locator('.locacao-espaco select').selectOption({ label: PROPRIO });
    await expect(resumo).toContainText('R$ 5.550,00');
    await expect(page.locator('.locacao-detalhe')).toContainText('A partir de 51 convidados');
    await expect(page.locator('.orc-estado')).toHaveText('Todas as alterações salvas', { timeout: 10_000 });
    await page.goto(eventoUrl);
    await expect(page.locator('main')).toContainText(PROPRIO);
    await expect(page.locator('main')).toContainText('Nosso espaço');

    // Espaço em uso não pode ser excluído
    await abrirEspaco(page, PROPRIO);
    await expect(page.locator('main')).toContainText(`E2E Espaço ${sufixo}`);
    await page.getByRole('button', { name: 'Excluir' }).click();
    await confirmarModal(page);
    await expectToast(page, /Desative o espaço/);

    // Limpeza: evento e os dois espaços
    await excluirEvento(page, eventoUrl);
    await excluirEspaco(page, PROPRIO);
    await excluirEspaco(page, TERCEIRO);
  });
});
