// Webhook do Resend (e-mails recebidos e status de entrega). Rota pública no middleware; a autenticação é a
// assinatura Svix do próprio pedido (RESEND_WEBHOOK_SECRET). O checkOrigin do Astro só vale para POST de formulário,
// então o JSON do Resend passa. Idempotência por svix-id (resend_events); erro transitório responde 500 para o
// Resend reenviar, e o evento pendente é reprocessado na próxima entrega.
import type { APIRoute } from 'astro';
import { verificarAssinaturaSvix } from '../../../lib/resendWebhook';
import { resendReceiving } from '../../../lib/resendReceiving';
import { dominioRespostas } from '../../../server/conversas';
import { EventoIgnorado, marcarEventoResend, processarEventoResend, registrarEventoResend } from '../../../server/inbox/receber';

export const prerender = false;

const LIMITE_CORPO = 1024 * 1024;

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const POST: APIRoute = async ({ request }) => {
  const secret = process.env.RESEND_WEBHOOK_SECRET ?? import.meta.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return json(503, { error: 'Webhook não configurado.' });

  const tamanho = Number(request.headers.get('content-length') ?? 0);
  if (tamanho > LIMITE_CORPO) return json(413, { error: 'Corpo grande demais.' });
  const corpo = await request.text();
  if (corpo.length > LIMITE_CORPO) return json(413, { error: 'Corpo grande demais.' });

  const cabecalhos = {
    id: request.headers.get('svix-id'),
    timestamp: request.headers.get('svix-timestamp'),
    signature: request.headers.get('svix-signature'),
  };
  if (!verificarAssinaturaSvix(corpo, cabecalhos, secret)) return json(401, { error: 'Assinatura inválida.' });

  let payload: { type?: unknown; data?: unknown };
  try {
    payload = JSON.parse(corpo);
  } catch {
    return json(400, { error: 'JSON inválido.' });
  }
  if (typeof payload.type !== 'string' || !cabecalhos.id) return json(400, { error: 'Evento inválido.' });
  const evento = {
    id: cabecalhos.id,
    type: payload.type,
    data: payload.data && typeof payload.data === 'object' ? (payload.data as Record<string, unknown>) : {},
  };

  const estado = await registrarEventoResend(evento);
  if (estado === 'duplicado') return json(200, { received: true, duplicate: true });

  try {
    await processarEventoResend(evento, { receiving: resendReceiving, dominio: dominioRespostas() });
    await marcarEventoResend(evento.id, null);
    return json(200, { received: true });
  } catch (err) {
    if (err instanceof EventoIgnorado) {
      await marcarEventoResend(evento.id, err.message);
      return json(200, { received: true, ignored: err.message });
    }
    const mensagem = err instanceof Error ? err.message : String(err);
    console.error('[webhook resend]', evento.type, evento.id, mensagem);
    await marcarEventoResend(evento.id, mensagem, true);
    return json(500, { error: 'Falha ao processar; o evento será reenviado.' });
  }
};
