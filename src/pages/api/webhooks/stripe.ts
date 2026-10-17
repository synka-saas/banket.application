// Webhook do Stripe (cobrança da assinatura). Rota pública no middleware (/api/webhooks/*); a autenticação é a
// assinatura Stripe-Signature sobre o corpo bruto (STRIPE_WEBHOOK_SECRET). Idempotência por event.id (stripe_events);
// erro no processamento responde 500 e o Stripe reenvia (o processamento busca sempre o objeto atual e é idempotente).
import type { APIRoute } from 'astro';
import type Stripe from 'stripe';
import { cobrancaConfigurada, stripe, webhookSecret } from '../../../lib/stripe';
import { marcarEventoStripe, processarEventoStripe, registrarEventoStripe } from '../../../server/assinatura';

export const prerender = false;

const LIMITE_CORPO = 1024 * 1024;

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const POST: APIRoute = async ({ request }) => {
  const segredo = webhookSecret();
  if (!segredo || !cobrancaConfigurada()) return json(503, { error: 'Webhook não configurado.' });

  if (Number(request.headers.get('content-length') ?? 0) > LIMITE_CORPO) return json(413, { error: 'Corpo grande demais.' });
  const corpo = await request.text();
  if (corpo.length > LIMITE_CORPO) return json(413, { error: 'Corpo grande demais.' });

  let evento: Stripe.Event;
  try {
    evento = stripe().webhooks.constructEvent(corpo, request.headers.get('stripe-signature') ?? '', segredo);
  } catch {
    return json(400, { error: 'Assinatura inválida.' });
  }

  if (!(await registrarEventoStripe(evento))) return json(200, { received: true, duplicate: true });
  try {
    const tenantId = await processarEventoStripe(evento);
    await marcarEventoStripe(evento.id, tenantId, null);
    return json(200, { received: true });
  } catch (err) {
    console.error('[stripe] webhook: falha ao processar', evento.type, evento.id, err);
    await marcarEventoStripe(evento.id, null, err instanceof Error ? err.message : String(err)).catch(() => undefined);
    return json(500, { error: 'Falha ao processar.' });
  }
};
