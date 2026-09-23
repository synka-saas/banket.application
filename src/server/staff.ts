// Staff: serviços (funções com custo e regra de dimensionamento) e base de profissionais.
import { z } from 'zod';
import type { Db } from '../lib/db';
import { cpfValido, somenteDigitos } from '../lib/documento';
import {
  UserError,
  checkbox,
  optionalEmail,
  optionalInt,
  optionalMoney,
  optionalText,
  optionalUuid,
  requiredText,
  tagList,
} from '../lib/forms';
import type { PageParams } from '../lib/pagination';
import type { RegraStaff } from '../lib/calculo/staff';

// ---------------------------------------------------------------------------
// Serviços e custos
// ---------------------------------------------------------------------------
export const servicoSchema = z
  .object({
    funcao: requiredText('Informe a função.', 80),
    descricao: optionalText(1000),
    cache_diaria: optionalMoney().refine((v) => v !== null, 'Informe o cachê / diária.'),
    hora_extra: optionalMoney(),
    auxilio: optionalMoney(),
    regra: z.enum(['proporcional', 'por_evento'], { error: 'Escolha a regra de quantidade.' }),
    quantidade_fixa: optionalInt(),
    convidados_por_profissional: optionalInt(),
    minimo: optionalInt(),
    incluir_por_padrao: checkbox(),
    tags: tagList(),
    ativo: checkbox(),
  })
  .superRefine((s, ctx) => {
    if (s.regra === 'por_evento' && !s.quantidade_fixa) {
      ctx.addIssue({ code: 'custom', message: 'Informe quantos profissionais por evento.' });
    }
    if (s.regra === 'proporcional' && !s.convidados_por_profissional && !s.minimo) {
      ctx.addIssue({ code: 'custom', message: 'Informe a proporção de convidados por profissional ou um mínimo.' });
    }
  });

export type ServicoInput = z.infer<typeof servicoSchema>;

export interface ServicoRow extends RegraStaff {
  id: string;
  funcao: string;
  descricao: string | null;
  hora_extra: number | null;
  incluir_por_padrao: boolean;
  tags: string[];
  ativo: boolean;
  profissionais: number;
}

export async function listarServicos(db: Db, filtros: { busca: string | null; tag?: string | null } = { busca: null }) {
  const { rows } = await db.query<ServicoRow>(
    `SELECT s.id, s.funcao, s.descricao, s.cache_diaria, s.hora_extra, s.auxilio, s.por_evento, s.quantidade_fixa,
            s.convidados_por_profissional, s.minimo, s.incluir_por_padrao, s.tags, s.ativo,
            (SELECT count(*) FROM profissionais p WHERE p.servico_id = s.id AND p.ativo) AS profissionais
       FROM staff_servicos s
      WHERE ($1::text IS NULL OR s.funcao ILIKE $1 OR s.descricao ILIKE $1)
        AND ($2::text IS NULL OR $2 = ANY(s.tags))
      ORDER BY s.ativo DESC, s.ordem, lower(s.funcao)`,
    [filtros.busca, filtros.tag ?? null]
  );
  return rows;
}

export async function listarTagsServicos(db: Db): Promise<string[]> {
  const { rows } = await db.query<{ tag: string }>(
    'SELECT DISTINCT unnest(tags) AS tag FROM staff_servicos ORDER BY 1'
  );
  return rows.map((r) => r.tag);
}

export async function salvarServico(db: Db, tenantId: string, id: string | null, input: ServicoInput) {
  const porEvento = input.regra === 'por_evento';
  const values = [
    input.funcao,
    input.descricao,
    input.cache_diaria,
    input.hora_extra,
    input.auxilio ?? 0,
    porEvento,
    porEvento ? input.quantidade_fixa : 1,
    porEvento ? null : input.convidados_por_profissional,
    porEvento ? 0 : (input.minimo ?? 0),
    input.incluir_por_padrao,
    input.tags,
    input.ativo,
  ];
  if (id) {
    const res = await db.query(
      `UPDATE staff_servicos SET funcao = $1, descricao = $2, cache_diaria = $3, hora_extra = $4, auxilio = $5,
              por_evento = $6, quantidade_fixa = $7, convidados_por_profissional = $8, minimo = $9,
              incluir_por_padrao = $10, tags = $11, ativo = $12, updated_at = now()
        WHERE id = $13`,
      [...values, id]
    );
    if (!res.rowCount) throw new UserError('Serviço não encontrado.');
    return;
  }
  await db.query(
    `INSERT INTO staff_servicos (funcao, descricao, cache_diaria, hora_extra, auxilio, por_evento, quantidade_fixa,
                                 convidados_por_profissional, minimo, incluir_por_padrao, tags, ativo, tenant_id, ordem)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
             (SELECT COALESCE(max(ordem), 0) + 1 FROM staff_servicos))`,
    [...values, tenantId]
  );
}

