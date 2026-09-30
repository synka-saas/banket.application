import { createHmac } from 'node:crypto';
import type { APIContext } from 'astro';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HwestaError, type HwestaAccount, type HwestaAdapter, type HwestaEntitlements } from './types';

// O adapter real conhece o banco; aqui entra um de mentira só com o snapshot de entitlements
const snapshots = new Map<string, HwestaEntitlements>();
vi.mock('./adapter', () => ({
  default: { getEntitlements: async (id: string) => snapshots.get(id) ?? null },
}));

const { requireManager, verifySignature } = await import('./auth');
const { can, invalidateEntitlements, limit, withinLimit } = await import('./entitlements');
const { createHwestaHandlers } = await import('./handlers');

const CHAVE = 'k'.repeat(64);
const CONTA = '11111111-1111-4111-8111-111111111111';

const conta: HwestaAccount = {
  id: CONTA, name: 'Buffet Teste', legal_name: null, tax_id: null, email: null, owner_name: null, owner_email: null,
  owner_phone: null, status: 'active', is_active: true, plan_slug: null, plan_name: null, user_count: 1,
  created_at: null, updated_at: null,
};

function adapterFalso(extra: Partial<HwestaAdapter> = {}): HwestaAdapter {
  return {
    appId: 'banket', name: 'Banket', version: '0.0.1',
    capabilities: {
      accounts: true, users: true, plans_catalog: false, entitlements_push: true, kill_switch: true,
      users_status: true, users_reset_password: false, events: true, tickets: true,
    },
    listPlans: async () => [],
    listAccounts: async () => ({ data: [conta], total: 1 }),
    getAccount: async (id) => (id === CONTA ? conta : null),
    listUsers: async () => [],
    setAccountStatus: async (id, status) => (id === CONTA ? { ...conta, status, is_active: status === 'active' } : null),
    applyEntitlements: async (id) => id === CONTA,
    getEntitlements: async () => null,
    recordEvent: async () => true,
    resolveRequester: () => null,
    ...extra,
  };
}

function ctx(path: string, init: RequestInit & { params?: Record<string, string>; semToken?: boolean } = {}): APIContext {
  const { params = {}, semToken, ...resto } = init;
  const url = new URL(`http://banket:4321/api/hwesta/v1${path}`);
  const headers = new Headers(resto.headers);
  if (!semToken) headers.set('Authorization', `Bearer ${CHAVE}`);
  return { request: new Request(url, { ...resto, headers }), url, params } as unknown as APIContext;
}

const assinar = (corpo: string) => 'sha256=' + createHmac('sha256', CHAVE).update(corpo).digest('hex');

beforeEach(() => {
  process.env.HWESTA_MANAGER_KEY = CHAVE;
});
afterEach(() => {
  delete process.env.HWESTA_MANAGER_KEY;
  snapshots.clear();
  invalidateEntitlements(CONTA);
});

describe('hwesta/auth', () => {
  it('só aceita o Bearer do Manager', async () => {
    expect(requireManager(new Request('http://x', { headers: { Authorization: `Bearer ${CHAVE}` } }))).toBeNull();
    expect(requireManager(new Request('http://x'))?.status).toBe(401);
    expect(requireManager(new Request('http://x', { headers: { Authorization: 'Bearer errado' } }))?.status).toBe(401);
  });

  it('sem chave configurada a integração fica desligada (503), nunca aberta', () => {
    delete process.env.HWESTA_MANAGER_KEY;
    expect(requireManager(new Request('http://x', { headers: { Authorization: 'Bearer ' } }))?.status).toBe(503);
  });

  it('confere a assinatura HMAC do corpo bruto', () => {
    const corpo = JSON.stringify({ id: 'a', type: 'platform.ping' });
    expect(verifySignature(corpo, assinar(corpo))).toBe(true);
    expect(verifySignature(corpo + ' ', assinar(corpo))).toBe(false);
    expect(verifySignature(corpo, null)).toBe(false);
  });
});

