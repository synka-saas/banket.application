// Eventos: briefing, quadro de vendas (Kanban/lista), checklist operacional e exportação.
import { z } from 'zod';
import type { Db } from '../lib/db';
import type { SessionUser } from '../lib/auth';
import {
  UserError,
  fieldErrors,
  optionalEmail,
  optionalInt,
  optionalMoney,
  optionalText,
  optionalUuid,
  requiredText,
  stringArray,
} from '../lib/forms';
import type { PageParams } from '../lib/pagination';
import { clienteSchema, salvarCliente } from './clientes';
import { registrarTimeline } from './timeline';
import { dataCurta } from '../lib/datas';
import { orderBy, type Ordenacao } from '../lib/ordenacao';

// ---------------------------------------------------------------------------
// Opções dos campos do briefing (mesmas do formulário público)
// ---------------------------------------------------------------------------
export const RESTRICOES_EVENTO = {
  vegetariana: 'Vegetariano',
  vegana: 'Vegano',
  sem_gluten: 'Sem glúten',
  sem_lactose: 'Sem lactose',
  alergenicos: 'Alergias (frutos do mar, castanhas…)',
} as const;

export const COMPLIANCE = {
  faturamento_prazo: 'Faturamento a prazo',
  laudos_vigilancia: 'Exigência de laudos/alvarás da Vigilância Sanitária',
  certidoes_negativas: 'Certidões negativas da empresa',
  contrato_formal: 'Contrato formal / pedido de compra',
  seguro: 'Seguro de responsabilidade civil',
} as const;

export const CONVITE_EXPERIENCIA = [
  'Sim, quero agendar uma degustação',
  'Sim, quero visitar o espaço',
  'No momento não, quero apenas receber a estimativa inicial.',
];

export const STAFF_TERCEIROS = [
  'Não haverá staff de terceiros',
  'Até 25 profissionais',
  'Entre 25 e 50 profissionais',
  'Entre 50 e 75 profissionais',
  'Mais de 75 profissionais',
];

export const QUALIFICACOES = { alta: 'Alta', media: 'Média', baixa: 'Baixa' } as const;

export const STATUS_CHECKLIST = {
  pendente: 'Pendente',
  agendado: 'Agendado',
  enviado: 'Enviado',
  concluido: 'Concluído',
} as const;

const filtrarCodigos = <T extends Record<string, string>>(mapa: T) =>
  stringArray().transform((lista) => lista.filter((v) => v in mapa));

const hora = () =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() ? v.trim() : null),
    z.string().regex(/^\d{2}:\d{2}$/, 'Horário inválido.').nullable()
  );

const horas = () =>
  z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : Number(String(v).replace(',', '.'))),
    z.number({ error: 'Duração inválida.' }).positive('A duração deve ser maior que zero.').max(72).nullable()
  );

export const eventoSchema = z
  .object({
    // Cliente: existente (cliente_id) ou novo (cliente_novo = "1" + campos do cliente com prefixo)
    cliente_id: optionalUuid(),
    cliente_novo: z.preprocess((v) => v === '1' || v === 'on', z.boolean()),
    titulo: optionalText(200),
    status_id: optionalUuid(),
    tipo_evento_id: optionalUuid(),
    categoria_evento_id: optionalUuid(),
    formato_servico_id: optionalUuid(),
    data_evento: z.preprocess(
      (v) => (typeof v === 'string' && v ? v : null),
      z.iso.date({ error: 'Data do evento inválida.' }).nullable()
    ),
    hora_inicio: hora(),
    hora_fim: hora(),
    duracao_evento_horas: horas(),
    duracao_alimentacao_horas: horas(),
    numero_convidados: optionalInt(),
    perfil_convidados: optionalText(120),
    // Espaço cadastrado (próprio ou de terceiro); sem espaço, o local é texto livre
    espaco_id: optionalUuid(),
    // Só o formulário público informa local_tipo; no app ele é derivado do espaço (resolverLocal)
    local_tipo: z.enum(['casa', 'externo']).optional(),
    local_nome: optionalText(255),
    endereco: optionalText(500),
    infraestrutura: optionalText(2000),
    verba_total: optionalMoney(),
    verba_por_pessoa: optionalMoney(),
    forma_pagamento: optionalText(255),
    qualificacao: z.preprocess((v) => (v ? v : null), z.enum(['alta', 'media', 'baixa']).nullable()),
    responsavel_nome: optionalText(255),
    responsavel_email: optionalEmail(),
    responsavel_whatsapp: optionalText(20),
    convite_experiencia: optionalText(255),
    estilo_principal: optionalText(1000),
    estilo_secundario: optionalText(1000),
    bebidas_alcoolicas: optionalText(1000),
    bebidas_sem_alcool: optionalText(1000),
    restricoes: filtrarCodigos(RESTRICOES_EVENTO),
    compliance: filtrarCodigos(COMPLIANCE),
    staff_terceiros: optionalText(255),
    comentario_cliente: optionalText(5000),
  })
  .refine((e) => e.cliente_novo || e.cliente_id, { message: 'Selecione o cliente ou cadastre um novo.', path: ['cliente_id'] })
  .refine((e) => !e.hora_inicio || !e.hora_fim || e.hora_fim > e.hora_inicio || e.hora_fim < '06:00', {
    message: 'O horário de término deve ser depois do início.',
    path: ['hora_fim'],
  });

