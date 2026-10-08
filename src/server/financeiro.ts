// Gestão financeira (owner/admin): contas a receber e a pagar, categorias, baixa, plano de pagamento do evento
// (condições acertadas no fechamento → contas a receber) e contas nascidas das movimentações de estoque.
import { z } from 'zod';
import type { Db } from '../lib/db';
import type { SessionUser } from '../lib/auth';
import { UserError, checkbox, optionalDate, optionalInt, optionalMoney, optionalText, optionalUuid, requiredText } from '../lib/forms';
import type { PageParams } from '../lib/pagination';
import { orderBy, type Ordenacao } from '../lib/ordenacao';
import { dataCurta, hojeSaoPaulo, somarMeses } from '../lib/datas';
import { formatMoney } from '../lib/money';
import {
  FORMAS_PAGAMENTO,
  centavos,
  gerarParcelas,
  rotuloParcela,
  rotuloSituacao,
  situacaoConta,
  type FormaPagamento,
  type SituacaoConta,
  type StatusConta,
  type TipoConta,
  TIPO_CONTA_DO_MOTIVO,
} from '../lib/financeiro';
import { registrarTimeline } from './timeline';

export * from '../lib/financeiro';

const forma = z.preprocess(
  (v) => (v === '' || v === undefined ? null : v),
  z.enum(Object.keys(FORMAS_PAGAMENTO) as [FormaPagamento, ...FormaPagamento[]], { error: 'Forma de pagamento inválida.' }).nullable()
);
const tipoConta = z.enum(['receber', 'pagar'], { error: 'Tipo de conta inválido.' });
const valorObrigatorio = (mensagem: string) =>
  optionalMoney().refine((v) => v !== null && v > 0, mensagem).transform((v) => centavos(v!));
const dataObrigatoria = (mensagem: string) => optionalDate().refine((v) => v !== null, mensagem).transform((v) => v!);

// ---------------------------------------------------------------------------
// Categorias
// ---------------------------------------------------------------------------
export const categoriaSchema = z.object({
  tipo: tipoConta,
  nome: requiredText('Informe o nome da categoria.', 80),
  ativo: checkbox(),
});

export interface Categoria {
  id: string;
  tipo: TipoConta;
  nome: string;
  ativo: boolean;
  ordem: number;
  contas: number;
}

export async function listarCategorias(db: Db, opts: { tipo?: TipoConta; somenteAtivas?: boolean } = {}): Promise<Categoria[]> {
  const { rows } = await db.query<Categoria>(
    `SELECT c.id, c.tipo, c.nome, c.ativo, c.ordem, (SELECT count(*) FROM fin_contas f WHERE f.categoria_id = c.id) AS contas
       FROM fin_categorias c
      WHERE ($1::text IS NULL OR c.tipo = $1) AND (NOT $2 OR c.ativo)
      ORDER BY c.tipo DESC, c.ordem, lower(c.nome)`,
    [opts.tipo ?? null, Boolean(opts.somenteAtivas)]
  );
  return rows;
}

export async function salvarCategoria(db: Db, tenantId: string, id: string | null, input: z.infer<typeof categoriaSchema>): Promise<void> {
  if (id) {
    const res = await db.query('UPDATE fin_categorias SET nome = $1, tipo = $2, ativo = $3 WHERE id = $4', [input.nome, input.tipo, input.ativo, id]);
    if (!res.rowCount) throw new UserError('Categoria não encontrada.');
    return;
  }
  await db.query(
    `INSERT INTO fin_categorias (tenant_id, tipo, nome, ativo, ordem)
     VALUES ($1, $2, $3, $4, (SELECT COALESCE(max(ordem), 0) + 1 FROM fin_categorias WHERE tipo = $2))`,
    [tenantId, input.tipo, input.nome, input.ativo]
  );
}

/** Excluir não apaga contas: elas ficam sem categoria. */
export async function excluirCategoria(db: Db, id: string): Promise<void> {
  const res = await db.query('DELETE FROM fin_categorias WHERE id = $1', [id]);
  if (!res.rowCount) throw new UserError('Categoria não encontrada.');
}

// ---------------------------------------------------------------------------
// Contas
// ---------------------------------------------------------------------------
export const contaSchema = z
  .object({
    tipo: tipoConta,
    descricao: requiredText('Descreva a conta.', 255),
    categoria_id: optionalUuid(),
    evento_id: optionalUuid(),
    fornecedor: optionalText(200),
    valor: valorObrigatorio('Informe o valor.'),
    vencimento: dataObrigatoria('Informe o vencimento.'),
    forma_pagamento: forma,
    documento: optionalText(60),
    observacoes: optionalText(1000),
    // Criar já quitada (ex.: compra paga à vista)
    ja_paga: checkbox(),
    pago_em: optionalDate(),
  })
  .superRefine((d, ctx) => {
    if (d.ja_paga && !d.pago_em) ctx.addIssue({ code: 'custom', path: ['pago_em'], message: 'Informe a data do pagamento.' });
  });
