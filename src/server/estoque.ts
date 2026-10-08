// Estoque: itens (consumíveis e não consumíveis), saldo, mínimo, custo e movimentações (entrada, saída, ajuste).
// Itens do cardápio "gerenciados no estoque" ficam ligados a um item de estoque (catalogo_item_id).
import { z } from 'zod';
import type { Db } from '../lib/db';
import type { SessionUser } from '../lib/auth';
import { parseMoney } from '../lib/money';
import { UserError, optionalDate, optionalMoney, optionalText, optionalUuid, requiredText } from '../lib/forms';
import type { PageParams } from '../lib/pagination';
import { orderBy, type Ordenacao } from '../lib/ordenacao';
import { UNIDADES_PORCAO, type UnidadePorcao } from '../lib/calculo/orcamento';
import type { EstoqueRef } from '../lib/calculo/estoque';
import { RAZOES, TIPOS_MOVIMENTO, ehRazao, type CodigoRazao, type TipoMovimento } from '../lib/estoqueRazoes';
import { isAdmin } from '../lib/auth';
import { formatarQuantidade } from '../lib/calculo/orcamento';
import { contaDoMovimento, financeiroMovimentoSchema } from './financeiro';

export { RAZOES, TIPOS_MOVIMENTO, type TipoMovimento };

export const TIPOS_ESTOQUE = { consumivel: 'Consumível', nao_consumivel: 'Não consumível' } as const;
export type TipoEstoque = keyof typeof TIPOS_ESTOQUE;

export const UNIDADES_ESTOQUE: Record<UnidadePorcao, string> = {
  un: 'unidades (un)',
  kg: 'quilos (kg)',
  g: 'gramas (g)',
  l: 'litros (l)',
  ml: 'mililitros (ml)',
};

const unidade = z.enum(Object.keys(UNIDADES_PORCAO) as [UnidadePorcao, ...UnidadePorcao[]], { error: 'Unidade inválida.' });

/** Quantidade decimal no formato brasileiro ("1,5") ou internacional; vazio vira null. */
const quantidade = (mensagem = 'Quantidade inválida.') =>
  z.preprocess((v) => parseMoney(v), z.number({ error: mensagem }).min(0, 'A quantidade não pode ser negativa.').max(1e9).nullable());

export const estoqueItemSchema = z.object({
  nome: requiredText('Informe o nome do item.', 200),
  tipo: z.enum(['consumivel', 'nao_consumivel']).default('consumivel'),
  categoria: optionalText(80),
  unidade: unidade.default('un'),
  quantidade_inicial: quantidade(),
  estoque_minimo: quantidade('Estoque mínimo inválido.'),
  custo_unitario: optionalMoney(),
  local: optionalText(120),
  validade: optionalDate(),
  observacoes: optionalText(2000),
  ativo: z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean()),
});
export type EstoqueItemInput = z.infer<typeof estoqueItemSchema>;

export const movimentoSchema = z.preprocess(
  // Contagem física tem um motivo só
  (v) => (v && typeof v === 'object' && (v as Record<string, unknown>).tipo === 'ajuste' ? { ...(v as object), razao: 'contagem' } : v),
  z.object({
    estoque_item_id: z.uuid('Selecione o item.'),
    tipo: z.enum(['entrada', 'saida', 'ajuste'], { error: 'Escolha o tipo da movimentação.' }),
    razao: z.preprocess((v) => (v === '' ? undefined : v), z.string({ error: 'Escolha o motivo.' }).refine(ehRazao, 'Motivo inválido.')),
    quantidade: quantidade(),
    custo_unitario: optionalMoney(),
    fornecedor: optionalText(200),
    documento: optionalText(60),
    evento_id: optionalUuid(),
    espaco_id: optionalUuid(),
    observacao: optionalText(500),
  }).superRefine((d, ctx) => {
    const exigir = (campo: string, mensagem: string) => ctx.addIssue({ code: 'custom', path: [campo], message: mensagem });
    if (d.quantidade === null) exigir('quantidade', 'Informe a quantidade.');
    if (!ehRazao(d.razao)) return;
    const r = RAZOES[d.razao];
    if (r.tipo !== d.tipo) return exigir('razao', 'O motivo não corresponde ao tipo da movimentação.');
    if (r.fornecedor === 'obrigatorio' && !d.fornecedor) exigir('fornecedor', 'Informe o fornecedor.');
    if (r.documento === 'obrigatorio' && !d.documento) exigir('documento', 'Informe a nota fiscal ou documento.');
    if (r.evento === 'obrigatorio' && !d.evento_id) exigir('evento_id', 'Escolha o evento.');
    if (r.espaco === 'obrigatorio' && !d.espaco_id) exigir('espaco_id', 'Escolha o espaço.');
    if (r.justificativa === 'obrigatorio' && !d.observacao) exigir('observacao', 'Descreva a justificativa.');
  })
);
export type MovimentoInput = z.infer<typeof movimentoSchema>;

