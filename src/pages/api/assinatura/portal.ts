import type { APIRoute } from 'astro';
import { z } from 'zod';
import { jsonEndpoint, readJson } from '../../../lib/api';
import { abrirPortal } from '../../../server/assinatura';

// POST { trocar_cartao? } → { url } do Portal do Cliente do Stripe (cartão e recibos).
export const POST: APIRoute = jsonEndpoint(async ({ request, locals }) => {
  const { trocar_cartao } = z.object({ trocar_cartao: z.boolean().default(false) }).parse(await readJson(request));
  return { url: await abrirPortal(locals.user, trocar_cartao) };
});
