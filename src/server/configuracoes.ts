// Cadastros de Configurações: tipos e categorias de evento, categorias de item,
// formatos de serviço, faixas de locação e status do orçamento (colunas do Kanban).
import { z } from 'zod';
import type { Db } from '../lib/db';
import { UserError, optionalInt, optionalMoney, optionalText, requiredText, stringArray } from '../lib/forms';

async function exigirAfetado(res: { rowCount: number | null }, entidade: string) {
  if (!res.rowCount) throw new UserError(`${entidade} não encontrado(a).`);
}

async function contar(db: Db, sql: string, params: unknown[]): Promise<number> {
  const { rows } = await db.query<{ n: number }>(sql, params);
  return rows[0]?.n ?? 0;
}

// ---------------------------------------------------------------------------
// Tipos de evento (natureza: Social, Corporativo…)
// ---------------------------------------------------------------------------
export const tipoEventoSchema = z.object({
  nome: requiredText('Informe o nome do tipo de evento.', 50),
  descricao: optionalText(500),
});

export async function listarTiposEvento(db: Db, busca: string | null) {
  const { rows } = await db.query<{ id: string; nome: string; descricao: string | null; eventos: number }>(
    `SELECT t.id, t.nome, t.descricao, (SELECT count(*) FROM eventos e WHERE e.tipo_evento_id = t.id) AS eventos
       FROM tipos_evento t
      WHERE $1::text IS NULL OR t.nome ILIKE $1 OR t.descricao ILIKE $1
      ORDER BY lower(t.nome)`,
    [busca]
  );
  return rows;
}

export async function salvarTipoEvento(db: Db, tenantId: string, id: string | null, input: z.infer<typeof tipoEventoSchema>) {
  if (id) {
    await exigirAfetado(
      await db.query('UPDATE tipos_evento SET nome = $1, descricao = $2 WHERE id = $3', [input.nome, input.descricao, id]),
      'Tipo de evento'
    );
  } else {
    await db.query('INSERT INTO tipos_evento (tenant_id, nome, descricao) VALUES ($1, $2, $3)', [tenantId, input.nome, input.descricao]);
  }
}

export async function excluirTipoEvento(db: Db, id: string) {
  const n = await contar(db, 'SELECT count(*) AS n FROM eventos WHERE tipo_evento_id = $1', [id]);
  if (n) throw new UserError(`Este tipo está em uso em ${n} evento(s) e não pode ser excluído.`);
  await exigirAfetado(await db.query('DELETE FROM tipos_evento WHERE id = $1', [id]), 'Tipo de evento');
}

// ---------------------------------------------------------------------------
// Categorias de evento (Casamento, Confraternização…) válidas para 1+ tipos
// ---------------------------------------------------------------------------
export const categoriaEventoSchema = z.object({
  nome: requiredText('Informe o nome da categoria.', 80),
  descricao: optionalText(500),
  tipos: stringArray(),
});

export async function listarCategoriasEvento(db: Db, busca: string | null, tipoId: string | null) {
  const { rows } = await db.query<{ id: string; nome: string; descricao: string | null; tipos: string[]; eventos: number }>(
    `SELECT c.id, c.nome, c.descricao,
            COALESCE(array_agg(cet.tipo_evento_id::text) FILTER (WHERE cet.tipo_evento_id IS NOT NULL), '{}') AS tipos,
            (SELECT count(*) FROM eventos e WHERE e.categoria_evento_id = c.id) AS eventos
       FROM categorias_evento c
       LEFT JOIN categoria_evento_tipos cet ON cet.categoria_id = c.id
      WHERE ($1::text IS NULL OR c.nome ILIKE $1)
        AND ($2::uuid IS NULL OR EXISTS (
              SELECT 1 FROM categoria_evento_tipos x WHERE x.categoria_id = c.id AND x.tipo_evento_id = $2))
      GROUP BY c.id
      ORDER BY lower(c.nome)`,
    [busca, tipoId]
  );
  return rows;
}

async function definirTiposDaCategoria(db: Db, tenantId: string, categoriaId: string, tipos: string[]) {
  await db.query('DELETE FROM categoria_evento_tipos WHERE categoria_id = $1', [categoriaId]);
  if (tipos.length) {
    await db.query(
      `INSERT INTO categoria_evento_tipos (tenant_id, categoria_id, tipo_evento_id)
       SELECT $1, $2, t.id FROM tipos_evento t WHERE t.id = ANY($3::uuid[])`,
      [tenantId, categoriaId, tipos]
    );
  }
}

