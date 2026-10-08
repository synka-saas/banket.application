// Pesquisa de satisfação pós-evento: questionário da empresa (NPS + CSAT + escolhas + abertas), envio ao cliente
// por e-mail dentro da conversa do evento (Inbox) com link público /p/<token>, coleta das respostas e indicadores.
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { systemQuery, withTenant, type Db } from '../lib/db';
import type { SessionUser } from '../lib/auth';
import { UserError, checkbox, optionalText, requiredText } from '../lib/forms';
import type { PageParams } from '../lib/pagination';
import { appUrl } from '../lib/mail';
import { dataCurta } from '../lib/datas';
import { aplicarVariaveis } from '../lib/documentos/variaveis';
import {
  CLASSES_NPS,
  TIPOS_PERGUNTA,
  calcularNps,
  classeNps,
  validarRespostas,
  type ClasseNps,
  type PerguntaPublica,
  type TipoPergunta,
} from '../lib/pesquisa';
import { carregarEmpresa } from './empresa';
import { listaEmails } from './emailTexto';
import { enviarNaConversa, obterOuCriarConversa } from './conversas';
import { registrarTimeline } from './timeline';

export * from '../lib/pesquisa';

/** Variáveis aceitas no e-mail e nos textos da pesquisa. */
export const VARIAVEIS_PESQUISA = ['{nome_cliente}', '{evento}', '{data_evento}', '{empresa}', '{link_pesquisa}'];

export const linkPesquisa = (token: string) => appUrl(`/p/${token}`);

/** Texto da pergunta como o cliente vê ({empresa} e afins aplicados), para as telas internas. */
export const textoParaExibir = (texto: string, empresa: string) => aplicarVariaveis(texto, { empresa, evento: 'o evento', nome_cliente: 'cliente' });

// ---------------------------------------------------------------------------
// Configuração (textos e e-mail) e questionário
// ---------------------------------------------------------------------------
export interface ConfigPesquisa {
  titulo: string;
  introducao: string | null;
  agradecimento: string | null;
  email_assunto: string;
  email_corpo: string;
  lembrete_dias: number;
}

export const configSchema = z.object({
  titulo: requiredText('Informe o título da pesquisa.', 120),
  introducao: optionalText(1000),
  agradecimento: optionalText(1000),
  email_assunto: requiredText('Informe o assunto do e-mail.', 255),
  email_corpo: requiredText('Escreva a mensagem do e-mail.', 10_000),
  lembrete_dias: z.coerce.number({ error: 'Número de dias inválido.' }).int().min(0, 'Use de 0 a 90 dias.').max(90, 'Use de 0 a 90 dias.'),
});

export async function carregarConfig(db: Db): Promise<ConfigPesquisa> {
  // Empresa criada antes da migration ou sem os padrões: cria a configuração com os valores padrão
  const { rows } = await db.query<ConfigPesquisa>('SELECT titulo, introducao, agradecimento, email_assunto, email_corpo, lembrete_dias FROM pesquisa_config');
  if (rows[0]) return rows[0];
  await db.query('SELECT aplicar_padroes_pesquisa(app_tenant_id()::uuid)');
  return (await db.query<ConfigPesquisa>('SELECT titulo, introducao, agradecimento, email_assunto, email_corpo, lembrete_dias FROM pesquisa_config')).rows[0];
}

export async function salvarConfig(db: Db, input: z.infer<typeof configSchema>): Promise<void> {
  await carregarConfig(db);
  await db.query(
    `UPDATE pesquisa_config SET titulo = $1, introducao = $2, agradecimento = $3, email_assunto = $4, email_corpo = $5,
            lembrete_dias = $6, updated_at = now()`,
    [input.titulo, input.introducao ?? null, input.agradecimento ?? null, input.email_assunto, input.email_corpo, input.lembrete_dias]
  );
}

export interface Pergunta extends PerguntaPublica {
  ativa: boolean;
  respostas: number;
}

