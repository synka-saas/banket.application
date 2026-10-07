// Conta Google do usuário (login e agenda). Como `usuarios`, a conta é global: roda na conexão de sistema
// (usuario_google tem RLS forçado sem política). Tokens guardados cifrados (lib/cripto.ts).
import crypto from 'node:crypto';
import { systemQuery, withSystem } from '../lib/db';
import { cifrar, decifrar } from '../lib/cripto';
import { UserError } from '../lib/forms';
import {
  GoogleApiError,
  perfilGoogle,
  renovarAccessToken,
  revogarToken,
  temEscopoAgenda,
  type PerfilGoogle,
  type TokensGoogle,
} from '../lib/google';
import { sessaoDoUsuario, type ResultadoLogin } from './autoatendimento';

export interface ContaGoogle {
  email: string;
  nome: string | null;
  agenda_ativa: boolean;
}

export async function contaGoogleDoUsuario(usuarioId: string): Promise<ContaGoogle | null> {
  const { rows } = await systemQuery<ContaGoogle>('SELECT email, nome, agenda_ativa FROM usuario_google WHERE usuario_id = $1', [usuarioId]);
  return rows[0] ?? null;
}

/** O usuário pode agendar reuniões? (conta vinculada com o escopo da agenda e refresh token guardado) */
export async function agendaAtiva(usuarioId: string): Promise<boolean> {
  const { rows } = await systemQuery<{ ok: boolean }>(
    'SELECT agenda_ativa AND refresh_token IS NOT NULL AS ok FROM usuario_google WHERE usuario_id = $1',
    [usuarioId]
  );
  return Boolean(rows[0]?.ok);
}

/** Grava (ou atualiza) o vínculo com os tokens recebidos; o refresh token só é trocado quando o Google manda um novo. */
async function gravarVinculo(usuarioId: string, perfil: PerfilGoogle, tokens: TokensGoogle): Promise<void> {
  const expira = new Date(Date.now() + Math.max(0, tokens.expires_in - 30) * 1000);
  const comAgenda = temEscopoAgenda(tokens.scope);
  await systemQuery(
    `INSERT INTO usuario_google (usuario_id, google_sub, email, nome, refresh_token, access_token, access_expira_em, escopos, agenda_ativa)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (usuario_id) DO UPDATE SET
       google_sub = EXCLUDED.google_sub,
       email = EXCLUDED.email,
       nome = EXCLUDED.nome,
       refresh_token = COALESCE(EXCLUDED.refresh_token, usuario_google.refresh_token),
       access_token = EXCLUDED.access_token,
       access_expira_em = EXCLUDED.access_expira_em,
       escopos = EXCLUDED.escopos,
       agenda_ativa = EXCLUDED.agenda_ativa AND COALESCE(EXCLUDED.refresh_token, usuario_google.refresh_token) IS NOT NULL,
       updated_at = now()`,
    [
      usuarioId,
      perfil.sub,
      perfil.email,
      perfil.name,
      tokens.refresh_token ? cifrar(tokens.refresh_token) : null,
      cifrar(tokens.access_token),
      expira,
      tokens.scope,
      comAgenda && Boolean(tokens.refresh_token),
    ]
  );
}

/**
 * Login com o Google: encontra a conta pelo `sub`, senão pelo e-mail (confirmado pelo Google), senão cria uma
 * conta nova (senha aleatória; o e-mail já nasce verificado). Devolve o mesmo resultado do login por senha.
 */
