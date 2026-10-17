import type { APIRoute } from 'astro';
import { z } from 'zod';
import { jsonEndpoint, readJson } from '../../../lib/api';
import { iniciarCheckout } from '../../../server/assinatura';

// POST { plano_id, ciclo: mes|ano, forma: cartao|pix, cobrar_agora } → { url } (cartão: Checkout do Stripe),
// { pagarUrl } (Pix: página do QR Code) ou { agendado, primeiraCobrancaEm } (Pix no fim do teste).
const schema = z.object({
  plano_id: z.uuid('Escolha um plano.'),
  ciclo: z.enum(['mes', 'ano'], { error: 'Escolha a recorrência.' }),
  forma: z.enum(['cartao', 'pix'], { error: 'Escolha cartão de crédito ou Pix.' }),
  cobrar_agora: z.boolean().default(true),
});

export const POST: APIRoute = jsonEndpoint(async ({ request, locals }) => {
  const p = schema.parse(await readJson(request));
  return iniciarCheckout(locals.user, { planoId: p.plano_id, ciclo: p.ciclo, forma: p.forma, cobrarAgora: p.cobrar_agora });
});
