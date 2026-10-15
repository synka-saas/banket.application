import type { APIRoute } from 'astro';
import { z } from 'zod';
import { jsonEndpoint, readJson } from '../../../lib/api';
import { withTenant } from '../../../lib/db';
import { registrarUpsell } from '../../../server/planos';

// Eventos do funil de upsell vindos do navegador (cadeado visto, CTA clicado). Nunca falha para o usuário.
const schema = z.object({
  tipo: z.enum(['cadeado_visto', 'cta_clicado', 'planos_visitado']),
  recurso: z.string().max(60).nullable().optional(),
  dados: z.record(z.string(), z.unknown()).optional(),
});

export const POST: APIRoute = jsonEndpoint(async ({ request, locals }) => {
  const input = schema.parse(await readJson(request));
  await withTenant(locals.user.tenantId, (db) => registrarUpsell(db, locals.user, input.tipo, input.recurso ?? null, input.dados ?? {}));
  return { ok: true };
});
