// WhatsApp Business (Cloud API da Meta) só com fetch: envio de mensagens de template (avisos à empresa) e verificação da
// assinatura do webhook (X-Hub-Signature-256 = HMAC-SHA256 do corpo com o App Secret). Sem WHATSAPP_TOKEN ou
// WHATSAPP_PHONE_NUMBER_ID, o envio vai para o log (como o e-mail sem Resend). Templates em scripts/whatsapp-templates.mjs.
import { createHmac, timingSafeEqual } from 'node:crypto';

function env(name: string): string | undefined {
  return process.env[name] ?? (import.meta.env as Record<string, string | undefined>)[name];
}

export const versaoApi = () => env('WHATSAPP_API_VERSION') || 'v23.0';
export const whatsappConfigurado = () => Boolean(env('WHATSAPP_TOKEN') && env('WHATSAPP_PHONE_NUMBER_ID'));

/** Templates aprovados na Meta (nome → quantidade de variáveis do corpo). O botão de cada um abre APP_URL/<caminho>. */
export const TEMPLATES = {
  novo_pedido: { nome: 'banket_novo_pedido', variaveis: 6 },
  prazo_resposta: { nome: 'banket_prazo_resposta', variaveis: 3 },
  inbox: { nome: 'banket_resposta_cliente', variaveis: 3 },
  pesquisa: { nome: 'banket_pesquisa_respondida', variaveis: 3 },
  teste: { nome: 'banket_avisos_ativados', variaveis: 1 },
} as const;
export type TipoAviso = keyof typeof TEMPLATES;

/**
 * Número para a API: só dígitos com DDI. Celular brasileiro com DDD (11 dígitos) ganha o 55; fixo (10) não recebe
 * WhatsApp de forma confiável e é recusado. Inválido → null.
 */
export function numeroWhatsapp(valor: string | null | undefined): string | null {
  const d = (valor ?? '').replace(/\D/g, '');
  if (/^[1-9]{2}9\d{8}$/.test(d)) return `55${d}`;
  if (/^55[1-9]{2}9\d{8}$/.test(d)) return d;
  return null;
}

/**
 * Variável de template: a Meta recusa vazio, quebra de linha, tabulação e mais de 4 espaços seguidos. Texto longo é
 * cortado (limite prático para caber no aviso).
 */
export function parametro(valor: string | number | null | undefined, max = 120): string {
  const t = String(valor ?? '').replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim();
  if (!t) return '—';
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

export interface EnvioTemplate {
  para: string;
  template: string;
  variaveis: string[];
  /** Sufixo do botão de URL (APP_URL/{{1}}), sem a barra inicial */
  link: string | null;
}

export type ResultadoEnvio = { ok: true; wamid: string | null; registrado?: boolean } | { ok: false; erro: string };

export async function enviarTemplate(e: EnvioTemplate): Promise<ResultadoEnvio> {
  const components: unknown[] = [{ type: 'body', parameters: e.variaveis.map((text) => ({ type: 'text', text })) }];
  if (e.link) components.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: e.link.replace(/^\/+/, '') }] });
  const corpo = { messaging_product: 'whatsapp', to: e.para, type: 'template', template: { name: e.template, language: { code: 'pt_BR' }, components } };
  if (!whatsappConfigurado()) {
    console.log(`[whatsapp] (sem WHATSAPP_TOKEN) ${e.template} → ${e.para}: ${e.variaveis.join(' | ')}${e.link ? ` · /${e.link}` : ''}`);
    return { ok: true, wamid: null, registrado: true };
  }
  try {
    const res = await fetch(`https://graph.facebook.com/${versaoApi()}/${env('WHATSAPP_PHONE_NUMBER_ID')}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env('WHATSAPP_TOKEN')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string; code?: number } };
    if (!res.ok) return { ok: false, erro: `${json.error?.code ?? res.status}: ${json.error?.message ?? 'erro na API do WhatsApp'}`.slice(0, 500) };
    return { ok: true, wamid: json.messages?.[0]?.id ?? null };
  } catch (err) {
    return { ok: false, erro: (err instanceof Error ? err.message : String(err)).slice(0, 500) };
  }
}

/** Confere X-Hub-Signature-256 ("sha256=<hex>") do webhook com o App Secret. */
export function assinaturaWebhookValida(corpo: string, assinatura: string | null, segredo: string): boolean {
  if (!assinatura?.startsWith('sha256=')) return false;
  const esperado = createHmac('sha256', segredo).update(corpo, 'utf8').digest();
  const recebido = Buffer.from(assinatura.slice(7), 'hex');
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}

/** Status de entrega da Meta → status de whatsapp_mensagens. */
export function statusDaMeta(s: string): 'enviada' | 'entregue' | 'lida' | 'falhou' | null {
  return ({ sent: 'enviada', delivered: 'entregue', read: 'lida', failed: 'falhou' } as const)[s as 'sent'] ?? null;
}