export interface EstoqueItem {
  id: string;
  nome: string;
  tipo: TipoEstoque;
  categoria: string | null;
  unidade: UnidadePorcao;
  quantidade: number;
  estoque_minimo: number | null;
  custo_unitario: number | null;
  local: string | null;
  validade: string | null;
  dias_para_vencer: number | null;
  observacoes: string | null;
  catalogo_item_id: string | null;
  catalogo_item_nome: string | null;
  ativo: boolean;
  abaixo_minimo: boolean;
  ultima_movimentacao: Date | null;
}

const SELECT_ITEM = `
  SELECT e.id, e.nome, e.tipo, e.categoria, e.unidade, e.quantidade, e.estoque_minimo, e.custo_unitario, e.local, e.observacoes,
         to_char(e.validade, 'YYYY-MM-DD') AS validade, (e.validade - current_date) AS dias_para_vencer,
         e.catalogo_item_id, ci.nome AS catalogo_item_nome, e.ativo,
         (e.estoque_minimo IS NOT NULL AND e.quantidade < e.estoque_minimo) AS abaixo_minimo,
         (SELECT max(m.created_at) FROM estoque_movimentos m WHERE m.estoque_item_id = e.id) AS ultima_movimentacao
    FROM estoque_itens e
    LEFT JOIN catalogo_itens ci ON ci.id = e.catalogo_item_id`;

const ORDEM: Record<string, string> = { nome: 'lower(e.nome)', categoria: 'lower(e.categoria)', quantidade: 'e.quantidade' };

export interface FiltrosEstoque {
  busca: string | null;
  tipo: TipoEstoque | null;
  situacao: 'abaixo' | 'zerado' | 'inativos' | 'vencendo' | null;
  categoria: string | null;
}

export async function listarEstoque(db: Db, f: FiltrosEstoque, page: PageParams, ord?: Ordenacao): Promise<{ rows: EstoqueItem[]; total: number }> {
  const params = [f.busca, f.tipo, f.situacao, f.categoria];
  const where = `WHERE ($1::text IS NULL OR e.nome ILIKE $1 OR e.categoria ILIKE $1 OR e.local ILIKE $1)
                   AND ($2::text IS NULL OR e.tipo = $2)
                   AND ($4::text IS NULL OR lower(e.categoria) = lower($4))
                   AND CASE $3::text
                         WHEN 'abaixo' THEN e.ativo AND e.estoque_minimo IS NOT NULL AND e.quantidade < e.estoque_minimo
                         WHEN 'zerado' THEN e.ativo AND e.quantidade <= 0
                         WHEN 'inativos' THEN NOT e.ativo
                         WHEN 'vencendo' THEN e.ativo AND e.validade IS NOT NULL AND e.validade <= current_date + 15
                         ELSE e.ativo END`;
  const { rows } = await db.query<EstoqueItem>(
    `${SELECT_ITEM} ${where} ORDER BY ${orderBy(ord, ORDEM, 'lower(e.nome)')} LIMIT $5 OFFSET $6`,
    [...params, page.pageSize, page.offset]
  );
  const { rows: c } = await db.query<{ total: number }>(`SELECT count(*) AS total FROM estoque_itens e ${where}`, params);
  return { rows, total: c[0].total };
}

