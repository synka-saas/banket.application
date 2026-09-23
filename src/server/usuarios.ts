// Gestão dos usuários da empresa: papéis, ativação e convites.
import { z } from 'zod';
import type { Db } from '../lib/db';
import { ROLE_LABELS, type Role, type SessionUser } from '../lib/auth';
import { UserError, checkbox, requiredText } from '../lib/forms';
import { appUrl, sendMail } from '../lib/mail';
import { invalidateMembership } from '../lib/membership';
import { generateToken, hashToken } from '../lib/tokens';
import type { PageParams } from '../lib/pagination';
import { emailLayout } from './emails';

export const CONVITE_VALIDADE_DIAS = 7;

const roleEnum = z.enum(['owner', 'admin', 'usuario'], { error: 'Selecione o papel do usuário.' });

export const conviteSchema = z.object({
  nome: requiredText('Informe o nome da pessoa convidada.'),
  email: z.preprocess((v) => (typeof v === 'string' ? v.trim().toLowerCase() : v), z.email('E-mail inválido.')),
  role: roleEnum,
});

export const membroSchema = z.object({
  role: roleEnum,
  ativo: checkbox(),
});

export interface MembroRow {
  id: string;
  nome: string;
  email: string;
  role: Role;
  ativo: boolean;
  created_at: Date;
}

export interface ConviteRow {
  id: string;
  email: string;
  nome: string;
  role: Role;
  expira_em: Date;
  created_at: Date;
}

/** Papéis que o usuário logado pode atribuir. */
export function papeisAtribuiveis(actor: Pick<SessionUser, 'role'>): Role[] {
  return actor.role === 'owner' ? ['owner', 'admin', 'usuario'] : ['admin', 'usuario'];
}

export async function listarMembros(
  db: Db,
  filtros: { busca: string | null; papel: string | null },
  page: PageParams
): Promise<{ rows: MembroRow[]; total: number }> {
  const params = [filtros.busca, filtros.papel || null];
  const where = `WHERE ($1::text IS NULL OR u.nome ILIKE $1 OR u.email ILIKE $1) AND ($2::text IS NULL OR tu.role = $2)`;
  const { rows } = await db.query<MembroRow>(
    `SELECT u.id, u.nome, u.email, tu.role, tu.ativo, tu.created_at
       FROM tenant_usuarios tu JOIN usuarios u ON u.id = tu.usuario_id
       ${where}
      ORDER BY tu.ativo DESC, lower(u.nome)
      LIMIT $3 OFFSET $4`,
    [...params, page.pageSize, page.offset]
  );
  const count = await db.query<{ total: number }>(
    `SELECT count(*) AS total FROM tenant_usuarios tu JOIN usuarios u ON u.id = tu.usuario_id ${where}`,
    params
  );
  return { rows, total: count.rows[0].total };
}

export async function listarConvitesPendentes(db: Db): Promise<ConviteRow[]> {
  const { rows } = await db.query<ConviteRow>(
    `SELECT id, email, payload->>'nome' AS nome, payload->>'role' AS role, expira_em, created_at
       FROM auth_tokens
      WHERE tipo = 'convite' AND usado_em IS NULL
      ORDER BY created_at DESC`
  );
  return rows;
}

async function carregarMembro(db: Db, usuarioId: string) {
  const { rows } = await db.query<{ role: Role; ativo: boolean }>(
    'SELECT role, ativo FROM tenant_usuarios WHERE usuario_id = $1',
    [usuarioId]
  );
  if (!rows[0]) throw new UserError('Usuário não encontrado.');
  return rows[0];
}

async function garantirOutroProprietario(db: Db, usuarioId: string) {
  const { rows } = await db.query<{ n: number }>(
    `SELECT count(*) AS n FROM tenant_usuarios WHERE role = 'owner' AND ativo AND usuario_id <> $1`,
    [usuarioId]
  );
  if (!rows[0].n) throw new UserError('A empresa precisa de pelo menos um proprietário ativo.');
}

function exigirPermissaoSobre(actor: SessionUser, alvo: { role: Role }, novoRole?: Role) {
  if (actor.role !== 'owner' && (alvo.role === 'owner' || novoRole === 'owner')) {
    throw new UserError('Apenas proprietários podem gerenciar outros proprietários.');
  }
}