export const perguntaSchema = z
  .object({
    tipo: z.enum(Object.keys(TIPOS_PERGUNTA) as [TipoPergunta, ...TipoPergunta[]], { error: 'Escolha o tipo da pergunta.' }),
    texto: requiredText('Escreva a pergunta.', 300),
    ajuda: optionalText(300),
    // Uma opção por linha
    opcoes: z.preprocess(
      (v) => [...new Set(String(v ?? '').split('\n').map((o) => o.trim()).filter(Boolean))],
      z.array(z.string().max(120, 'Cada opção pode ter no máximo 120 caracteres.')).max(15, 'Use no máximo 15 opções.')
    ),
    obrigatoria: checkbox(),
    ativa: checkbox(),
  })
  .superRefine((d, ctx) => {
    if ((d.tipo === 'escolha' || d.tipo === 'multipla') && d.opcoes.length < 2) {
      ctx.addIssue({ code: 'custom', path: ['opcoes'], message: 'Informe pelo menos duas opções, uma por linha.' });
    }
  });

export async function listarPerguntas(db: Db, opts: { somenteAtivas?: boolean } = {}): Promise<Pergunta[]> {
  const { rows } = await db.query<Pergunta>(
    `SELECT p.id, p.tipo, p.texto, p.ajuda, p.opcoes, p.obrigatoria, p.ativa, p.ordem,
            (SELECT count(*) FROM pesquisa_respostas r WHERE r.pergunta_id = p.id) AS respostas
       FROM pesquisa_perguntas p WHERE (NOT $1 OR p.ativa) ORDER BY p.ordem, p.created_at`,
    [Boolean(opts.somenteAtivas)]
  );
  return rows;
}

export async function salvarPergunta(db: Db, tenantId: string, id: string | null, input: z.infer<typeof perguntaSchema>): Promise<void> {
  const opcoes = input.tipo === 'escolha' || input.tipo === 'multipla' ? input.opcoes : [];
  if (input.tipo === 'nps') {
    const { rowCount } = await db.query(`SELECT 1 FROM pesquisa_perguntas WHERE tipo = 'nps' AND ($1::uuid IS NULL OR id <> $1)`, [id]);
    if (rowCount) throw new UserError('O questionário já tem uma pergunta NPS. Use “Nota de 1 a 5” para avaliar outros aspectos.', 'tipo');
  }
  if (id) {
    const { rows } = await db.query<{ tipo: string; respostas: number }>(
      'SELECT tipo, (SELECT count(*) FROM pesquisa_respostas r WHERE r.pergunta_id = p.id) AS respostas FROM pesquisa_perguntas p WHERE id = $1',
      [id]
    );
    if (!rows[0]) throw new UserError('Pergunta não encontrada.');
    // Trocar o tipo de uma pergunta já respondida misturaria escalas nos indicadores
    if (rows[0].tipo !== input.tipo && rows[0].respostas > 0) {
      throw new UserError('Esta pergunta já tem respostas: o tipo não pode mudar. Desative-a e crie uma nova.', 'tipo');
    }
    await db.query(
      `UPDATE pesquisa_perguntas SET tipo = $1, texto = $2, ajuda = $3, opcoes = $4, obrigatoria = $5, ativa = $6, updated_at = now() WHERE id = $7`,
      [input.tipo, input.texto, input.ajuda ?? null, opcoes, input.obrigatoria, input.ativa, id]
    );
    return;
  }
  await db.query(
    `INSERT INTO pesquisa_perguntas (tenant_id, tipo, texto, ajuda, opcoes, obrigatoria, ativa, ordem)
     VALUES ($1, $2, $3, $4, $5, $6, $7, (SELECT COALESCE(max(ordem), 0) + 1 FROM pesquisa_perguntas))`,
    [tenantId, input.tipo, input.texto, input.ajuda ?? null, opcoes, input.obrigatoria, input.ativa]
  );
}

/** Excluir mantém as respostas já dadas (com o enunciado copiado); elas só saem dos filtros por pergunta. */
export async function excluirPergunta(db: Db, id: string): Promise<void> {
  const res = await db.query('DELETE FROM pesquisa_perguntas WHERE id = $1', [id]);
  if (!res.rowCount) throw new UserError('Pergunta não encontrada.');
}

// ---------------------------------------------------------------------------
// Envio
// ---------------------------------------------------------------------------
interface ContextoEvento {
  titulo: string | null;
  data_evento: string | null;
  cliente_id: string | null;
  cliente_nome: string | null;
  cliente_email: string | null;
  responsavel_nome: string | null;
  responsavel_email: string | null;
}