export interface ResumoEstoque {
  itens: number;
  abaixo_minimo: number;
  zerados: number;
  valor_total: number;
}

export async function resumoEstoque(db: Db): Promise<ResumoEstoque> {
  const { rows } = await db.query<ResumoEstoque>(
    `SELECT count(*) AS itens,
            count(*) FILTER (WHERE estoque_minimo IS NOT NULL AND quantidade < estoque_minimo) AS abaixo_minimo,
            count(*) FILTER (WHERE quantidade <= 0) AS zerados,
            COALESCE(round(sum(GREATEST(quantidade, 0) * COALESCE(custo_unitario, 0)), 2), 0) AS valor_total
       FROM estoque_itens WHERE ativo`
  );
  return rows[0];
}

export async function categoriasEstoque(db: Db): Promise<string[]> {
  const { rows } = await db.query<{ categoria: string }>(
    `SELECT DISTINCT ON (lower(categoria)) categoria FROM estoque_itens WHERE categoria IS NOT NULL ORDER BY lower(categoria)`
  );
  return rows.map((r) => r.categoria);
}

export async function carregarEstoqueItem(db: Db, id: string): Promise<EstoqueItem> {
  const { rows } = await db.query<EstoqueItem>(`${SELECT_ITEM} WHERE e.id = $1`, [id]);
  if (!rows[0]) throw new UserError('Item de estoque não encontrado.');
  return rows[0];
}

/** Itens ativos para selects (movimentação) */
export async function itensParaSelecao(db: Db): Promise<{ id: string; nome: string; unidade: UnidadePorcao; quantidade: number }[]> {
  const { rows } = await db.query<{ id: string; nome: string; unidade: UnidadePorcao; quantidade: number }>(
    'SELECT id, nome, unidade, quantidade FROM estoque_itens WHERE ativo ORDER BY lower(nome)'
  );
  return rows;
}

/** Saldos para a lista de compras (itens ativos). */
export async function estoqueParaLista(db: Db): Promise<EstoqueRef[]> {
  const { rows } = await db.query<EstoqueRef>(
    'SELECT id, nome, catalogo_item_id, unidade, quantidade FROM estoque_itens WHERE ativo'
  );
  return rows;
}

// ---------------------------------------------------------------------------
// Escrita
// ---------------------------------------------------------------------------
interface DadosMovimento {
  tipo: TipoMovimento;
  razao: CodigoRazao;
  delta: number;
  saldo: number;
  custo: number | null;
  fornecedor?: string | null;
  documento?: string | null;
  eventoId?: string | null;
  espacoId?: string | null;
  observacao?: string | null;
}

async function registrarMovimento(db: Db, user: SessionUser, itemId: string, d: DadosMovimento): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO estoque_movimentos (tenant_id, estoque_item_id, tipo, razao, quantidade, saldo_apos, custo_unitario, fornecedor, documento,
                                     evento_id, espaco_id, observacao, usuario_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
    [user.tenantId, itemId, d.tipo, d.razao, d.delta, d.saldo, d.custo, d.fornecedor ?? null, d.documento ?? null, d.eventoId ?? null,
     d.espacoId ?? null, d.observacao ?? null, user.id]
  );
  return rows[0].id;
}