export async function excluirServico(db: Db, id: string) {
  // Profissionais dessa especialidade ficam sem especialidade (ON DELETE SET NULL)
  const res = await db.query('DELETE FROM staff_servicos WHERE id = $1', [id]);
  if (!res.rowCount) throw new UserError('Serviço não encontrado.');
}

// ---------------------------------------------------------------------------
// Base de profissionais
// ---------------------------------------------------------------------------
export const profissionalSchema = z
  .object({
    nome: requiredText('Informe o nome do profissional.'),
    email: optionalEmail(),
    telefone: optionalText(20),
    documento: optionalText(14),
    servico_id: optionalUuid(),
    chave_pix: optionalText(140),
    observacoes: optionalText(2000),
    ativo: checkbox(),
  })
  .transform((p) => ({ ...p, documento: p.documento ? somenteDigitos(p.documento) : null }))
  .refine((p) => !p.documento || cpfValido(p.documento), { message: 'CPF inválido.' });

export type ProfissionalInput = z.infer<typeof profissionalSchema>;

export interface ProfissionalRow {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  documento: string | null;
  servico_id: string | null;
  servico_funcao: string | null;
  chave_pix: string | null;
  observacoes: string | null;
  ativo: boolean;
}

export async function listarProfissionais(
  db: Db,
  filtros: { busca: string | null; servicoId: string | null },
  page: PageParams
): Promise<{ rows: ProfissionalRow[]; total: number }> {
  const params = [filtros.busca, filtros.servicoId];
  const where = `WHERE ($1::text IS NULL OR p.nome ILIKE $1 OR p.email ILIKE $1 OR p.telefone ILIKE $1)
                   AND ($2::uuid IS NULL OR p.servico_id = $2)`;
  const { rows } = await db.query<ProfissionalRow>(
    `SELECT p.id, p.nome, p.email, p.telefone, p.documento, p.servico_id, s.funcao AS servico_funcao,
            p.chave_pix, p.observacoes, p.ativo
       FROM profissionais p LEFT JOIN staff_servicos s ON s.id = p.servico_id
       ${where}
      ORDER BY p.ativo DESC, lower(p.nome)
      LIMIT $3 OFFSET $4`,
    [...params, page.pageSize, page.offset]
  );
  const count = await db.query<{ total: number }>(`SELECT count(*) AS total FROM profissionais p ${where}`, params);
  return { rows, total: count.rows[0].total };
}

export async function salvarProfissional(db: Db, tenantId: string, id: string | null, input: ProfissionalInput) {
  const values = [input.nome, input.email, input.telefone, input.documento, input.servico_id, input.chave_pix, input.observacoes, input.ativo];
  if (id) {
    const res = await db.query(
      `UPDATE profissionais SET nome = $1, email = $2, telefone = $3, documento = $4, servico_id = $5,
              chave_pix = $6, observacoes = $7, ativo = $8, updated_at = now()
        WHERE id = $9`,
      [...values, id]
    );
    if (!res.rowCount) throw new UserError('Profissional não encontrado.');
    return;
  }
  await db.query(
    `INSERT INTO profissionais (nome, email, telefone, documento, servico_id, chave_pix, observacoes, ativo, tenant_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [...values, tenantId]
  );
}

export async function atualizarEspecialidade(db: Db, id: string, servicoId: string | null) {
  const res = await db.query('UPDATE profissionais SET servico_id = $1, updated_at = now() WHERE id = $2', [servicoId, id]);
  if (!res.rowCount) throw new UserError('Profissional não encontrado.');
}

export async function excluirProfissional(db: Db, id: string) {
  const res = await db.query('DELETE FROM profissionais WHERE id = $1', [id]);
  if (!res.rowCount) throw new UserError('Profissional não encontrado.');
}
