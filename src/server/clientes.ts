import { z } from 'zod';
import type { Db } from '../lib/db';
import { cnpjValido, cpfValido, somenteDigitos } from '../lib/documento';
import { UserError, optionalEmail, optionalText, requiredText } from '../lib/forms';
import type { PageParams } from '../lib/pagination';

export const clienteSchema = z
  .object({
    tipo_pessoa: z.enum(['PF', 'PJ'], { error: 'Selecione pessoa física ou jurídica.' }),
    nome: requiredText('Informe o nome do cliente.'),
    documento: optionalText(18),
    email: optionalEmail(),
    telefone: optionalText(20),
    endereco: optionalText(500),
    observacoes: optionalText(2000),
  })
  .transform((c) => ({ ...c, documento: c.documento ? somenteDigitos(c.documento) : null }))
  .refine((c) => !c.documento || (c.tipo_pessoa === 'PF' ? cpfValido(c.documento) : cnpjValido(c.documento)), {
    message: 'CPF/CNPJ inválido.',
  });

export type ClienteInput = z.infer<typeof clienteSchema>;

export interface ClienteRow {
  id: string;
  tipo_pessoa: 'PF' | 'PJ';
  nome: string;
  documento: string | null;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  observacoes: string | null;
  created_at: Date;
  total_eventos: number;
}

export async function listarClientes(
  db: Db,
  filtros: { busca: string | null; tipo: string | null },
  page: PageParams
): Promise<{ rows: ClienteRow[]; total: number }> {
  const params: unknown[] = [filtros.busca, filtros.tipo || null];
  const where = `
    WHERE ($1::text IS NULL OR c.nome ILIKE $1 OR c.email ILIKE $1
           OR (regexp_replace($1, '[^0-9]', '', 'g') <> ''
               AND c.documento LIKE '%' || regexp_replace($1, '[^0-9]', '', 'g') || '%'))
      AND ($2::text IS NULL OR c.tipo_pessoa = $2)`;
  const [{ rows }, count] = await Promise.all([
    db.query<ClienteRow>(
      `SELECT c.*, (SELECT count(*) FROM eventos e WHERE e.cliente_id = c.id) AS total_eventos
         FROM clientes c ${where}
        ORDER BY lower(c.nome)
        LIMIT $3 OFFSET $4`,
      [...params, page.pageSize, page.offset]
    ),
    db.query<{ total: number }>(`SELECT count(*) AS total FROM clientes c ${where}`, params),
  ]);
  return { rows, total: count.rows[0].total };
}

export async function salvarCliente(db: Db, tenantId: string, id: string | null, input: ClienteInput) {
  const values = [input.tipo_pessoa, input.nome, input.documento, input.email, input.telefone, input.endereco, input.observacoes];
  if (id) {
    const res = await db.query(
      `UPDATE clientes SET tipo_pessoa = $1, nome = $2, documento = $3, email = $4, telefone = $5,
              endereco = $6, observacoes = $7, updated_at = now()
        WHERE id = $8`,
      [...values, id]
    );
    if (res.rowCount === 0) throw new UserError('Cliente não encontrado.');
    return id;
  }
  const res = await db.query<{ id: string }>(
    `INSERT INTO clientes (tipo_pessoa, nome, documento, email, telefone, endereco, observacoes, tenant_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [...values, tenantId]
  );
  return res.rows[0].id;
}

export async function excluirCliente(db: Db, id: string) {
  const { rows } = await db.query<{ n: number }>('SELECT count(*) AS n FROM eventos WHERE cliente_id = $1', [id]);
  if (rows[0].n > 0) {
    throw new UserError(`Este cliente possui ${rows[0].n} evento(s) e não pode ser excluído.`);
  }
  const res = await db.query('DELETE FROM clientes WHERE id = $1', [id]);
  if (res.rowCount === 0) throw new UserError('Cliente não encontrado.');
}
