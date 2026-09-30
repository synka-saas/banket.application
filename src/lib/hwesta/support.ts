// HCP v1 — handlers das rotas do PRÓPRIO usuário do app (/api/suporte/tickets), que repassam ao Manager.
// Exigem sessão do app (não são públicas no middleware).
import type { APIRoute } from 'astro';
import { tickets } from './client';
import type { HwestaAdapter } from './types';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const PRIORITIES = new Set(['low', 'medium', 'high', 'critical']);
const CATEGORIES = new Set(['Bug', 'Dúvida', 'Financeiro', 'Sugestão', 'Outro']);

export function createSupportHandlers(adapter: HwestaAdapter) {
  const withRequester = (fn: (ctx: Parameters<APIRoute>[0], who: NonNullable<Awaited<ReturnType<HwestaAdapter['resolveRequester']>>>) => Promise<Response>): APIRoute =>
    async (ctx) => {
      const who = await adapter.resolveRequester(ctx);
      if (!who) return json({ message: 'Não autenticado' }, 401);
      return fn(ctx, who);
    };

  /** O chamado precisa ser do usuário (ou da conta dele) — o Manager não conhece as sessões do app. */
  async function loadOwned(id: string, who: { userId: string; accountId: string }) {
    const r = await tickets.get(id);
    const t = (r.data as any)?.data;
    if (!r.ok || !t) return { r, ticket: null };
    const owned = String(t.user_id ?? '') === who.userId || String(t.tenant_id ?? '') === who.accountId;
    return { r, ticket: owned ? t : null };
  }

  return {
    list: withRequester(async (_ctx, who) => {
      const r = await tickets.listByUser(who.userId);
      return json(r.data ?? { data: [] }, r.status);
    }),

    create: withRequester(async (ctx, who) => {
      let body: any;
      try { body = await ctx.request.json(); } catch { return json({ message: 'JSON inválido' }, 400); }
      const subject = String(body?.subject ?? '').trim();
      const description = String(body?.description ?? '').trim();
      if (!subject) return json({ message: 'O assunto é obrigatório.' }, 400);
      if (!description) return json({ message: 'A descrição é obrigatória.' }, 400);
      const r = await tickets.create({
        subject: subject.slice(0, 255),
        description,
        priority: PRIORITIES.has(body.priority) ? body.priority : 'medium',
        category: CATEGORIES.has(body.category) ? body.category : null,
        user_id: who.userId,
        tenant_id: who.accountId,
        user_name: who.name,
        user_email: who.email,
        context: {
          app_id: adapter.appId,
          app_version: adapter.version,
          plan: who.planSlug ?? null,
          url: typeof body.url === 'string' ? body.url.slice(0, 500) : ctx.request.headers.get('referer'),
          user_agent: ctx.request.headers.get('user-agent'),
          client_state: body.client_state ?? null,
        },
      });
      return json(r.data ?? {}, r.status);
    }),

    detail: withRequester(async (ctx, who) => {
      const { r, ticket } = await loadOwned(String(ctx.params.id), who);
      if (!ticket) return json({ message: 'Chamado não encontrado' }, r.ok ? 404 : r.status);
      return json({ data: ticket });
    }),

    reply: withRequester(async (ctx, who) => {
      const { r, ticket } = await loadOwned(String(ctx.params.id), who);
      if (!ticket) return json({ message: 'Chamado não encontrado' }, r.ok ? 404 : r.status);
      let body: any;
      try { body = await ctx.request.json(); } catch { return json({ message: 'JSON inválido' }, 400); }
      const content = String(body?.content ?? '').trim();
      if (!content) return json({ message: 'A mensagem não pode estar vazia.' }, 400);
      const sent = await tickets.reply(ticket.id, content, who.name);
      return json(sent.data ?? {}, sent.status);
    }),
  };
}