export async function atualizarMembro(db: Db, actor: SessionUser, usuarioId: string, input: z.infer<typeof membroSchema>) {
  if (usuarioId === actor.id && (input.role !== actor.role || !input.ativo)) {
    throw new UserError('Você não pode alterar o próprio papel nem desativar a si mesmo.');
  }
  const atual = await carregarMembro(db, usuarioId);
  exigirPermissaoSobre(actor, atual, input.role);
  if (atual.role === 'owner' && (input.role !== 'owner' || !input.ativo)) {
    await garantirOutroProprietario(db, usuarioId);
  }
  await db.query('UPDATE tenant_usuarios SET role = $1, ativo = $2 WHERE usuario_id = $3', [input.role, input.ativo, usuarioId]);
  invalidateMembership(usuarioId, actor.tenantId);
}

export async function removerMembro(db: Db, actor: SessionUser, usuarioId: string) {
  if (usuarioId === actor.id) throw new UserError('Você não pode remover a si mesmo.');
  const atual = await carregarMembro(db, usuarioId);
  exigirPermissaoSobre(actor, atual);
  if (atual.role === 'owner') await garantirOutroProprietario(db, usuarioId);
  // Remove só o vínculo com a empresa: a conta pode pertencer a outras empresas.
  await db.query('DELETE FROM tenant_usuarios WHERE usuario_id = $1', [usuarioId]);
  invalidateMembership(usuarioId, actor.tenantId);
}

async function enviarEmailConvite(db: Db, email: string, nome: string, role: Role, token: string, remetente: string) {
  const { rows } = await db.query<{ nome: string }>('SELECT nome FROM tenants');
  const empresa = rows[0]?.nome ?? 'sua empresa';
  const { html, text } = emailLayout({
    titulo: `Você foi convidado para o Banket`,
    paragrafos: [
      `Olá, ${nome}!`,
      `${remetente} convidou você para acessar a ${empresa} no Banket como ${ROLE_LABELS[role].toLowerCase()}.`,
      `O convite é válido por ${CONVITE_VALIDADE_DIAS} dias.`,
    ],
    cta: { texto: 'Aceitar convite', url: appUrl(`/auth/cadastro-convidado?token=${token}`) },
  });
  await sendMail({ to: email, subject: `Convite para ${empresa} no Banket`, html, text });
}

export async function convidarUsuario(db: Db, actor: SessionUser, input: z.infer<typeof conviteSchema>) {
  if (!papeisAtribuiveis(actor).includes(input.role)) {
    throw new UserError('Apenas proprietários podem convidar outros proprietários.');
  }
  const { rows: membro } = await db.query(
    'SELECT 1 FROM tenant_usuarios tu JOIN usuarios u ON u.id = tu.usuario_id WHERE lower(u.email) = $1',
    [input.email]
  );
  if (membro.length) throw new UserError('Esta pessoa já faz parte da empresa.');

  const token = generateToken();
  // Substitui um convite pendente anterior para o mesmo e-mail
  await db.query(`DELETE FROM auth_tokens WHERE tipo = 'convite' AND usado_em IS NULL AND lower(email) = $1`, [input.email]);
  await db.query(
    `INSERT INTO auth_tokens (tipo, token_hash, email, tenant_id, payload, expira_em, criado_por)
     VALUES ('convite', $1, $2, app_tenant_id(), $3, now() + ($4 || ' days')::interval, $5)`,
    [hashToken(token), input.email, { nome: input.nome, role: input.role }, CONVITE_VALIDADE_DIAS, actor.id]
  );
  await enviarEmailConvite(db, input.email, input.nome, input.role, token, actor.nome);
}

export async function reenviarConvite(db: Db, actor: SessionUser, conviteId: string) {
  const token = generateToken();
  const { rows } = await db.query<{ email: string; nome: string; role: Role }>(
    `UPDATE auth_tokens SET token_hash = $1, expira_em = now() + ($2 || ' days')::interval
      WHERE id = $3 AND tipo = 'convite' AND usado_em IS NULL
      RETURNING email, payload->>'nome' AS nome, payload->>'role' AS role`,
    [hashToken(token), CONVITE_VALIDADE_DIAS, conviteId]
  );
  if (!rows[0]) throw new UserError('Convite não encontrado.');
  await enviarEmailConvite(db, rows[0].email, rows[0].nome, rows[0].role, token, actor.nome);
}

export async function cancelarConvite(db: Db, conviteId: string) {
  const res = await db.query(`DELETE FROM auth_tokens WHERE id = $1 AND tipo = 'convite' AND usado_em IS NULL`, [conviteId]);
  if (!res.rowCount) throw new UserError('Convite não encontrado.');
}