async function contextoEvento(db: Db, eventoId: string): Promise<ContextoEvento> {
  const { rows } = await db.query<ContextoEvento>(
    `SELECT e.titulo, to_char(e.data_evento, 'YYYY-MM-DD') AS data_evento, e.cliente_id, c.nome AS cliente_nome, c.email AS cliente_email,
            e.responsavel_nome, e.responsavel_email
       FROM eventos e LEFT JOIN clientes c ON c.id = e.cliente_id WHERE e.id = $1`,
    [eventoId]
  );
  if (!rows[0]) throw new UserError('Evento não encontrado.', 'evento_id');
  return rows[0];
}

const valoresDoEvento = (e: ContextoEvento, empresa: string, token: string) => ({
  nome_cliente: (e.responsavel_nome ?? e.cliente_nome ?? '').split(/\s+/)[0] ?? '',
  evento: e.titulo ?? 'seu evento',
  data_evento: e.data_evento ? dataCurta(e.data_evento) : '',
  empresa,
  link_pesquisa: linkPesquisa(token),
});

/** Link do evento (um por evento): reaproveita o existente ou cria um novo token. */
async function obterEnvio(db: Db, tenantId: string, eventoId: string, clienteId: string | null) {
  await db.query(
    `INSERT INTO pesquisa_envios (tenant_id, evento_id, cliente_id, token) VALUES ($1, $2, $3, $4) ON CONFLICT (evento_id) DO NOTHING`,
    [tenantId, eventoId, clienteId, randomBytes(24).toString('base64url')]
  );
  const { rows } = await db.query<{ id: string; token: string; respondida_em: Date | null; envios: number }>(
    'SELECT id, token, respondida_em, envios FROM pesquisa_envios WHERE evento_id = $1 FOR UPDATE',
    [eventoId]
  );
  return rows[0];
}

export const envioSchema = z.object({
  evento_id: z.uuid('Escolha o evento.'),
  para: listaEmails,
  assunto: requiredText('Informe o assunto.', 255),
  mensagem: requiredText('Escreva a mensagem.', 10_000),
});

/**
 * Envia (ou reenvia) a pesquisa do evento por e-mail, na conversa do usuário com o cliente (Inbox). O link é o mesmo
 * em todos os envios do evento; pesquisa já respondida não é reenviada.
 */
export async function enviarPesquisa(db: Db, user: SessionUser, input: z.infer<typeof envioSchema>): Promise<{ delivered: boolean }> {
  const e = await contextoEvento(db, input.evento_id);
  const envio = await obterEnvio(db, user.tenantId, input.evento_id, e.cliente_id);
  if (envio.respondida_em) throw new UserError('O cliente já respondeu a pesquisa deste evento.');
  const empresa = await carregarEmpresa(db);
  const link = linkPesquisa(envio.token);
  let texto = aplicarVariaveis(input.mensagem, { link_pesquisa: link });
  if (!texto.includes(link)) texto = `${texto.trimEnd()}\n\nResponda a pesquisa: ${link}`;
  const conversa = await obterOuCriarConversa(db, user, input.evento_id, { assunto: input.assunto, participantes: input.para, clienteId: e.cliente_id });
  const r = await enviarNaConversa(db, user, conversa.id, {
    para: input.para,
    assunto: input.assunto,
    texto,
    rodape: `Pesquisa de satisfação enviada por ${empresa.nome}.`,
  });
  await db.query(
    `UPDATE pesquisa_envios SET enviado_em = now(), envios = envios + 1, enviado_para = $2, enviado_por = $3 WHERE id = $1`,
    [envio.id, input.para, user.id]
  );
  await registrarTimeline(
    db,
    { tenantId: user.tenantId, eventoId: input.evento_id, usuarioId: user.id },
    'pesquisa',
    `Pesquisa de satisfação ${envio.envios > 0 ? 'reenviada' : 'enviada'} para ${input.para.join(', ')}`,
    { conversa_id: conversa.id, entregue: r.delivered }
  );
  return { delivered: r.delivered };
}

/** Link da pesquisa para copiar e mandar por outro canal (WhatsApp): cria o link sem enviar e-mail. */
export async function linkDoEvento(db: Db, user: SessionUser, eventoId: string): Promise<string> {
  const e = await contextoEvento(db, eventoId);
  const envio = await obterEnvio(db, user.tenantId, eventoId, e.cliente_id);
  return linkPesquisa(envio.token);
}

export interface EventoParaPesquisa {
  id: string;
  titulo: string | null;
  cliente_nome: string | null;
  data_evento: string | null;
  email: string | null;
}

