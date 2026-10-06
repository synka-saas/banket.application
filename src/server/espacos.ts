// Espaços de eventos: próprios (locação por faixa de convidados) e de terceiros (dados gerais e valor de referência).
// As faixas de locação pertencem a um espaço próprio e alimentam o cálculo da locação no orçamento.
import { z } from 'zod';
import type { Db } from '../lib/db';
import { UserError, checkbox, optionalEmail, optionalInt, optionalMoney, optionalText, requiredText } from '../lib/forms';
import type { PageParams } from '../lib/pagination';
import { orderBy, type Ordenacao } from '../lib/ordenacao';
import type { EspacoRef, FaixaLocacaoRef, ReferenciasLocacao } from '../lib/calculo/orcamento';

export type TipoEspaco = 'proprio' | 'terceiro';

export const TIPOS_ESPACO: Record<TipoEspaco, string> = {
  proprio: 'Nosso espaço',
  terceiro: 'Espaço de terceiro',
};

export const espacoSchema = z
  .object({
    nome: requiredText('Informe o nome do espaço.', 120),
    tipo: z.enum(['proprio', 'terceiro'], { error: 'Selecione o tipo do espaço.' }),
    descricao: optionalText(2000),
    endereco: optionalText(500),
    cidade: optionalText(120),
    capacidade_min: optionalInt(),
    capacidade_max: optionalInt(),
    contato_nome: optionalText(255),
    contato_telefone: optionalText(20),
    contato_email: optionalEmail(),
    valor_referencia: optionalMoney(),
    observacoes: optionalText(5000),
    ativo: checkbox(),
  })
  .refine((e) => e.capacidade_min === null || e.capacidade_min >= 0, {
    message: 'A capacidade mínima não pode ser negativa.',
    path: ['capacidade_min'],
  })
  .refine((e) => e.capacidade_max === null || e.capacidade_max >= (e.capacidade_min ?? 0), {
    message: 'A capacidade máxima deve ser maior ou igual à mínima.',
    path: ['capacidade_max'],
  })
  .refine((e) => e.valor_referencia === null || e.valor_referencia >= 0, {
    message: 'O valor de referência não pode ser negativo.',
    path: ['valor_referencia'],
  })
  // Campos de terceiro não fazem sentido num espaço próprio (a locação dele é por faixa)
  .transform((e) =>
    e.tipo === 'proprio' ? { ...e, contato_nome: null, contato_telefone: null, contato_email: null, valor_referencia: null } : e
  );

export type EspacoInput = z.infer<typeof espacoSchema>;

export interface Espaco {
  id: string;
  nome: string;
  tipo: TipoEspaco;
  descricao: string | null;
  endereco: string | null;
  cidade: string | null;
  capacidade_min: number | null;
  capacidade_max: number | null;
  contato_nome: string | null;
  contato_telefone: string | null;
  contato_email: string | null;
  valor_referencia: number | null;
  observacoes: string | null;
  ativo: boolean;
  ordem: number;
  faixas_count: number;
  eventos_count: number;
}

const COLUNAS = `e.id, e.nome, e.tipo, e.descricao, e.endereco, e.cidade, e.capacidade_min, e.capacidade_max,
            e.contato_nome, e.contato_telefone, e.contato_email, e.valor_referencia, e.observacoes, e.ativo, e.ordem,
            (SELECT count(*) FROM faixas_locacao f WHERE f.espaco_id = e.id) AS faixas_count,
            (SELECT count(*) FROM eventos ev WHERE ev.espaco_id = e.id) AS eventos_count`;

const ORDEM_ESPACOS: Record<string, string> = {
  nome: 'lower(e.nome)',
  tipo: 'e.tipo',
  cidade: 'lower(e.cidade)',
  capacidade: 'e.capacidade_max',
};