/** Cria ou edita o item. O saldo só muda por movimentação; na criação, a quantidade inicial vira uma entrada. */
export async function salvarEstoqueItem(db: Db, user: SessionUser, id: string | null, input: EstoqueItemInput): Promise<string> {
  const valores = [input.nome, input.tipo, input.categoria ?? null, input.unidade, input.estoque_minimo, input.custo_unitario, input.local ?? null, input.observacoes ?? null, input.ativo, input.validade];
  if (id) {
    const atual = await carregarEstoqueItem(db, id);
    if (atual.unidade !== input.unidade && Number(atual.quantidade) !== 0) {
      throw new UserError('Zere o saldo (ajuste para 0) antes de trocar a unidade do item, ou mantenha a unidade atual.', 'unidade');
    }
    await db.query(
      `UPDATE estoque_itens SET nome = $1, tipo = $2, categoria = $3, unidade = $4, estoque_minimo = $5, custo_unitario = $6,
              local = $7, observacoes = $8, ativo = $9, validade = $10, updated_at = now()
        WHERE id = $11`,
      [...valores, id]
    );
    return id;
  }
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO estoque_itens (nome, tipo, categoria, unidade, estoque_minimo, custo_unitario, local, observacoes, ativo, validade, tenant_id, quantidade)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
    [...valores, user.tenantId, input.quantidade_inicial ?? 0]
  );
  if (input.quantidade_inicial) {
    await registrarMovimento(db, user, rows[0].id, {
      tipo: 'ajuste', razao: 'contagem', delta: input.quantidade_inicial, saldo: input.quantidade_inicial, custo: input.custo_unitario, observacao: 'Saldo inicial',
    });
  }
  return rows[0].id;
}

/** Exclui o item e o histórico. Item ligado ao cardápio deixa de ser gerenciado (o item do cardápio continua). */
export async function excluirEstoqueItem(db: Db, id: string) {
  const res = await db.query('DELETE FROM estoque_itens WHERE id = $1', [id]);
  if (!res.rowCount) throw new UserError('Item de estoque não encontrado.');
}

/**
 * Movimenta o saldo com o item travado (FOR UPDATE): entrada soma, saída subtrai (sem deixar negativo), contagem
 * define o saldo. Compra e produção com custo recalculam o custo médio ponderado; bonificação entra sem mexer no custo;
 * saídas gravam o custo médio do momento (CMV). Evento e espaço vindos do formulário são conferidos no tenant.
 */
export async function movimentar(
  db: Db,
  user: SessionUser,
  input: MovimentoInput
): Promise<{ id: string; nome: string; saldo: number; unidade: UnidadePorcao }> {
  const { rows } = await db.query<{ nome: string; quantidade: number; unidade: UnidadePorcao; custo_unitario: number | null }>(
    'SELECT nome, quantidade, unidade, custo_unitario FROM estoque_itens WHERE id = $1 FOR UPDATE',
    [input.estoque_item_id]
  );
  const item = rows[0];
  if (!item) throw new UserError('Item de estoque não encontrado.', 'estoque_item_id');
  const razao = input.razao as CodigoRazao;
  const regra = RAZOES[razao];
  // Campos que o motivo não usa são descartados
  const eventoId = regra.evento ? (input.evento_id ?? null) : null;
  const espacoId = regra.espaco ? (input.espaco_id ?? null) : null;
  if (eventoId && !(await db.query('SELECT 1 FROM eventos WHERE id = $1', [eventoId])).rowCount) throw new UserError('Evento não encontrado.', 'evento_id');
  if (espacoId && !(await db.query('SELECT 1 FROM espacos WHERE id = $1', [espacoId])).rowCount) throw new UserError('Espaço não encontrado.', 'espaco_id');

  const qtd = input.quantidade!;
  const atual = Number(item.quantidade);
  const custoAtual = item.custo_unitario === null ? null : Number(item.custo_unitario);
  let saldo: number;
  let custoItem = custoAtual;
  let custoMov: number | null = custoAtual;
  if (input.tipo === 'entrada') {
    if (qtd <= 0) throw new UserError('Informe uma quantidade maior que zero.', 'quantidade');
    saldo = atual + qtd;
    if (regra.custo && input.custo_unitario !== null) {
      custoMov = input.custo_unitario;
      // Custo médio ponderado (saldo negativo ou sem custo anterior: assume o custo da entrada)
      custoItem = custoAtual === null || atual <= 0 ? input.custo_unitario : Math.round(((atual * custoAtual + qtd * input.custo_unitario) / (atual + qtd)) * 100) / 100;
    } else if (razao === 'bonificacao') {
      custoMov = 0;
    }
  } else if (input.tipo === 'saida') {
    if (qtd <= 0) throw new UserError('Informe uma quantidade maior que zero.', 'quantidade');
    if (qtd > atual) {
      throw new UserError(`Saída maior que o saldo (${String(atual).replace('.', ',')} ${item.unidade}). Se a contagem física for outra, registre uma contagem.`, 'quantidade');
    }
    saldo = atual - qtd;
  } else {
    saldo = qtd;
  }
  saldo = Math.round(saldo * 1000) / 1000;
  const delta = Math.round((saldo - atual) * 1000) / 1000;
  if (input.tipo === 'ajuste' && delta === 0) throw new UserError('A quantidade contada é igual ao saldo atual: nada a ajustar.', 'quantidade');
  await db.query('UPDATE estoque_itens SET quantidade = $2, custo_unitario = $3, updated_at = now() WHERE id = $1', [input.estoque_item_id, saldo, custoItem]);
  const id = await registrarMovimento(db, user, input.estoque_item_id, {
    tipo: input.tipo, razao, delta, saldo, custo: custoMov,
    fornecedor: regra.fornecedor ? (input.fornecedor ?? null) : null,
    documento: regra.documento ? (input.documento ?? null) : null,
    eventoId, espacoId, observacao: input.observacao ?? null,
  });
  return { id, nome: item.nome, saldo, unidade: item.unidade };
}

