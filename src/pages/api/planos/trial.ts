import type { APIRoute } from 'astro';
import { z } from 'zod';
import { jsonEndpoint, readJson } from '../../../lib/api';
import { withTenant } from '../../../lib/db';
import { setFlash } from '../../../lib/flash';
import { iniciarTrial, recusarTrial } from '../../../server/planos';

// Teste grátis a partir do plano gratuito: POST { plano_id } inicia; DELETE registra "não tenho interesse".
export const POST: APIRoute = jsonEndpoint(async ({ request, locals, cookies }) => {
  const { plano_id } = z.object({ plano_id: z.uuid('Plano inválido.') }).parse(await readJson(request));
  const r = await withTenant(locals.user.tenantId, (db) => iniciarTrial(db, locals.user, plano_id));
  setFlash(cookies, 'success', `Seu teste do plano ${r.plano.nome} começou. Você tem acesso a tudo até ${r.ate.split('-').reverse().join('/')}.`);
  return { ok: true, ate: r.ate, redirect: '/dashboard' };
});

export const DELETE: APIRoute = jsonEndpoint(async ({ locals }) => {
  await withTenant(locals.user.tenantId, (db) => recusarTrial(db, locals.user));
  return { ok: true };
});