export type ContaInput = z.infer<typeof contaSchema>;

export const baixaSchema = z.object({
  pago_em: dataObrigatoria('Informe a data do pagamento.'),
  valor_pago: optionalMoney().refine((v) => v !== null, 'Informe o valor pago.').transform((v) => centavos(v!)),
  forma_pagamento: forma,
});

export interface Conta {
  id: string;
  tipo: TipoConta;
  descricao: string;
  categoria_id: string | null;
  categoria_nome: string | null;
  evento_id: string | null;
  evento_titulo: string | null;
  cliente_nome: string | null;
  fornecedor: string | null;
  valor: number;
  vencimento: string;
  forma_pagamento: FormaPagamento | null;
  documento: string | null;
  observacoes: string | null;
  origem: 'manual' | 'plano' | 'estoque';
  parcela: number | null;
  parcelas: number | null;
  estoque_movimento_id: string | null;
  status: StatusConta;
  situacao: SituacaoConta;
  pago_em: string | null;
  valor_pago: number | null;
}

const SELECT_CONTA = `
  SELECT c.id, c.tipo, c.descricao, c.categoria_id, cat.nome AS categoria_nome, c.evento_id, e.titulo AS evento_titulo,
         cl.nome AS cliente_nome, c.fornecedor, c.valor, to_char(c.vencimento, 'YYYY-MM-DD') AS vencimento, c.forma_pagamento,
         c.documento, c.observacoes, c.origem, c.parcela, c.parcelas, c.estoque_movimento_id, c.status,
         to_char(c.pago_em, 'YYYY-MM-DD') AS pago_em, c.valor_pago
    FROM fin_contas c
    LEFT JOIN fin_categorias cat ON cat.id = c.categoria_id
    LEFT JOIN eventos e ON e.id = c.evento_id
    LEFT JOIN clientes cl ON cl.id = c.cliente_id`;

const comSituacao = (rows: Omit<Conta, 'situacao'>[], hoje = hojeSaoPaulo()): Conta[] =>
  rows.map((r) => ({ ...r, situacao: situacaoConta(r.status, r.vencimento, hoje) }));

export async function carregarConta(db: Db, id: string): Promise<Conta> {
  const { rows } = await db.query<Omit<Conta, 'situacao'>>(`${SELECT_CONTA} WHERE c.id = $1`, [id]);
  if (!rows[0]) throw new UserError('Conta não encontrada.');
  return comSituacao(rows)[0];
}

/** Categoria e evento vindos do formulário precisam ser da empresa (FK não passa pelo RLS). */
async function validarReferencias(db: Db, tipo: TipoConta, categoriaId: string | null, eventoId: string | null) {
  if (categoriaId) {
    const { rows } = await db.query<{ tipo: string }>('SELECT tipo FROM fin_categorias WHERE id = $1', [categoriaId]);
    if (!rows[0]) throw new UserError('Categoria não encontrada.', 'categoria_id');
    if (rows[0].tipo !== tipo) throw new UserError('A categoria não é deste tipo de conta.', 'categoria_id');
  }
  let clienteId: string | null = null;
  if (eventoId) {
    const { rows } = await db.query<{ cliente_id: string | null }>('SELECT cliente_id FROM eventos WHERE id = $1', [eventoId]);
    if (!rows[0]) throw new UserError('Evento não encontrado.', 'evento_id');
    clienteId = rows[0].cliente_id;
  }
  return { clienteId };
}