export type EventoInput = z.infer<typeof eventoSchema>;

/**
 * Valida o formulário do evento e, se for o caso, o cliente novo de uma vez: todos os erros voltam juntos
 * (o usuário corrige tudo numa só volta).
 */
export function validarFormularioEvento(valores: Record<string, unknown>) {
  const evento = eventoSchema.safeParse(valores);
  const issues = evento.success ? [] : [...evento.error.issues];
  let cliente: ReturnType<typeof clienteNovoDoFormulario> | null = null;
  const querNovo = valores.cliente_novo === '1' || valores.cliente_novo === 'on' || valores.cliente_novo === true;
  if (querNovo) {
    try {
      cliente = clienteNovoDoFormulario(valores);
    } catch (err) {
      if (!(err instanceof z.ZodError)) throw err;
      issues.push(...err.issues);
    }
  }
  if (issues.length || !evento.success) throw new z.ZodError(issues);
  return { input: evento.data, cliente: evento.data.cliente_novo ? cliente : null };
}

/**
 * Erros por campo do formulário do evento. Duplicidade na tabela de clientes (e-mail/documento do cliente novo)
 * aponta para os campos com prefixo "cliente_".
 */
export function errosDoFormularioEvento(err: unknown): Record<string, string> {
  const campos = fieldErrors(err);
  if (!String((err as { constraint?: string })?.constraint ?? '').startsWith('clientes_')) return campos;
  return Object.fromEntries(Object.entries(campos).map(([k, v]) => [`cliente_${k}`, v]));
}

