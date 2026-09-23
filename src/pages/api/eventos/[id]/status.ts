import { z } from 'zod';
import { jsonEndpoint, readJson } from '../../../../lib/api';
import { withTenant } from '../../../../lib/db';
import { moverEvento } from '../../../../server/eventos';

const bodySchema = z.object({ status_id: z.uuid('Status inválido.') });

// Move o evento para outra coluna do quadro de vendas (arrastar e soltar)
export const PATCH = jsonEndpoint(async ({ params, request, locals }) => {
  const { status_id } = bodySchema.parse(await readJson(request));
  await withTenant(locals.user.tenantId, (db) => moverEvento(db, locals.user, params.id!, status_id));
  return { ok: true };
});