export async function salvarConta(db: Db, user: SessionUser, id: string | null, input: ContaInput): Promise<string> {
  const { clienteId } = await validarReferencias(db, input.tipo, input.categoria_id, input.evento_id);
  const campos = [input.descricao, input.categoria_id, input.evento_id, clienteId, input.fornecedor ?? null, input.valor, input.vencimento,
    input.forma_pagamento, input.documento ?? null, input.observacoes ?? null];
  if (id) {
    const res = await db.query(
      `UPDATE fin_contas SET descricao = $1, categoria_id = $2, evento_id = $3, cliente_id = $4, fornecedor = $5, valor = $6,
              vencimento = $7, forma_pagamento = $8, documento = $9, observacoes = $10, updated_at = now()
        WHERE id = $11 AND tipo = $12`,
      [...campos, id, input.tipo]
    );
    if (!res.rowCount) throw new UserError('Conta não encontrada.');
    return id;
  }
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO fin_contas (descricao, categoria_id, evento_id, cliente_id, fornecedor, valor, vencimento, forma_pagamento, documento,
                             observacoes, tenant_id, tipo, usuario_id, status, pago_em, valor_pago, baixa_usuario_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING id`,
    [...campos, user.tenantId, input.tipo, user.id, input.ja_paga ? 'paga' : 'aberta', input.ja_paga ? input.pago_em : null,
      input.ja_paga ? input.valor : null, input.ja_paga ? user.id : null]
  );
  return rows[0].id;
}

async function timelineDaConta(db: Db, user: SessionUser, contaId: string, descricao: (c: Conta) => string) {
  const c = await carregarConta(db, contaId);
  if (!c.evento_id) return;
  await registrarTimeline(db, { tenantId: user.tenantId, eventoId: c.evento_id, usuarioId: user.id }, 'financeiro', descricao(c), { conta_id: c.id, tipo: c.tipo });
}

/** Registra o pagamento (recebimento) da conta: data, valor pago (aceita juros/desconto) e forma. */
export async function baixarConta(db: Db, user: SessionUser, id: string, input: z.infer<typeof baixaSchema>): Promise<Conta> {
  const res = await db.query(
    `UPDATE fin_contas SET status = 'paga', pago_em = $2, valor_pago = $3, forma_pagamento = COALESCE($4, forma_pagamento),
            baixa_usuario_id = $5, updated_at = now()
      WHERE id = $1 AND status = 'aberta'`,
    [id, input.pago_em, input.valor_pago, input.forma_pagamento, user.id]
  );
  if (!res.rowCount) throw new UserError('Só contas em aberto podem receber baixa.');
  await timelineDaConta(db, user, id, (c) =>
    `${c.tipo === 'receber' ? 'Recebimento' : 'Pagamento'} registrado: ${c.descricao} — ${formatMoney(Number(c.valor_pago))} em ${dataCurta(c.pago_em)}`);
  return carregarConta(db, id);
}

/** Desfaz a baixa ou o cancelamento: a conta volta a ficar em aberto. */
export async function reabrirConta(db: Db, user: SessionUser, id: string): Promise<void> {
  const res = await db.query(
    `UPDATE fin_contas SET status = 'aberta', pago_em = NULL, valor_pago = NULL, baixa_usuario_id = NULL, updated_at = now()
      WHERE id = $1 AND status <> 'aberta'`,
    [id]
  );
  if (!res.rowCount) throw new UserError('A conta já está em aberto.');
  await timelineDaConta(db, user, id, (c) => `Conta reaberta: ${c.descricao}`);
}

export async function cancelarConta(db: Db, user: SessionUser, id: string): Promise<void> {
  const res = await db.query(`UPDATE fin_contas SET status = 'cancelada', updated_at = now() WHERE id = $1 AND status = 'aberta'`, [id]);
  if (!res.rowCount) throw new UserError('Só contas em aberto podem ser canceladas.');
  await timelineDaConta(db, user, id, (c) => `Conta cancelada: ${c.descricao} (${formatMoney(Number(c.valor))})`);
}

export async function excluirConta(db: Db, id: string): Promise<void> {
  const res = await db.query('DELETE FROM fin_contas WHERE id = $1', [id]);
  if (!res.rowCount) throw new UserError('Conta não encontrada.');
}

// ---------------------------------------------------------------------------
// Listagem (menu Financeiro)
// ---------------------------------------------------------------------------
export const PERIODOS = {
  mes: 'Vence neste mês',
  mes_anterior: 'Venceu no mês passado',
  proximo_mes: 'Vence no próximo mês',
  proximos_30: 'Próximos 30 dias',
  ano: 'Neste ano',
} as const;
export type Periodo = keyof typeof PERIODOS;

export const FILTROS_SITUACAO = {
  pendentes: 'Em aberto e vencidas',
  aberta: 'Em aberto (a vencer)',
  vencida: 'Vencidas',
  paga: 'Pagas / recebidas',
  cancelada: 'Canceladas',
  todas: 'Todas',
} as const;
export type FiltroSituacao = keyof typeof FILTROS_SITUACAO;

/** Intervalo de vencimento de um período (datas no fuso de São Paulo). */
export function intervaloPeriodo(periodo: Periodo | null, hoje = hojeSaoPaulo()): { de: string | null; ate: string | null } {
  const inicioMes = `${hoje.slice(0, 7)}-01`;
  const ultimoDia = (inicio: string) => {
    const [a, m] = inicio.split('-').map(Number);
    return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
  };
  switch (periodo) {
    case 'mes':
      return { de: inicioMes, ate: ultimoDia(inicioMes) };
    case 'mes_anterior': {
      const ini = somarMeses(inicioMes, -1);
      return { de: ini, ate: ultimoDia(ini) };
    }
    case 'proximo_mes': {
      const ini = somarMeses(inicioMes, 1);
      return { de: ini, ate: ultimoDia(ini) };
    }
    case 'proximos_30': {
      const d = new Date(`${hoje}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 30);
      return { de: hoje, ate: d.toISOString().slice(0, 10) };
    }
    case 'ano':
      return { de: `${hoje.slice(0, 4)}-01-01`, ate: `${hoje.slice(0, 4)}-12-31` };
    default:
      return { de: null, ate: null };
  }
}

