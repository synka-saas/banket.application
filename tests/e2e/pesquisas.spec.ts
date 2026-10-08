import { expect, test } from '@playwright/test';
import { criarEventoE2E, expectToast, login, psql, removerEventoBanco } from './helpers';

// Pesquisa de satisfação: questionário editável, lembrete dos eventos realizados, envio por e-mail (Inbox),
// resposta do cliente pelo link público e os indicadores (NPS, respostas, por pergunta).

test.describe('Pesquisas de satisfação', () => {
  test('envia, o cliente responde pelo link e os resultados aparecem', async ({ page, browser }) => {
    test.setTimeout(150_000);
    await login(page);
    const sufixo = Date.now();
    const pergunta = `Decoração das mesas E2E ${sufixo}`;
    const titulo = `E2E Pesquisa ${sufixo}`;
    let eventoUrl = '';
    try {
      // Questionário: perguntas padrão (NPS primeiro), nova pergunta e só uma NPS
      await page.goto('/pesquisas/configurar');
      await expect(page.locator('.data-table tbody tr').first()).toContainText('recomendaria');
      await page.getByRole('button', { name: 'Nova pergunta' }).click();
      const drawer = page.locator('#drawer-pergunta');
      await drawer.locator('#pq-tipo').selectOption('nps');
      await drawer.locator('#pq-texto').fill('Outra NPS');
      await drawer.getByRole('button', { name: 'Salvar' }).click();
      await expect(drawer).toContainText('já tem uma pergunta NPS');
      await drawer.locator('#pq-tipo').selectOption('nota');
      await drawer.locator('#pq-texto').fill(pergunta);
      await drawer.getByRole('button', { name: 'Salvar' }).click();
      await expectToast(page, 'Pergunta adicionada.');

      // Evento fechado e já realizado aparece no lembrete
      eventoUrl = await criarEventoE2E(page, titulo, '2026-10-01');
      await page.locator('#status-evento').selectOption({ label: 'Aprovado' });
      const dialogo = page.locator('[data-etapa-dialogo]');
      await dialogo.locator('#etapa-plano').uncheck();
      await dialogo.getByRole('button', { name: 'Confirmar fechamento' }).click();
      await expectToast(page, 'Etapa alterada para "Aprovado".');

      await page.goto('/pesquisas');
      const lembrete = page.locator('.section-card', { hasText: 'Eventos realizados sem pesquisa' });
      await lembrete.locator('.fin-lista-item', { hasText: titulo }).getByRole('button', { name: 'Enviar' }).click();
      const envio = page.locator('#drawer-pesquisa');
      await expect(envio.locator('[name=mensagem]')).toHaveValue(/\{link_pesquisa\}/);
      await expect(envio.locator('[name=mensagem]')).toHaveValue(new RegExp(titulo));
      await envio.locator('[name=para]').fill('cliente-pesquisa@example.com');
      await envio.getByRole('button', { name: 'Enviar' }).click();
      await expectToast(page, /Envio registrado|Pesquisa enviada/);

      // O e-mail fica na conversa do evento, com o link
      const eventoId = new URL(eventoUrl).pathname.split('/')[2];
      const token = psql(`SELECT token FROM pesquisa_envios WHERE evento_id = '${eventoId}'`);
      expect(token).toMatch(/^[\w-]{20,}$/);
      expect(psql(`SELECT count(*) FROM mensagens m JOIN conversas c ON c.id = m.conversa_id WHERE c.evento_id = '${eventoId}' AND m.texto LIKE '%/p/${token}%'`)).toBe('1');

      // Cliente responde sem login
      const cliente = await browser.newContext();
      const publica = await cliente.newPage();
      await publica.goto(`/p/${token}`);
      await expect(publica.locator('.ps-evento')).toContainText(titulo);
      const campo = (texto: string) => publica.locator('fieldset.ps-pergunta', { hasText: texto });
      // Obrigatória em branco: o navegador bloqueia; sem o required, o servidor recusa
      await publica.locator('[required]').evaluateAll((els) => els.forEach((el) => el.removeAttribute('required')));
      await publica.getByRole('button', { name: 'Enviar respostas' }).click();
      await expect(publica.locator('.ps-erro')).toContainText('Responda');
      await campo('recomendaria').locator('label:has(input[value="9"])').click();
      await campo('Qualidade da comida').locator('label:has(input[value="5"])').click();
      await campo('Atendimento da equipe').locator('label:has(input[value="4"])').click();
      await campo(pergunta).locator('label:has(input[value="3"])').click();
      await campo('expectativas').locator('label:has(input[value="Superou as expectativas"])').click();
      await campo('O que poderíamos melhorar').locator('textarea').fill('Mais opções de doces E2E');
      await publica.getByRole('button', { name: 'Enviar respostas' }).click();
      await expect(publica.locator('.ps-centro')).toContainText('Obrigado');
      await publica.goto(`/p/${token}`);
      await expect(publica.locator('.ps-centro')).toContainText('Obrigado');
      await cliente.close();

      // Respostas e indicadores
      await page.goto(`/pesquisas/respostas?q=${encodeURIComponent(titulo)}`);
      const linha = page.locator('.data-table tbody tr', { hasText: titulo });
      await expect(linha).toContainText('Respondida');
      await expect(linha).toContainText('9 · Promotor');
      await linha.getByRole('link', { name: 'Ver respostas' }).click();
      await expect(page.locator('.rp-lista')).toContainText('Mais opções de doces E2E');
      await expect(page.locator('.rp-lista')).toContainText('Superou as expectativas');

      const perguntaId = psql(`SELECT id FROM pesquisa_perguntas WHERE texto = '${pergunta}'`);
      await page.goto(`/pesquisas/perguntas?pergunta=${perguntaId}`);
      await expect(page.locator('.section-card')).toContainText('01 respostas');
      await expect(page.locator('.data-table tbody tr', { hasText: titulo })).toContainText('3');

      await page.goto('/pesquisas');
      await expect(page.locator('.fin-resumo')).toContainText('NPS');
      await expect(page.locator('.section-card', { hasText: 'Satisfação por aspecto' })).toContainText(pergunta);

      await page.goto(`${eventoUrl}/linha-do-tempo`);
      await expect(page.locator('.timeline')).toContainText('Pesquisa de satisfação respondida — NPS 9 (promotor)');
    } finally {
      if (eventoUrl) removerEventoBanco(eventoUrl);
      psql(`DELETE FROM pesquisa_perguntas WHERE texto = '${pergunta}'`);
    }
  });

  test('usuário comum vê as pesquisas, mas não edita o questionário', async ({ page }) => {
    await login(page, { email: 'operacao@banket.com.br', senha: 'Banket.2026' });
    await page.goto('/pesquisas');
    await expect(page.locator('.submenu, nav').filter({ hasText: 'Respostas' }).first()).not.toContainText('Questionário e e-mail');
    await page.goto('/pesquisas/configurar');
    await expect(page).toHaveURL(/\/pesquisas$/);
  });
});