/** Extrai os campos do cliente novo (prefixo "cliente_") do formulário do evento. */
export function clienteNovoDoFormulario(data: Record<string, unknown>) {
  const r = clienteSchema.safeParse({
    tipo_pessoa: data.cliente_tipo_pessoa,
    nome: data.cliente_nome,
    documento: data.cliente_documento,
    email: data.cliente_email,
    telefone: data.cliente_telefone,
  });
  if (r.success) return r.data;
  // Os campos do cliente novo têm o prefixo "cliente_" no formulário do evento: o erro aponta para eles
  throw new z.ZodError(r.error.issues.map((i) => ({ ...i, path: i.path.length ? [`cliente_${String(i.path[0])}`, ...i.path.slice(1)] : i.path })));
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------
export interface EventoCard {
  id: string;
  titulo: string | null;
  cliente_nome: string | null;
  cliente_tipo: 'PF' | 'PJ' | null;
  status_id: string;
  data_evento: string | null;
  hora_inicio: string | null;
  numero_convidados: number | null;
  formato_nome: string | null;
  tipo_nome: string | null;
  categoria_nome: string | null;
  verba_total: number | null;
  valor_orcamento: number | null;
  local_nome: string | null;
  /** Desde quando está na etapa atual (última mudança de status, ou a criação) */
  etapa_desde: Date;
}

export interface FiltrosEventos {
  busca: string | null;
  de: string | null;
  ate: string | null;
  /** Intervalo de trabalho do Kanban (hoje até +N meses; eventos sem data sempre entram). Ignorado com de/ate. */
  intervaloMeses?: number | null;
  tipoId: string | null;
  formatoId: string | null;
  statusId?: string | null;
}

const SELECT_CARD = `
  SELECT e.id, e.titulo, c.nome AS cliente_nome, c.tipo_pessoa AS cliente_tipo, e.status_id,
         to_char(e.data_evento, 'YYYY-MM-DD') AS data_evento, to_char(e.hora_inicio, 'HH24:MI') AS hora_inicio,
         e.numero_convidados, f.nome AS formato_nome, t.nome AS tipo_nome, ce.nome AS categoria_nome,
         e.verba_total, o.valor_total AS valor_orcamento, e.local_nome,
         COALESCE((SELECT max(tl.created_at) FROM evento_timeline tl WHERE tl.evento_id = e.id AND tl.tipo = 'status'),
                  e.created_at) AS etapa_desde
    FROM eventos e
    LEFT JOIN clientes c ON c.id = e.cliente_id
    LEFT JOIN formatos_servico f ON f.id = e.formato_servico_id
    LEFT JOIN tipos_evento t ON t.id = e.tipo_evento_id
    LEFT JOIN categorias_evento ce ON ce.id = e.categoria_evento_id
    LEFT JOIN orcamentos o ON o.evento_id = e.id`;

function whereEventos(f: FiltrosEventos): { sql: string; params: unknown[] } {
  // Datas escolhidas no filtro (recorte temporário) substituem o intervalo de trabalho
  const intervalo = f.de || f.ate ? null : (f.intervaloMeses ?? null);
  const params = [f.busca, f.de, f.ate, f.tipoId, f.formatoId, f.statusId ?? null, intervalo];
  const sql = `
    WHERE ($1::text IS NULL OR e.titulo ILIKE $1 OR c.nome ILIKE $1 OR e.responsavel_nome ILIKE $1 OR e.local_nome ILIKE $1)
      AND ($2::date IS NULL OR e.data_evento >= $2)
      AND ($3::date IS NULL OR e.data_evento <= $3)
      AND ($4::uuid IS NULL OR e.tipo_evento_id = $4)
      AND ($5::uuid IS NULL OR e.formato_servico_id = $5)
      AND ($6::uuid IS NULL OR e.status_id = $6)
      AND ($7::int IS NULL OR e.data_evento IS NULL
           OR e.data_evento BETWEEN (now() AT TIME ZONE 'America/Sao_Paulo')::date
                                AND ((now() AT TIME ZONE 'America/Sao_Paulo')::date + make_interval(months => $7))::date)`;
  return { sql, params };
}

export async function listarEventosKanban(db: Db, filtros: FiltrosEventos): Promise<EventoCard[]> {
  const { sql, params } = whereEventos(filtros);
  const { rows } = await db.query<EventoCard>(
    `${SELECT_CARD} ${sql} ORDER BY e.data_evento NULLS LAST, e.created_at`,
    params
  );
  return rows;
}

const ORDEM_EVENTOS: Record<string, string> = {
  data: 'x.data_evento',
  evento: 'lower(x.titulo)',
  cliente: 'lower(x.cliente_nome)',
  convidados: 'x.numero_convidados',
  etapa: 's.ordem',
  valor: 'COALESCE(x.valor_orcamento, x.verba_total)',
};

export async function listarEventosPaginado(
  db: Db,
  filtros: FiltrosEventos,
  page: PageParams,
  ord?: Ordenacao
): Promise<{ rows: (EventoCard & { status_nome: string; status_cor: string | null })[]; total: number }> {
  const { sql, params } = whereEventos(filtros);
  const { rows } = await db.query(
    `SELECT x.*, s.nome AS status_nome, s.cor AS status_cor FROM (${SELECT_CARD} ${sql}) x
       JOIN status_orcamento s ON s.id = x.status_id
      ORDER BY ${orderBy(ord, ORDEM_EVENTOS, 'x.data_evento DESC NULLS LAST')}
      LIMIT ${page.pageSize} OFFSET ${page.offset}`,
    params
  );
  const count = await db.query<{ total: number }>(
    `SELECT count(*) AS total FROM eventos e LEFT JOIN clientes c ON c.id = e.cliente_id ${sql}`,
    params
  );
  return { rows, total: count.rows[0].total };
}

export interface EventoDetalhe extends Omit<EventoInput, 'cliente_novo'> {
  id: string;
  cliente_nome: string | null;
  cliente_tipo: 'PF' | 'PJ' | null;
  cliente_documento: string | null;
  cliente_email: string | null;
  cliente_telefone: string | null;
  status_id: string;
  status_nome: string;
  status_variante: string;
  motivo_perda: string | null;
  fechado_em: string | null;
  status_cor: string | null;
  tipo_nome: string | null;
  categoria_nome: string | null;
  formato_nome: string | null;
  espaco_id: string | null;
  espaco_nome: string | null;
  espaco_tipo: 'proprio' | 'terceiro' | null;
  valor_orcamento: number | null;
  tem_orcamento: boolean;
  origem: 'manual' | 'formulario';
  created_at: Date;
}

export async function carregarEvento(db: Db, id: string): Promise<EventoDetalhe> {
  const { rows } = await db.query<EventoDetalhe>(
    `SELECT e.id, e.titulo, e.cliente_id, e.status_id, e.tipo_evento_id, e.categoria_evento_id, e.formato_servico_id,
            to_char(e.data_evento, 'YYYY-MM-DD') AS data_evento,
            to_char(e.hora_inicio, 'HH24:MI') AS hora_inicio, to_char(e.hora_fim, 'HH24:MI') AS hora_fim,
            e.duracao_evento_horas, e.duracao_alimentacao_horas, e.numero_convidados, e.perfil_convidados,
            e.local_tipo, e.local_nome, e.endereco, e.infraestrutura, e.verba_total, e.verba_por_pessoa,
            e.forma_pagamento, e.qualificacao, e.responsavel_nome, e.responsavel_email, e.responsavel_whatsapp,
            e.convite_experiencia, e.estilo_principal, e.estilo_secundario, e.bebidas_alcoolicas,
            e.bebidas_sem_alcool, e.restricoes, e.compliance, e.staff_terceiros, e.comentario_cliente,
            e.origem, e.created_at, e.motivo_perda, to_char(e.fechado_em, 'YYYY-MM-DD') AS fechado_em,
            e.espaco_id, es.nome AS espaco_nome, es.tipo AS espaco_tipo,
            c.nome AS cliente_nome, c.tipo_pessoa AS cliente_tipo, c.documento AS cliente_documento,
            c.email AS cliente_email, c.telefone AS cliente_telefone,
            s.nome AS status_nome, s.variante AS status_variante, s.cor AS status_cor,
            t.nome AS tipo_nome, ce.nome AS categoria_nome, f.nome AS formato_nome,
            o.valor_total AS valor_orcamento, (o.id IS NOT NULL) AS tem_orcamento
       FROM eventos e
       LEFT JOIN clientes c ON c.id = e.cliente_id
       JOIN status_orcamento s ON s.id = e.status_id
       LEFT JOIN tipos_evento t ON t.id = e.tipo_evento_id
       LEFT JOIN categorias_evento ce ON ce.id = e.categoria_evento_id
       LEFT JOIN formatos_servico f ON f.id = e.formato_servico_id
       LEFT JOIN espacos es ON es.id = e.espaco_id
       LEFT JOIN orcamentos o ON o.evento_id = e.id
      WHERE e.id = $1`,
    [id]
  );
  if (!rows[0]) throw new UserError('Evento não encontrado.');
  return rows[0];
}

/** Evento existe e pertence ao tenant? (usado pelas páginas antes de renderizar) */
export async function eventoExiste(db: Db, id: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return false;
  const { rows } = await db.query('SELECT 1 FROM eventos WHERE id = $1', [id]);
  return rows.length > 0;
}

export async function statusDeEntrada(db: Db): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `SELECT id FROM status_orcamento WHERE variante = 'novo' ORDER BY ordem LIMIT 1`
  );
  if (!rows[0]) throw new UserError('Configure uma etapa de entrada em Configurações › Etapas do funil.');
  return rows[0].id;
}

