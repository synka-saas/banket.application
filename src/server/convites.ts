// Aceite de convite. Roda na conexão de sistema: quem aceita ainda não tem sessão/tenant.
import { systemQuery, withSystem } from '../lib/db';
import { normalizeRole, type SessionUser } from '../lib/auth';
import { UserError } from '../lib/forms';
import { validarSenha } from '../lib/senha';
import { hashToken } from '../lib/tokens';

export interface ConviteValido {
  email: string;
  nome: string;
  empresa: string;
  contaExistente: boolean;
}

export async function buscarConvite(token: string | null): Promise<ConviteValido | null> {
  if (!token) return null;
  const { rows } = await systemQuery<{ email: string; nome: string; empresa: string; conta: boolean }>(
    `SELECT t.email, t.payload->>'nome' AS nome, tn.nome AS empresa,
            EXISTS (SELECT 1 FROM usuarios u WHERE lower(u.email) = lower(t.email)) AS conta
       FROM auth_tokens t JOIN tenants tn ON tn.id = t.tenant_id
      WHERE t.token_hash = $1 AND t.tipo = 'convite' AND t.usado_em IS NULL AND t.expira_em > now()`,
    [hashToken(token)]
  );
  const r = rows[0];
  return r ? { email: r.email, nome: r.nome, empresa: r.empresa, contaExistente: r.conta } : null;
}

export async function aceitarConvite(
  token: string,
  dados: { nome?: string; senha: string; confirmacao?: string }
): Promise<SessionUser> {
  return withSystem(async (db) => {
    const { rows } = await db.query<{ id: string; email: string; tenant_id: string; payload: { role?: string } }>(
      `SELECT id, email, tenant_id, payload FROM auth_tokens
        WHERE token_hash = $1 AND tipo = 'convite' AND usado_em IS NULL AND expira_em > now()
        FOR UPDATE`,
      [hashToken(token)]
    );
    const convite = rows[0];
    if (!convite) throw new UserError('Este convite é inválido ou expirou. Peça um novo convite ao administrador.');

    const { rows: existentes } = await db.query<{ id: string; nome: string; ok: boolean }>(
      'SELECT id, nome, senha_hash = crypt($2, senha_hash) AS ok FROM usuarios WHERE lower(email) = lower($1)',
      [convite.email, dados.senha]
    );

    let usuario: { id: string; nome: string };
    if (existentes[0]) {
      if (!existentes[0].ok) throw new UserError('Senha incorreta.');
      usuario = existentes[0];
    } else {
      const nome = dados.nome?.trim();
      if (!nome) throw new UserError('Informe seu nome.');
      const erroSenha = validarSenha(dados.senha, dados.confirmacao);
      if (erroSenha) throw new UserError(erroSenha);
      const { rows: novo } = await db.query<{ id: string; nome: string }>(
        `INSERT INTO usuarios (nome, email, senha_hash, email_verificado_em)
         VALUES ($1, lower($2), crypt($3, gen_salt('bf')), now()) RETURNING id, nome`,
        [nome, convite.email, dados.senha]
      );
      usuario = novo[0];
    }

    const role = normalizeRole(convite.payload.role);
    await db.query(
      `INSERT INTO tenant_usuarios (tenant_id, usuario_id, role, ativo) VALUES ($1, $2, $3, true)
       ON CONFLICT (tenant_id, usuario_id) DO UPDATE SET role = EXCLUDED.role, ativo = true`,
      [convite.tenant_id, usuario.id, role]
    );
    await db.query('UPDATE auth_tokens SET usado_em = now(), usuario_id = $1 WHERE id = $2', [usuario.id, convite.id]);

    return { id: usuario.id, nome: usuario.nome, email: convite.email, tenantId: convite.tenant_id, role };
  });
}