export interface FiltrosContas {
  tipo: TipoConta;
  situacao: FiltroSituacao;
  periodo: Periodo | null;
  categoriaId: string | null;
  eventoId: string | null;
  busca: string | null;
}

export interface TotaisContas {
  quantidade: number;
  valor: number;
  aberto: number;
  vencido: number;
  pago: number;
}

const ORDEM_CONTAS: Record<string, string> = { vencimento: 'c.vencimento', valor: 'c.valor', descricao: 'lower(c.descricao)' };

export async function listarContas(db: Db, f: FiltrosContas, page: PageParams, ord?: Ordenacao): Promise<{ rows: Conta[]; total: number; totais: TotaisContas }> {
  const hoje = hojeSaoPaulo();
  const { de, ate } = intervaloPeriodo(f.periodo, hoje);
  const params = [f.tipo, f.situacao, hoje, de, ate, f.categoriaId, f.eventoId, f.busca];
  const where = `WHERE c.tipo = $1
      AND CASE $2::text
            WHEN 'pendentes' THEN c.status = 'aberta'
            WHEN 'aberta' THEN c.status = 'aberta' AND c.vencimento >= $3::date
            WHEN 'vencida' THEN c.status = 'aberta' AND c.vencimento < $3::date
            WHEN 'paga' THEN c.status = 'paga'
            WHEN 'cancelada' THEN c.status = 'cancelada'
            ELSE true END
      AND ($4::date IS NULL OR c.vencimento >= $4::date) AND ($5::date IS NULL OR c.vencimento <= $5::date)
      AND ($6::uuid IS NULL OR c.categoria_id = $6) AND ($7::uuid IS NULL OR c.evento_id = $7)
      AND ($8::text IS NULL OR c.descricao ILIKE $8 OR c.fornecedor ILIKE $8 OR c.documento ILIKE $8 OR e.titulo ILIKE $8 OR cl.nome ILIKE $8)`;
  const { rows } = await db.query<Omit<Conta, 'situacao'>>(
    `${SELECT_CONTA} ${where} ORDER BY ${orderBy(ord, ORDEM_CONTAS, 'c.vencimento, c.parcela NULLS FIRST, lower(c.descricao)')} LIMIT $9 OFFSET $10`,
    [...params, page.pageSize, page.offset]
  );
  const { rows: t } = await db.query<TotaisContas>(
    `SELECT count(*) AS quantidade,
            COALESCE(sum(c.valor) FILTER (WHERE c.status <> 'cancelada'), 0) AS valor,
            COALESCE(sum(c.valor) FILTER (WHERE c.status = 'aberta'), 0) AS aberto,
            COALESCE(sum(c.valor) FILTER (WHERE c.status = 'aberta' AND c.vencimento < $3::date), 0) AS vencido,
            COALESCE(sum(c.valor_pago) FILTER (WHERE c.status = 'paga'), 0) AS pago
       FROM fin_contas c LEFT JOIN eventos e ON e.id = c.evento_id LEFT JOIN clientes cl ON cl.id = c.cliente_id ${where}`,
    params
  );
  return { rows: comSituacao(rows, hoje), total: t[0].quantidade, totais: t[0] };
}

/** Todas as contas do recorte, para a exportação CSV. */
export async function contasParaExportar(db: Db, f: FiltrosContas): Promise<Conta[]> {
  return (await listarContas(db, f, { page: 1, pageSize: 5000, offset: 0 })).rows;
}

// ---------------------------------------------------------------------------
// Visão geral
// ---------------------------------------------------------------------------
export interface FluxoMes {
  mes: string;
  receber: number;
  pagar: number;
  recebido: number;
  pago: number;
}

export interface ResumoFinanceiro {
  receber_aberto: number;
  receber_vencido: number;
  pagar_aberto: number;
  pagar_vencido: number;
  recebido_mes: number;
  pago_mes: number;
  fluxo: FluxoMes[];
  proximas: Conta[];
  vencidas: Conta[];
}