export async function salvarCategoriaEvento(
  db: Db,
  tenantId: string,
  id: string | null,
  input: z.infer<typeof categoriaEventoSchema>
) {
  let categoriaId = id;
  if (id) {
    await exigirAfetado(
      await db.query('UPDATE categorias_evento SET nome = $1, descricao = $2 WHERE id = $3', [input.nome, input.descricao, id]),
      'Categoria'
    );
  } else {
    const { rows } = await db.query<{ id: string }>(
      'INSERT INTO categorias_evento (tenant_id, nome, descricao) VALUES ($1, $2, $3) RETURNING id',
      [tenantId, input.nome, input.descricao]
    );
    categoriaId = rows[0].id;
  }
  await definirTiposDaCategoria(db, tenantId, categoriaId!, input.tipos);
}

/** Liga/desliga um tipo de evento para a categoria (toggles da listagem). */
export async function alternarTipoDaCategoria(db: Db, tenantId: string, categoriaId: string, tipoId: string, ativo: boolean) {
  if (ativo) {
    await db.query(
      `INSERT INTO categoria_evento_tipos (tenant_id, categoria_id, tipo_evento_id)
       SELECT $1, c.id, t.id FROM categorias_evento c, tipos_evento t WHERE c.id = $2 AND t.id = $3
       ON CONFLICT DO NOTHING`,
      [tenantId, categoriaId, tipoId]
    );
  } else {
    await db.query('DELETE FROM categoria_evento_tipos WHERE categoria_id = $1 AND tipo_evento_id = $2', [categoriaId, tipoId]);
  }
}

export async function excluirCategoriaEvento(db: Db, id: string) {
  const n = await contar(db, 'SELECT count(*) AS n FROM eventos WHERE categoria_evento_id = $1', [id]);
  if (n) throw new UserError(`Esta categoria está em uso em ${n} evento(s) e não pode ser excluída.`);
  await exigirAfetado(await db.query('DELETE FROM categorias_evento WHERE id = $1', [id]), 'Categoria');
}

// ---------------------------------------------------------------------------
// Categorias de item do cardápio (principal = tipo; secundária = momento do serviço)
// ---------------------------------------------------------------------------
export const TIPOS_CATEGORIA_ITEM = { principal: 'Principal (tipo)', secundaria: 'Secundária (momento)' } as const;

export const categoriaItemSchema = z.object({
  nome: requiredText('Informe o nome da categoria.', 80),
  tipo: z.enum(['principal', 'secundaria'], { error: 'Selecione se a categoria é principal ou secundária.' }),
});

export async function listarCategoriasItem(db: Db, busca: string | null, tipo: string | null) {
  const { rows } = await db.query<{ id: string; nome: string; tipo: 'principal' | 'secundaria'; ordem: number }>(
    `SELECT id, nome, tipo, ordem FROM categorias_item
      WHERE ($1::text IS NULL OR nome ILIKE $1) AND ($2::text IS NULL OR tipo = $2)
      ORDER BY tipo, ordem, lower(nome)`,
    [busca, tipo]
  );
  return rows;
}

export async function salvarCategoriaItem(db: Db, tenantId: string, id: string | null, input: z.infer<typeof categoriaItemSchema>) {
  if (id) {
    await exigirAfetado(
      await db.query('UPDATE categorias_item SET nome = $1, tipo = $2 WHERE id = $3', [input.nome, input.tipo, id]),
      'Categoria'
    );
  } else {
    await db.query(
      `INSERT INTO categorias_item (tenant_id, nome, tipo, ordem)
       VALUES ($1, $2, $3::varchar, COALESCE((SELECT max(ordem) + 1 FROM categorias_item WHERE tipo = $3::varchar), 1))`,
      [tenantId, input.nome, input.tipo]
    );
  }
}

export async function excluirCategoriaItem(db: Db, id: string) {
  await exigirAfetado(await db.query('DELETE FROM categorias_item WHERE id = $1', [id]), 'Categoria');
}

// ---------------------------------------------------------------------------
// Formatos de serviço (volante, buffet, ilhas, empratado…)
// ---------------------------------------------------------------------------
export const formatoServicoSchema = z.object({
  nome: requiredText('Informe o nome do formato de serviço.', 80),
  descricao: optionalText(500),
});

export async function listarFormatosServico(db: Db, busca: string | null = null) {
  const { rows } = await db.query<{ id: string; nome: string; descricao: string | null; ordem: number }>(
    `SELECT id, nome, descricao, ordem FROM formatos_servico
      WHERE $1::text IS NULL OR nome ILIKE $1 OR descricao ILIKE $1
      ORDER BY ordem, lower(nome)`,
    [busca]
  );
  return rows;
}