/**
 * Lembrete: eventos fechados (etapa "aprovado") realizados há pelo menos `lembrete_dias` (e até 90 dias), cuja pesquisa
 * ainda não foi enviada.
 */
export async function eventosSemPesquisa(db: Db, lembreteDias: number): Promise<EventoParaPesquisa[]> {
  const { rows } = await db.query<EventoParaPesquisa>(
    `SELECT e.id, e.titulo, c.nome AS cliente_nome, to_char(e.data_evento, 'YYYY-MM-DD') AS data_evento,
            COALESCE(e.responsavel_email, c.email) AS email
       FROM eventos e
       JOIN status_orcamento s ON s.id = e.status_id
       LEFT JOIN clientes c ON c.id = e.cliente_id
       LEFT JOIN pesquisa_envios pe ON pe.evento_id = e.id
      WHERE s.variante = 'aprovado' AND e.data_evento IS NOT NULL
        AND e.data_evento <= current_date - $1::int AND e.data_evento >= current_date - 90
        AND pe.enviado_em IS NULL
      ORDER BY e.data_evento DESC LIMIT 50`,
    [lembreteDias]
  );
  return rows;
}

export interface EventoEnvio {
  id: string;
  rotulo: string;
  /** Valores das variáveis do e-mail (o drawer monta assunto e mensagem no navegador) */
  nome_cliente: string;
  evento: string;
  data_evento: string;
  email: string;
  enviada: boolean;
}

/** Eventos que podem receber a pesquisa: fechados, já realizados (ou sem data) e ainda sem resposta. */
export async function eventosParaEnvio(db: Db): Promise<EventoEnvio[]> {
  const { rows } = await db.query<ContextoEvento & { id: string; enviado_em: Date | null }>(
    `SELECT e.id, e.titulo, to_char(e.data_evento, 'YYYY-MM-DD') AS data_evento, e.cliente_id, c.nome AS cliente_nome, c.email AS cliente_email,
            e.responsavel_nome, e.responsavel_email, pe.enviado_em
       FROM eventos e
       JOIN status_orcamento s ON s.id = e.status_id
       LEFT JOIN clientes c ON c.id = e.cliente_id
       LEFT JOIN pesquisa_envios pe ON pe.evento_id = e.id
      WHERE s.variante = 'aprovado' AND (e.data_evento IS NULL OR e.data_evento <= current_date) AND pe.respondida_em IS NULL
      ORDER BY e.data_evento DESC NULLS LAST LIMIT 300`
  );
  return rows.map((e) => {
    const v = valoresDoEvento(e, '', '');
    return {
      id: e.id,
      rotulo: [e.titulo ?? 'Evento', e.cliente_nome, e.data_evento ? dataCurta(e.data_evento) : null].filter(Boolean).join(' · '),
      nome_cliente: v.nome_cliente,
      evento: v.evento,
      data_evento: v.data_evento,
      email: e.responsavel_email ?? e.cliente_email ?? '',
      enviada: Boolean(e.enviado_em),
    };
  });
}

// ---------------------------------------------------------------------------
// Página pública (/p/<token>, sem sessão)
// ---------------------------------------------------------------------------
export interface PesquisaPublica {
  envioId: string;
  tenantId: string;
  eventoId: string;
  respondida: boolean;
  titulo: string;
  introducao: string | null;
  agradecimento: string;
  evento: string;
  empresa: { nome: string; logo_path: string | null };
  perguntas: PerguntaPublica[];
}

/** Resolve o token (conexão de sistema) e carrega o questionário dentro do tenant dono. */
export async function pesquisaPublica(token: string): Promise<PesquisaPublica | null> {
  if (!/^[\w-]{20,64}$/.test(token)) return null;
  const { rows } = await systemQuery<{ id: string; tenant_id: string }>('SELECT id, tenant_id FROM pesquisa_envios WHERE token = $1', [token]);
  const alvo = rows[0];
  if (!alvo) return null;
  return withTenant(alvo.tenant_id, async (db) => {
    const { rows: env } = await db.query<{ evento_id: string; respondida_em: Date | null }>('SELECT evento_id, respondida_em FROM pesquisa_envios WHERE id = $1', [alvo.id]);
    if (!env[0]) return null;
    const [config, empresa, e, perguntas] = await Promise.all([
      carregarConfig(db),
      carregarEmpresa(db),
      contextoEvento(db, env[0].evento_id),
      listarPerguntas(db, { somenteAtivas: true }),
    ]);
    const valores = valoresDoEvento(e, empresa.nome, token);
    const v = (t: string | null) => (t ? aplicarVariaveis(t, valores) : null);
    return {
      envioId: alvo.id,
      tenantId: alvo.tenant_id,
      eventoId: env[0].evento_id,
      respondida: Boolean(env[0].respondida_em),
      titulo: v(config.titulo)!,
      introducao: v(config.introducao),
      agradecimento: v(config.agradecimento) ?? 'Obrigado pela sua avaliação!',
      evento: e.titulo ?? 'Evento',
      empresa: { nome: empresa.nome, logo_path: empresa.logo_path },
      perguntas: perguntas.map(({ ativa: _a, respostas: _r, ...p }) => ({ ...p, texto: v(p.texto)!, ajuda: v(p.ajuda) })),
    };
  });
}

