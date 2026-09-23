// Catálogo do cardápio: sessões, itens e opções prontas (pacotes).
import { z } from 'zod';
import type { Db } from '../lib/db';
import {
  UserError,
  checkbox,
  optionalInt,
  optionalMoney,
  optionalText,
  optionalUuid,
  requiredText,
  stringArray,
  tagList,
} from '../lib/forms';
import type { PageParams } from '../lib/pagination';

export const RESTRICOES = {
  vegetariana: 'Vegetariana',
  vegana: 'Vegana',
  sem_gluten: 'Sem glúten',
  sem_lactose: 'Sem lactose',
  alergenicos: 'Presença de frutos do mar, castanhas, amendoim, soja etc.',
} as const;

export const DADOS_OPERACIONAIS = {
  preparo_evento: 'Preparo no evento',
  frito: 'Frito',
  assado: 'Assado',
  cozido: 'Cozido',
  consumo_2h: 'Consumo em até 2 horas',
} as const;

export const UNIDADES_COBRANCA = { pessoa: 'por pessoa', unidade: 'por unidade' } as const;

const unidade = z.enum(['pessoa', 'unidade']).default('pessoa');
const codigos = <T extends Record<string, string>>(mapa: T) =>
  stringArray().transform((lista) => lista.filter((v) => v in mapa));

// ---------------------------------------------------------------------------
// Sessões
// ---------------------------------------------------------------------------
export const secaoSchema = z.object({
  nome: requiredText('Informe o nome da sessão.', 120),
  descricao: optionalText(1000),
  preco: optionalMoney(),
  unidade_cobranca: unidade,
  ordem: optionalInt(),
});

export interface SecaoRow {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number | null;
  unidade_cobranca: 'pessoa' | 'unidade';
  ordem: number;
  itens: number;
  opcoes: number;
}

export async function listarSecoes(db: Db, busca: string | null, page?: PageParams): Promise<{ rows: SecaoRow[]; total: number }> {
  const params: unknown[] = [busca];
  const where = 'WHERE $1::text IS NULL OR s.nome ILIKE $1 OR s.descricao ILIKE $1';
  const limit = page ? `LIMIT ${page.pageSize} OFFSET ${page.offset}` : '';
  const { rows } = await db.query<SecaoRow>(
    `SELECT s.id, s.nome, s.descricao, s.preco, s.unidade_cobranca, s.ordem,
            (SELECT count(*) FROM catalogo_itens i WHERE i.secao_id = s.id) AS itens,
            (SELECT count(DISTINCT os.opcao_id) FROM cardapio_opcao_secoes os WHERE os.secao_id = s.id) AS opcoes
       FROM catalogo_secoes s ${where}
      ORDER BY s.ordem, lower(s.nome) ${limit}`,
    params
  );
  const count = await db.query<{ total: number }>(`SELECT count(*) AS total FROM catalogo_secoes s ${where}`, params);
  return { rows, total: count.rows[0].total };
}

export async function salvarSecao(db: Db, tenantId: string, id: string | null, input: z.infer<typeof secaoSchema>) {
  if (id) {
    const res = await db.query(
      `UPDATE catalogo_secoes SET nome = $1, descricao = $2, preco = $3, unidade_cobranca = $4,
              ordem = COALESCE($5, ordem), updated_at = now()
        WHERE id = $6`,
      [input.nome, input.descricao, input.preco, input.unidade_cobranca, input.ordem, id]
    );
    if (!res.rowCount) throw new UserError('Sessão não encontrada.');
    return;
  }
  await db.query(
    `INSERT INTO catalogo_secoes (tenant_id, nome, descricao, preco, unidade_cobranca, ordem)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, (SELECT COALESCE(max(ordem), 0) + 1 FROM catalogo_secoes)))`,
    [tenantId, input.nome, input.descricao, input.preco, input.unidade_cobranca, input.ordem]
  );
}

export async function excluirSecao(db: Db, id: string) {
  const { rows } = await db.query<{ n: number }>(
    'SELECT count(DISTINCT opcao_id) AS n FROM cardapio_opcao_secoes WHERE secao_id = $1',
    [id]
  );
  if (rows[0].n) {
    throw new UserError(`Esta sessão é usada em ${rows[0].n} opção(ões) de cardápio. Remova-a das opções antes de excluir.`);
  }
  // Os itens da sessão são removidos junto (ON DELETE CASCADE)
  const res = await db.query('DELETE FROM catalogo_secoes WHERE id = $1', [id]);
  if (!res.rowCount) throw new UserError('Sessão não encontrada.');
}