// ---------------------------------------------------------------------------
// Escrita
// ---------------------------------------------------------------------------
const CAMPOS = [
  'titulo', 'tipo_evento_id', 'categoria_evento_id', 'formato_servico_id', 'data_evento', 'hora_inicio', 'hora_fim',
  'duracao_evento_horas', 'duracao_alimentacao_horas', 'numero_convidados', 'perfil_convidados', 'espaco_id', 'local_tipo',
  'local_nome', 'endereco', 'infraestrutura', 'verba_total', 'verba_por_pessoa', 'forma_pagamento', 'qualificacao',
  'responsavel_nome', 'responsavel_email', 'responsavel_whatsapp', 'convite_experiencia', 'estilo_principal',
  'estilo_secundario', 'bebidas_alcoolicas', 'bebidas_sem_alcool', 'restricoes', 'compliance', 'staff_terceiros',
  'comentario_cliente',
] as const;

/**
 * Chaves estrangeiras não passam pelo RLS: confirma que cada referência é visível no tenant atual
 * antes de gravar (um id de outra empresa seria aceito pela FK).
 */
async function validarReferencias(db: Db, input: EventoInput, clienteId: string | null) {
  const refs: [string, string | null | undefined, string][] = [
    ['clientes', clienteId, 'Cliente não encontrado.'],
    ['tipos_evento', input.tipo_evento_id, 'Tipo de evento inválido.'],
    ['categorias_evento', input.categoria_evento_id, 'Categoria de evento inválida.'],
    ['formatos_servico', input.formato_servico_id, 'Formato de serviço inválido.'],
    ['status_orcamento', input.status_id, 'Status inválido.'],
    ['espacos', input.espaco_id, 'Espaço inválido.'],
  ];
  for (const [tabela, id, mensagem] of refs) {
    if (!id) continue;
    const { rowCount } = await db.query(`SELECT 1 FROM ${tabela} WHERE id = $1`, [id]);
    if (!rowCount) throw new UserError(mensagem);
  }
}