/** Grava as respostas (uma vez por link) e registra na linha do tempo do evento. */
export async function responderPesquisa(pub: PesquisaPublica, dados: Record<string, unknown>, ip: string): Promise<void> {
  let respostas;
  try {
    respostas = validarRespostas(pub.perguntas, dados);
  } catch (err) {
    throw new UserError((err as Error).message);
  }
  if (!respostas.length) throw new UserError('Responda pelo menos uma pergunta.');
  await withTenant(pub.tenantId, async (db) => {
    const { rows } = await db.query<{ respondida_em: Date | null }>('SELECT respondida_em FROM pesquisa_envios WHERE id = $1 FOR UPDATE', [pub.envioId]);
    if (!rows[0]) throw new UserError('Pesquisa não encontrada.');
    if (rows[0].respondida_em) throw new UserError('Esta pesquisa já foi respondida. Obrigado!');
    for (const r of respostas) {
      await db.query(
        `INSERT INTO pesquisa_respostas (tenant_id, envio_id, pergunta_id, tipo, pergunta_texto, ordem, nota, opcoes, texto)
         VALUES ($1, $2, $3, $4, left($5, 300), $6, $7, $8, $9)`,
        [pub.tenantId, pub.envioId, r.pergunta.id, r.pergunta.tipo, r.pergunta.texto, r.pergunta.ordem, r.nota, r.opcoes, r.texto]
      );
    }
    const nps = respostas.find((r) => r.pergunta.tipo === 'nps')?.nota ?? null;
    await db.query('UPDATE pesquisa_envios SET respondida_em = now(), nps = $2, ip = $3 WHERE id = $1', [pub.envioId, nps, ip.slice(0, 64)]);
    await registrarTimeline(
      db,
      { tenantId: pub.tenantId, eventoId: pub.eventoId, usuarioId: null },
      'pesquisa',
      `Pesquisa de satisfação respondida${nps !== null ? ` — NPS ${nps} (${CLASSES_NPS[classeNps(nps)].toLowerCase()})` : ''}`,
      { envio_id: pub.envioId, nps }
    );
  });
}

// ---------------------------------------------------------------------------
// Indicadores e respostas
// ---------------------------------------------------------------------------
export const PERIODOS_PESQUISA = { '30': 'Últimos 30 dias', '90': 'Últimos 90 dias', '365': 'Últimos 12 meses' } as const;

export interface FiltrosPesquisa {
  /** Envios dos últimos N dias (null = todos) */
  dias: number | null;
  tipoEventoId: string | null;
}

/** Tipos de evento para o filtro dos indicadores. */
export async function tiposParaFiltro(db: Db): Promise<{ id: string; nome: string }[]> {
  return (await db.query<{ id: string; nome: string }>('SELECT id, nome FROM tipos_evento ORDER BY lower(nome)')).rows;
}

export function filtrosPesquisaDaUrl(url: URL): FiltrosPesquisa {
  const p = url.searchParams;
  const dias = p.get('periodo');
  const tipo = p.get('tipo');
  return {
    dias: dias && dias in PERIODOS_PESQUISA ? Number(dias) : null,
    tipoEventoId: tipo && /^[0-9a-f-]{36}$/i.test(tipo) ? tipo : null,
  };
}