// ---------------------------------------------------------------------------
// Itens
// ---------------------------------------------------------------------------
export const itemSchema = z.object({
  nome: requiredText('Informe o nome do item.', 200),
  secao_id: z.uuid('Selecione a sessão do item.'),
  descricao: optionalText(2000),
  composicao: optionalText(2000),
  categoria_principal_id: optionalUuid(),
  categoria_secundaria_id: optionalUuid(),
  formato_servico_id: optionalUuid(),
  custo_unitario: optionalMoney(),
  preco: optionalMoney(),
  unidade_cobranca: unidade,
  restricoes: codigos(RESTRICOES),
  dados_operacionais: codigos(DADOS_OPERACIONAIS),
  ativo: checkbox(),
});

export type ItemInput = z.infer<typeof itemSchema>;

export interface ItemRow {
  id: string;
  nome: string;
  descricao: string | null;
  composicao: string | null;
  secao_id: string;
  secao_nome: string;
  categoria_principal_id: string | null;
  categoria_principal_nome: string | null;
  categoria_secundaria_id: string | null;
  formato_servico_id: string | null;
  custo_unitario: number | null;
  preco: number | null;
  unidade_cobranca: 'pessoa' | 'unidade';
  restricoes: string[];
  dados_operacionais: string[];
  ativo: boolean;
}

export async function listarItens(
  db: Db,
  filtros: { busca: string | null; secaoId: string | null },
  page: PageParams
): Promise<{ rows: ItemRow[]; total: number }> {
  const params = [filtros.busca, filtros.secaoId];
  const where = `WHERE ($1::text IS NULL OR i.nome ILIKE $1 OR i.descricao ILIKE $1)
                   AND ($2::uuid IS NULL OR i.secao_id = $2)`;
  const { rows } = await db.query<ItemRow>(
    `SELECT i.id, i.nome, i.descricao, i.composicao, i.secao_id, s.nome AS secao_nome,
            i.categoria_principal_id, cp.nome AS categoria_principal_nome, i.categoria_secundaria_id,
            i.formato_servico_id, i.custo_unitario, i.preco, i.unidade_cobranca, i.restricoes,
            i.dados_operacionais, i.ativo
       FROM catalogo_itens i
       JOIN catalogo_secoes s ON s.id = i.secao_id
       LEFT JOIN categorias_item cp ON cp.id = i.categoria_principal_id
       ${where}
      ORDER BY s.ordem, lower(s.nome), i.ordem, lower(i.nome)
      LIMIT $3 OFFSET $4`,
    [...params, page.pageSize, page.offset]
  );
  const count = await db.query<{ total: number }>(
    `SELECT count(*) AS total FROM catalogo_itens i ${where}`,
    params
  );
  return { rows, total: count.rows[0].total };
}

export async function salvarItem(db: Db, tenantId: string, id: string | null, input: ItemInput) {
  const values = [
    input.nome,
    input.secao_id,
    input.descricao,
    input.composicao,
    input.categoria_principal_id,
    input.categoria_secundaria_id,
    input.formato_servico_id,
    input.custo_unitario,
    input.preco,
    input.unidade_cobranca,
    input.restricoes,
    input.dados_operacionais,
    input.ativo,
  ];
  if (id) {
    const res = await db.query(
      `UPDATE catalogo_itens SET nome = $1, secao_id = $2, descricao = $3, composicao = $4,
              categoria_principal_id = $5, categoria_secundaria_id = $6, formato_servico_id = $7,
              custo_unitario = $8, preco = $9, unidade_cobranca = $10, restricoes = $11,
              dados_operacionais = $12, ativo = $13, updated_at = now()
        WHERE id = $14`,
      [...values, id]
    );
    if (!res.rowCount) throw new UserError('Item não encontrado.');
    return;
  }
  await db.query(
    `INSERT INTO catalogo_itens (nome, secao_id, descricao, composicao, categoria_principal_id, categoria_secundaria_id,
                                 formato_servico_id, custo_unitario, preco, unidade_cobranca, restricoes,
                                 dados_operacionais, ativo, tenant_id, ordem)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
             (SELECT COALESCE(max(ordem), 0) + 1 FROM catalogo_itens WHERE secao_id = $2))`,
    [...values, tenantId]
  );
}

export async function atualizarCategoriaPrincipal(db: Db, id: string, categoriaId: string | null) {
  const res = await db.query('UPDATE catalogo_itens SET categoria_principal_id = $1, updated_at = now() WHERE id = $2', [
    categoriaId,
    id,
  ]);
  if (!res.rowCount) throw new UserError('Item não encontrado.');
}