/** Indicadores do menu Financeiro: saldos em aberto, realizado no mês e fluxo de caixa (3 meses atrás a 5 à frente). */
export async function resumoFinanceiro(db: Db): Promise<ResumoFinanceiro> {
  const hoje = hojeSaoPaulo();
  const inicioMes = `${hoje.slice(0, 7)}-01`;
  const { rows: r } = await db.query<Omit<ResumoFinanceiro, 'fluxo' | 'proximas' | 'vencidas'>>(
    `SELECT COALESCE(sum(valor) FILTER (WHERE tipo = 'receber' AND status = 'aberta'), 0) AS receber_aberto,
            COALESCE(sum(valor) FILTER (WHERE tipo = 'receber' AND status = 'aberta' AND vencimento < $1::date), 0) AS receber_vencido,
            COALESCE(sum(valor) FILTER (WHERE tipo = 'pagar' AND status = 'aberta'), 0) AS pagar_aberto,
            COALESCE(sum(valor) FILTER (WHERE tipo = 'pagar' AND status = 'aberta' AND vencimento < $1::date), 0) AS pagar_vencido,
            COALESCE(sum(valor_pago) FILTER (WHERE tipo = 'receber' AND status = 'paga' AND pago_em >= $2::date), 0) AS recebido_mes,
            COALESCE(sum(valor_pago) FILTER (WHERE tipo = 'pagar' AND status = 'paga' AND pago_em >= $2::date), 0) AS pago_mes
       FROM fin_contas`,
    [hoje, inicioMes]
  );
  // Previsto pelo vencimento (contas em aberto) e realizado pela data do pagamento
  const { rows: fluxo } = await db.query<FluxoMes>(
    `WITH meses AS (SELECT to_char(m, 'YYYY-MM') AS mes FROM generate_series($1::date - interval '3 months', $1::date + interval '5 months', interval '1 month') AS m)
     SELECT meses.mes,
            COALESCE(sum(c.valor) FILTER (WHERE c.tipo = 'receber' AND c.status = 'aberta' AND to_char(c.vencimento, 'YYYY-MM') = meses.mes), 0) AS receber,
            COALESCE(sum(c.valor) FILTER (WHERE c.tipo = 'pagar' AND c.status = 'aberta' AND to_char(c.vencimento, 'YYYY-MM') = meses.mes), 0) AS pagar,
            COALESCE(sum(c.valor_pago) FILTER (WHERE c.tipo = 'receber' AND c.status = 'paga' AND to_char(c.pago_em, 'YYYY-MM') = meses.mes), 0) AS recebido,
            COALESCE(sum(c.valor_pago) FILTER (WHERE c.tipo = 'pagar' AND c.status = 'paga' AND to_char(c.pago_em, 'YYYY-MM') = meses.mes), 0) AS pago
       FROM meses LEFT JOIN fin_contas c ON c.status <> 'cancelada'
         AND (to_char(c.vencimento, 'YYYY-MM') = meses.mes OR to_char(c.pago_em, 'YYYY-MM') = meses.mes)
      GROUP BY meses.mes ORDER BY meses.mes`,
    [inicioMes]
  );
  const { rows: proximas } = await db.query<Omit<Conta, 'situacao'>>(
    `${SELECT_CONTA} WHERE c.status = 'aberta' AND c.vencimento BETWEEN $1::date AND $1::date + 7 ORDER BY c.vencimento, c.tipo LIMIT 12`,
    [hoje]
  );
  const { rows: vencidas } = await db.query<Omit<Conta, 'situacao'>>(
    `${SELECT_CONTA} WHERE c.status = 'aberta' AND c.vencimento < $1::date ORDER BY c.vencimento LIMIT 12`,
    [hoje]
  );
  return { ...r[0], fluxo, proximas: comSituacao(proximas, hoje), vencidas: comSituacao(vencidas, hoje) };
}

// ---------------------------------------------------------------------------
// Finanças do evento e plano de pagamento
// ---------------------------------------------------------------------------
export interface FinancasEvento {
  contas: Conta[];
  valor_orcamento: number | null;
  receber_previsto: number;
  recebido: number;
  receber_aberto: number;
  pagar_previsto: number;
  pago: number;
  /** Custo dos itens de estoque baixados para o evento (consumo e degustação, pelo custo médio da saída) */
  cmv_estoque: number;
  /** Plano já cadastrado (parcelas de origem 'plano', exceto canceladas) */
  tem_plano: boolean;
  recebido_plano: number;
}

