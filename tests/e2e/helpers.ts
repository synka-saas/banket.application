import { expect, type Page } from '@playwright/test';

export const USUARIO_DEMO = { email: 'leandro@banket.com.br', senha: 'Banket.2026' };

export async function login(page: Page, usuario = USUARIO_DEMO) {
  await page.goto('/auth/login');
  await page.fill('#email', usuario.email);
  await page.fill('#senha', usuario.senha);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith('/auth')), page.click('button[type=submit]')]);
}

export async function expectToast(page: Page, texto: string | RegExp) {
  await expect(page.locator('.toast').filter({ hasText: texto }).first()).toBeVisible();
}

/** Aguarda as ilhas interativas (Preact) hidratarem — o Astro remove o atributo "ssr" ao hidratar. */
export async function waitForIslands(page: Page) {
  await page.waitForFunction(() => document.querySelectorAll('astro-island[ssr]').length === 0);
}

/** Exclui um evento pela tela de Resumo (limpeza dos eventos criados pelos testes). Aceita qualquer URL do evento. */
export async function excluirEvento(page: Page, eventoUrl: string) {
  const id = new URL(eventoUrl, 'http://localhost').pathname.split('/')[2];
  await page.goto(`/eventos/${id}`);
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Excluir evento' }).click();
  await expectToast(page, 'Evento excluído.');
}
