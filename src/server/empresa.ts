// Dados cadastrais da empresa (tenant) e parâmetros comerciais usados nos orçamentos.
import { z } from 'zod';
import type { Db } from '../lib/db';
import { cnpjValido, cpfValido, somenteDigitos } from '../lib/documento';
import { UserError, optionalEmail, optionalInt, optionalText, optionalUuid, requiredText } from '../lib/forms';

export const empresaSchema = z
  .object({
    nome: requiredText('Informe o nome da empresa.'),
    razao_social: optionalText(255),
    tipo_pessoa: z.enum(['PF', 'PJ']),
    documento: optionalText(18),
    email: optionalEmail(),
    telefone: optionalText(20),
    endereco: optionalText(500),
    validade_proposta_dias: optionalInt().refine((v) => v !== null && v > 0, 'Informe a validade da proposta em dias.'),
    criancas_isentas_ate: optionalInt().refine((v) => v !== null, 'Informe até que idade a criança não paga.'),
    criancas_meia_ate: optionalInt().refine((v) => v !== null, 'Informe até que idade a criança paga meia.'),
    espaco_padrao_id: optionalUuid(),
    assinatura_nome: optionalText(255),
    assinatura_cargo: optionalText(255),
    assinatura_telefone: optionalText(30),
  })
  .transform((e) => ({ ...e, documento: e.documento ? somenteDigitos(e.documento) : null }))
  .refine((e) => !e.documento || (e.tipo_pessoa === 'PF' ? cpfValido(e.documento) : cnpjValido(e.documento)), {
    message: 'CPF/CNPJ inválido.',
    path: ['documento'],
  })
  .refine((e) => (e.criancas_meia_ate ?? 0) >= (e.criancas_isentas_ate ?? 0), {
    message: 'A idade limite para meia deve ser maior ou igual à de isenção.',
    path: ['criancas_meia_ate'],
  });

export type EmpresaInput = z.infer<typeof empresaSchema>;

export interface Empresa {
  id: string;
  nome: string;
  slug: string;
  razao_social: string | null;
  tipo_pessoa: 'PF' | 'PJ';
  documento: string | null;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  logo_path: string | null;
  validade_proposta_dias: number;
  criancas_isentas_ate: number;
  criancas_meia_ate: number;
  espaco_padrao_id: string | null;
  assinatura_nome: string | null;
  assinatura_cargo: string | null;
  assinatura_telefone: string | null;
}

export async function carregarEmpresa(db: Db): Promise<Empresa> {
  // RLS garante que só a própria empresa é visível
  await db.query('INSERT INTO configuracoes_tenant (tenant_id) VALUES (app_tenant_id()) ON CONFLICT DO NOTHING');
  const { rows } = await db.query<Empresa>(
    `SELECT t.id, t.nome, t.slug, t.razao_social, t.tipo_pessoa, t.documento, t.email, t.telefone, t.endereco, t.logo_path,
            c.validade_proposta_dias, c.criancas_isentas_ate, c.criancas_meia_ate, c.espaco_padrao_id,
            c.assinatura_nome, c.assinatura_cargo, c.assinatura_telefone
       FROM tenants t JOIN configuracoes_tenant c ON c.tenant_id = t.id`
  );
  if (!rows[0]) throw new UserError('Empresa não encontrada.');
  return rows[0];
}

export async function salvarEmpresa(db: Db, input: EmpresaInput, logoPath?: string | null) {
  // O id do espaço vem do formulário: confere no tenant antes de gravar (FK não passa pelo RLS)
  if (input.espaco_padrao_id) {
    const { rowCount } = await db.query('SELECT 1 FROM espacos WHERE id = $1', [input.espaco_padrao_id]);
    if (!rowCount) throw new UserError('Espaço padrão inválido.', 'espaco_padrao_id');
  }
  await db.query(
    `UPDATE tenants SET nome = $1, razao_social = $2, tipo_pessoa = $3, documento = $4, email = $5, telefone = $6,
            endereco = $7, logo_path = COALESCE($8, logo_path), updated_at = now()
      WHERE id = app_tenant_id()`,
    [input.nome, input.razao_social, input.tipo_pessoa, input.documento, input.email, input.telefone, input.endereco, logoPath ?? null]
  );
  await db.query(
    `UPDATE configuracoes_tenant SET validade_proposta_dias = $1, criancas_isentas_ate = $2, criancas_meia_ate = $3,
            espaco_padrao_id = $4, assinatura_nome = $5, assinatura_cargo = $6, assinatura_telefone = $7, updated_at = now()
      WHERE tenant_id = app_tenant_id()`,
    [
      input.validade_proposta_dias,
      input.criancas_isentas_ate,
      input.criancas_meia_ate,
      input.espaco_padrao_id,
      input.assinatura_nome,
      input.assinatura_cargo,
      input.assinatura_telefone,
    ]
  );
}

export async function removerLogo(db: Db): Promise<string | null> {
  const { rows } = await db.query<{ logo_path: string | null }>(
    'UPDATE tenants t SET logo_path = NULL FROM tenants old WHERE t.id = old.id AND t.id = app_tenant_id() RETURNING old.logo_path'
  );
  return rows[0]?.logo_path ?? null;
}