/**
 * Movimentação vinda do formulário (drawer): registra no estoque e, se pedido (owner/admin), lança a conta a pagar
 * ou a receber ligada à movimentação. Devolve a mensagem para o usuário.
 */
export async function movimentarDoFormulario(db: Db, user: SessionUser, data: Record<string, unknown>): Promise<string> {
  const input = movimentoSchema.parse(data);
  const fin = isAdmin(user) ? financeiroMovimentoSchema.parse(data) : null;
  const r = await movimentar(db, user, input);
  const conta = fin ? await contaDoMovimento(db, user, r.id, fin) : null;
  const saldo = `Saldo de ${r.nome}: ${formatarQuantidade(r.saldo, r.unidade)}.`;
  return conta ? `Movimentação registrada e conta ${conta.tipo === 'pagar' ? 'a pagar' : 'a receber'} lançada. ${saldo}` : `Movimentação registrada. ${saldo}`;
}

export interface Movimento {
  id: string;
  estoque_item_id: string;
  item_nome: string;
  unidade: UnidadePorcao;
  tipo: TipoMovimento;
  razao: CodigoRazao;
  quantidade: number;
  saldo_apos: number;
  custo_unitario: number | null;
  fornecedor: string | null;
  documento: string | null;
  observacao: string | null;
  evento_id: string | null;
  evento_titulo: string | null;
  espaco_nome: string | null;
  usuario_nome: string | null;
  /** Gerou conta a pagar/receber no financeiro */
  financeiro: boolean;
  created_at: Date;
}

export async function listarMovimentos(
  db: Db,
  f: { itemId: string | null; tipo: TipoMovimento | null; razao: CodigoRazao | null; busca: string | null },
  page: PageParams
): Promise<{ rows: Movimento[]; total: number }> {
  const params = [f.itemId, f.tipo, f.busca, f.razao];
  const where = `WHERE ($1::uuid IS NULL OR m.estoque_item_id = $1) AND ($2::text IS NULL OR m.tipo = $2)
                   AND ($4::text IS NULL OR m.razao = $4)
                   AND ($3::text IS NULL OR e.nome ILIKE $3 OR m.observacao ILIKE $3 OR m.fornecedor ILIKE $3 OR m.documento ILIKE $3)`;
  const { rows } = await db.query<Movimento>(
    `SELECT m.id, m.estoque_item_id, e.nome AS item_nome, e.unidade, m.tipo, m.razao, m.quantidade, m.saldo_apos, m.custo_unitario,
            m.fornecedor, m.documento, m.observacao, m.evento_id, ev.titulo AS evento_titulo, es.nome AS espaco_nome,
            u.nome AS usuario_nome, EXISTS (SELECT 1 FROM fin_contas f WHERE f.estoque_movimento_id = m.id) AS financeiro, m.created_at
       FROM estoque_movimentos m
       JOIN estoque_itens e ON e.id = m.estoque_item_id
       LEFT JOIN eventos ev ON ev.id = m.evento_id
       LEFT JOIN espacos es ON es.id = m.espaco_id
       LEFT JOIN usuarios u ON u.id = m.usuario_id
      ${where}
      ORDER BY m.created_at DESC LIMIT $5 OFFSET $6`,
    [...params, page.pageSize, page.offset]
  );
  const { rows: c } = await db.query<{ total: number }>(
    `SELECT count(*) AS total FROM estoque_movimentos m JOIN estoque_itens e ON e.id = m.estoque_item_id ${where}`,
    params
  );
  return { rows, total: c[0].total };
}