export async function salvarFormatoServico(db: Db, tenantId: string, id: string | null, input: z.infer<typeof formatoServicoSchema>) {
  if (id) {
    await exigirAfetado(
      await db.query('UPDATE formatos_servico SET nome = $1, descricao = $2 WHERE id = $3', [input.nome, input.descricao, id]),
      'Formato de serviço'
    );
  } else {
    await db.query(
      `INSERT INTO formatos_servico (tenant_id, nome, descricao, ordem)
       VALUES ($1, $2, $3, COALESCE((SELECT max(ordem) + 1 FROM formatos_servico), 1))`,
      [tenantId, input.nome, input.descricao]
    );
  }
}

export async function excluirFormatoServico(db: Db, id: string) {
  await exigirAfetado(await db.query('DELETE FROM formatos_servico WHERE id = $1', [id]), 'Formato de serviço');
}

// ---------------------------------------------------------------------------
// Faixas de locação do espaço por número de convidados
// ---------------------------------------------------------------------------
export const faixaLocacaoSchema = z
  .object({
    min_convidados: optionalInt().refine((v) => v !== null, 'Informe o número mínimo de convidados.'),
    max_convidados: optionalInt(),
    valor: optionalMoney().refine((v) => v !== null, 'Informe o valor da locação.'),
    observacao: optionalText(500),
  })
  .refine((f) => f.max_convidados === null || f.max_convidados >= (f.min_convidados ?? 0), {
    message: 'O máximo de convidados deve ser maior ou igual ao mínimo.',
  });

export interface FaixaLocacao {
  id: string;
  min_convidados: number;
  max_convidados: number | null;
  valor: number;
  observacao: string | null;
}

export async function listarFaixasLocacao(db: Db): Promise<FaixaLocacao[]> {
  const { rows } = await db.query<FaixaLocacao>(
    'SELECT id, min_convidados, max_convidados, valor, observacao FROM faixas_locacao ORDER BY min_convidados'
  );
  return rows;
}

export function descreverFaixa(f: Pick<FaixaLocacao, 'min_convidados' | 'max_convidados'>): string {
  if (f.max_convidados === null) return `A partir de ${f.min_convidados} convidados`;
  if (f.min_convidados <= 0) return `Até ${f.max_convidados} convidados`;
  return `De ${f.min_convidados} a ${f.max_convidados} convidados`;
}

export async function salvarFaixaLocacao(db: Db, tenantId: string, id: string | null, input: z.infer<typeof faixaLocacaoSchema>) {
  const max = input.max_convidados ?? 2_147_483_647;
  const sobreposta = await contar(
    db,
    `SELECT count(*) AS n FROM faixas_locacao
      WHERE ($1::uuid IS NULL OR id <> $1)
        AND min_convidados <= $3 AND COALESCE(max_convidados, 2147483647) >= $2`,
    [id, input.min_convidados, max]
  );
  if (sobreposta) throw new UserError('Esta faixa se sobrepõe a outra já cadastrada.');

  const values = [input.min_convidados, input.max_convidados, input.valor, input.observacao];
  if (id) {
    await exigirAfetado(
      await db.query(
        'UPDATE faixas_locacao SET min_convidados = $1, max_convidados = $2, valor = $3, observacao = $4 WHERE id = $5',
        [...values, id]
      ),
      'Faixa'
    );
  } else {
    await db.query(
      'INSERT INTO faixas_locacao (min_convidados, max_convidados, valor, observacao, tenant_id) VALUES ($1, $2, $3, $4, $5)',
      [...values, tenantId]
    );
  }
}

export async function excluirFaixaLocacao(db: Db, id: string) {
  await exigirAfetado(await db.query('DELETE FROM faixas_locacao WHERE id = $1', [id]), 'Faixa');
}

// ---------------------------------------------------------------------------
// Status do orçamento = colunas do Kanban
// ---------------------------------------------------------------------------
export const VARIANTES_STATUS = {
  novo: 'Entrada (novos pedidos)',
  negociacao: 'Em andamento',
  aprovado: 'Ganho (aprovado)',
  recusado: 'Perdido (recusado)',
} as const;

export type VarianteStatus = keyof typeof VARIANTES_STATUS;

export const statusSchema = z.object({
  nome: requiredText('Informe o nome do status.', 50),
  variante: z.enum(['novo', 'negociacao', 'aprovado', 'recusado'], { error: 'Selecione o tipo do status.' }),
  cor: z.preprocess(
    (v) => (typeof v === 'string' && v ? v : '#888888'),
    z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida.')
  ),
});