// Envios do recorte (CTE reaproveitada pelas consultas de indicadores)
const ENVIOS_FILTRADOS = `
  WITH f AS (
    SELECT pe.* FROM pesquisa_envios pe JOIN eventos ev ON ev.id = pe.evento_id
     WHERE (pe.enviado_em IS NOT NULL OR pe.respondida_em IS NOT NULL)
       AND ($1::int IS NULL OR COALESCE(pe.enviado_em, pe.respondida_em) >= now() - make_interval(days => $1::int))
       AND ($2::uuid IS NULL OR ev.tipo_evento_id = $2)
  )`;

export interface IndicadorNota {
  pergunta_id: string;
  texto: string;
  respostas: number;
  media: number | null;
  satisfeitos: number;
}

export interface IndicadorEscolha {
  pergunta_id: string;
  texto: string;
  tipo: TipoPergunta;
  respostas: number;
  opcoes: { opcao: string; total: number }[];
}

export interface Comentario {
  envio_id: string;
  pergunta: string;
  texto: string;
  nps: number | null;
  evento_titulo: string | null;
  respondida_em: Date;
}

export interface ResumoPesquisas {
  enviadas: number;
  respondidas: number;
  promotores: number;
  neutros: number;
  detratores: number;
  nps: number | null;
  distribuicao: number[];
  notas: IndicadorNota[];
  escolhas: IndicadorEscolha[];
  comentarios: Comentario[];
}

export async function resumoPesquisas(db: Db, f: FiltrosPesquisa): Promise<ResumoPesquisas> {
  const params = [f.dias, f.tipoEventoId];
  const { rows: t } = await db.query<{ enviadas: number; respondidas: number; promotores: number; neutros: number; detratores: number }>(
    `${ENVIOS_FILTRADOS}
     SELECT count(*) FILTER (WHERE enviado_em IS NOT NULL) AS enviadas, count(*) FILTER (WHERE respondida_em IS NOT NULL) AS respondidas,
            count(*) FILTER (WHERE nps >= 9) AS promotores, count(*) FILTER (WHERE nps BETWEEN 7 AND 8) AS neutros,
            count(*) FILTER (WHERE nps <= 6) AS detratores
       FROM f`,
    params
  );
  const { rows: dist } = await db.query<{ nps: number; total: number }>(`${ENVIOS_FILTRADOS} SELECT nps, count(*) AS total FROM f WHERE nps IS NOT NULL GROUP BY nps`, params);
  const distribuicao = Array.from({ length: 11 }, (_, n) => Number(dist.find((d) => d.nps === n)?.total ?? 0));
  const { rows: notas } = await db.query<IndicadorNota>(
    `${ENVIOS_FILTRADOS}
     SELECT p.id AS pergunta_id, p.texto, count(r.id) AS respostas, round(avg(r.nota), 1)::float AS media,
            count(r.id) FILTER (WHERE r.nota >= 4) AS satisfeitos
       FROM pesquisa_perguntas p
       LEFT JOIN pesquisa_respostas r ON r.pergunta_id = p.id AND r.envio_id IN (SELECT id FROM f)
      WHERE p.tipo = 'nota'
      GROUP BY p.id HAVING p.ativa OR count(r.id) > 0 ORDER BY p.ordem`,
    params
  );
  const { rows: escolhas } = await db.query<{ pergunta_id: string; texto: string; tipo: TipoPergunta; opcoes: string[]; respostas: number; contagem: Record<string, number> | null }>(
    `${ENVIOS_FILTRADOS}
     SELECT p.id AS pergunta_id, p.texto, p.tipo, p.opcoes,
            (SELECT count(*) FROM pesquisa_respostas r WHERE r.pergunta_id = p.id AND r.envio_id IN (SELECT id FROM f)) AS respostas,
            (SELECT jsonb_object_agg(o, n) FROM (
               SELECT o, count(*) AS n FROM pesquisa_respostas r, unnest(r.opcoes) AS o
                WHERE r.pergunta_id = p.id AND r.envio_id IN (SELECT id FROM f) GROUP BY o) x) AS contagem
       FROM pesquisa_perguntas p WHERE p.tipo IN ('escolha', 'multipla') ORDER BY p.ordem`,
    params
  );
  const { rows: comentarios } = await db.query<Comentario>(
    `${ENVIOS_FILTRADOS}
     SELECT r.envio_id, r.pergunta_texto AS pergunta, r.texto, f.nps, ev.titulo AS evento_titulo, f.respondida_em
       FROM pesquisa_respostas r JOIN f ON f.id = r.envio_id JOIN eventos ev ON ev.id = f.evento_id
      WHERE r.tipo = 'texto' AND r.texto IS NOT NULL
      ORDER BY f.respondida_em DESC, r.ordem LIMIT 8`,
    params
  );
  const c = t[0];
  const empresa = (await carregarEmpresa(db)).nome;
  return {
    ...c,
    nps: calcularNps(c),
    distribuicao,
    notas: notas.map((q) => ({ ...q, texto: textoParaExibir(q.texto, empresa) })),
    escolhas: escolhas
      .filter((e) => e.respostas > 0 || e.opcoes.length)
      .map((e) => {
        const contagem = e.contagem ?? {};
        // Opções atuais na ordem do cadastro, e as que saíram do cadastro mas têm respostas no fim
        const nomes = [...e.opcoes, ...Object.keys(contagem).filter((o) => !e.opcoes.includes(o))];
        return { pergunta_id: e.pergunta_id, texto: textoParaExibir(e.texto, empresa), tipo: e.tipo, respostas: e.respostas, opcoes: nomes.map((o) => ({ opcao: o, total: Number(contagem[o] ?? 0) })) };
      }),
    comentarios,
  };
}