export async function excluirItem(db: Db, id: string) {
  const { rows } = await db.query<{ n: number }>(
    `SELECT count(DISTINCT os.opcao_id) AS n
       FROM cardapio_opcao_itens oi JOIN cardapio_opcao_secoes os ON os.id = oi.opcao_secao_id
      WHERE oi.item_id = $1`,
    [id]
  );
  if (rows[0].n) {
    throw new UserError(
      `Este item faz parte de ${rows[0].n} opção(ões) de cardápio. Remova-o das opções ou desative-o em vez de excluir.`
    );
  }
  const res = await db.query('DELETE FROM catalogo_itens WHERE id = $1', [id]);
  if (!res.rowCount) throw new UserError('Item não encontrado.');
}

// ---------------------------------------------------------------------------
// Catálogo resumido (seletores e editor de opções)
// ---------------------------------------------------------------------------
export interface CatalogoItem {
  id: string;
  nome: string;
  preco: number | null;
  unidade: 'pessoa' | 'unidade';
  ativo: boolean;
}

export interface CatalogoSecao {
  id: string;
  nome: string;
  preco: number | null;
  unidade: 'pessoa' | 'unidade';
  itens: CatalogoItem[];
}

export async function carregarCatalogo(db: Db): Promise<CatalogoSecao[]> {
  const { rows } = await db.query<CatalogoSecao>(
    `SELECT s.id, s.nome, s.preco, s.unidade_cobranca AS unidade,
            COALESCE(json_agg(json_build_object(
              'id', i.id, 'nome', i.nome, 'preco', i.preco, 'unidade', i.unidade_cobranca, 'ativo', i.ativo
            ) ORDER BY i.ordem, lower(i.nome)) FILTER (WHERE i.id IS NOT NULL), '[]') AS itens
       FROM catalogo_secoes s
       LEFT JOIN catalogo_itens i ON i.secao_id = s.id
      GROUP BY s.id
      ORDER BY s.ordem, lower(s.nome)`
  );
  return rows.map((s) => ({ ...s, itens: s.itens.map((i) => ({ ...i, preco: i.preco === null ? null : Number(i.preco) })) }));
}

// ---------------------------------------------------------------------------
// Opções prontas (pacotes)
// ---------------------------------------------------------------------------
const opcaoSecaoSchema = z.object({
  secao_id: z.uuid('Sessão inválida.'),
  titulo: optionalText(120),
  escolha_qtd: optionalInt(),
  preco: optionalMoney(),
  itens: z.array(z.uuid()).min(1, 'Cada sessão da opção precisa de pelo menos um item.'),
});

export const opcaoSchema = z.object({
  nome: requiredText('Informe o nome do cardápio.', 150),
  descricao: optionalText(2000),
  preco_por_pessoa: optionalMoney(),
  duracao_horas: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : Number(String(v).replace(',', '.'))),
    z.number({ error: 'Duração inválida.' }).positive('A duração deve ser maior que zero.').max(48).nullable()
  ),
  formato_servico_id: optionalUuid(),
  tags: tagList(),
  ativo: z.boolean().default(true),
  secoes: z.array(opcaoSecaoSchema).min(1, 'Adicione pelo menos uma sessão ao cardápio.'),
});

export type OpcaoInput = z.infer<typeof opcaoSchema>;

export interface OpcaoResumo {
  id: string;
  nome: string;
  descricao: string | null;
  preco_por_pessoa: number | null;
  duracao_horas: number | null;
  formato_nome: string | null;
  tags: string[];
  ativo: boolean;
  secoes: number;
  itens: number;
}

export async function listarOpcoes(db: Db, filtros: { busca: string | null; secaoId: string | null }): Promise<OpcaoResumo[]> {
  const { rows } = await db.query<OpcaoResumo>(
    `SELECT o.id, o.nome, o.descricao, o.preco_por_pessoa, o.duracao_horas, f.nome AS formato_nome, o.tags, o.ativo,
            (SELECT count(*) FROM cardapio_opcao_secoes os WHERE os.opcao_id = o.id) AS secoes,
            (SELECT count(*) FROM cardapio_opcao_itens oi JOIN cardapio_opcao_secoes os ON os.id = oi.opcao_secao_id
              WHERE os.opcao_id = o.id) AS itens
       FROM cardapio_opcoes o
       LEFT JOIN formatos_servico f ON f.id = o.formato_servico_id
      WHERE ($1::text IS NULL OR o.nome ILIKE $1 OR o.descricao ILIKE $1 OR array_to_string(o.tags, ' ') ILIKE $1)
        AND ($2::uuid IS NULL OR EXISTS (SELECT 1 FROM cardapio_opcao_secoes x WHERE x.opcao_id = o.id AND x.secao_id = $2))
      ORDER BY o.ativo DESC, lower(o.nome)`,
    [filtros.busca, filtros.secaoId]
  );
  return rows;
}