// ---------------------------------------------------------------------------
// Itens do cardápio gerenciados no estoque
// ---------------------------------------------------------------------------
/** Unidade de estoque sugerida a partir da porção (gramas viram kg, ml viram litros). */
const unidadeDeEstoque = (porcao: UnidadePorcao | null): UnidadePorcao => (porcao === 'g' ? 'kg' : porcao === 'ml' ? 'l' : (porcao ?? 'un'));

/**
 * Liga/desliga o item do cardápio ao estoque. Ligar cria o item de estoque (ou reativa o que já existia, inclusive
 * um item avulso de mesmo nome ainda sem ligação); desligar só desativa: saldo e histórico ficam guardados.
 */
export async function sincronizarItemCardapio(db: Db, tenantId: string, catalogoItemId: string, gerenciado: boolean) {
  const { rows: ligado } = await db.query<{ id: string; ativo: boolean }>(
    'SELECT id, ativo FROM estoque_itens WHERE catalogo_item_id = $1',
    [catalogoItemId]
  );
  if (!gerenciado) {
    if (ligado[0]?.ativo) await db.query('UPDATE estoque_itens SET ativo = false, updated_at = now() WHERE id = $1', [ligado[0].id]);
    return;
  }
  if (ligado[0]) {
    if (!ligado[0].ativo) await db.query('UPDATE estoque_itens SET ativo = true, updated_at = now() WHERE id = $1', [ligado[0].id]);
    return;
  }
  const { rows: item } = await db.query<{ nome: string; porcao_unidade: UnidadePorcao | null; custo_unitario: number | null }>(
    'SELECT nome, porcao_unidade, custo_unitario FROM catalogo_itens WHERE id = $1',
    [catalogoItemId]
  );
  if (!item[0]) throw new UserError('Item do cardápio não encontrado.');
  const { rows: mesmoNome } = await db.query<{ id: string }>(
    'SELECT id FROM estoque_itens WHERE lower(nome) = lower($1) AND catalogo_item_id IS NULL',
    [item[0].nome]
  );
  if (mesmoNome[0]) {
    await db.query('UPDATE estoque_itens SET catalogo_item_id = $2, ativo = true, updated_at = now() WHERE id = $1', [mesmoNome[0].id, catalogoItemId]);
    return;
  }
  // Nome pode colidir com um item de estoque já ligado a outro item do cardápio de mesmo nome (seções diferentes)
  const { rows: colisao } = await db.query('SELECT 1 FROM estoque_itens WHERE lower(nome) = lower($1)', [item[0].nome]);
  const nome = colisao.length ? `${item[0].nome.slice(0, 180)} (cardápio)` : item[0].nome;
  await db.query(
    `INSERT INTO estoque_itens (tenant_id, nome, tipo, categoria, unidade, catalogo_item_id)
     VALUES ($1, $2, 'consumivel', 'Cardápio', $3, $4)`,
    [tenantId, nome, unidadeDeEstoque(item[0].porcao_unidade), catalogoItemId]
  );
}