describe('hwesta/entitlements', () => {
  it('conta sem snapshot não sofre restrição', async () => {
    expect(await can(CONTA, 'exportar_pdf')).toBe(true);
    expect(await limit(CONTA, 'max_usuarios')).toBe(Number.POSITIVE_INFINITY);
    expect(await withinLimit(CONTA, 'max_usuarios', 999)).toBe(true);
  });

  it('aplica o snapshot empurrado pelo Manager', async () => {
    snapshots.set(CONTA, {
      plan_slug: 'essencial', plan_name: 'Essencial', status: 'active', expires_at: null,
      capabilities: { max_usuarios: 3, exportar_pdf: false, ilimitado: -1 },
    });
    expect(await can(CONTA, 'exportar_pdf')).toBe(false);
    expect(await can(CONTA, 'recurso_nao_listado')).toBe(true);
    expect(await limit(CONTA, 'max_usuarios')).toBe(3);
    expect(await withinLimit(CONTA, 'max_usuarios', 2)).toBe(true);
    expect(await withinLimit(CONTA, 'max_usuarios', 3)).toBe(false);
    expect(await limit(CONTA, 'ilimitado')).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('hwesta/handlers', () => {
  it('ping declara protocolo e capabilities; sem token responde 401', async () => {
    const h = createHwestaHandlers(adapterFalso());
    const ok = await h.ping(ctx('/ping'));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ app_id: 'banket', protocol: '1.0', capabilities: { kill_switch: true, plans_catalog: false } });
    expect((await h.ping(ctx('/ping', { semToken: true }))).status).toBe(401);
  });

  it('capability desligada responde 501', async () => {
    const h = createHwestaHandlers(adapterFalso());
    expect((await h.plans(ctx('/plans'))).status).toBe(501);
    expect((await h.userResetPassword(ctx('/x', { method: 'POST', params: { id: CONTA, uid: CONTA } }))).status).toBe(501);
  });

  it('lista contas paginadas e devolve 404 para conta inexistente', async () => {
    const h = createHwestaHandlers(adapterFalso());
    expect(await (await h.accountsList(ctx('/accounts?page=2&per_page=10'))).json()).toMatchObject({ page: 2, per_page: 10, total: 1 });
    expect((await h.accountGet(ctx('/accounts/x', { params: { id: 'x' } }))).status).toBe(404);
    expect(await (await h.accountGet(ctx(`/accounts/${CONTA}`, { params: { id: CONTA } }))).json()).toMatchObject({ id: CONTA, users: [], entitlements: null });
  });

  it('kill-switch valida o status e repassa ao adapter', async () => {
    const setAccountStatus = vi.fn(adapterFalso().setAccountStatus);
    const h = createHwestaHandlers(adapterFalso({ setAccountStatus }));
    const patch = (body: unknown) =>
      h.accountStatus(ctx('/s', { method: 'PATCH', params: { id: CONTA }, body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }));
    expect((await patch({ status: 'trial' })).status).toBe(400);
    expect(setAccountStatus).not.toHaveBeenCalled();
    expect(await (await patch({ status: 'suspended', reason: 'teste' })).json()).toMatchObject({ status: 'suspended', is_active: false });
    expect(setAccountStatus).toHaveBeenCalledWith(CONTA, 'suspended', 'teste');
  });

  it('regra de negócio do adapter vira 409 com a mensagem; erro inesperado vira 500 genérico', async () => {
    const patch = (adapter: HwestaAdapter) =>
      createHwestaHandlers(adapter).userStatus(
        ctx('/u', { method: 'PATCH', params: { id: CONTA, uid: CONTA }, body: JSON.stringify({ status: 'inactive' }) })
      );
    const negocio = await patch(adapterFalso({ setUserStatus: async () => { throw new HwestaError('Único proprietário.'); } }));
    expect(negocio.status).toBe(409);
    expect(await negocio.json()).toEqual({ error: 'Único proprietário.' });

    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const inesperado = await patch(adapterFalso({ setUserStatus: async () => { throw new Error('senha do banco na mensagem'); } }));
    expect(inesperado.status).toBe(500);
    expect(await inesperado.json()).toEqual({ error: 'Erro interno' });
    log.mockRestore();
  });

  it('eventos exigem assinatura e ignoram entrega repetida', async () => {
    const vistos = new Set<string>();
    const onEvent = vi.fn(async () => {});
    const h = createHwestaHandlers(
      adapterFalso({ recordEvent: async (e) => (vistos.has(e.id) ? false : (vistos.add(e.id), true)), onEvent })
    );
    const corpo = JSON.stringify({ id: 'e1', type: 'ticket.message', occurred_at: new Date().toISOString(), data: {} });
    const post = (assinatura?: string) =>
      h.events(ctx('/events', { method: 'POST', body: corpo, headers: assinatura ? { 'X-Hwesta-Signature': assinatura } : {} }));

    expect((await post()).status).toBe(401);
    expect((await post('sha256=00')).status).toBe(401);
    expect(await (await post(assinar(corpo))).json()).toEqual({ received: true, duplicate: false });
    expect(await (await post(assinar(corpo))).json()).toEqual({ received: true, duplicate: true });
    expect(onEvent).toHaveBeenCalledTimes(1);
  });
});