export interface EnvioPesquisa {
  id: string;
  token: string;
  evento_id: string;
  evento_titulo: string | null;
  cliente_nome: string | null;
  data_evento: string | null;
  enviado_em: Date | null;
  envios: number;
  enviado_para: string[];
  respondida_em: Date | null;
  nps: number | null;
}

export const STATUS_ENVIO = { respondida: 'Respondidas', aguardando: 'Aguardando resposta' } as const;

export async function listarEnvios(
  db: Db,
  f: FiltrosPesquisa & { status: keyof typeof STATUS_ENVIO | null; classe: ClasseNps | null; busca: string | null },
  page: PageParams
): Promise<{ rows: EnvioPesquisa[]; total: number }> {
  const params = [f.dias, f.tipoEventoId, f.status, f.classe, f.busca];
  const where = `WHERE ($3::text IS NULL OR ($3 = 'respondida' AND f.respondida_em IS NOT NULL) OR ($3 = 'aguardando' AND f.respondida_em IS NULL))
                   AND ($4::text IS NULL OR ($4 = 'promotor' AND f.nps >= 9) OR ($4 = 'neutro' AND f.nps BETWEEN 7 AND 8) OR ($4 = 'detrator' AND f.nps <= 6))
                   AND ($5::text IS NULL OR ev.titulo ILIKE $5 OR c.nome ILIKE $5
                        OR EXISTS (SELECT 1 FROM pesquisa_respostas r WHERE r.envio_id = f.id AND r.texto ILIKE $5))`;
  const { rows } = await db.query<EnvioPesquisa>(
    `${ENVIOS_FILTRADOS}
     SELECT f.id, f.token, f.evento_id, ev.titulo AS evento_titulo, c.nome AS cliente_nome, to_char(ev.data_evento, 'YYYY-MM-DD') AS data_evento,
            f.enviado_em, f.envios, f.enviado_para, f.respondida_em, f.nps
       FROM f JOIN eventos ev ON ev.id = f.evento_id LEFT JOIN clientes c ON c.id = ev.cliente_id
      ${where}
      ORDER BY COALESCE(f.respondida_em, f.enviado_em) DESC LIMIT $6 OFFSET $7`,
    [...params, page.pageSize, page.offset]
  );
  const { rows: t } = await db.query<{ total: number }>(
    `${ENVIOS_FILTRADOS} SELECT count(*) AS total FROM f JOIN eventos ev ON ev.id = f.evento_id LEFT JOIN clientes c ON c.id = ev.cliente_id ${where}`,
    params
  );
  return { rows, total: t[0].total };
}

export interface RespostaDetalhe {
  envio: EnvioPesquisa;
  respostas: { pergunta_texto: string; tipo: TipoPergunta; nota: number | null; opcoes: string[] | null; texto: string | null }[];
}