export async function financasDoEvento(db: Db, eventoId: string): Promise<FinancasEvento> {
  const { rows } = await db.query<Omit<Conta, 'situacao'>>(
    `${SELECT_CONTA} WHERE c.evento_id = $1 ORDER BY c.tipo DESC, c.vencimento, c.parcela NULLS FIRST`,
    [eventoId]
  );
  const contas = comSituacao(rows);
  const soma = (lista: Conta[], f: (c: Conta) => number) => centavos(lista.reduce((s, c) => s + f(c), 0));
  const receber = contas.filter((c) => c.tipo === 'receber' && c.status !== 'cancelada');
  const pagar = contas.filter((c) => c.tipo === 'pagar' && c.status !== 'cancelada');
  const plano = receber.filter((c) => c.origem === 'plano');
  const { rows: o } = await db.query<{ valor_total: number | null }>('SELECT valor_total FROM orcamentos WHERE evento_id = $1', [eventoId]);
  const { rows: cmv } = await db.query<{ total: number }>(
    `SELECT COALESCE(round(sum(-quantidade * COALESCE(custo_unitario, 0)), 2), 0) AS total
       FROM estoque_movimentos WHERE evento_id = $1 AND razao IN ('consumo_evento', 'degustacao')`,
    [eventoId]
  );
  return {
    contas,
    valor_orcamento: o[0]?.valor_total ?? null,
    receber_previsto: soma(receber, (c) => (c.status === 'paga' ? Number(c.valor_pago) : Number(c.valor))),
    recebido: soma(receber.filter((c) => c.status === 'paga'), (c) => Number(c.valor_pago)),
    receber_aberto: soma(receber.filter((c) => c.status === 'aberta'), (c) => Number(c.valor)),
    pagar_previsto: soma(pagar, (c) => (c.status === 'paga' ? Number(c.valor_pago) : Number(c.valor))),
    pago: soma(pagar.filter((c) => c.status === 'paga'), (c) => Number(c.valor_pago)),
    cmv_estoque: Number(cmv[0].total),
    tem_plano: plano.length > 0,
    recebido_plano: soma(plano.filter((c) => c.status === 'paga'), (c) => Number(c.valor_pago)),
  };
}

export const planoSchema = z.object({
  valor_total: valorObrigatorio('Informe o valor total.'),
  entrada_valor: optionalMoney(),
  entrada_vencimento: optionalDate(),
  parcelas: optionalInt(),
  primeiro_vencimento: optionalDate(),
  intervalo_meses: optionalInt(),
  forma_pagamento: forma,
  categoria_id: optionalUuid(),
});
export type PlanoInput = z.infer<typeof planoSchema>;

/**
 * Cadastra (ou refaz) o plano de pagamento do evento: as parcelas em aberto do plano anterior são substituídas;
 * as já recebidas ficam. Cada parcela vira uma conta a receber do cliente do evento.
 */
export async function salvarPlano(db: Db, user: SessionUser, eventoId: string, input: PlanoInput): Promise<number> {
  const { rows: ev } = await db.query<{ titulo: string | null; cliente_id: string | null; cliente_nome: string | null }>(
    'SELECT e.titulo, e.cliente_id, c.nome AS cliente_nome FROM eventos e LEFT JOIN clientes c ON c.id = e.cliente_id WHERE e.id = $1',
    [eventoId]
  );
  if (!ev[0]) throw new UserError('Evento não encontrado.');
  let parcelas;
  try {
    parcelas = gerarParcelas({
      valor_total: input.valor_total,
      entrada_valor: input.entrada_valor,
      entrada_vencimento: input.entrada_vencimento,
      parcelas: input.parcelas ?? 0,
      primeiro_vencimento: input.primeiro_vencimento,
      intervalo_meses: input.intervalo_meses ?? 1,
    });
  } catch (err) {
    throw new UserError((err as Error).message);
  }
  let categoriaId = input.categoria_id;
  if (categoriaId) await validarReferencias(db, 'receber', categoriaId, null);
  else {
    const { rows } = await db.query<{ id: string }>(
      `SELECT id FROM fin_categorias WHERE tipo = 'receber' AND ativo ORDER BY (lower(nome) = 'venda de evento') DESC, ordem LIMIT 1`
    );
    categoriaId = rows[0]?.id ?? null;
  }
  await db.query(`DELETE FROM fin_contas WHERE evento_id = $1 AND origem = 'plano' AND status = 'aberta'`, [eventoId]);
  const titulo = ev[0].titulo ?? ev[0].cliente_nome ?? 'Evento';
  for (const p of parcelas) {
    await db.query(
      `INSERT INTO fin_contas (tenant_id, tipo, descricao, categoria_id, evento_id, cliente_id, valor, vencimento, forma_pagamento,
                               origem, parcela, parcelas, usuario_id)
       VALUES ($1, 'receber', $2, $3, $4, $5, $6, $7, $8, 'plano', $9, $10, $11)`,
      [user.tenantId, `${titulo} – ${rotuloParcela(p.parcela, p.parcelas)}`.slice(0, 255), categoriaId, eventoId, ev[0].cliente_id,
        p.valor, p.vencimento, input.forma_pagamento, p.parcela, p.parcelas, user.id]
    );
  }
  await registrarTimeline(
    db,
    { tenantId: user.tenantId, eventoId, usuarioId: user.id },
    'financeiro',
    `Plano de pagamento cadastrado: ${formatMoney(input.valor_total)} — ${descreverPlano(parcelas, input.forma_pagamento)}`,
    { parcelas: parcelas.length, valor_total: input.valor_total }
  );
  return parcelas.length;
}