export interface OpcaoDetalhe {
  id: string;
  nome: string;
  descricao: string | null;
  preco_por_pessoa: number | null;
  duracao_horas: number | null;
  formato_servico_id: string | null;
  tags: string[];
  ativo: boolean;
  secoes: { secao_id: string; titulo: string | null; escolha_qtd: number | null; preco: number | null; itens: string[] }[];
}

export async function carregarOpcao(db: Db, id: string): Promise<OpcaoDetalhe> {
  const { rows } = await db.query<OpcaoDetalhe>(
    `SELECT o.id, o.nome, o.descricao, o.preco_por_pessoa, o.duracao_horas, o.formato_servico_id, o.tags, o.ativo,
            COALESCE((
              SELECT json_agg(json_build_object(
                       'secao_id', os.secao_id, 'titulo', os.titulo, 'escolha_qtd', os.escolha_qtd, 'preco', os.preco,
                       'itens', COALESCE((SELECT json_agg(oi.item_id ORDER BY oi.ordem)
                                            FROM cardapio_opcao_itens oi WHERE oi.opcao_secao_id = os.id), '[]'))
                     ORDER BY os.ordem)
                FROM cardapio_opcao_secoes os WHERE os.opcao_id = o.id), '[]') AS secoes
       FROM cardapio_opcoes o WHERE o.id = $1`,
    [id]
  );
  if (!rows[0]) throw new UserError('Opção de cardápio não encontrada.');
  const o = rows[0];
  return { ...o, secoes: o.secoes.map((s) => ({ ...s, preco: s.preco === null ? null : Number(s.preco) })) };
}

export async function salvarOpcao(db: Db, tenantId: string, id: string | null, input: OpcaoInput): Promise<string> {
  const values = [
    input.nome,
    input.descricao,
    input.preco_por_pessoa,
    input.duracao_horas,
    input.formato_servico_id,
    input.tags,
    input.ativo,
  ];
  let opcaoId = id;
  if (id) {
    const res = await db.query(
      `UPDATE cardapio_opcoes SET nome = $1, descricao = $2, preco_por_pessoa = $3, duracao_horas = $4,
              formato_servico_id = $5, tags = $6, ativo = $7, updated_at = now()
        WHERE id = $8`,
      [...values, id]
    );
    if (!res.rowCount) throw new UserError('Opção de cardápio não encontrada.');
    await db.query('DELETE FROM cardapio_opcao_secoes WHERE opcao_id = $1', [id]);
  } else {
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO cardapio_opcoes (nome, descricao, preco_por_pessoa, duracao_horas, formato_servico_id, tags, ativo, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [...values, tenantId]
    );
    opcaoId = rows[0].id;
  }

  for (const [ordem, secao] of input.secoes.entries()) {
    // Só aceita itens que pertencem de fato à sessão do catálogo
    const { rows: validos } = await db.query<{ id: string }>(
      'SELECT id FROM catalogo_itens WHERE secao_id = $1 AND id = ANY($2::uuid[])',
      [secao.secao_id, secao.itens]
    );
    if (!validos.length) throw new UserError('Há sessões sem itens válidos no cardápio.');
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO cardapio_opcao_secoes (tenant_id, opcao_id, secao_id, titulo, escolha_qtd, preco, ordem)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [tenantId, opcaoId, secao.secao_id, secao.titulo, secao.escolha_qtd, secao.preco, ordem + 1]
    );
    const validosSet = new Set(validos.map((v) => v.id));
    const itens = secao.itens.filter((i) => validosSet.has(i));
    await db.query(
      `INSERT INTO cardapio_opcao_itens (tenant_id, opcao_secao_id, item_id, ordem)
       SELECT $1, $2, item_id, ordinality FROM unnest($3::uuid[]) WITH ORDINALITY AS t(item_id, ordinality)`,
      [tenantId, rows[0].id, itens]
    );
  }
  return opcaoId!;
}

export async function excluirOpcao(db: Db, id: string) {
  const res = await db.query('DELETE FROM cardapio_opcoes WHERE id = $1', [id]);
  if (!res.rowCount) throw new UserError('Opção de cardápio não encontrada.');
}

export async function duplicarOpcao(db: Db, tenantId: string, id: string): Promise<string> {
  const original = await carregarOpcao(db, id);
  return salvarOpcao(db, tenantId, null, {
    ...original,
    nome: `${original.nome} (cópia)`,
    secoes: original.secoes,
  });
}