export interface StatusRow {
  id: string;
  nome: string;
  variante: VarianteStatus;
  cor: string | null;
  ordem: number;
  eventos: number;
}

export async function listarStatus(db: Db): Promise<StatusRow[]> {
  const { rows } = await db.query<StatusRow>(
    `SELECT s.id, s.nome, s.variante, s.cor, s.ordem,
            (SELECT count(*) FROM eventos e WHERE e.status_id = s.id) AS eventos
       FROM status_orcamento s ORDER BY s.ordem, s.created_at`
  );
  return rows;
}

async function garantirEntrada(db: Db, excluindoId: string) {
  const restantes = await contar(db, `SELECT count(*) AS n FROM status_orcamento WHERE variante = 'novo' AND id <> $1`, [excluindoId]);
  if (!restantes) {
    throw new UserError('É preciso manter pelo menos um status de entrada (novos pedidos).');
  }
}

export async function salvarStatus(db: Db, tenantId: string, id: string | null, input: z.infer<typeof statusSchema>) {
  if (id) {
    const { rows } = await db.query<{ variante: string }>('SELECT variante FROM status_orcamento WHERE id = $1', [id]);
    if (!rows[0]) throw new UserError('Status não encontrado.');
    if (rows[0].variante === 'novo' && input.variante !== 'novo') await garantirEntrada(db, id);
    await db.query('UPDATE status_orcamento SET nome = $1, variante = $2, cor = $3 WHERE id = $4', [
      input.nome,
      input.variante,
      input.cor,
      id,
    ]);
  } else {
    await db.query(
      `INSERT INTO status_orcamento (tenant_id, nome, variante, cor, ordem)
       VALUES ($1, $2, $3, $4, COALESCE((SELECT max(ordem) + 1 FROM status_orcamento), 1))`,
      [tenantId, input.nome, input.variante, input.cor]
    );
  }
}

export async function excluirStatus(db: Db, id: string) {
  const n = await contar(db, 'SELECT count(*) AS n FROM eventos WHERE status_id = $1', [id]);
  if (n) throw new UserError(`Há ${n} evento(s) neste status. Mova-os para outra coluna antes de excluir.`);
  const { rows } = await db.query<{ variante: string }>('SELECT variante FROM status_orcamento WHERE id = $1', [id]);
  if (!rows[0]) throw new UserError('Status não encontrado.');
  if (rows[0].variante === 'novo') await garantirEntrada(db, id);
  await db.query('DELETE FROM status_orcamento WHERE id = $1', [id]);
}

/** Troca a posição do status com o vizinho (seta para cima/baixo). */
export async function moverStatus(db: Db, id: string, direcao: 'up' | 'down') {
  const lista = await listarStatus(db);
  const i = lista.findIndex((s) => s.id === id);
  const j = direcao === 'up' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= lista.length) return;
  const ordenada = [...lista];
  [ordenada[i], ordenada[j]] = [ordenada[j], ordenada[i]];
  for (const [pos, s] of ordenada.entries()) {
    await db.query('UPDATE status_orcamento SET ordem = $1 WHERE id = $2', [pos + 1, s.id]);
  }
}

// ---------------------------------------------------------------------------
// Intervalo de trabalho do Kanban: eventos de hoje até +N meses (os sem data sempre aparecem). null = sem limite.

export const INTERVALOS_KANBAN = [1, 3, 6] as const;
export type IntervaloKanban = (typeof INTERVALOS_KANBAN)[number] | null;

export async function carregarIntervaloKanban(db: Db): Promise<IntervaloKanban> {
  const { rows } = await db.query<{ kanban_intervalo_meses: number | null }>(
    'SELECT kanban_intervalo_meses FROM configuracoes_tenant WHERE tenant_id = app_tenant_id()'
  );
  return (rows[0]?.kanban_intervalo_meses ?? null) as IntervaloKanban;
}

export function intervaloKanbanDoForm(valor: unknown): IntervaloKanban {
  if (valor === '' || valor === undefined || valor === null) return null;
  const n = Number(valor);
  if (!INTERVALOS_KANBAN.includes(n as 1 | 3 | 6)) throw new UserError('Intervalo de trabalho inválido.');
  return n as IntervaloKanban;
}

export async function salvarIntervaloKanban(db: Db, meses: IntervaloKanban) {
  await db.query(
    `INSERT INTO configuracoes_tenant (tenant_id, kanban_intervalo_meses) VALUES (app_tenant_id(), $1)
     ON CONFLICT (tenant_id) DO UPDATE SET kanban_intervalo_meses = EXCLUDED.kanban_intervalo_meses, updated_at = now()`,
    [meses]
  );
}
