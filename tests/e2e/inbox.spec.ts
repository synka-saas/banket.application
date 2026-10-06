import { expect, test, type Page } from '@playwright/test';
import { confirmarModal, excluirEvento, expectToast, login, psql, waitForIslands } from './helpers';

// Inbox: a proposta enviada abre a conversa; a resposta do cliente (simulada no banco, como faria o webhook do Resend)
// aparece como não lida no menu, no inbox e na aba Mensagens do evento; o usuário comum não vê conversas dos outros.

const sufixo = Date.now();
const TITULO = `E2E Inbox ${sufixo}`;
const CLIENTE_EMAIL = 'cliente-inbox@example.com';
const USUARIO_COMUM = { email: 'operacao@banket.com.br', senha: 'Banket.2026' };

async function criarEventoComOrcamento(page: Page): Promise<string> {
  await page.goto('/eventos/novo');
  await page.getByLabel('Cliente*').selectOption({ label: 'Maria Eduarda Silva' });
  await page.getByLabel('Título do evento').fill(TITULO);
  await page.getByLabel('Convidados', { exact: true }).fill('50');
  await page.getByRole('button', { name: 'Criar evento' }).first().click();
  await expectToast(page, 'Evento criado.');
  const url = page.url();
  await page.getByRole('button', { name: 'Criar orçamento' }).click();
  await expectToast(page, 'Orçamento iniciado');
  await waitForIslands(page);
  return url;
}

test.describe('Inbox', () => {
  test('proposta abre a conversa, resposta do cliente chega como não lida e permissões por usuário', async ({ page }) => {
    await login(page);
    const eventoUrl = await criarEventoComOrcamento(page);
    const eventoId = new URL(eventoUrl).pathname.split('/')[2];

    // Enviar a proposta (domínio reservado: fica no log, mas a conversa é criada)
    await page.getByRole('button', { name: 'Enviar ao cliente' }).click();
    const drawer = page.locator('#drawer-enviar');
    while (await drawer.locator('.chip-email button').count()) {
      await drawer.locator('.chip-email button').first().click();
    }
    await drawer.getByLabel('Para*').fill(CLIENTE_EMAIL);
    await drawer.getByLabel('Para*').press('Enter');
    const assunto = await drawer.getByLabel('Assunto*').inputValue();
    await drawer.getByRole('button', { name: 'Enviar' }).click();
    await confirmarModal(page);
    await expect(page.locator('.toast').filter({ hasText: /versão 01 foi congelada/ })).toBeVisible({ timeout: 30_000 });

    // Aba Mensagens do evento: a thread com a proposta enviada e o PDF em anexo
    await page.goto(`${eventoUrl}/mensagens`);
    await expect(page.locator('.conv-assunto')).toHaveText(assunto);
    await expect(page.locator('.mensagem-saida')).toHaveCount(1);
    await expect(page.locator('.mensagem-saida')).toContainText(CLIENTE_EMAIL);
    await expect(page.locator('.mensagem-anexo')).toContainText('.pdf');
    const conversaId = await page.locator('[data-conversa]').getAttribute('data-conversa');
    expect(conversaId).toMatch(/^[0-9a-f-]{36}$/);

    // Responder pela aba do evento
    await page.getByLabel('Responder*').fill('Olá! Fico à disposição para ajustar a proposta.');
    await page.getByRole('button', { name: 'Enviar resposta' }).click();
    await expectToast(page, /Resposta (enviada|registrada)/);
    await expect(page).toHaveURL(/\/mensagens$/);
    await expect(page.locator('.mensagem-saida')).toHaveCount(2);

    // Inbox central lista a conversa
    await page.goto('/inbox');
    await expect(page.locator('tbody tr', { hasText: TITULO })).toContainText(assunto);
    await expect(page.locator('.nav-badge')).toHaveCount(0);

    // Resposta do cliente, como o webhook do Resend gravaria
    psql(
      `INSERT INTO mensagens (tenant_id, conversa_id, direcao, de, para, assunto, texto, message_id, resend_id, status, status_em)
         SELECT tenant_id, id, 'entrada', 'Cliente E2E <${CLIENTE_EMAIL}>', ARRAY['r-' || token || '@respostas.banket.com.br'],
                'Re: ' || assunto, 'Recebi a proposta, podemos fechar na data combinada?', '<e2e-${sufixo}@example.com>', 'e2e-${sufixo}', 'recebida', now()
           FROM conversas WHERE id = '${conversaId}'`
    );
    psql(
      `UPDATE conversas SET nao_lidas = 1, ultima_direcao = 'entrada', ultima_mensagem_em = now(),
              ultimo_trecho = 'Recebi a proposta, podemos fechar na data combinada?' WHERE id = '${conversaId}'`
    );

    // Contador no menu, filtro "Não lidas" e a mensagem na thread (abrir zera o contador)
    await page.goto('/inbox?filtro=nao_lidas');
    await expect(page.locator('.sidebar .nav-badge')).toHaveText('1');
    const linha = page.locator('tbody tr', { hasText: TITULO });
    await expect(linha).toContainText('Cliente:');
    await expect(linha).toContainText('01');
    await linha.getByRole('link', { name: assunto }).click();
    await expect(page).toHaveURL(new RegExp(`/inbox/${conversaId}$`));
    await expect(page.locator('.mensagem-entrada')).toContainText('Recebi a proposta, podemos fechar');
    await expect(page.locator('.mensagem-entrada')).toContainText('Cliente E2E');
    await expect(page.locator('.sidebar .nav-badge')).toHaveCount(0);
    // A linha do tempo do evento registra o e-mail recebido? (o webhook registra; a inserção direta não) — só a conversa
    await expect(page.locator('.conv-meta')).toContainText(CLIENTE_EMAIL);

    // Usuário comum não vê a conversa do proprietário
    await page.context().clearCookies();
    await login(page, USUARIO_COMUM);
    await page.goto('/inbox');
    await expect(page.locator('main')).not.toContainText(TITULO);
    await page.goto(`/inbox/${conversaId}`);
    await expect(page).toHaveURL(/\/inbox$/);
    await expectToast(page, 'Conversa não encontrada.');
    await page.goto(`/eventos/${eventoId}/mensagens`);
    await expect(page.locator('main')).toContainText('Nenhuma conversa com o cliente ainda');

    // Limpeza (o evento leva a conversa e as mensagens junto)
    await page.context().clearCookies();
    await login(page);
    await excluirEvento(page, eventoUrl);
    expect(psql(`SELECT count(*) FROM conversas WHERE id = '${conversaId}'`)).toBe('0');
  });
});