export async function listarEspacos(
  db: Db,
  filtros: { busca: string | null; tipo: TipoEspaco | null },
  page: PageParams,
  ord?: Ordenacao
): Promise<{ rows: Espaco[]; total: number }> {
  const params = [filtros.busca, filtros.tipo];
  const where = `WHERE ($1::text IS NULL OR e.nome ILIKE $1 OR e.cidade ILIKE $1 OR e.endereco ILIKE $1)
                   AND ($2::text IS NULL OR e.tipo = $2)`;
  const [lista, count] = await Promise.all([
    db.query<Espaco>(
      `SELECT ${COLUNAS} FROM espacos e ${where}
        ORDER BY ${orderBy(ord, ORDEM_ESPACOS, 'e.ativo DESC, e.tipo, e.ordem, lower(e.nome)')}
        LIMIT $3 OFFSET $4`,
      [...params, page.pageSize, page.offset]
    ),
    db.query<{ total: number }>(`SELECT count(*) AS total FROM espacos e ${where}`, params),
  ]);
  return { rows: lista.rows, total: count.rows[0].total };
}

export async function carregarEspaco(db: Db, id: string): Promise<Espaco | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { rows } = await db.query<Espaco>(`SELECT ${COLUNAS} FROM espacos e WHERE e.id = $1`, [id]);
  return rows[0] ?? null;
}

