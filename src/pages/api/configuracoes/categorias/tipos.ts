import type { APIRoute } from 'astro';
import { z } from 'zod';
import { withTenant } from '../../../../lib/db';
import { userMessage } from '../../../../lib/forms';
import { alternarTipoDaCategoria } from '../../../../server/configuracoes';

const bodySchema = z.object({
  categoriaId: z.uuid(),
  tipoId: z.uuid(),
  ativo: z.boolean(),
});

// Liga/desliga um tipo de evento para uma categoria (toggles da listagem de categorias).
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = bodySchema.parse(await request.json());
    const { tenantId } = locals.user;
    await withTenant(tenantId, (db) => alternarTipoDaCategoria(db, tenantId, body.categoriaId, body.tipoId, body.ativo));
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: userMessage(err) }, { status: 400 });
  }
};