/**
 * Local do evento a partir do espaço escolhido: o tipo (casa/externo) e o nome espelham o espaço; o endereço do
 * cadastro vale quando o usuário não informou outro. Sem espaço, fica o texto livre do formulário.
 */
async function resolverLocal(db: Db, input: EventoInput): Promise<EventoInput> {
  if (!input.espaco_id) return { ...input, local_tipo: input.local_tipo ?? 'externo' };
  const { rows } = await db.query<{ nome: string; tipo: 'proprio' | 'terceiro'; endereco: string | null }>(
    'SELECT nome, tipo, endereco FROM espacos WHERE id = $1',
    [input.espaco_id]
  );
  if (!rows[0]) throw new UserError('Espaço inválido.');
  return {
    ...input,
    local_tipo: rows[0].tipo === 'proprio' ? 'casa' : 'externo',
    local_nome: rows[0].nome,
    endereco: input.endereco ?? rows[0].endereco,
  };
}

async function tituloPadrao(db: Db, input: EventoInput, clienteId: string): Promise<string> {
  if (input.titulo) return input.titulo;
  const { rows } = await db.query<{ cliente: string; categoria: string | null }>(
    `SELECT c.nome AS cliente, (SELECT nome FROM categorias_evento WHERE id = $2) AS categoria
       FROM clientes c WHERE c.id = $1`,
    [clienteId, input.categoria_evento_id]
  );
  const r = rows[0];
  return r?.categoria ? `${r.categoria} – ${r.cliente}` : `Evento – ${r?.cliente ?? 'sem cliente'}`;
}