export async function salvarEspaco(db: Db, tenantId: string, id: string | null, input: EspacoInput): Promise<string> {
  const values = [
    input.nome, input.tipo, input.descricao, input.endereco, input.cidade, input.capacidade_min, input.capacidade_max,
    input.contato_nome, input.contato_telefone, input.contato_email, input.valor_referencia, input.observacoes, input.ativo,
  ];
  if (id) {
    const res = await db.query(
      `UPDATE espacos SET nome = $1, tipo = $2, descricao = $3, endereco = $4, cidade = $5, capacidade_min = $6,
              capacidade_max = $7, contato_nome = $8, contato_telefone = $9, contato_email = $10, valor_referencia = $11,
              observacoes = $12, ativo = $13, updated_at = now()
        WHERE id = $14`,
      [...values, id]
    );
    if (!res.rowCount) throw new UserError('Espaço não encontrado.');
    // Um espaço que deixa de ser próprio não tem mais faixas
    if (input.tipo === 'terceiro') await db.query('DELETE FROM faixas_locacao WHERE espaco_id = $1', [id]);
    return id;
  }
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO espacos (nome, tipo, descricao, endereco, cidade, capacidade_min, capacidade_max, contato_nome,
                          contato_telefone, contato_email, valor_referencia, observacoes, ativo, tenant_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id`,
    [...values, tenantId]
  );
  return rows[0].id;
}

export async function excluirEspaco(db: Db, id: string): Promise<void> {
  const espaco = await carregarEspaco(db, id);
  if (!espaco) throw new UserError('Espaço não encontrado.');
  if (espaco.eventos_count > 0) {
    throw new UserError(
      `Este espaço está em ${espaco.eventos_count} evento(s). Desative o espaço em vez de excluir para manter o histórico.`
    );
  }
  await db.query('DELETE FROM espacos WHERE id = $1', [id]);
}

/** Espaços ativos para seleção (evento, orçamento, empresa), mais o atualmente escolhido mesmo que inativo. */
export async function espacosParaSelecao(db: Db, incluirId: string | null = null): Promise<EspacoRef[]> {
  const { rows } = await db.query<EspacoRef>(
    `SELECT id, nome, tipo, valor_referencia, ativo FROM espacos
      WHERE ativo OR id = $1
      ORDER BY tipo, ordem, lower(nome)`,
    [incluirId]
  );
  return rows;
}

/** Espaço padrão da empresa (pré-selecionado em eventos novos e no formulário público). */
export async function espacoPadraoId(db: Db): Promise<string | null> {
  const { rows } = await db.query<{ espaco_padrao_id: string | null }>(
    'SELECT espaco_padrao_id FROM configuracoes_tenant'
  );
  return rows[0]?.espaco_padrao_id ?? null;
}

/**
 * Dados de apoio do cálculo da locação: todos os espaços (inclusive inativos, para versões que ainda os usam) e as
 * faixas. Faixas sem espaço (gravadas pela versão anterior do código) contam como do espaço padrão.
 */
export async function referenciasLocacao(db: Db): Promise<ReferenciasLocacao> {
  const [espacos, faixas] = await Promise.all([
    db.query<EspacoRef>('SELECT id, nome, tipo, valor_referencia, ativo FROM espacos ORDER BY tipo, ordem, lower(nome)'),
    db.query<Omit<FaixaLocacaoRef, 'descricao'>>(
      `SELECT f.id, COALESCE(f.espaco_id, c.espaco_padrao_id) AS espaco_id, f.min_convidados, f.max_convidados, f.valor
         FROM faixas_locacao f CROSS JOIN configuracoes_tenant c
        ORDER BY f.min_convidados`
    ),
  ]);
  return { espacos: espacos.rows, faixas: faixas.rows.map((f) => ({ ...f, descricao: descreverFaixa(f) })) };
}

// ---------------------------------------------------------------------------
// Faixas de locação do espaço próprio por número de convidados
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
    path: ['max_convidados'],
  });

export interface FaixaLocacao {
  id: string;
  espaco_id: string | null;
  min_convidados: number;
  max_convidados: number | null;
  valor: number;
  observacao: string | null;
}

export function descreverFaixa(f: Pick<FaixaLocacao, 'min_convidados' | 'max_convidados'>): string {
  if (f.max_convidados === null) return `A partir de ${f.min_convidados} convidados`;
  if (f.min_convidados <= 0) return `Até ${f.max_convidados} convidados`;
  return `De ${f.min_convidados} a ${f.max_convidados} convidados`;
}

/** Faixas do espaço; as sem espaço aparecem no espaço padrão (dados da versão anterior do código). */
export async function listarFaixasLocacao(db: Db, espacoId: string): Promise<FaixaLocacao[]> {
  const { rows } = await db.query<FaixaLocacao>(
    `SELECT f.id, f.espaco_id, f.min_convidados, f.max_convidados, f.valor, f.observacao
       FROM faixas_locacao f CROSS JOIN configuracoes_tenant c
      WHERE f.espaco_id = $1 OR (f.espaco_id IS NULL AND c.espaco_padrao_id = $1)
      ORDER BY f.min_convidados`,
    [espacoId]
  );
  return rows;
}

async function exigirEspacoProprio(db: Db, espacoId: string) {
  const espaco = await carregarEspaco(db, espacoId);
  if (!espaco) throw new UserError('Espaço não encontrado.');
  if (espaco.tipo !== 'proprio') throw new UserError('Só espaços próprios têm faixas de locação.');
}

export async function salvarFaixaLocacao(
  db: Db,
  tenantId: string,
  espacoId: string,
  id: string | null,
  input: z.infer<typeof faixaLocacaoSchema>
) {
  await exigirEspacoProprio(db, espacoId);
  const max = input.max_convidados ?? 2_147_483_647;
  const { rows } = await db.query<{ n: number }>(
    `SELECT count(*) AS n FROM faixas_locacao f CROSS JOIN configuracoes_tenant c
      WHERE ($1::uuid IS NULL OR f.id <> $1)
        AND (f.espaco_id = $4 OR (f.espaco_id IS NULL AND c.espaco_padrao_id = $4))
        AND f.min_convidados <= $3 AND COALESCE(f.max_convidados, 2147483647) >= $2`,
    [id, input.min_convidados, max, espacoId]
  );
  if (rows[0]?.n) throw new UserError('Esta faixa se sobrepõe a outra já cadastrada neste espaço.');

  const values = [input.min_convidados, input.max_convidados, input.valor, input.observacao];
  if (id) {
    const res = await db.query(
      `UPDATE faixas_locacao SET min_convidados = $1, max_convidados = $2, valor = $3, observacao = $4, espaco_id = $6
        WHERE id = $5`,
      [...values, id, espacoId]
    );
    if (!res.rowCount) throw new UserError('Faixa não encontrada.');
    return;
  }
  await db.query(
    `INSERT INTO faixas_locacao (min_convidados, max_convidados, valor, observacao, espaco_id, tenant_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [...values, espacoId, tenantId]
  );
}

export async function excluirFaixaLocacao(db: Db, espacoId: string, id: string) {
  const res = await db.query(
    `DELETE FROM faixas_locacao f USING configuracoes_tenant c
      WHERE f.id = $1 AND (f.espaco_id = $2 OR (f.espaco_id IS NULL AND c.espaco_padrao_id = $2))`,
    [id, espacoId]
  );
  if (!res.rowCount) throw new UserError('Faixa não encontrada.');
}
