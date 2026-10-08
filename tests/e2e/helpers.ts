import { execFileSync } from 'node:child_process';
import { expect, type Page } from '@playwright/test';

// Contêineres usados para ler os e-mails do log e consultar o banco.
// Padrão: ambiente de dev (make dev). Em produção: E2E_CONTAINER=banket-webapp_<cor>-1 E2E_DB_CONTAINER=banket-postgres-1
export const CONTAINER_APP = process.env.E2E_CONTAINER ?? 'application-webapp-1';
export const CONTAINER_DB = process.env.E2E_DB_CONTAINER ?? 'application-postgres-1';

export function psql(sql: string): string {
  return execFileSync('docker', ['exec', CONTAINER_DB, 'sh', '-c', `psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "${sql}"`], {
    encoding: 'utf8',
  }).trim();
}

export const USUARIO_DEMO = { email: 'leandro@banket.com.br', senha: 'Banket.2026' };

export async function login(page: Page, usuario = USUARIO_DEMO) {
  await page.goto('/auth/login');
  await page.fill('#email', usuario.email);
  await page.fill('#senha', usuario.senha);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith('/auth')), page.click('button[type=submit]')]);
}

/** Confirma o modal de confirmação do sistema (components/ui/Confirmar.astro), aberto pela ação anterior. */
export async function confirmarModal(page: Page) {
  await page.locator('dialog.confirmar[open] [data-confirmar-ok]').click();
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
  await page.getByRole('button', { name: 'Excluir evento' }).click();
  await confirmarModal(page);
  await expectToast(page, 'Evento excluído.');
}

/** Cria um evento simples pela tela (cliente do seed); devolve a URL do resumo. */
export async function criarEventoE2E(page: Page, titulo: string, data?: string): Promise<string> {
  await page.goto('/eventos/novo');
  await page.getByLabel('Cliente*').selectOption({ label: 'Maria Eduarda Silva' });
  await page.getByLabel('Título do evento').fill(titulo);
  if (data) await page.locator('#ev-data').fill(data);
  await page.getByRole('button', { name: 'Criar evento' }).first().click();
  await expectToast(page, 'Evento criado.');
  return page.url();
}

/** Remove direto no banco um evento criado pelo teste, com o orçamento e as contas do financeiro (que só seriam desvinculadas). */
export function removerEventoBanco(eventoUrl: string) {
  const id = new URL(eventoUrl, 'http://localhost').pathname.split('/')[2];
  psql(`DELETE FROM fin_contas WHERE evento_id = '${id}'; DELETE FROM orcamentos WHERE evento_id = '${id}'; DELETE FROM eventos WHERE id = '${id}'`);
}
