import { expect, test } from '@playwright/test';
import { expectToast, login } from './helpers';
import { hojeSaoPaulo, intervaloPeriodo } from '../../src/lib/periodos';

test.describe('Eventos e quadro de vendas', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('ciclo completo: criar com cliente novo, mover no Kanban, checklist, editar, histórico e excluir', async ({ page }) => {
    const sufixo = Date.now();
    const cliente = `E2E Cliente ${sufixo}`;

    // Criação com erro de validação preserva o que foi digitado
    await page.goto('/eventos/novo');
    await page.getByRole('button', { name: '+ Cadastrar novo cliente' }).click();
    await page.getByLabel('Nome / Razão social*').fill(cliente);
    await page.getByLabel('Convidados', { exact: true }).fill('120');
    await page.getByLabel('Início').fill('20:00');
    await page.getByLabel('Término').fill('19:00');
    await page.getByRole('button', { name: 'Criar evento' }).first().click();
    await expect(page.locator('.form-erro')).toContainText('O horário de término deve ser depois do início.');
    await expect(page.getByLabel('Nome / Razão social*')).toHaveValue(cliente);
    await expect(page.getByLabel('Convidados', { exact: true })).toHaveValue('120');

    // Corrige e cria
    await page.getByLabel('Término').fill('23:30');
    await page.getByLabel('Data', { exact: true }).fill('2027-03-15');
    await page.getByLabel('Natureza (tipo)').selectOption({ label: 'Social' });
    await page.getByLabel('Formato do evento (categoria)').selectOption({ label: 'Casamento' });
    await page.getByLabel('Sem lactose').check();
    await page.getByRole('button', { name: 'Criar evento' }).first().click();
    await expectToast(page, 'Evento criado.');
    await expect(page.locator('.banner')).toContainText(cliente);
    await expect(page.locator('.banner')).toContainText('20h às 23:30');
    const eventoUrl = page.url();

    // Checklist
    await page.getByLabel('Novo item do checklist').fill('Degustação presencial');
    await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
    await expectToast(page, 'Item adicionado ao checklist.');
    await page.getByLabel('Status de Degustação presencial').selectOption({ label: 'Agendado' });
    await expect(page.getByLabel('Status de Degustação presencial')).toHaveValue('agendado');

    // Kanban: aparece na coluna de entrada e pode ser arrastado
    // Filtra pelo cliente para o card ficar isolado (o arrasto do Playwright erra coordenadas em colunas longas com rolagem)
    await page.goto(`/eventos?q=${encodeURIComponent(cliente)}`);
    const card = page.locator('.evento-card', { hasText: cliente });
    const colunaEntrada = page.locator('.kanban-col', { hasText: 'Novo orçamento' });
    await expect(colunaEntrada.locator('.evento-card', { hasText: cliente })).toBeVisible();
    const colunaNegociacao = page.locator('.kanban-col', { hasText: 'Em negociação' });
    await card.dragTo(colunaNegociacao.locator('[data-dropzone]'));
    await expectToast(page, 'Evento movido para "Em negociação".');
    await page.reload();
    await expect(colunaNegociacao.locator('.evento-card', { hasText: cliente })).toBeVisible();

    // Lista com filtro de status
    await page.goto('/eventos?view=lista');
    await expect(page.locator('tr', { hasText: cliente })).toContainText('Em negociação');

    // Exportação CSV contém o evento
    const csv = await page.request.get('/eventos/exportar');
    expect(csv.headers()['content-type']).toContain('text/csv');
    expect(await csv.text()).toContain(cliente);

    // Edição registra a mudança de convidados no histórico
    await page.goto(`${eventoUrl}/editar`);
    await page.getByLabel('Convidados', { exact: true }).fill('150');
    await page.getByRole('button', { name: 'Salvar alterações' }).first().click();
    await expectToast(page, 'Evento atualizado.');
    await page.goto(`${eventoUrl}/linha-do-tempo`);
    const timeline = page.locator('.timeline');
    await expect(timeline).toContainText('convidados: 120 → 150');
    await expect(timeline).toContainText('Status alterado de "Novo orçamento" para "Em negociação"');
    await expect(timeline).toContainText('Degustação presencial');
    await expect(timeline).toContainText('Evento cadastrado');

    // Exclusão do evento e depois do cliente (sem eventos)
    await page.goto(eventoUrl);
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Excluir evento' }).click();
    await expectToast(page, 'Evento excluído.');
    await expect(page).toHaveURL(/\/eventos$/);

    await page.goto(`/clientes?q=${encodeURIComponent(cliente)}`);
    await page.locator('tr', { hasText: cliente }).getByRole('button', { name: 'Editar' }).click();
    page.once('dialog', (d) => d.accept());
    await page.locator('#drawer-cliente').getByRole('button', { name: 'Excluir' }).click();
    await expectToast(page, 'Cliente removido.');
  });

  test('categorias do formulário respeitam o tipo de evento', async ({ page }) => {
    await page.goto('/eventos/novo');
    await page.getByLabel('Natureza (tipo)').selectOption({ label: 'Corporativo' });
    const categoria = page.getByLabel('Formato do evento (categoria)');
    await expect(categoria.locator('option', { hasText: 'Casamento' })).toBeHidden();
    await expect(categoria.locator('option', { hasText: 'Confraternização de fim de ano' })).not.toHaveAttribute('hidden');
  });

  test('filtro por período: fica ativo até trocar ou definir datas manualmente', async ({ page }) => {
    const mes = intervaloPeriodo('mes', hojeSaoPaulo());
    await page.goto('/eventos');
    await page.getByText('Filtros').click();
    await page.getByRole('radio', { name: 'Este mês' }).click();
    await expect(page.locator('#f-de')).toHaveValue(mes.de);
    await expect(page.locator('#f-ate')).toHaveValue(mes.ate);
    await page.getByRole('button', { name: 'Aplicar' }).click();

    // Só o período vai para a URL e continua ativo ao recarregar
    await expect(page).toHaveURL(/periodo=mes/);
    expect(new URL(page.url()).searchParams.has('de')).toBe(false);
    await page.reload();
    await page.getByText('Filtros').click();
    await expect(page.getByRole('radio', { name: 'Este mês' })).toBeChecked();
    await expect(page.locator('#f-de')).toHaveValue(mes.de);

    // Definir uma data à mão desmarca o período e passa a valer o intervalo manual
    await page.locator('#f-ate').fill('2030-12-31');
    await expect(page.getByRole('radio', { name: 'Este mês' })).not.toBeChecked();
    await page.getByRole('button', { name: 'Aplicar' }).click();
    await expect(page).toHaveURL(/ate=2030-12-31/);
    expect(new URL(page.url()).searchParams.has('periodo')).toBe(false);
  });
});
