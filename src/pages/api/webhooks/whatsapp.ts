// Webhook do WhatsApp (Cloud API da Meta). GET: verificação da assinatura do webhook no painel da Meta (hub.verify_token
// = WHATSAPP_VERIFY_TOKEN, devolve hub.challenge). POST: status de entrega das mensagens (sent, delivered, read, failed),
// autenticado pela assinatura X-Hub-Signature-256 com WHATSAPP_APP_SECRET. Rota pública no middleware (/api/webhooks/*).
// Idempotência por evento (whatsapp_events); a atualização acha a mensagem pelo wamid na conexão de sistema (o webhook
// não tem empresa). Mensagens recebidas no número do Banket são ignoradas (os avisos não esperam resposta).
import type { APIRoute } from 'astro';
import { systemQuery } from '../../../lib/db';
import { assinaturaWebhookValida, statusDaMeta } from '../../../lib/whatsapp';

export const prerender = false;

const LIMITE_CORPO = 1024 * 1024;
const env = (nome: string) => process.env[nome] ?? (import.meta.env as Record<string, string | undefined>)[nome];

export const GET: APIRoute = async ({ url }) => {
  const token = env('WHATSAPP_VERIFY_TOKEN');
  const p = url.searchParams;
  if (token && p.get('hub.mode') === 'subscribe' && p.get('hub.verify_token') === token) {
    return new Response(p.get('hub.challenge') ?? '', { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }
  return new Response('Forbidden', { status: 403 });
};

interface StatusMeta {
  id?: string;
  status?: string;
  timestamp?: string;
  errors?: { code?: number; title?: string; message?: string; error_data?: { details?: string } }[];
}

export const POST: APIRoute = async ({ request }) => {
  const segredo = env('WHATSAPP_APP_SECRET');
  if (!segredo) return new Response('Webhook não configurado.', { status: 503 });
  const corpo = await request.text();
  if (corpo.length > LIMITE_CORPO) return new Response('Corpo grande demais.', { status: 413 });
  if (!assinaturaWebhookValida(corpo, request.headers.get('x-hub-signature-256'), segredo)) {
    return new Response('Assinatura inválida.', { status: 401 });
  }
  let payload: { entry?: { changes?: { value?: { statuses?: StatusMeta[] } }[] }[] };
  try {
    payload = JSON.parse(corpo);
  } catch {
    return new Response('JSON inválido.', { status: 400 });
  }
  const statuses = (payload.entry ?? []).flatMap((e) => (e.changes ?? []).flatMap((c) => c.value?.statuses ?? []));
  for (const s of statuses) {
    const status = s.status ? statusDaMeta(s.status) : null;
    if (!s.id || !status) continue;
    const idEvento = `${s.id}:${s.status}`;
    const { rowCount } = await systemQuery('INSERT INTO whatsapp_events (id, payload) VALUES ($1, $2) ON CONFLICT DO NOTHING', [idEvento, JSON.stringify(s)]);
    if (!rowCount) continue;
    const erro = s.errors?.[0] ? `${s.errors[0].code ?? ''} ${s.errors[0].error_data?.details ?? s.errors[0].message ?? s.errors[0].title ?? ''}`.trim().slice(0, 500) : null;
    const quando = s.timestamp && /^\d+$/.test(s.timestamp) ? new Date(Number(s.timestamp) * 1000) : new Date();
    // Fora de ordem: "lida" não volta para "entregue"; falha sempre registra
    await systemQuery(
      `UPDATE whatsapp_mensagens SET status = $2, erro = COALESCE($3, erro), status_em = $4
        WHERE wamid = $1 AND NOT (status = 'lida' AND $2 IN ('enviada', 'entregue')) AND NOT (status = 'entregue' AND $2 = 'enviada')`,
      [s.id, status, erro, quando]
    );
  }
  return new Response(null, { status: 200 });
};
