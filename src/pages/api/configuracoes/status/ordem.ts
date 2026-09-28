import type { APIRoute } from 'astro';
import { jsonEndpoint, readJson } from '../../../../lib/api';
import { withTenant } from '../../../../lib/db';
import { reordenar, reordenarSchema } from '../../../../server/reordenar';

// Nova ordem por arrastar: { ids: [...] } na ordem desejada
export const PATCH: APIRoute = jsonEndpoint(async ({ request, locals }) => {
  const { ids } = reordenarSchema.parse(await readJson(request));
  await withTenant(locals.user.tenantId, (db) => reordenar(db, 'status', ids));
  return { ok: true };
});
