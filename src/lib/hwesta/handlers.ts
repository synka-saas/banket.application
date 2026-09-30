// HCP v1 — handlers genéricos das rotas {prefix}/*. Não editar por app.
import type { APIRoute } from 'astro';
import { requireManager, verifySignature } from './auth';
import { invalidateEntitlements } from './entitlements';
import { HwestaError, type HwestaAdapter, type HwestaEntitlements, type HwestaEvent } from './types';

export const HCP_PROTOCOL = '1.0';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

async function readJson(request: Request): Promise<any | undefined> {
  try { return await request.json(); } catch { return undefined; }
}

export function createHwestaHandlers(adapter: HwestaAdapter) {
  const guard = (fn: APIRoute): APIRoute => async (ctx) => {
    const denied = requireManager(ctx.request);
    if (denied) return denied;
    try {
      return await fn(ctx);
    } catch (err) {
      if (err instanceof HwestaError) return json({ error: err.message }, err.status);
      console.error(`[hwesta] ${ctx.request.method} ${ctx.url.pathname}:`, err);
      return json({ error: 'Erro interno' }, 500);
    }
  };
  const need = (cap: keyof HwestaAdapter['capabilities']) =>
    adapter.capabilities[cap] ? null : json({ error: `Capability "${cap}" não suportada por ${adapter.appId}` }, 501);

  return {
    ping: guard(async () => json({
      app_id: adapter.appId, name: adapter.name, version: adapter.version, protocol: HCP_PROTOCOL,
      time: new Date().toISOString(), capabilities: adapter.capabilities,
    })),

    plans: guard(async () => need('plans_catalog') ?? json(await adapter.listPlans())),

    accountsList: guard(async ({ url }) => {
      const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1);
      const perPage = Math.min(500, Math.max(1, Number(url.searchParams.get('per_page') ?? 100) || 100));
      const { data, total } = await adapter.listAccounts({
        page, perPage, updatedSince: url.searchParams.get('updated_since'), q: url.searchParams.get('q'),
      });
      return json({ data, page, per_page: perPage, total });
    }),

    accountGet: guard(async ({ params }) => {
      const account = await adapter.getAccount(String(params.id));
      if (!account) return json({ error: 'Conta não encontrada' }, 404);
      const [users, entitlements] = await Promise.all([adapter.listUsers(account.id), adapter.getEntitlements(account.id)]);
      return json({ ...account, users, entitlements });
    }),

    accountStatus: guard(async ({ params, request }) => {
      const no = need('kill_switch'); if (no) return no;
      const body = await readJson(request);
      if (!body || !['active', 'suspended', 'canceled'].includes(body.status)) return json({ error: 'status deve ser active | suspended | canceled' }, 400);
      const account = await adapter.setAccountStatus(String(params.id), body.status, body.reason ?? null);
      if (!account) return json({ error: 'Conta não encontrada' }, 404);
      invalidateEntitlements(account.id);
      return json(account);
    }),

    accountEntitlements: guard(async ({ params, request }) => {
      const no = need('entitlements_push'); if (no) return no;
      const body = await readJson(request);
      if (!body || typeof body.capabilities !== 'object' || body.capabilities === null) return json({ error: 'capabilities (objeto) é obrigatório' }, 400);
      const ent: HwestaEntitlements = {
        plan_slug: body.plan_slug ?? null, plan_name: body.plan_name ?? null,
        status: body.status ?? 'active', capabilities: body.capabilities,
        expires_at: body.expires_at ?? null, source: body.source ?? 'hwesta_manager',
        pushed_at: body.pushed_at ?? new Date().toISOString(),
      };
      const ok = await adapter.applyEntitlements(String(params.id), ent);
      if (!ok) return json({ error: 'Conta não encontrada' }, 404);
      invalidateEntitlements(String(params.id));
      return json({ ok: true, applied_at: new Date().toISOString() });
    }),

    accountUsers: guard(async ({ params }) => {
      const account = await adapter.getAccount(String(params.id));
      if (!account) return json({ error: 'Conta não encontrada' }, 404);
      return json(await adapter.listUsers(account.id));
    }),

    userStatus: guard(async ({ params, request }) => {
      const no = need('users_status'); if (no) return no;
      const body = await readJson(request);
      if (!body || !['active', 'inactive'].includes(body.status) || !adapter.setUserStatus) return json({ error: 'status deve ser active | inactive' }, 400);
      const user = await adapter.setUserStatus(String(params.id), String(params.uid), body.status);
      return user ? json(user) : json({ error: 'Usuário não encontrado nesta conta' }, 404);
    }),

    userResetPassword: guard(async ({ params }) => {
      const no = need('users_reset_password'); if (no) return no;
      if (!adapter.resetUserPassword) return json({ error: 'não implementado' }, 501);
      const ok = await adapter.resetUserPassword(String(params.id), String(params.uid));
      return ok ? json({ ok: true }) : json({ error: 'Usuário não encontrado nesta conta' }, 404);
    }),

    // Corpo bruto é necessário para validar a assinatura — por isso não passa por readJson.
    events: (async (ctx) => {
      const denied = requireManager(ctx.request);
      if (denied) return denied;
      const raw = await ctx.request.text();
      if (!verifySignature(raw, ctx.request.headers.get('x-hwesta-signature'))) return json({ error: 'Assinatura inválida' }, 401);
      let event: HwestaEvent;
      try { event = JSON.parse(raw); } catch { return json({ error: 'JSON inválido' }, 400); }
      if (!event?.id || !event?.type) return json({ error: 'id e type são obrigatórios' }, 400);
      try {
        const fresh = await adapter.recordEvent(event);
        if (fresh && adapter.onEvent) {
          if (event.type === 'account.entitlements_changed' && event.data?.account_id) invalidateEntitlements(String(event.data.account_id));
          await adapter.onEvent(event).catch((err) => console.error(`[hwesta] onEvent ${event.type}:`, err));
        }
        return json({ received: true, duplicate: !fresh });
      } catch (err) {
        console.error('[hwesta] events:', err);
        return json({ error: 'Erro interno' }, 500);
      }
    }) as APIRoute,
  };
}