function descreverPlano(parcelas: { parcela: number | null; parcelas: number | null; valor: number; vencimento: string }[], f: FormaPagamento | null): string {
  const partes = parcelas.map((p) => `${rotuloParcela(p.parcela, p.parcelas).toLowerCase()} de ${formatMoney(Number(p.valor))} em ${dataCurta(p.vencimento)}`);
  return `${partes.join('; ')}${f ? ` (${FORMAS_PAGAMENTO[f]})` : ''}`;
}

/** Texto do plano de pagamento do evento (variável {plano_pagamento} dos documentos). */
export async function textoPlanoPagamento(db: Db, eventoId: string): Promise<string> {
  const { rows } = await db.query<{ parcela: number | null; parcelas: number | null; valor: number; vencimento: string; forma_pagamento: FormaPagamento | null }>(
    `SELECT parcela, parcelas, valor, to_char(vencimento, 'YYYY-MM-DD') AS vencimento, forma_pagamento
       FROM fin_contas WHERE evento_id = $1 AND origem = 'plano' AND status <> 'cancelada'
      ORDER BY parcela, vencimento`,
    [eventoId]
  );
  if (!rows.length) return '';
  const formas = [...new Set(rows.map((r) => r.forma_pagamento).filter(Boolean))] as FormaPagamento[];
  return descreverPlano(rows, formas.length === 1 ? formas[0] : null);
}

/** Eventos para os selects do financeiro (exceto perdidos; do último ano em diante). */
export async function eventosParaFinanceiro(db: Db): Promise<{ id: string; rotulo: string }[]> {
  const { rows } = await db.query<{ id: string; titulo: string | null; cliente_nome: string | null; data_evento: string | null }>(
    `SELECT e.id, e.titulo, c.nome AS cliente_nome, to_char(e.data_evento, 'DD/MM/YYYY') AS data_evento
       FROM eventos e JOIN status_orcamento s ON s.id = e.status_id LEFT JOIN clientes c ON c.id = e.cliente_id
      WHERE s.variante <> 'recusado' AND (e.data_evento IS NULL OR e.data_evento >= current_date - 365)
      ORDER BY e.data_evento NULLS LAST, lower(e.titulo) LIMIT 500`
  );
  return rows.map((e) => ({ id: e.id, rotulo: [e.titulo ?? 'Evento', e.cliente_nome, e.data_evento].filter(Boolean).join(' · ') }));
}

// ---------------------------------------------------------------------------
// Movimentações de estoque com registro financeiro
// ---------------------------------------------------------------------------
export const financeiroMovimentoSchema = z
  .object({
    fin_lancar: checkbox(),
    fin_valor: optionalMoney(),
    fin_vencimento: optionalDate(),
    fin_forma: forma,
    fin_categoria_id: optionalUuid(),
    fin_pago: checkbox(),
  })
  .superRefine((d, ctx) => {
    if (!d.fin_lancar) return;
    if (!d.fin_valor || d.fin_valor <= 0) ctx.addIssue({ code: 'custom', path: ['fin_valor'], message: 'Informe o valor da conta.' });
    if (!d.fin_vencimento) ctx.addIssue({ code: 'custom', path: ['fin_vencimento'], message: d.fin_pago ? 'Informe a data do pagamento.' : 'Informe o vencimento.' });
  });
export type FinanceiroMovimento = z.infer<typeof financeiroMovimentoSchema>;

export async function contaDoMovimento(
  db: Db,
  user: SessionUser,
  movimentoId: string,
  fin: FinanceiroMovimento
): Promise<{ tipo: TipoConta } | null> {
  if (!fin.fin_lancar) return null;
  const { rows } = await db.query<{ razao: string; quantidade: number; item: string; unidade: string; fornecedor: string | null; documento: string | null; evento_id: string | null }>(
    `SELECT m.razao, m.quantidade, i.nome AS item, i.unidade, m.fornecedor, m.documento, m.evento_id
       FROM estoque_movimentos m JOIN estoque_itens i ON i.id = m.estoque_item_id
      WHERE m.id = $1`,
    [movimentoId]
  );
  const m = rows[0];
  if (!m) throw new UserError('Movimentação não encontrada.');
  const tipo = TIPO_CONTA_DO_MOTIVO[m.razao];
  if (!tipo) throw new UserError('Este motivo de movimentação não gera conta financeira.', 'fin_lancar');
  if (fin.fin_categoria_id) await validarReferencias(db, tipo, fin.fin_categoria_id, null);
  const qtd = String(Math.abs(Number(m.quantidade))).replace('.', ',');
  const descricao = `${tipo === 'pagar' ? 'Compra' : 'Devolução ao fornecedor'}: ${m.item} (${qtd} ${m.unidade})${m.documento ? ` · NF ${m.documento}` : ''}`;
  const pago = fin.fin_pago;
  await db.query(
    `INSERT INTO fin_contas (tenant_id, tipo, descricao, categoria_id, evento_id, cliente_id, fornecedor, valor, vencimento, forma_pagamento,
                             documento, origem, estoque_movimento_id, usuario_id, status, pago_em, valor_pago, baixa_usuario_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'estoque', $12, $13, $14, $15, $16, $17)`,
    [user.tenantId, tipo, descricao.slice(0, 255), fin.fin_categoria_id, m.evento_id, null, m.fornecedor,
      centavos(fin.fin_valor!), fin.fin_vencimento, fin.fin_forma, m.documento, movimentoId, user.id, pago ? 'paga' : 'aberta',
      pago ? fin.fin_vencimento : null, pago ? centavos(fin.fin_valor!) : null, pago ? user.id : null]
  );
  return { tipo };
}