export async function carregarResposta(db: Db, envioId: string): Promise<RespostaDetalhe> {
  const { rows } = await db.query<EnvioPesquisa>(
    `SELECT f.id, f.token, f.evento_id, ev.titulo AS evento_titulo, c.nome AS cliente_nome, to_char(ev.data_evento, 'YYYY-MM-DD') AS data_evento,
            f.enviado_em, f.envios, f.enviado_para, f.respondida_em, f.nps
       FROM pesquisa_envios f JOIN eventos ev ON ev.id = f.evento_id LEFT JOIN clientes c ON c.id = ev.cliente_id
      WHERE f.id = $1`,
    [envioId]
  );
  if (!rows[0]) throw new UserError('Pesquisa não encontrada.');
  const { rows: respostas } = await db.query<RespostaDetalhe['respostas'][number]>(
    'SELECT pergunta_texto, tipo, nota, opcoes, texto FROM pesquisa_respostas WHERE envio_id = $1 ORDER BY ordem, created_at',
    [envioId]
  );
  return { envio: rows[0], respostas };
}

export interface RespostaDaPergunta {
  envio_id: string;
  evento_id: string;
  evento_titulo: string | null;
  cliente_nome: string | null;
  respondida_em: Date;
  nps: number | null;
  nota: number | null;
  opcoes: string[] | null;
  texto: string | null;
}

export interface FiltrosPergunta extends FiltrosPesquisa {
  classe: ClasseNps | null;
  /** Nota exata (NPS/nota) ou opção escolhida */
  valor: string | null;
  busca: string | null;
}

/** Respostas de uma pergunta com filtros (classe NPS de quem respondeu, nota/opção, texto) e a distribuição do recorte. */
export async function respostasDaPergunta(
  db: Db,
  perguntaId: string,
  f: FiltrosPergunta,
  page: PageParams
): Promise<{ rows: RespostaDaPergunta[]; total: number; distribuicao: { valor: string; total: number }[] }> {
  const params = [f.dias, f.tipoEventoId, perguntaId, f.classe, f.valor, f.busca];
  const base = `FROM pesquisa_respostas r JOIN f ON f.id = r.envio_id JOIN eventos ev ON ev.id = f.evento_id LEFT JOIN clientes c ON c.id = ev.cliente_id
     WHERE r.pergunta_id = $3
       AND ($4::text IS NULL OR ($4 = 'promotor' AND f.nps >= 9) OR ($4 = 'neutro' AND f.nps BETWEEN 7 AND 8) OR ($4 = 'detrator' AND f.nps <= 6))`;
  const filtroValor = `AND ($5::text IS NULL OR r.nota::text = $5 OR $5 = ANY(r.opcoes))
       AND ($6::text IS NULL OR r.texto ILIKE $6 OR ev.titulo ILIKE $6 OR c.nome ILIKE $6)`;
  const { rows } = await db.query<RespostaDaPergunta>(
    `${ENVIOS_FILTRADOS}
     SELECT r.envio_id, f.evento_id, ev.titulo AS evento_titulo, c.nome AS cliente_nome, f.respondida_em, f.nps, r.nota, r.opcoes, r.texto
       ${base} ${filtroValor}
      ORDER BY f.respondida_em DESC LIMIT $7 OFFSET $8`,
    [...params, page.pageSize, page.offset]
  );
  const { rows: t } = await db.query<{ total: number }>(`${ENVIOS_FILTRADOS} SELECT count(*) AS total ${base} ${filtroValor}`, params);
  // Distribuição sem o filtro de valor (mostra o todo do recorte; o valor escolhido fica destacado na tela)
  const { rows: distribuicao } = await db.query<{ valor: string; total: number }>(
    `${ENVIOS_FILTRADOS}
     SELECT v AS valor, count(*) AS total FROM (
       SELECT unnest(CASE WHEN r.nota IS NOT NULL THEN ARRAY[r.nota::text] ELSE COALESCE(r.opcoes, '{}') END) AS v
         ${base} AND ($5::text IS NULL OR r.texto ILIKE $5 OR ev.titulo ILIKE $5 OR c.nome ILIKE $5)
     ) x GROUP BY v`,
    [f.dias, f.tipoEventoId, perguntaId, f.classe, f.busca]
  );
  return { rows, total: t[0].total, distribuicao };
}

/** POST das telas de pesquisa: envio/reenvio por e-mail. */
export async function acaoPesquisa(db: Db, user: SessionUser, data: Record<string, unknown>): Promise<string> {
  if (data._action !== 'enviar') throw new UserError('Ação inválida.');
  const input = envioSchema.parse(data);
  const r = await enviarPesquisa(db, user, input);
  return r.delivered
    ? `Pesquisa enviada para ${input.para.join(', ')}.`
    : 'Envio registrado (sem envio real: domínio de teste ou e-mail não configurado).';
}
