import { expect, test } from '@playwright/test';
import { confirmarModal, expectToast, login } from './helpers';

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
    await page.getByLabel('CPF', { exact: true }).fill('123.456.789-00');
    await page.getByRole('button', { name: 'Criar evento' }).first().click();
    // Todos os erros de uma vez (evento e cliente novo), cada um junto do seu campo
    await expect(page.locator('.form-erro')).toContainText('Corrija os 2 campos destacados');
    await expect(page.locator('#erro-form-evento-hora_fim')).toHaveText('O horário de término deve ser depois do início.');
    await expect(page.locator('#erro-form-evento-cliente_documento')).toHaveText('CPF/CNPJ inválido.');
    await expect(page.getByLabel('Término')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByLabel('Nome / Razão social*')).toHaveValue(cliente);
    await expect(page.getByLabel('Convidados', { exact: true })).toHaveValue('120');

    // Corrige e cria (corrigir o campo tira o destaque)
    await page.getByLabel('CPF', { exact: true }).fill('');
    await expect(page.locator('#erro-form-evento-cliente_documento')).toHaveCount(0);
    await page.getByLabel('Término').fill('23:30');
    await page.getByLabel('Data', { exact: true }).fill('2027-03-15');
    await page.getByLabel('Tipo', { exact: true }).selectOption({ label: 'Social' });
    await page.getByLabel('Ocasião').selectOption({ label: 'Casamento' });
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
    // de=2000-01-01: filtro de datas manual ignora o intervalo de trabalho configurado (evento é de 2027)
    await page.goto(`/eventos?q=${encodeURIComponent(cliente)}&de=2000-01-01`);
    const card = page.locator('.evento-card', { hasText: cliente });
    const colunaEntrada = page.locator('.kanban-col[data-status-nome="Novo orçamento"]');
    await expect(colunaEntrada.locator('.evento-card', { hasText: cliente })).toBeVisible();
    const colunaNegociacao = page.locator('.kanban-col[data-status-nome="Em negociação"]');
    await card.dragTo(colunaNegociacao.locator('[data-dropzone]'));
    await expectToast(page, 'Evento movido para "Em negociação".');
    await page.reload();
    await expect(colunaNegociacao.locator('.evento-card', { hasText: cliente })).toBeVisible();

    // Sem arrastar (teclado/toque): menu "⋯" → Mover para; ida e volta
    const menu = card.locator('[data-card-menu]');
    await menu.locator('summary').click();
    await menu.getByRole('button', { name: 'Novo orçamento' }).click();
    await expectToast(page, 'Evento movido para "Novo orçamento".');
    await expect(colunaEntrada.locator('.evento-card', { hasText: cliente })).toBeVisible();
    await menu.locator('summary').click();
    await expect(menu.getByRole('button', { name: 'Novo orçamento' })).toHaveCount(0);
    await menu.getByRole('button', { name: 'Em negociação' }).click();
    await expectToast(page, 'Evento movido para "Em negociação".');
    await page.reload();
    await expect(colunaNegociacao.locator('.evento-card', { hasText: cliente })).toBeVisible();

    // O card inteiro abre o resumo
    await colunaNegociacao.locator('.evento-card', { hasText: cliente }).locator('.evento-card-link').click();
    await expect(page).toHaveURL(/\/eventos\/[0-9a-f-]{36}$/);

    // Etapa pela faixa do resumo: marcar como perdido pede o motivo (UX-104) e tem Desfazer (UX-117)
    const selectEtapa = page.locator('#status-evento');
    await selectEtapa.selectOption({ label: 'Recusado' });
    const dialogoEtapa = page.locator('[data-etapa-dialogo]');
    await expect(dialogoEtapa).toBeVisible();
    await expect(dialogoEtapa).toContainText('Marcar como perdido');
    await dialogoEtapa.locator('#etapa-motivo').selectOption('Preço');
    await dialogoEtapa.locator('#etapa-detalhe').fill('acima da verba');
    await dialogoEtapa.getByRole('button', { name: 'Marcar como perdido' }).click();
    await expectToast(page, 'Etapa alterada para "Recusado".');
    await page.reload();
    await expect(page.locator('.banner')).toContainText('Motivo: Preço — acima da verba');
    await page.goto(`${eventoUrl}/linha-do-tempo`);
    await expect(page.locator('.timeline')).toContainText('motivo: Preço — acima da verba');

    // Cancelar o diálogo mantém a etapa; voltar para negociação limpa o motivo
    await page.goto(eventoUrl);
    await selectEtapa.selectOption({ label: 'Aprovado' });
    await dialogoEtapa.getByRole('button', { name: 'Voltar' }).click();
    await expect(selectEtapa.locator('option:checked')).toHaveText('Recusado');
    await selectEtapa.selectOption({ label: 'Em negociação' });
    await expectToast(page, 'Etapa alterada para "Em negociação".');
    await page.reload();
    await expect(page.locator('.banner')).not.toContainText('Motivo:');

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
    await page.getByRole('button', { name: 'Excluir evento' }).click();
    await confirmarModal(page);
    await expectToast(page, 'Evento excluído.');
    await expect(page).toHaveURL(/\/eventos$/);

    await page.goto(`/clientes?q=${encodeURIComponent(cliente)}`);
    await page.locator('tr', { hasText: cliente }).getByRole('button', { name: 'Editar' }).click();
    await page.locator('#drawer-cliente').getByRole('button', { name: 'Excluir' }).click();
    await confirmarModal(page);
    await expectToast(page, 'Cliente removido.');
  });

  test('categorias do formulário respeitam o tipo de evento', async ({ page }) => {
    await page.goto('/eventos/novo');
    await page.getByLabel('Tipo', { exact: true }).selectOption({ label: 'Corporativo' });
    const categoria = page.getByLabel('Ocasião');
    await expect(categoria.locator('option', { hasText: 'Casamento' })).toBeHidden();
    await expect(categoria.locator('option', { hasText: 'Confraternização de fim de ano' })).not.toHaveAttribute('hidden');
  });

  test('intervalo de trabalho do Kanban: configurado pela empresa e substituído pelo filtro de datas', async ({ page }) => {
    const salvarIntervalo = async (rotulo: string) => {
      await page.goto('/configuracoes/status-orcamento');
      await page.getByRole('radio', { name: rotulo, exact: true }).check();
      await page.getByRole('button', { name: 'Salvar intervalo' }).click();
      await expectToast(page, 'Intervalo de trabalho salvo.');
      await expect(page.getByRole('radio', { name: rotulo, exact: true })).toBeChecked();
    };
    const anterior = await (async () => {
      await page.goto('/configuracoes/status-orcamento');
      return (await page.locator('.intervalo-opcao:has(input:checked) span').textContent())!.trim();
    })();

    try {
      await salvarIntervalo('1 mês');
      await page.goto('/eventos');
      await expect(page.locator('[data-recorte]')).toContainText('Intervalo de trabalho: 1 mês, de hoje até');

      // O filtro só tem Data de / Até, e elas valem como recorte temporário
      await page.getByText('Filtros').click();
      await expect(page.locator('input[name=periodo]')).toHaveCount(0);
      await page.locator('#f-de').fill('2027-01-01');
      await page.locator('#f-ate').fill('2027-12-31');
      await page.getByRole('button', { name: 'Aplicar' }).click();
      await expect(page.locator('[data-recorte]')).toContainText('Filtro de datas: 01/01/2027 a 31/12/2027');
      await page.getByRole('link', { name: 'Voltar ao intervalo de trabalho' }).click();
      await expect(page.locator('[data-recorte]')).toContainText('Intervalo de trabalho: 1 mês, de hoje até');
    } finally {
      await salvarIntervalo(anterior);
    }
  });
});
