import type { APIRoute } from 'astro';
import { z } from 'zod';
import { jsonEndpoint, readJson } from '../../../lib/api';
import { setFlash } from '../../../lib/flash';
import { cancelarAssinatura, retomarAssinatura } from '../../../server/assinatura';

// POST { motivo? } agenda o cancelamento para o fim do período pago; DELETE desfaz.
export const POST: APIRoute = jsonEndpoint(async ({ request, locals, cookies }) => {
  const { motivo } = z.object({ motivo: z.string().max(500).default('') }).parse(await readJson(request));
  const em = await cancelarAssinatura(locals.user, motivo);
  setFlash(cookies, 'success', em ? `Cancelamento agendado. O acesso continua até ${em.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.` : 'Cancelamento agendado para o fim do período pago.');
  return { ok: true, redirect: '/configuracoes/financeiro' };
});

export const DELETE: APIRoute = jsonEndpoint(async ({ locals, cookies }) => {
  await retomarAssinatura(locals.user);
  setFlash(cookies, 'success', 'Cancelamento desfeito. Sua assinatura continua ativa.');
  return { ok: true, redirect: '/configuracoes/financeiro' };
});