// ---------------------------------------------------------------------------
// Ações dos formulários (menu Financeiro e aba Finanças do evento)
// ---------------------------------------------------------------------------
/** Trata os POSTs das telas de contas: salvar, excluir, baixar, reabrir e cancelar. Devolve a mensagem de sucesso. */
export async function acaoConta(db: Db, user: SessionUser, data: Record<string, unknown>): Promise<string> {
  const id = optionalUuid().parse(data.id ?? null);
  const contaId = optionalUuid().parse(data.conta_id ?? null);
  switch (data._action) {
    case 'delete':
      if (!id) throw new UserError('Conta não encontrada.');
      await excluirConta(db, id);
      return 'Conta excluída.';
    case 'baixar': {
      if (!contaId) throw new UserError('Conta não encontrada.');
      const c = await baixarConta(db, user, contaId, baixaSchema.parse(data));
      return c.tipo === 'receber' ? 'Recebimento registrado.' : 'Pagamento registrado.';
    }
    case 'reabrir':
      if (!contaId) throw new UserError('Conta não encontrada.');
      await reabrirConta(db, user, contaId);
      return 'Conta reaberta.';
    case 'cancelar':
      if (!contaId) throw new UserError('Conta não encontrada.');
      await cancelarConta(db, user, contaId);
      return 'Conta cancelada.';
    default: {
      const input = contaSchema.parse(data);
      await salvarConta(db, user, id, input);
      return id ? 'Conta atualizada.' : input.tipo === 'receber' ? 'Conta a receber cadastrada.' : 'Conta a pagar cadastrada.';
    }
  }
}

// ---------------------------------------------------------------------------
// Filtros da URL e exportação CSV
// ---------------------------------------------------------------------------
export function filtrosContasDaUrl(url: URL, tipo: TipoConta, busca: string | null): FiltrosContas {
  const p = url.searchParams;
  const uuid = (v: string | null) => (v && /^[0-9a-f-]{36}$/i.test(v) ? v : null);
  const situacao = p.get('situacao');
  const periodo = p.get('periodo');
  return {
    tipo,
    situacao: situacao && situacao in FILTROS_SITUACAO ? (situacao as FiltroSituacao) : 'pendentes',
    periodo: periodo && periodo in PERIODOS ? (periodo as Periodo) : null,
    categoriaId: uuid(p.get('categoria')),
    eventoId: uuid(p.get('evento')),
    busca,
  };
}

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  // Evita injeção de fórmula ao abrir no Excel/Sheets
  const seguro = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[";\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

const decimal = (v: number | null) => (v === null ? '' : Number(v).toFixed(2).replace('.', ','));

export async function exportarContasCsv(db: Db, f: FiltrosContas): Promise<string> {
  const contas = await contasParaExportar(db, f);
  const cabecalho = ['Descrição', 'Categoria', 'Evento', 'Cliente / pagador', 'Fornecedor', 'Parcela', 'Vencimento', 'Valor', 'Situação',
    'Pago em', 'Valor pago', 'Forma de pagamento', 'Documento', 'Origem', 'Observações'];
  const linhas = contas.map((c) =>
    [c.descricao, c.categoria_nome, c.evento_titulo, c.cliente_nome, c.fornecedor, rotuloParcela(c.parcela, c.parcelas), dataCurta(c.vencimento),
      decimal(c.valor), rotuloSituacao(c.tipo, c.situacao), c.pago_em ? dataCurta(c.pago_em) : '', decimal(c.valor_pago),
      c.forma_pagamento ? FORMAS_PAGAMENTO[c.forma_pagamento] : '', c.documento, { manual: 'Manual', plano: 'Plano de pagamento', estoque: 'Estoque' }[c.origem],
      c.observacoes].map(csvCell).join(';')
  );
  // BOM para o Excel reconhecer UTF-8
  return '﻿' + [cabecalho.join(';'), ...linhas].join('\r\n');
}