export async function entrarComGoogle(tokens: TokensGoogle): Promise<ResultadoLogin> {
  const perfil = await perfilGoogle(tokens.access_token);
  if (!perfil.email_verified) throw new UserError('O Google não confirmou este e-mail. Use outra conta Google.');

  const usuario = await withSystem(async (db) => {
    const porSub = await db.query<{ id: string; nome: string; email: string }>(
      'SELECT u.id, u.nome, u.email FROM usuario_google g JOIN usuarios u ON u.id = g.usuario_id WHERE g.google_sub = $1',
      [perfil.sub]
    );
    if (porSub.rows[0]) return porSub.rows[0];
    const porEmail = await db.query<{ id: string; nome: string; email: string; vinculado: boolean }>(
      `SELECT u.id, u.nome, u.email, g.usuario_id IS NOT NULL AS vinculado
         FROM usuarios u LEFT JOIN usuario_google g ON g.usuario_id = u.id
        WHERE lower(u.email) = $1 FOR UPDATE OF u`,
      [perfil.email]
    );
    if (porEmail.rows[0]) {
      if (porEmail.rows[0].vinculado) throw new UserError('Este e-mail já está vinculado a outra conta Google. Entre com e-mail e senha.');
      // Quem comprova o e-mail pelo Google está com a conta confirmada
      await db.query('UPDATE usuarios SET email_verificado_em = COALESCE(email_verificado_em, now()), updated_at = now() WHERE id = $1', [porEmail.rows[0].id]);
      return porEmail.rows[0];
    }
    const nome = (perfil.name ?? perfil.email.split('@')[0]).slice(0, 255);
    const novo = await db.query<{ id: string; nome: string; email: string }>(
      `INSERT INTO usuarios (nome, email, senha_hash, email_verificado_em)
       VALUES ($1, $2, crypt($3, gen_salt('bf')), now()) RETURNING id, nome, email`,
      [nome, perfil.email, crypto.randomBytes(32).toString('base64url')]
    );
    return novo.rows[0];
  });

  await gravarVinculo(usuario.id, perfil, tokens);
  const sessao = await sessaoDoUsuario(usuario.id);
  if (sessao) return { tipo: 'sessao', usuario: sessao };
  const { rows: vinculos } = await systemQuery('SELECT 1 FROM tenant_usuarios WHERE usuario_id = $1', [usuario.id]);
  if (vinculos.length) return { tipo: 'invalido' };
  return { tipo: 'onboarding', usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email } };
}

/** Vincula (ou reativa a agenda de) uma conta Google ao usuário logado. */
export async function vincularGoogle(usuarioId: string, tokens: TokensGoogle): Promise<ContaGoogle> {
  const perfil = await perfilGoogle(tokens.access_token);
  if (!perfil.email_verified) throw new UserError('O Google não confirmou este e-mail. Use outra conta Google.');
  const { rows } = await systemQuery<{ usuario_id: string }>('SELECT usuario_id FROM usuario_google WHERE google_sub = $1', [perfil.sub]);
  if (rows[0] && rows[0].usuario_id !== usuarioId) throw new UserError('Esta conta Google já está vinculada a outro usuário do Banket.');
  await gravarVinculo(usuarioId, perfil, tokens);
  return (await contaGoogleDoUsuario(usuarioId))!;
}

export async function desvincularGoogle(usuarioId: string): Promise<void> {
  const { rows } = await systemQuery<{ refresh_token: string | null; access_token: string | null }>(
    'DELETE FROM usuario_google WHERE usuario_id = $1 RETURNING refresh_token, access_token',
    [usuarioId]
  );
  const token = decifrar(rows[0]?.refresh_token) ?? decifrar(rows[0]?.access_token);
  if (token) await revogarToken(token);
}

/**
 * Access token válido para a agenda do usuário (renovado pelo refresh token quando vence).
 * Refresh token revogado/perdido desativa a agenda e pede para reconectar.
 */
export async function accessTokenAgenda(usuarioId: string): Promise<string> {
  const { rows } = await systemQuery<{ access_token: string | null; refresh_token: string | null; access_expira_em: Date | null; agenda_ativa: boolean }>(
    'SELECT access_token, refresh_token, access_expira_em, agenda_ativa FROM usuario_google WHERE usuario_id = $1',
    [usuarioId]
  );
  const c = rows[0];
  const refresh = decifrar(c?.refresh_token);
  if (!c || !c.agenda_ativa || !refresh) {
    throw new UserError('A agenda do Google não está ativa para este usuário. Ative em Minha conta › Conta Google.');
  }
  const atual = decifrar(c.access_token);
  if (atual && c.access_expira_em && c.access_expira_em.getTime() > Date.now() + 60_000) return atual;
  try {
    const t = await renovarAccessToken(refresh);
    await systemQuery('UPDATE usuario_google SET access_token = $2, access_expira_em = $3, updated_at = now() WHERE usuario_id = $1', [
      usuarioId,
      cifrar(t.access_token),
      new Date(Date.now() + Math.max(0, t.expires_in - 30) * 1000),
    ]);
    return t.access_token;
  } catch (err) {
    if (err instanceof GoogleApiError && (err.codigo === 'invalid_grant' || err.status === 400 || err.status === 401)) {
      await systemQuery('UPDATE usuario_google SET agenda_ativa = false, refresh_token = NULL, updated_at = now() WHERE usuario_id = $1', [usuarioId]);
      throw new UserError('O acesso à agenda do Google expirou ou foi revogado. Reative em Minha conta › Conta Google.');
    }
    throw err;
  }
}
