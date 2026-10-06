// Processamento dos eventos do webhook do Resend (/api/webhooks/resend):
//   - email.received: localiza a conversa pelo endereço de resposta (token) ou pelos cabeçalhos de encadeamento,
//     busca corpo e anexos na Receiving API e grava a mensagem de entrada;
//   - email.delivered/bounced/complained/failed/delivery_delayed: status da mensagem enviada (pelo id do Resend).
// Só duas consultas usam a conexão de sistema (token → empresa; id do Resend → empresa); o resto roda em withTenant.
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { systemQuery, withTenant } from '../../lib/db';
import { saveFile } from '../../lib/storage';
import type { ResendReceiving } from '../../lib/resendReceiving';
import { atualizarStatusMensagem, receberMensagem, type AnexoMensagem, type StatusMensagem } from '../conversas';

export interface EventoResend {
  /** svix-id (idempotência) */
  id: string;
  type: string;
  data: Record<string, unknown>;
}

/** Evento válido mas sem destino (token desconhecido, id não é nosso): registrado e respondido com 200. */
export class EventoIgnorado extends Error {}

export const LIMITE_ANEXO_BYTES = 10 * 1024 * 1024;
export const MAX_ANEXOS = 10;

const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : typeof v === 'string' ? [v] : []);

/** Token do endereço de resposta r-<token>@<domínio> entre os destinatários. */
export function extrairToken(enderecos: string[], dominio: string | null): string | null {
  if (!dominio) return null;
  const re = new RegExp(`^r-([a-f0-9]{20})@${dominio.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
  for (const bruto of enderecos) {
    const puro = (bruto.match(/<([^>]+)>/)?.[1] ?? bruto).trim();
    const m = puro.match(re);
    if (m) return m[1].toLowerCase();
  }
  return null;
}

/** Ids de mensagem dos cabeçalhos In-Reply-To e References ("<a@b> <c@d>"). */
export function extrairReferencias(headers: Record<string, string>): { inReplyTo: string | null; referencias: string[] } {
  const ids = (v: string | undefined) => (v ? (v.match(/<[^<>\s]+>/g) ?? []) : []);
  const inReplyTo = ids(headers['in-reply-to'])[0] ?? null;
  const referencias = [...new Set([...ids(headers['references']), ...(inReplyTo ? [inReplyTo] : [])])];
  return { inReplyTo, referencias };
}

/** Remove o que não pode rodar nem vazar numa página do app (a exibição ainda é em iframe sandbox). */
export function limparHtmlEmail(html: string): string {
  return (
    html
      // Elementos ativos com conteúdo (script, iframe, object, embed, form) saem inteiros…
      .replace(/<(script|iframe|object|embed|form)\b[\s\S]*?<\/\1\s*>/gi, '')
      // …e qualquer tag solta deles ou de meta/link/base
      .replace(/<\/?(script|iframe|object|embed|form|meta|link|base)\b[^>]*>/gi, '')
      .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/\s(href|src)\s*=\s*("\s*javascript:[^"]*"|'\s*javascript:[^']*')/gi, '')
  );
}

/** Status da mensagem enviada a partir do tipo do evento; null quando o evento não interessa. */
export function mapearStatus(type: string, data: Record<string, unknown> = {}): { status: StatusMensagem | null; detalhe: string | null } | null {
  const bounce = data.bounce && typeof data.bounce === 'object' ? (data.bounce as Record<string, unknown>) : null;
  const motivo = bounce && typeof bounce.message === 'string' ? bounce.message : null;
  switch (type) {
    case 'email.delivered':
      return { status: 'entregue', detalhe: null };
    case 'email.bounced':
      return { status: 'devolvida', detalhe: motivo ?? 'E-mail devolvido pelo servidor do destinatário' };
    case 'email.complained':
      return { status: 'devolvida', detalhe: 'Marcado como spam pelo destinatário' };
    case 'email.failed':
      return { status: 'falhou', detalhe: typeof data.failed === 'object' && data.failed && typeof (data.failed as Record<string, unknown>).reason === 'string' ? ((data.failed as Record<string, unknown>).reason as string) : 'Falha no envio' };
    case 'email.delivery_delayed':
      return { status: null, detalhe: 'Entrega atrasada; o servidor do destinatário ainda não aceitou' };
    default:
      return null;
  }
}

/** Nome de arquivo seguro para o armazenamento (só a extensão importa; o nome original fica no registro). */
function extensaoSegura(nome: string): string {
  const ext = path.extname(nome).toLowerCase();
  return /^\.[a-z0-9]{1,8}$/.test(ext) ? ext : '';
}

export type EstadoEvento = 'novo' | 'pendente' | 'duplicado';

/** Registra o evento (svix-id) e informa se é novo, se já veio mas não terminou de processar, ou se já foi processado. */
export async function registrarEventoResend(e: EventoResend): Promise<EstadoEvento> {
  const { rows } = await systemQuery<{ processed_at: Date | null; novo: boolean }>(
    `INSERT INTO resend_events (id, type, payload) VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET received_at = now()
     RETURNING processed_at, (xmax = 0) AS novo`,
    [e.id, e.type, JSON.stringify({ type: e.type, data: e.data })]
  );
  if (rows[0]?.novo) return 'novo';
  return rows[0]?.processed_at ? 'duplicado' : 'pendente';
}

export async function marcarEventoResend(id: string, erro: string | null, pendente = false): Promise<void> {
  await systemQuery(`UPDATE resend_events SET processed_at = CASE WHEN $3 THEN NULL ELSE now() END, error = $2 WHERE id = $1`, [
    id,
    erro,
    pendente,
  ]);
}

interface Destino {
  tenantId: string;
  conversaId: string;
  eventoId: string;
}

async function destinoPorToken(token: string | null): Promise<Destino | null> {
  if (!token) return null;
  const { rows } = await systemQuery<{ tenant_id: string; id: string; evento_id: string }>(
    'SELECT tenant_id, id, evento_id FROM conversas WHERE token = $1',
    [token]
  );
  return rows[0] ? { tenantId: rows[0].tenant_id, conversaId: rows[0].id, eventoId: rows[0].evento_id } : null;
}

async function destinoPorReferencias(ids: string[]): Promise<Destino | null> {
  if (!ids.length) return null;
  const { rows } = await systemQuery<{ tenant_id: string; conversa_id: string; evento_id: string }>(
    `SELECT m.tenant_id, m.conversa_id, c.evento_id FROM mensagens m JOIN conversas c ON c.id = m.conversa_id
      WHERE m.message_id = ANY($1) ORDER BY m.created_at DESC LIMIT 1`,
    [ids]
  );
  return rows[0] ? { tenantId: rows[0].tenant_id, conversaId: rows[0].conversa_id, eventoId: rows[0].evento_id } : null;
}

export interface DepsReceber {
  receiving: ResendReceiving;
  dominio: string | null;
}

export async function processarEventoResend(e: EventoResend, deps: DepsReceber): Promise<void> {
  if (e.type === 'email.received') return receberEmail(e, deps);
  const mapa = mapearStatus(e.type, e.data);
  if (!mapa) return;
  const resendId = typeof e.data.email_id === 'string' ? e.data.email_id : null;
  if (!resendId) throw new EventoIgnorado('evento sem email_id');
  const { rows } = await systemQuery<{ tenant_id: string }>(`SELECT tenant_id FROM mensagens WHERE resend_id = $1 AND direcao = 'saida'`, [resendId]);
  // E-mails transacionais (convite, recuperação de senha…) também geram eventos: não são mensagens do inbox
  if (!rows[0]) throw new EventoIgnorado('mensagem desconhecida');
  await withTenant(rows[0].tenant_id, (db) => atualizarStatusMensagem(db, resendId, mapa.status, mapa.detalhe));
}

async function receberEmail(e: EventoResend, deps: DepsReceber): Promise<void> {
  const emailId = typeof e.data.email_id === 'string' ? e.data.email_id : null;
  if (!emailId) throw new EventoIgnorado('evento sem email_id');
  const destinatarios = [...strs(e.data.to), ...strs(e.data.cc), ...strs(e.data.received_for)];

  let destino = await destinoPorToken(extrairToken(destinatarios, deps.dominio));
  const email = await deps.receiving.obterEmail(emailId);
  const { inReplyTo, referencias } = extrairReferencias(email.headers);
  if (!destino) destino = await destinoPorReferencias(referencias);
  if (!destino) throw new EventoIgnorado('token desconhecido');

  // Anexos: metadados sempre; arquivo só até o limite (a URL de download vale 1 h, por isso é baixado agora)
  const anexos: AnexoMensagem[] = [];
  const lista = (await deps.receiving.listarAnexos(emailId)).slice(0, MAX_ANEXOS);
  for (const a of lista) {
    let chave: string | null = null;
    if ((a.size ?? 0) <= LIMITE_ANEXO_BYTES) {
      try {
        const conteudo = await deps.receiving.baixar(a.download_url);
        if (conteudo.byteLength <= LIMITE_ANEXO_BYTES) {
          chave = await saveFile(destino.tenantId, `mensagens/${destino.eventoId}/${randomUUID()}${extensaoSegura(a.filename)}`, conteudo);
        }
      } catch (err) {
        console.error('[inbox] falha ao baixar anexo', a.id, err);
      }
    }
    anexos.push({ nome: a.filename.slice(0, 255), tipo: a.content_type, tamanho: a.size, path: chave });
  }

  const alvo = destino;
  await withTenant(alvo.tenantId, (db) =>
    receberMensagem(db, alvo, {
      de: email.from || (typeof e.data.from === 'string' ? e.data.from : 'desconhecido'),
      para: email.to.length ? email.to : strs(e.data.to),
      cc: email.cc,
      assunto: email.subject ?? (typeof e.data.subject === 'string' ? e.data.subject : null),
      texto: email.text,
      html: email.html ? limparHtmlEmail(email.html) : null,
      message_id: email.message_id ?? (typeof e.data.message_id === 'string' ? e.data.message_id : null),
      in_reply_to: inReplyTo,
      referencias,
      resend_id: emailId,
      anexos,
    })
  );
}
