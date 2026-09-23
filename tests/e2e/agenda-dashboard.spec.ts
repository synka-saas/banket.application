import { expect, test, type Page } from '@playwright/test';
import { excluirEvento, expectToast, login, waitForIslands } from './helpers';

const SHOTS = process.env.SHOTS;
const shot = (page: Page, nome: string) => (SHOTS ? page.screenshot({ path: `${SHOTS}/${nome}.png`, fullPage: true }) : null);

const hoje = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

async function criarEvento(page: Page, titulo: string, data: string | null) {
  await page.goto('/eventos/novo');
  await page.getByLabel('Cliente*').selectOption({ label: 'Maria Eduarda Silva' });
  await page.getByLabel('Título do evento').fill(titulo);
  await page.getByLabel('Convidados', { exact: true }).fill('80');
  if (data) {
    await page.getByLabel('Data', { exact: true }).fill(data);
    await page.getByLabel('Início').fill('19:30');
  }
  await page.getByRole('button', { name: 'Criar evento' }).first().click();
  await expectToast(page, 'Evento criado.');
  criados.push(page.url());
  return page.url();
}

const criados: string[] = [];

test.describe('Agenda, dashboard e envio', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test.afterEach(async ({ page }) => {
    while (criados.length) await excluirEvento(page, criados.pop()!);
  });

  test('evento com data aparece na agenda (mês e semana) e respeita o filtro de status', async ({ page }) => {
    const titulo = `E2E Agenda ${Date.now()}`;
    const data = hoje();
    await criarEvento(page, titulo, data);

    await page.goto(`/agenda?data=${data}`);
    // No mês, cada dia mostra até 3 eventos e um link "+N mais" (outros testes também criam eventos hoje)
    const diaHoje = page.locator('.dia.hoje');
    await expect(diaHoje).toHaveCount(1);
    const noMes = diaHoje.locator('.evento', { hasText: titulo });
    const mais = diaHoje.locator('.mais');
    await expect(noMes.or(mais).first()).toBeVisible();
    await shot(page, 'agenda-mes');

    await page.getByRole('link', { name: 'Semana' }).click();
    const naSemana = page.locator('.semana .cartao', { hasText: titulo });
    await expect(naSemana).toContainText('80 convidados');
    await expect(naSemana).toContainText('19:30');
    await shot(page, 'agenda-semana');

    // Evento novo está na coluna de entrada: some ao filtrar por "recusado"
    await page.getByLabel('Filtrar por status').selectOption('recusado');
    await expect(page).toHaveURL(/status=recusado/);
    await expect(page.locator('.cartao', { hasText: titulo })).toHaveCount(0);

    // Clique abre o evento
    await page.goto(`/agenda?data=${data}&visao=semana`);
    await naSemana.click();
    await expect(page).toHaveURL(/\/eventos\/[0-9a-f-]{36}$/);
  });

  test('dashboard mostra indicadores, funil e próximos eventos', async ({ page }) => {
    const titulo = `E2E Dash ${Date.now()}`;
    await criarEvento(page, titulo, hoje());
    await page.goto('/dashboard');
    for (const rotulo of ['Pedidos recebidos', 'Em aberto', 'Aprovados', 'Taxa de conversão', 'Ticket médio']) {
      await expect(page.locator('.kpi .rotulo', { hasText: new RegExp(`^${rotulo}$`) })).toBeVisible();
    }
    await expect(page.locator('.funil li').first()).toBeVisible();
    await expect(page.locator('.lista a', { hasText: titulo })).toBeVisible();
    await page.getByLabel('Período').selectOption('tudo');
    await expect(page).toHaveURL(/periodo=tudo/);
    await shot(page, 'dashboard');
  });

  test('envia a proposta por e-mail e registra na linha do tempo', async ({ page }) => {
    const eventoUrl = await criarEvento(page, `E2E Envio ${Date.now()}`, null);
    await page.getByRole('button', { name: 'Confeccionar orçamento' }).click();
    await expectToast(page, 'Orçamento iniciado');
    await waitForIslands(page);

    await page.getByRole('button', { name: 'Enviar ao cliente' }).click();
    const drawer = page.locator('#drawer-enviar');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByLabel('Assunto*')).not.toHaveValue('');
    await expect(drawer.getByLabel('Mensagem*')).toHaveValue(/Maria Eduarda Silva|Olá/);
    await drawer.getByLabel('Para*').fill('cliente-e2e@example.com');
    await shot(page, 'envio-drawer');
    await drawer.getByRole('button', { name: 'Enviar' }).click();
    // Sem RESEND_API_KEY o e-mail vai para o log do servidor
    await expectToast(page, /Proposta enviada para cliente-e2e@example.com|E-mail registrado no log/);

    await page.getByRole('button', { name: 'Enviar ao cliente' }).click();
    await expect(page.locator('#drawer-enviar .aviso-envio')).toContainText('cliente-e2e@example.com');

    await page.goto(`${eventoUrl}/linha-do-tempo`);
    await expect(page.locator('main')).toContainText('enviada para cliente-e2e@example.com');
  });
});
