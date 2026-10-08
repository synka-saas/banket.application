import type { APIRoute } from 'astro';
import { jsonEndpoint, readJson } from '../../../../lib/api';
import { withTenant } from '../../../../lib/db';
import { isAdmin } from '../../../../lib/auth';
import { UserError } from '../../../../lib/forms';
import { reordenar, reordenarSchema } from '../../../../server/reordenar';

// Nova ordem das perguntas da pesquisa de satisfação (owner/admin): { ids: [...] } na ordem desejada
export const PATCH: APIRoute = jsonEndpoint(async ({ request, locals }) => {
  if (!isAdmin(locals.user)) throw new UserError('Só administradores editam o questionário.');
  const { ids } = reordenarSchema.parse(await readJson(request));
  await withTenant(locals.user.tenantId, (db) => reordenar(db, 'perguntas', ids));
  return { ok: true };
});
