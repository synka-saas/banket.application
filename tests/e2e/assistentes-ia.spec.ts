import { expect, test } from '@playwright/test';
import { excluirEvento, expectToast, login, psql, waitForIslands } from './helpers';

// Assistentes de IA sem chamar a OpenAI: margem projetada (cálculo do sistema), telas dos assistentes e
// "Aplicar troca" do Assistente de Orçamentos IA (o mesmo envio que o botão da sugestão faz).
const SAI = 'Bruschetta de tomate, manjericão e parmesão';
const ENTRA = 'Steak tartar';

test('margem projetada, telas dos assistentes e aplicação de uma troca', async ({ page }) => {
  test.setTimeout(120_000);
  const ids = Object.fromEntries(
    psql(`SELECT i.nome || '|' || i.id || '|' || COALESCE(i.custo_unitario::text, '') FROM catalogo_itens i JOIN tenants t ON t.id = i.tenant_id
          WHERE t.slug = 'banket' AND i.nome IN ('${SAI}', '${ENTRA}')`)
      .split('\n')
      .map((l) => l.split('|'))
      .map(([nome, id, custo]) => [nome, { id, custo }])
  ) as Record<string, { id: string; custo: string }>;
  const custo = (id: string, v: string) => psql(`UPDATE catalogo_itens SET custo_unitario = ${v || 'NULL'} WHERE id = '${id}'`);
  custo(ids[SAI].id, '3');
  custo(ids[ENTRA].id, '2');
  // Custo esperado: soma do custo por porção dos itens ativos da seção Coquetel (menos o desmarcado) × 50 convidados
  const somaCoquetel = Number(
    psql(`SELECT COALESCE(sum(i.custo_unitario), 0) FROM catalogo_itens i JOIN catalogo_secoes s ON s.id = i.secao_id JOIN tenants t ON t.id = i.tenant_id
          WHERE t.slug = 'banket' AND s.nome = 'Coquetel' AND i.ativo AND i.nome <> '${ENTRA}'`)
  );
  const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\u00a0/g, ' ');
  const antes = brl(somaCoquetel * 50);
  const depois = brl((somaCoquetel - 3 + 2) * 50);
  await login(page);
  let eventoUrl: string | null = null;
  try {
    await page.goto('/eventos/novo');
    await page.getByLabel('Cliente*').selectOption({ label: 'Maria Eduarda Silva' });
    await page.getByLabel('Título do evento').fill(`E2E IA ${Date.now()}`);
    await page.getByLabel('Convidados', { exact: true }).fill('50');
    await page.getByRole('button', { name: 'Criar evento' }).first().click();
    await expectToast(page, 'Evento criado.');
    eventoUrl = page.url();
    const eventoId = new URL(eventoUrl).pathname.split('/')[2];

    // Assistente de Negociação IA: aba e botão
    await page.getByRole('link', { name: 'Assistente de Negociação IA' }).click();
    await expect(page.getByText('Nenhuma análise ainda')).toBeVisible();
    await expect(page.getByRole('button', { name: /Analisar negociação/ })).toBeVisible();

    // Orçamento com a seção Coquetel; Steak tartar desmarcado (alternativa da seção)
    await page.goto(`/eventos/${eventoId}`);
    await page.getByRole('button', { name: 'Criar orçamento' }).click();
    await waitForIslands(page);
    await page.getByRole('button', { name: /Adicionar cardápio/ }).click();
    await page.getByRole('combobox', { name: /Adicionar cardápio/ }).fill('zero');
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: /Adicionar seção/ }).click();
    await page.getByRole('combobox', { name: /Adicionar seção/ }).fill('coquetel');
    await page.keyboard.press('Enter');
    await page.locator('.chip-item', { hasText: ENTRA }).locator('input').uncheck();
    await expect(page.locator('.orc-estado')).toHaveText('Todas as alterações salvas', { timeout: 10_000 });
    await expect(page.locator('.orc-margem')).toContainText(antes);

    // Assistente de Orçamentos IA: margem e custo por item
    await page.getByRole('link', { name: 'Assistente de Orçamentos IA' }).click();
    await expect(page.locator('.kpis')).toContainText(antes);
    await expect(page.locator('.tabela-orc')).toContainText(SAI);
    await expect(page.getByRole('button', { name: /Gerar sugestões/ })).toBeVisible();

    // Aplicar troca (mesmo POST do botão da sugestão)
    const res = await page.request.post(`/eventos/${eventoId}/assistente-orcamento`, {
      form: { _action: 'aplicar', numero: '1', incluir_id: ids[ENTRA].id, remover_id: ids[SAI].id },
      headers: { Origin: new URL(page.url()).origin },
    });
    expect(res.ok()).toBeTruthy();
    await page.goto(`/eventos/${eventoId}/assistente-orcamento`);
    // A bruschetta (R$ 3) saiu e o Steak tartar (R$ 2) entrou: R$ 50 a menos no evento
    await expect(page.locator('.kpis')).toContainText(depois);
    await expect(page.locator('.tabela-orc')).toContainText(ENTRA);
    await expect(page.locator('.tabela-orc')).not.toContainText(SAI);
    await page.goto(`/eventos/${eventoId}/linha-do-tempo`);
    await expect(page.locator('body')).toContainText(`"${SAI}" trocado por "${ENTRA}"`);
  } finally {
    custo(ids[SAI].id, ids[SAI].custo);
    custo(ids[ENTRA].id, ids[ENTRA].custo);
    if (eventoUrl) await excluirEvento(page, eventoUrl);
  }
});
