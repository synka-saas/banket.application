// Inbox: conversas por e-mail entre o usuário e o cliente, sempre ligadas a um evento.
// Cada conversa tem um endereço de resposta próprio (r-<token>@<RESEND_INBOUND_DOMAIN>) usado como Reply-To;
// o que o cliente responde chega pelo webhook do Resend (server/inbox/receber.ts) e cai aqui como mensagem de entrada.
// Permissões: owner/admin veem todas as conversas da empresa; usuário comum, só as suas (usuario_id).
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import type { Db } from '../lib/db';
import { isAdmin, type SessionUser } from '../lib/auth';
import { UserError, optionalText, optionalUuid, requiredText } from '../lib/forms';
import type { PageParams } from '../lib/pagination';
import { sendMail, type MailAttachment } from '../lib/mail';
import { carregarEmpresa } from './empresa';
import { modelosComVariaveis, type ModeloPronto } from './emailModelos';
import { dataCurta } from '../lib/datas';
import { formatMoney } from '../lib/money';
import { enderecoPuro, listaEmails, mensagemHtml } from './emailTexto';
import { registrarTimeline } from './timeline';

export type StatusMensagem = 'enviada' | 'entregue' | 'devolvida' | 'falhou' | 'recebida';

export const ROTULOS_STATUS: Record<StatusMensagem, string> = {
  enviada: 'Enviada',
  entregue: 'Entregue',
  devolvida: 'Devolvida',
  falhou: 'Falhou',
  recebida: 'Recebida',
};

export interface AnexoMensagem {
  nome: string;
  tipo: string | null;
  tamanho: number | null;
  /** Chave em lib/storage.ts; null quando o arquivo não foi guardado (muito grande) */
  path: string | null;
}

function env(name: string): string | undefined {
  return process.env[name] ?? (import.meta.env as Record<string, string | undefined>)[name];
}

/** Domínio que recebe as respostas (MX → Resend); sem ele, as respostas vão para o e-mail do usuário. */
export function dominioRespostas(): string | null {
  const d = env('RESEND_INBOUND_DOMAIN')?.trim().toLowerCase();
  return d || null;
}

export const gerarTokenConversa = () => randomBytes(10).toString('hex');

export function enderecoResposta(token: string): string | null {
  const dominio = dominioRespostas();
  return dominio ? `r-${token}@${dominio}` : null;
}

export function assuntoResposta(assunto: string): string {
  const base = assunto.trim();
  return (/^re:\s*/i.test(base) ? base : `Re: ${base}`).slice(0, 255);
}