export async function criarEvento(
  db: Db,
  // Pedidos do formulário público não têm usuário logado (id null)
  user: Pick<SessionUser, 'tenantId'> & { id: string | null },
  input: EventoInput,
  clienteNovo: ReturnType<typeof clienteNovoDoFormulario> | null,
  origem: 'manual' | 'formulario' = 'manual'
): Promise<string> {
  const clienteId = clienteNovo ? await salvarCliente(db, user.tenantId, null, clienteNovo) : input.cliente_id!;
  await validarReferencias(db, input, clienteId);
  input = await resolverLocal(db, input);
  const statusId = input.status_id ?? (await statusDeEntrada(db));
  const titulo = await tituloPadrao(db, input, clienteId);
  const valores = CAMPOS.map((c) => (c === 'titulo' ? titulo : input[c]));
  const colunas = [...CAMPOS, 'cliente_id', 'status_id', 'origem', 'criado_por', 'tenant_id'];
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO eventos (${colunas.join(', ')})
     VALUES (${colunas.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`,
    [...valores, clienteId, statusId, origem, origem === 'manual' ? user.id : null, user.tenantId]
  );
  const eventoId = rows[0].id;
  await registrarTimeline(
    db,
    { tenantId: user.tenantId, eventoId, usuarioId: origem === 'manual' ? user.id : null },
    origem === 'formulario' ? 'formulario' : 'criado',
    origem === 'formulario' ? 'Pedido recebido pelo formulário' : 'Evento cadastrado'
  );
  return eventoId;
}

export async function atualizarEvento(
  db: Db,
  user: SessionUser,
  id: string,
  input: EventoInput,
  clienteNovo: ReturnType<typeof clienteNovoDoFormulario> | null
) {
  const antes = await carregarEvento(db, id);
  const clienteId = clienteNovo ? await salvarCliente(db, user.tenantId, null, clienteNovo) : input.cliente_id!;
  await validarReferencias(db, input, clienteId);
  input = await resolverLocal(db, input);
  const titulo = await tituloPadrao(db, input, clienteId);
  const valores = CAMPOS.map((c) => (c === 'titulo' ? titulo : input[c]));
  await db.query(
    `UPDATE eventos SET ${CAMPOS.map((c, i) => `${c} = $${i + 1}`).join(', ')},
            cliente_id = $${CAMPOS.length + 1}, updated_at = now()
      WHERE id = $${CAMPOS.length + 2}`,
    [...valores, clienteId, id]
  );

  // Registra na linha do tempo as mudanças que importam para o comercial
  const mudancas: string[] = [];
  if (antes.data_evento !== input.data_evento) mudancas.push(`data: ${antes.data_evento ?? '-'} → ${input.data_evento ?? '-'}`);
  if (antes.numero_convidados !== input.numero_convidados)
    mudancas.push(`convidados: ${antes.numero_convidados ?? '-'} → ${input.numero_convidados ?? '-'}`);
  if (antes.cliente_id !== clienteId) mudancas.push('cliente alterado');
  if ((antes.espaco_id ?? null) !== (input.espaco_id ?? null))
    mudancas.push(`espaço: ${antes.espaco_nome ?? antes.local_nome ?? '-'} → ${input.local_nome ?? '-'}`);
  await registrarTimeline(
    db,
    { tenantId: user.tenantId, eventoId: id, usuarioId: user.id },
    'editado',
    mudancas.length ? `Evento atualizado (${mudancas.join('; ')})` : 'Evento atualizado'
  );
  if (input.status_id && input.status_id !== antes.status_id) await moverEvento(db, user, id, input.status_id);
}

export interface ExtrasEtapa {
  /** Motivo da perda, ao mover para uma etapa "recusado" */
  motivo?: string | null;
  /** Data de fechamento (AAAA-MM-DD), ao mover para uma etapa "aprovado"; padrão: hoje */
  fechadoEm?: string | null;
}

export async function moverEvento(db: Db, user: SessionUser, id: string, statusId: string, extras: ExtrasEtapa = {}) {
  const { rows } = await db.query<{ de: string; para: string | null; variante: string | null }>(
    `SELECT s.nome AS de, d.nome AS para, d.variante
       FROM eventos e JOIN status_orcamento s ON s.id = e.status_id
       LEFT JOIN status_orcamento d ON d.id = $2
      WHERE e.id = $1`,
    [id, statusId]
  );
  if (!rows[0]) throw new UserError('Evento não encontrado.');
  if (!rows[0].para) throw new UserError('Status inválido.');
  if (rows[0].de === rows[0].para) return;
  // O motivo/fechamento pertence à etapa em que o evento está: sai dela, é limpo
  const motivo = rows[0].variante === 'recusado' ? (extras.motivo?.trim() || null) : null;
  const fechadoEm = rows[0].variante === 'aprovado' ? (extras.fechadoEm ?? null) : null;
  await db.query(
    `UPDATE eventos SET status_id = $1, motivo_perda = $2,
            fechado_em = CASE WHEN $4 = 'aprovado' THEN COALESCE($3::date, CURRENT_DATE) END,
            updated_at = now()
      WHERE id = $5`,
    [statusId, motivo, fechadoEm, rows[0].variante, id]
  );
  const detalhe = motivo ? ` — motivo: ${motivo}` : rows[0].variante === 'aprovado' ? ` — fechado em ${fechadoEm ? dataCurta(fechadoEm) : 'hoje'}` : '';
  await registrarTimeline(
    db,
    { tenantId: user.tenantId, eventoId: id, usuarioId: user.id },
    'status',
    `Status alterado de "${rows[0].de}" para "${rows[0].para}"${detalhe}`,
    { status_id: statusId, motivo, fechado_em: fechadoEm }
  );
}

export async function excluirEvento(db: Db, id: string) {
  // O orçamento (e suas versões) pertence ao evento e é removido junto
  await db.query('DELETE FROM orcamentos WHERE evento_id = $1', [id]);
  const res = await db.query('DELETE FROM eventos WHERE id = $1', [id]);
  if (!res.rowCount) throw new UserError('Evento não encontrado.');
}

// ---------------------------------------------------------------------------
// Checklist operacional
// ---------------------------------------------------------------------------
export const checklistSchema = z.object({
  item: requiredText('Descreva o item do checklist.', 255),
  status: z.enum(['pendente', 'agendado', 'enviado', 'concluido']).default('pendente'),
  prazo: z.preprocess((v) => (typeof v === 'string' && v ? v : null), z.iso.date('Prazo inválido.').nullable()),
});

export interface ChecklistRow {
  id: string;
  item: string;
  status: keyof typeof STATUS_CHECKLIST;
  prazo: string | null;
}

export async function listarChecklist(db: Db, eventoId: string): Promise<ChecklistRow[]> {
  const { rows } = await db.query<ChecklistRow>(
    `SELECT id, item, status, to_char(prazo, 'YYYY-MM-DD') AS prazo FROM evento_checklist
      WHERE evento_id = $1 ORDER BY ordem, created_at`,
    [eventoId]
  );
  return rows;
}

export async function salvarChecklist(
  db: Db,
  user: SessionUser,
  eventoId: string,
  id: string | null,
  input: z.infer<typeof checklistSchema>
) {
  if (id) {
    const { rows } = await db.query<{ status: string }>(
      'SELECT status FROM evento_checklist WHERE id = $1 AND evento_id = $2',
      [id, eventoId]
    );
    if (!rows[0]) throw new UserError('Item do checklist não encontrado.');
    await db.query('UPDATE evento_checklist SET item = $1, status = $2, prazo = $3 WHERE id = $4', [
      input.item,
      input.status,
      input.prazo,
      id,
    ]);
    if (rows[0].status !== input.status) {
      await registrarTimeline(
        db,
        { tenantId: user.tenantId, eventoId, usuarioId: user.id },
        'checklist',
        `Checklist: "${input.item}" marcado como ${STATUS_CHECKLIST[input.status].toLowerCase()}`
      );
    }
    return;
  }
  await db.query(
    `INSERT INTO evento_checklist (tenant_id, evento_id, item, status, prazo, ordem)
     VALUES ($1, $2, $3, $4, $5, (SELECT COALESCE(max(ordem), 0) + 1 FROM evento_checklist WHERE evento_id = $2))`,
    [user.tenantId, eventoId, input.item, input.status, input.prazo]
  );
}

export async function excluirChecklist(db: Db, eventoId: string, id: string) {
  const res = await db.query('DELETE FROM evento_checklist WHERE id = $1 AND evento_id = $2', [id, eventoId]);
  if (!res.rowCount) throw new UserError('Item do checklist não encontrado.');
}

// ---------------------------------------------------------------------------
// Exportação CSV
// ---------------------------------------------------------------------------
function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  // Evita injeção de fórmula ao abrir no Excel/Sheets
  const seguro = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[";\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

export async function exportarEventosCsv(db: Db, filtros: FiltrosEventos): Promise<string> {
  const { sql, params } = whereEventos(filtros);
  const { rows } = await db.query(
    `SELECT e.titulo, c.nome AS cliente, s.nome AS status, to_char(e.data_evento, 'DD/MM/YYYY') AS data,
            to_char(e.hora_inicio, 'HH24:MI') AS horario, e.numero_convidados, t.nome AS tipo, ce.nome AS categoria,
            f.nome AS formato, e.local_nome, e.verba_total, o.valor_total AS orcamento, e.responsavel_nome,
            e.responsavel_email, e.responsavel_whatsapp
       FROM eventos e
       LEFT JOIN clientes c ON c.id = e.cliente_id
       JOIN status_orcamento s ON s.id = e.status_id
       LEFT JOIN tipos_evento t ON t.id = e.tipo_evento_id
       LEFT JOIN categorias_evento ce ON ce.id = e.categoria_evento_id
       LEFT JOIN formatos_servico f ON f.id = e.formato_servico_id
       LEFT JOIN orcamentos o ON o.evento_id = e.id
       ${sql}
      ORDER BY e.data_evento NULLS LAST`,
    params
  );
  const cabecalho = [
    'Evento', 'Cliente', 'Etapa', 'Data', 'Horário', 'Convidados', 'Tipo', 'Ocasião', 'Formato de serviço', 'Local',
    'Verba', 'Orçamento', 'Responsável', 'E-mail', 'WhatsApp',
  ];
  const linhas = rows.map((r) =>
    [
      r.titulo, r.cliente, r.status, r.data, r.horario, r.numero_convidados, r.tipo, r.categoria, r.formato,
      r.local_nome, r.verba_total?.toString().replace('.', ','), r.orcamento?.toString().replace('.', ','),
      r.responsavel_nome, r.responsavel_email, r.responsavel_whatsapp,
    ].map(csvCell).join(';')
  );
  // BOM para o Excel reconhecer UTF-8
  return '﻿' + [cabecalho.join(';'), ...linhas].join('\r\n');
}

/** Lê os filtros do quadro de vendas a partir da query string. */
export function filtrosDaUrl(url: URL, busca: string | null): FiltrosEventos {
  const p = url.searchParams;
  const data = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const uuid = (v: string | null) => (v && /^[0-9a-f-]{36}$/i.test(v) ? v : null);
  return {
    busca,
    de: data(p.get('de')),
    ate: data(p.get('ate')),
    tipoId: uuid(p.get('tipo')),
    formatoId: uuid(p.get('formato')),
    statusId: uuid(p.get('status')),
  };
}

/** Listas usadas pelo formulário do evento. */
/** Espaços oferecidos no formulário do evento: ativos mais o já escolhido (mesmo inativo), com endereço para a dica */
export interface EspacoOpcao {
  id: string;
  nome: string;
  tipo: 'proprio' | 'terceiro';
  endereco: string | null;
  ativo: boolean;
}

export async function opcoesFormularioEvento(db: Db, espacoAtualId: string | null = null) {
  const [clientes, tipos, categorias, formatos, status, espacos] = [
    (await db.query<{ id: string; nome: string; documento: string | null }>(
      'SELECT id, nome, documento FROM clientes ORDER BY lower(nome)'
    )).rows,
    (await db.query<{ id: string; nome: string }>('SELECT id, nome FROM tipos_evento ORDER BY lower(nome)')).rows,
    (await db.query<{ id: string; nome: string; tipos: string[] }>(
      `SELECT c.id, c.nome,
              COALESCE(array_agg(cet.tipo_evento_id::text) FILTER (WHERE cet.tipo_evento_id IS NOT NULL), '{}') AS tipos
         FROM categorias_evento c LEFT JOIN categoria_evento_tipos cet ON cet.categoria_id = c.id
        GROUP BY c.id ORDER BY lower(c.nome)`
    )).rows,
    (await db.query<{ id: string; nome: string }>('SELECT id, nome FROM formatos_servico ORDER BY ordem, lower(nome)')).rows,
    (await db.query<{ id: string; nome: string; variante: string }>('SELECT id, nome, variante FROM status_orcamento ORDER BY ordem')).rows,
    (await db.query<EspacoOpcao>(
      'SELECT id, nome, tipo, endereco, ativo FROM espacos WHERE ativo OR id = $1 ORDER BY tipo, ordem, lower(nome)',
      [espacoAtualId]
    )).rows,
  ];
  return { clientes, tipos, categorias, formatos, status, espacos };
}
