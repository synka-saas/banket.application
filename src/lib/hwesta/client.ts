// HCP v1 — cliente app -> Manager (helpdesk). Só roda no servidor; a chave nunca vai ao browser.
import { hwestaEnv } from './auth';

const TIMEOUT_MS = 10_000;

export interface ManagerResult<T = any> { ok: boolean; status: number; data: T | null }

export async function managerFetch<T = any>(path: string, init: { method?: string; body?: unknown } = {}): Promise<ManagerResult<T>> {
  const base = (hwestaEnv('HWESTA_MANAGER_URL') ?? '').replace(/\/+$/, '');
  const key = hwestaEnv('HWESTA_APP_KEY');
  if (!base || !key) return { ok: false, status: 503, data: { message: 'Integração com o suporte não configurada' } as any };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${base}${path}`, {
      method: init.method ?? 'GET',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: ctrl.signal,
    });
    const data = (await res.json().catch(() => null)) as T | null;
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    console.error('[hwesta] falha ao chamar o Manager:', (err as Error).message);
    return { ok: false, status: 502, data: { message: 'Suporte indisponível no momento' } as any };
  } finally {
    clearTimeout(timer);
  }
}

export interface NewTicket {
  subject: string;
  description: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  category?: string | null;
  user_id: string;
  tenant_id: string;
  user_name?: string | null;
  user_email?: string | null;
  context?: Record<string, unknown>;
}

export const tickets = {
  create: (t: NewTicket) => managerFetch('/api/public/tickets', { method: 'POST', body: t }),
  listByUser: (userId: string) => managerFetch(`/api/public/tickets?user_id=${encodeURIComponent(userId)}`),
  listByAccount: (accountId: string) => managerFetch(`/api/public/tickets?tenant_id=${encodeURIComponent(accountId)}`),
  get: (id: string | number) => managerFetch(`/api/public/tickets/${encodeURIComponent(String(id))}`),
  reply: (id: string | number, content: string, authorName: string | null) =>
    managerFetch(`/api/public/tickets/${encodeURIComponent(String(id))}`, { method: 'POST', body: { content, author_name: authorName } }),
};