/** Prévia curta da mensagem para a lista do inbox. */
export function trecho(texto: string | null, html: string | null): string | null {
  const base = texto?.trim() || (html ? html.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ') : '');
  const limpo = base.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  return limpo ? limpo.slice(0, 200) : null;
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------
export interface ConversaResumo {
  id: string;
  evento_id: string;
  evento_titulo: string | null;
  cliente_id: string | null;
  cliente_nome: string | null;
  usuario_id: string | null;
  usuario_nome: string | null;
  assunto: string;
  participantes: string[];
  ultima_mensagem_em: Date | null;
  ultima_direcao: 'entrada' | 'saida' | null;
  ultimo_trecho: string | null;
  nao_lidas: number;
  arquivada: boolean;
  total_mensagens: number;
}

export interface Mensagem {
  id: string;
  direcao: 'entrada' | 'saida';
  usuario_id: string | null;
  usuario_nome: string | null;
  de: string;
  para: string[];
  cc: string[];
  assunto: string | null;
  texto: string | null;
  html: string | null;
  message_id: string | null;
  status: StatusMensagem;
  status_em: Date | null;
  status_detalhe: string | null;
  anexos: AnexoMensagem[];
  lida_em: Date | null;
  created_at: Date;
}

export interface ConversaDetalhe extends ConversaResumo {
  token: string;
  endereco_resposta: string | null;
  mensagens: Mensagem[];
  evento: { id: string; titulo: string | null; responsavel_email: string | null; cliente_email: string | null };
}

export interface FiltrosConversas {
  filtro?: 'todas' | 'nao_lidas' | 'minhas';
  busca?: string | null;
  usuarioId?: string | null;
  eventoId?: string | null;
  arquivadas?: boolean;
}

// Escopo de visibilidade: $1 = usuário é admin, $2 = id do usuário (os dois primeiros parâmetros de toda consulta)
const VISIVEL = '($1::boolean OR c.usuario_id = $2::uuid)';
const escopo = (user: SessionUser) => [isAdmin(user), user.id];

const SELECT_RESUMO = `
  SELECT c.id, c.evento_id, e.titulo AS evento_titulo, c.cliente_id, cl.nome AS cliente_nome,
         c.usuario_id, u.nome AS usuario_nome, c.assunto, c.participantes, c.ultima_mensagem_em, c.ultima_direcao,
         c.ultimo_trecho, c.nao_lidas, c.arquivada,
         (SELECT count(*) FROM mensagens m WHERE m.conversa_id = c.id) AS total_mensagens
    FROM conversas c
    JOIN eventos e ON e.id = c.evento_id
    LEFT JOIN clientes cl ON cl.id = COALESCE(c.cliente_id, e.cliente_id)
    LEFT JOIN usuarios u ON u.id = c.usuario_id`;

export async function listarConversas(
  db: Db,
  user: SessionUser,
  f: FiltrosConversas,
  page: PageParams
): Promise<{ rows: ConversaResumo[]; total: number }> {
  const params: unknown[] = [...escopo(user), f.arquivadas ?? false, f.busca ?? null, f.usuarioId ?? null, f.eventoId ?? null];
  const where = `WHERE ${VISIVEL} AND c.arquivada = $3
                   AND ($4::text IS NULL OR c.assunto ILIKE $4 OR e.titulo ILIKE $4 OR cl.nome ILIKE $4 OR array_to_string(c.participantes, ' ') ILIKE $4)
                   AND ($5::uuid IS NULL OR c.usuario_id = $5)
                   AND ($6::uuid IS NULL OR c.evento_id = $6)
                   ${f.filtro === 'nao_lidas' ? 'AND c.nao_lidas > 0' : ''}
                   ${f.filtro === 'minhas' ? 'AND c.usuario_id = $2::uuid' : ''}`;
  const [lista, count] = await Promise.all([
    db.query<ConversaResumo>(
      `${SELECT_RESUMO} ${where}
        ORDER BY c.ultima_mensagem_em DESC NULLS LAST, c.created_at DESC
        LIMIT $7 OFFSET $8`,
      [...params, page.pageSize, page.offset]
    ),
    db.query<{ total: number }>(
      `SELECT count(*) AS total FROM conversas c JOIN eventos e ON e.id = c.evento_id
         LEFT JOIN clientes cl ON cl.id = COALESCE(c.cliente_id, e.cliente_id) ${where}`,
      params
    ),
  ]);
  return { rows: lista.rows, total: count.rows[0].total };
}

/** Usuários que têm conversas (filtro "Responsável" do inbox dos administradores). */
export async function listarUsuariosComConversas(db: Db): Promise<{ id: string; nome: string }[]> {
  const { rows } = await db.query<{ id: string; nome: string }>(
    `SELECT DISTINCT u.id, u.nome FROM conversas c JOIN usuarios u ON u.id = c.usuario_id ORDER BY u.nome`
  );
  return rows;
}

/** Mensagens recebidas ainda não lidas, no escopo do usuário (contador do menu). */
export async function contarNaoLidas(db: Db, user: SessionUser): Promise<number> {
  const { rows } = await db.query<{ n: number }>(
    `SELECT COALESCE(sum(c.nao_lidas), 0) AS n FROM conversas c WHERE NOT c.arquivada AND ${VISIVEL}`,
    escopo(user)
  );
  return Number(rows[0]?.n ?? 0);
}

export async function carregarConversa(db: Db, user: SessionUser, id: string): Promise<ConversaDetalhe> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new UserError('Conversa não encontrada.');
  const { rows } = await db.query<ConversaResumo & { token: string; responsavel_email: string | null; cliente_email: string | null }>(
    `${SELECT_RESUMO.replace('c.arquivada,', 'c.arquivada, c.token, e.responsavel_email, cl.email AS cliente_email,')}
      WHERE ${VISIVEL} AND c.id = $3`,
    [...escopo(user), id]
  );
  const c = rows[0];
  if (!c) throw new UserError('Conversa não encontrada.');
  const { rows: mensagens } = await db.query<Mensagem>(
    `SELECT m.id, m.direcao, m.usuario_id, u.nome AS usuario_nome, m.de, m.para, m.cc, m.assunto, m.texto, m.html,
            m.message_id, m.status, m.status_em, m.status_detalhe, m.anexos, m.lida_em, m.created_at
       FROM mensagens m LEFT JOIN usuarios u ON u.id = m.usuario_id
      WHERE m.conversa_id = $1 ORDER BY m.created_at, m.id`,
    [id]
  );
  const { token, responsavel_email, cliente_email, ...resumo } = c;
  return {
    ...resumo,
    token,
    endereco_resposta: enderecoResposta(token),
    mensagens,
    evento: { id: c.evento_id, titulo: c.evento_titulo, responsavel_email, cliente_email },
  };
}

export async function marcarComoLida(db: Db, id: string): Promise<void> {
  await db.query(`UPDATE mensagens SET lida_em = now() WHERE conversa_id = $1 AND direcao = 'entrada' AND lida_em IS NULL`, [id]);
  await db.query('UPDATE conversas SET nao_lidas = 0, updated_at = now() WHERE id = $1 AND nao_lidas > 0', [id]);
}

export async function arquivarConversa(db: Db, user: SessionUser, id: string, arquivada: boolean): Promise<void> {
  const res = await db.query(`UPDATE conversas c SET arquivada = $3, updated_at = now() WHERE ${VISIVEL} AND c.id = $4`, [
    ...escopo(user),
    arquivada,
    id,
  ]);
  if (!res.rowCount) throw new UserError('Conversa não encontrada.');
}

// ---------------------------------------------------------------------------
// Escrita
// ---------------------------------------------------------------------------
export interface ConversaAberta {
  id: string;
  token: string;
  nova: boolean;
}

/** Conversa do par (evento, usuário): reaproveita a existente ou cria uma nova com token próprio. */
export async function obterOuCriarConversa(
  db: Db,
  user: SessionUser,
  eventoId: string,
  dados: { assunto: string; participantes: string[]; clienteId: string | null }
): Promise<ConversaAberta> {
  const { rows } = await db.query<{ id: string; token: string }>(
    `SELECT id, token FROM conversas WHERE evento_id = $1 AND usuario_id = $2 ORDER BY created_at LIMIT 1 FOR UPDATE`,
    [eventoId, user.id]
  );
  if (rows[0]) return { ...rows[0], nova: false };
  const token = gerarTokenConversa();
  const { rows: criada } = await db.query<{ id: string }>(
    `INSERT INTO conversas (tenant_id, evento_id, cliente_id, usuario_id, assunto, token, participantes)
     VALUES ($1, $2, $3, $4, left($5, 255), $6, $7) RETURNING id`,
    [user.tenantId, eventoId, dados.clienteId, user.id, dados.assunto, token, dados.participantes.map(enderecoPuro)]
  );
  return { id: criada[0].id, token, nova: true };
}

/** Cabeçalhos de encadeamento: responde ao último e-mail recebido e referencia todos os ids conhecidos. */
async function cabecalhosDeResposta(db: Db, conversaId: string): Promise<Record<string, string>> {
  const { rows } = await db.query<{ message_id: string; direcao: string }>(
    `SELECT message_id, direcao FROM mensagens WHERE conversa_id = $1 AND message_id IS NOT NULL ORDER BY created_at`,
    [conversaId]
  );
  if (!rows.length) return {};
  const ultimoRecebido = [...rows].reverse().find((m) => m.direcao === 'entrada');
  const cabecalhos: Record<string, string> = { References: rows.map((m) => m.message_id).join(' ').slice(0, 4000) };
  if (ultimoRecebido) cabecalhos['In-Reply-To'] = ultimoRecebido.message_id;
  return cabecalhos;
}

export interface EnvioNaConversa {
  para: string[];
  assunto: string;
  /** Texto simples; vira HTML com o layout dos e-mails da empresa */
  texto: string;
  anexos?: (AnexoMensagem & { conteudo: Uint8Array })[];
  /** Rodapé do e-mail (padrão: "Proposta enviada por <empresa>.") */
  rodape?: string;
}

/**
 * Envia um e-mail dentro da conversa (proposta, resposta ou mensagem nova) e grava a mensagem de saída.
 * Remetente: "<usuário> · <empresa>" no endereço da empresa; Reply-To: endereço da conversa (ou o e-mail do usuário
 * quando o recebimento não está configurado).
 */
export async function enviarNaConversa(
  db: Db,
  user: SessionUser,
  conversaId: string,
  envio: EnvioNaConversa
): Promise<{ delivered: boolean; mensagemId: string }> {
  const { rows } = await db.query<{ token: string }>('SELECT token FROM conversas WHERE id = $1', [conversaId]);
  if (!rows[0]) throw new UserError('Conversa não encontrada.');
  const empresa = await carregarEmpresa(db);
  const replyTo = enderecoResposta(rows[0].token) ?? user.email;
  const resultado = await sendMail({
    to: envio.para,
    subject: envio.assunto,
    html: mensagemHtml(envio.texto, empresa.nome, envio.rodape),
    text: envio.texto,
    fromName: `${user.nome} · ${empresa.nome}`,
    replyTo,
    headers: await cabecalhosDeResposta(db, conversaId),
    attachments: envio.anexos?.map<MailAttachment>((a) => ({ filename: a.nome, content: a.conteudo, contentType: a.tipo ?? undefined })),
  });
  const anexos: AnexoMensagem[] = (envio.anexos ?? []).map(({ conteudo: _c, ...a }) => a);
  const { rows: inserida } = await db.query<{ id: string }>(
    `INSERT INTO mensagens (tenant_id, conversa_id, direcao, usuario_id, de, para, assunto, texto, html, resend_id, status, status_em, anexos)
     VALUES ($1, $2, 'saida', $3, $4, $5, left($6, 255), $7, NULL, $8, 'enviada', now(), $9) RETURNING id`,
    [
      user.tenantId,
      conversaId,
      user.id,
      replyTo === user.email ? user.email : `${user.nome} · ${empresa.nome}`,
      envio.para.map(enderecoPuro),
      envio.assunto,
      envio.texto,
      resultado.delivered ? resultado.id : null,
      JSON.stringify(anexos),
    ]
  );
  await db.query(
    `UPDATE conversas SET ultima_mensagem_em = now(), ultima_direcao = 'saida', ultimo_trecho = $2, arquivada = false,
            participantes = (SELECT array_agg(DISTINCT x) FROM unnest(participantes || $3::text[]) AS x), updated_at = now()
      WHERE id = $1`,
    [conversaId, trecho(envio.texto, null), envio.para.map(enderecoPuro)]
  );
  return { delivered: resultado.delivered, mensagemId: inserida[0].id };
}

export interface MensagemRecebida {
  de: string;
  para: string[];
  cc: string[];
  assunto: string | null;
  texto: string | null;
  html: string | null;
  message_id: string | null;
  in_reply_to: string | null;
  referencias: string[];
  resend_id: string;
  anexos: AnexoMensagem[];
}

/** Grava uma mensagem recebida pelo webhook (duplicada pelo resend_id → ignorada) e marca a conversa como não lida. */
export async function receberMensagem(
  db: Db,
  ctx: { tenantId: string; conversaId: string; eventoId: string },
  m: MensagemRecebida
): Promise<string | null> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO mensagens (tenant_id, conversa_id, direcao, de, para, cc, assunto, texto, html, message_id, in_reply_to,
                            referencias, resend_id, status, status_em, anexos)
     VALUES ($1, $2, 'entrada', left($3, 320), $4, $5, left($6, 255), $7, $8, left($9, 998), left($10, 998), $11, $12, 'recebida', now(), $13)
     ON CONFLICT (resend_id) WHERE resend_id IS NOT NULL DO NOTHING
     RETURNING id`,
    [
      ctx.tenantId,
      ctx.conversaId,
      m.de,
      m.para.map(enderecoPuro),
      m.cc.map(enderecoPuro),
      m.assunto,
      m.texto,
      m.html,
      m.message_id,
      m.in_reply_to,
      m.referencias,
      m.resend_id,
      JSON.stringify(m.anexos),
    ]
  );
  if (!rows[0]) return null;
  await db.query(
    `UPDATE conversas SET nao_lidas = nao_lidas + 1, ultima_mensagem_em = now(), ultima_direcao = 'entrada',
            ultimo_trecho = $2, arquivada = false,
            participantes = (SELECT array_agg(DISTINCT x) FROM unnest(participantes || $3::text[]) AS x), updated_at = now()
      WHERE id = $1`,
    [ctx.conversaId, trecho(m.texto, m.html), [enderecoPuro(m.de)]]
  );
  await registrarTimeline(
    db,
    { tenantId: ctx.tenantId, eventoId: ctx.eventoId, usuarioId: null },
    'email_recebido',
    `E-mail recebido de ${m.de}${m.assunto ? `: "${m.assunto}"` : ''}`,
    { conversa_id: ctx.conversaId, mensagem_id: rows[0].id }
  );
  return rows[0].id;
}

/** Atualiza o status de entrega de uma mensagem enviada (eventos delivered/bounced/complained/failed do Resend). */
export async function atualizarStatusMensagem(
  db: Db,
  resendId: string,
  status: StatusMensagem | null,
  detalhe: string | null
): Promise<boolean> {
  const res = await db.query(
    `UPDATE mensagens SET status = COALESCE($2, status), status_em = now(), status_detalhe = $3 WHERE resend_id = $1 AND direcao = 'saida'`,
    [resendId, status, detalhe]
  );
  return Boolean(res.rowCount);
}

// ---------------------------------------------------------------------------
// Ações do usuário
// ---------------------------------------------------------------------------
export const respostaSchema = z.object({
  texto: requiredText('Escreva a mensagem.', 10_000),
  modelo_id: optionalUuid(),
  _voltar: optionalText(300),
});

export async function responder(
  db: Db,
  user: SessionUser,
  conversaId: string,
  input: z.infer<typeof respostaSchema>
): Promise<{ delivered: boolean }> {
  const conversa = await carregarConversa(db, user, conversaId);
  const ultimaEntrada = [...conversa.mensagens].reverse().find((m) => m.direcao === 'entrada');
  const para = ultimaEntrada ? [enderecoPuro(ultimaEntrada.de)] : conversa.participantes;
  if (!para.length) throw new UserError('Esta conversa não tem destinatário.');
  const r = await enviarNaConversa(db, user, conversaId, {
    para,
    assunto: assuntoResposta(conversa.assunto),
    texto: input.texto,
    rodape: `Mensagem enviada por ${user.nome}.`,
  });
  await registrarTimeline(
    db,
    { tenantId: user.tenantId, eventoId: conversa.evento_id, usuarioId: user.id },
    'email_enviado',
    `Resposta enviada para ${para.join(', ')}`,
    { conversa_id: conversaId, entregue: r.delivered, modelo_id: input.modelo_id }
  );
  return { delivered: r.delivered };
}

export const novaMensagemSchema = z.object({
  para: listaEmails,
  assunto: requiredText('Informe o assunto.', 255),
  texto: requiredText('Escreva a mensagem.', 10_000),
  modelo_id: optionalUuid(),
});

/** Mensagem avulsa a partir da aba Mensagens do evento (sem proposta): abre ou reaproveita a conversa do usuário. */
export async function novaMensagem(
  db: Db,
  user: SessionUser,
  eventoId: string,
  input: z.infer<typeof novaMensagemSchema>
): Promise<{ conversaId: string; delivered: boolean }> {
  const { rows } = await db.query<{ cliente_id: string | null }>('SELECT cliente_id FROM eventos WHERE id = $1', [eventoId]);
  if (!rows[0]) throw new UserError('Evento não encontrado.');
  const conversa = await obterOuCriarConversa(db, user, eventoId, { assunto: input.assunto, participantes: input.para, clienteId: rows[0].cliente_id });
  const r = await enviarNaConversa(db, user, conversa.id, {
    para: input.para,
    assunto: conversa.nova ? input.assunto : assuntoResposta(input.assunto),
    texto: input.texto,
    rodape: `Mensagem enviada por ${user.nome}.`,
  });
  await registrarTimeline(
    db,
    { tenantId: user.tenantId, eventoId, usuarioId: user.id },
    'email_enviado',
    `E-mail "${input.assunto}" enviado para ${input.para.join(', ')}`,
    { conversa_id: conversa.id, entregue: r.delivered, modelo_id: input.modelo_id }
  );
  return { conversaId: conversa.id, delivered: r.delivered };
}

/** Modelos de e-mail com as variáveis do evento aplicadas (select "Inserir modelo" nas respostas e mensagens novas). */
export async function modelosParaEvento(db: Db, eventoId: string): Promise<ModeloPronto[]> {
  const { rows } = await db.query<{
    titulo: string | null;
    data_evento: string | null;
    cliente_nome: string | null;
    responsavel_nome: string | null;
    valor_total: number | null;
    versao_atual: number | null;
  }>(
    `SELECT e.titulo, e.data_evento::text, c.nome AS cliente_nome, e.responsavel_nome, o.valor_total, o.versao_atual
       FROM eventos e LEFT JOIN clientes c ON c.id = e.cliente_id LEFT JOIN orcamentos o ON o.evento_id = e.id
      WHERE e.id = $1`,
    [eventoId]
  );
  const e = rows[0];
  if (!e) return [];
  const empresa = await carregarEmpresa(db);
  return modelosComVariaveis(db, {
    nome_cliente: e.responsavel_nome ?? e.cliente_nome ?? '',
    evento: e.titulo ?? 'seu evento',
    data_evento: e.data_evento ? dataCurta(e.data_evento) : 'data a definir',
    empresa: empresa.nome,
    valor_total: e.valor_total !== null ? formatMoney(e.valor_total) : '',
    versao: e.versao_atual ? String(e.versao_atual).padStart(2, '0') : '',
  });
}
