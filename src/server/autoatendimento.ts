// Cadastro self-service e acesso: criação de conta, verificação de e-mail, empresa (tenant) nova,
// recuperação de senha, link de acesso por e-mail e troca de empresa.
// Tudo aqui roda na conexão de sistema: quem chama ainda não tem sessão (ou ainda não tem empresa).
import { z } from 'zod';
import { systemQuery, withSystem, type Db } from '../lib/db';
import { normalizeRole, type OnboardingUser, type Role, type SessionUser } from '../lib/auth';
import { UserError, requiredText } from '../lib/forms';
import { validarSenha } from '../lib/senha';
import { generateToken, hashToken } from '../lib/tokens';
import { cnpjValido, cpfValido, somenteDigitos } from '../lib/documento';
import { appUrl, sendMail } from '../lib/mail';
import { emailLayout } from './emails';

type TipoToken = 'verificacao_email' | 'reset_senha' | 'link_acesso';

const VALIDADE: Record<TipoToken, string> = {
  verificacao_email: '24 hours',
  reset_senha: '1 hour',
  link_acesso: '15 minutes',
};

/** Emite um token de uso único (invalida os anteriores do mesmo tipo) e devolve o valor em claro para o link. */
async function emitirToken(db: Db, tipo: TipoToken, usuarioId: string, email: string): Promise<string> {
  await db.query(
    `UPDATE auth_tokens SET usado_em = now() WHERE usuario_id = $1 AND tipo = $2 AND usado_em IS NULL`,
    [usuarioId, tipo]
  );
  const token = generateToken();
  await db.query(
    `INSERT INTO auth_tokens (tipo, token_hash, email, usuario_id, expira_em)
     VALUES ($1, $2, lower($3), $4, now() + $5::interval)`,
    [tipo, hashToken(token), email, usuarioId, VALIDADE[tipo]]
  );
  return token;
}

/** Consome um token válido (uso único) e devolve o usuário dono dele. */
async function consumirToken(db: Db, tipo: TipoToken, token: string | null) {
  if (!token) return null;
  const { rows } = await db.query<{ id: string; usuario_id: string; email: string }>(
    `UPDATE auth_tokens SET usado_em = now()
      WHERE token_hash = $1 AND tipo = $2 AND usado_em IS NULL AND expira_em > now()
      RETURNING id, usuario_id, email`,
    [hashToken(token), tipo]
  );
  return rows[0] ?? null;
}

async function enviarVerificacao(nome: string, email: string, token: string) {
  const { html, text } = emailLayout({
    titulo: 'Confirme seu e-mail',
    paragrafos: [
      `Olá, ${nome.split(' ')[0]}!`,
      'Falta pouco para começar a usar o Banket. Confirme seu e-mail para ativar a conta e cadastrar sua empresa.',
      'O link vale por 24 horas.',
    ],
    cta: { texto: 'Confirmar e-mail', url: appUrl(`/auth/verificar?token=${token}`) },
    rodape: 'Se você não criou uma conta no Banket, ignore este e-mail.',
  });
  await sendMail({ to: email, subject: 'Confirme seu e-mail no Banket', html, text });
}

// ---------------------------------------------------------------------------
// Cadastro de conta
// ---------------------------------------------------------------------------
export const cadastroSchema = z
  .object({
    nome: requiredText('Informe seu nome e sobrenome.', 255),
    email: z.preprocess((v) => (typeof v === 'string' ? v.trim().toLowerCase() : v), z.email('E-mail inválido.')),
    senha: z.string({ error: 'Informe a senha.' }),
    confirma_senha: z.string({ error: 'Confirme a senha.' }),
    termos: z.literal('on', { error: 'É preciso aceitar os Termos e Condições de Uso.' }),
  })
  .superRefine((d, ctx) => {
    if (d.nome.split(/\s+/).length < 2) ctx.addIssue({ code: 'custom', message: 'Informe nome e sobrenome.' });
    const erro = validarSenha(d.senha, d.confirma_senha);
    if (erro) ctx.addIssue({ code: 'custom', message: erro });
  });

export async function cadastrarConta(input: z.infer<typeof cadastroSchema>): Promise<void> {
  const { usuario, token } = await withSystem(async (db) => {
    const { rows } = await db.query<{ id: string; verificado: boolean }>(
      'SELECT id, email_verificado_em IS NOT NULL AS verificado FROM usuarios WHERE lower(email) = $1 FOR UPDATE',
      [input.email]
    );
    let id: string;
    if (rows[0]?.verificado) {
      throw new UserError('Já existe uma conta com este e-mail. Faça login ou recupere sua senha.');
    } else if (rows[0]) {
      // Cadastro anterior nunca confirmado: atualiza os dados e reenvia a confirmação
      id = rows[0].id;
      await db.query(`UPDATE usuarios SET nome = $2, senha_hash = crypt($3, gen_salt('bf')), updated_at = now() WHERE id = $1`, [
        id,
        input.nome,
        input.senha,
      ]);
    } else {
      const novo = await db.query<{ id: string }>(
        `INSERT INTO usuarios (nome, email, senha_hash) VALUES ($1, $2, crypt($3, gen_salt('bf'))) RETURNING id`,
        [input.nome, input.email, input.senha]
      );
      id = novo.rows[0].id;
    }
    return { usuario: { id, nome: input.nome, email: input.email }, token: await emitirToken(db, 'verificacao_email', id, input.email) };
  });
  await enviarVerificacao(usuario.nome, usuario.email, token);
}

/** Reenvia a confirmação. Não revela se o e-mail existe. */
export async function reenviarVerificacao(email: string): Promise<void> {
  const dados = await withSystem(async (db) => {
    const { rows } = await db.query<{ id: string; nome: string; email: string }>(
      'SELECT id, nome, email FROM usuarios WHERE lower(email) = lower($1) AND email_verificado_em IS NULL',
      [email.trim()]
    );
    if (!rows[0]) return null;
    return { ...rows[0], token: await emitirToken(db, 'verificacao_email', rows[0].id, rows[0].email) };
  });
  if (dados) await enviarVerificacao(dados.nome, dados.email, dados.token);
}

/** Confirma o e-mail pelo link. Devolve o usuário para seguir ao onboarding (ou null se o link não vale). */
export async function verificarEmail(token: string | null): Promise<OnboardingUser | null> {
  return withSystem(async (db) => {
    const t = await consumirToken(db, 'verificacao_email', token);
    if (!t) return null;
    const { rows } = await db.query<OnboardingUser>(
      `UPDATE usuarios SET email_verificado_em = COALESCE(email_verificado_em, now()), updated_at = now()
        WHERE id = $1 RETURNING id, nome, email`,
      [t.usuario_id]
    );
    return rows[0] ?? null;
  });
}

// ---------------------------------------------------------------------------
// Login e sessão
// ---------------------------------------------------------------------------
export type ResultadoLogin =
  | { tipo: 'sessao'; usuario: SessionUser }
  | { tipo: 'onboarding'; usuario: OnboardingUser }
  | { tipo: 'nao_verificado'; email: string }
  | { tipo: 'invalido' };

/** Primeira empresa ativa do usuário (ou a indicada, se ele pertencer a ela). */
export async function sessaoDoUsuario(usuarioId: string, tenantId?: string): Promise<SessionUser | null> {
  const { rows } = await systemQuery<{ id: string; nome: string; email: string; tenant_id: string; role: string }>(
    `SELECT u.id, u.nome, u.email, tu.tenant_id, tu.role
       FROM usuarios u JOIN tenant_usuarios tu ON tu.usuario_id = u.id
      WHERE u.id = $1 AND tu.ativo AND ($2::uuid IS NULL OR tu.tenant_id = $2::uuid)
      ORDER BY tu.created_at LIMIT 1`,
    [usuarioId, tenantId ?? null]
  );
  const r = rows[0];
  return r ? { id: r.id, nome: r.nome, email: r.email, tenantId: r.tenant_id, role: normalizeRole(r.role) } : null;
}

export async function autenticar(email: string, senha: string): Promise<ResultadoLogin> {
  const { rows } = await systemQuery<{ id: string; nome: string; email: string; verificado: boolean }>(
    `SELECT id, nome, email, email_verificado_em IS NOT NULL AS verificado
       FROM usuarios WHERE lower(email) = lower($1) AND senha_hash = crypt($2, senha_hash)`,
    [email.trim(), senha]
  );
  const u = rows[0];
  if (!u) return { tipo: 'invalido' };
  if (!u.verificado) return { tipo: 'nao_verificado', email: u.email };
  const sessao = await sessaoDoUsuario(u.id);
  if (sessao) return { tipo: 'sessao', usuario: sessao };
  // Conta sem empresa ativa: ainda não concluiu o cadastro (ou foi removida de todas as empresas)
  const { rows: vinculos } = await systemQuery('SELECT 1 FROM tenant_usuarios WHERE usuario_id = $1', [u.id]);
  if (vinculos.length) return { tipo: 'invalido' };
  return { tipo: 'onboarding', usuario: { id: u.id, nome: u.nome, email: u.email } };
}

export interface EmpresaDoUsuario {
  id: string;
  nome: string;
  role: Role;
}

const cacheEmpresas = new Map<string, { valor: EmpresaDoUsuario[]; expira: number }>();

/** Empresas ativas do usuário (para o seletor do topo). Cache curto em memória. */
export async function empresasDoUsuario(usuarioId: string): Promise<EmpresaDoUsuario[]> {
  const hit = cacheEmpresas.get(usuarioId);
  if (hit && hit.expira > Date.now()) return hit.valor;
  const { rows } = await systemQuery<{ id: string; nome: string; role: string }>(
    `SELECT t.id, t.nome, tu.role FROM tenant_usuarios tu JOIN tenants t ON t.id = tu.tenant_id
      WHERE tu.usuario_id = $1 AND tu.ativo ORDER BY lower(t.nome)`,
    [usuarioId]
  );
  const valor = rows.map((r) => ({ id: r.id, nome: r.nome, role: normalizeRole(r.role) }));
  cacheEmpresas.set(usuarioId, { valor, expira: Date.now() + 30_000 });
  return valor;
}

export function invalidarEmpresas(usuarioId: string) {
  cacheEmpresas.delete(usuarioId);
}

// ---------------------------------------------------------------------------
// Empresa nova (cadastro complementar)
// ---------------------------------------------------------------------------
export const empresaNovaSchema = z
  .object({
    tipo_pessoa: z.enum(['PF', 'PJ'], { error: 'Selecione o tipo de conta.' }),
    celular: z.preprocess(
      (v) => (typeof v === 'string' ? somenteDigitos(v) : v),
      z.string({ error: 'Informe o celular.' }).regex(/^\d{10,11}$/, 'Celular inválido: informe DDD + número.')
    ),
    cpf: z.preprocess((v) => (typeof v === 'string' ? somenteDigitos(v) : ''), z.string()),
    cnpj: z.preprocess((v) => (typeof v === 'string' ? somenteDigitos(v) : ''), z.string()),
    razao_social: z.preprocess((v) => (typeof v === 'string' ? v.trim() : ''), z.string().max(255)),
    nome_empresa: z.preprocess((v) => (typeof v === 'string' ? v.trim() : ''), z.string().max(255)),
    endereco: requiredText('Informe o endereço comercial.', 500),
  })
  .superRefine((d, ctx) => {
    if (d.tipo_pessoa === 'PJ') {
      if (!d.razao_social) ctx.addIssue({ code: 'custom', message: 'Informe a razão social.' });
      if (!cnpjValido(d.cnpj)) ctx.addIssue({ code: 'custom', message: 'CNPJ inválido.' });
    } else if (!cpfValido(d.cpf)) {
      ctx.addIssue({ code: 'custom', message: 'CPF inválido.' });
    }
  });

export function slugify(texto: string): string {
  return (
    texto
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'empresa'
  );
}

export async function criarEmpresa(usuario: OnboardingUser, input: z.infer<typeof empresaNovaSchema>): Promise<SessionUser> {
  return withSystem(async (db) => {
    const { rows: u } = await db.query<{ nome: string; email: string; verificado: boolean }>(
      'SELECT nome, email, email_verificado_em IS NOT NULL AS verificado FROM usuarios WHERE id = $1 FOR UPDATE',
      [usuario.id]
    );
    if (!u[0]?.verificado) throw new UserError('Confirme seu e-mail antes de cadastrar a empresa.');
    const { rows: vinculos } = await db.query('SELECT 1 FROM tenant_usuarios WHERE usuario_id = $1', [usuario.id]);
    if (vinculos.length) throw new UserError('Sua conta já está vinculada a uma empresa. Faça login.');

    const documento = input.tipo_pessoa === 'PJ' ? input.cnpj : input.cpf;
    const { rows: existente } = await db.query('SELECT 1 FROM tenants WHERE documento = $1', [documento]);
    if (existente.length) {
      throw new UserError(
        `Já existe uma empresa cadastrada com este ${input.tipo_pessoa === 'PJ' ? 'CNPJ' : 'CPF'}. Peça ao administrador dela um convite de acesso.`
      );
    }

    const nome = input.nome_empresa || (input.tipo_pessoa === 'PJ' ? input.razao_social : u[0].nome);
    const base = slugify(nome);
    const { rows: usados } = await db.query<{ slug: string }>(`SELECT slug FROM tenants WHERE slug = $1 OR slug LIKE $1 || '-%'`, [base]);
    let slug = base;
    for (let i = 2; usados.some((r) => r.slug === slug); i++) slug = `${base}-${i}`;

    const { rows: t } = await db.query<{ id: string }>(
      `INSERT INTO tenants (nome, slug, tipo_pessoa, documento, razao_social, email, telefone, endereco, onboarding_completo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true) RETURNING id`,
      [nome, slug, input.tipo_pessoa, documento, input.tipo_pessoa === 'PJ' ? input.razao_social : null, u[0].email, input.celular, input.endereco]
    );
    const tenantId = t[0].id;
    // Padrões da empresa: status do Kanban, tipos, formatos, categorias, faixas, template e blocos da proposta
    await db.query('SELECT aplicar_padroes_tenant_completo($1)', [tenantId]);
    await db.query(
      `INSERT INTO configuracoes_tenant (tenant_id, assinatura_nome, assinatura_cargo, assinatura_telefone)
       VALUES ($1, $2, 'Proprietário', $3)
       ON CONFLICT (tenant_id) DO UPDATE SET assinatura_nome = EXCLUDED.assinatura_nome,
         assinatura_cargo = EXCLUDED.assinatura_cargo, assinatura_telefone = EXCLUDED.assinatura_telefone`,
      [tenantId, u[0].nome, input.celular]
    );
    await db.query(`INSERT INTO tenant_usuarios (tenant_id, usuario_id, role, ativo) VALUES ($1, $2, 'owner', true)`, [
      tenantId,
      usuario.id,
    ]);
    await db.query('UPDATE usuarios SET telefone = $2, updated_at = now() WHERE id = $1', [usuario.id, input.celular]);
    invalidarEmpresas(usuario.id);
    return { id: usuario.id, nome: u[0].nome, email: u[0].email, tenantId, role: 'owner' };
  });
}

// ---------------------------------------------------------------------------
// Recuperação de senha e link de acesso
// ---------------------------------------------------------------------------

/** Envia o link de redefinição. Não revela se o e-mail existe. */
export async function solicitarRecuperacao(email: string): Promise<void> {
  const dados = await withSystem(async (db) => {
    const { rows } = await db.query<{ id: string; nome: string; email: string }>(
      'SELECT id, nome, email FROM usuarios WHERE lower(email) = lower($1)',
      [email.trim()]
    );
    if (!rows[0]) return null;
    return { ...rows[0], token: await emitirToken(db, 'reset_senha', rows[0].id, rows[0].email) };
  });
  if (!dados) return;
  const { html, text } = emailLayout({
    titulo: 'Redefinição de senha',
    paragrafos: [
      `Olá, ${dados.nome.split(' ')[0]}!`,
      'Recebemos um pedido para redefinir a senha da sua conta no Banket. O link vale por 1 hora.',
    ],
    cta: { texto: 'Criar nova senha', url: appUrl(`/auth/redefinir?token=${dados.token}`) },
    rodape: 'Se você não pediu a redefinição, ignore este e-mail: sua senha continua a mesma.',
  });
  await sendMail({ to: dados.email, subject: 'Redefinição de senha do Banket', html, text });
}

/** O link de redefinição ainda vale? (sem consumir) */
export async function tokenResetValido(token: string | null): Promise<string | null> {
  if (!token) return null;
  const { rows } = await systemQuery<{ email: string }>(
    `SELECT email FROM auth_tokens WHERE token_hash = $1 AND tipo = 'reset_senha' AND usado_em IS NULL AND expira_em > now()`,
    [hashToken(token)]
  );
  return rows[0]?.email ?? null;
}

export async function redefinirSenha(token: string | null, senha: string, confirmacao: string): Promise<string> {
  const erro = validarSenha(senha, confirmacao);
  if (erro) throw new UserError(erro);
  return withSystem(async (db) => {
    const t = await consumirToken(db, 'reset_senha', token);
    if (!t) throw new UserError('Este link é inválido ou expirou. Peça uma nova redefinição de senha.');
    // Quem recebeu o link comprovou o e-mail
    await db.query(
      `UPDATE usuarios SET senha_hash = crypt($2, gen_salt('bf')), email_verificado_em = COALESCE(email_verificado_em, now()),
              updated_at = now() WHERE id = $1`,
      [t.usuario_id, senha]
    );
    await db.query(`UPDATE auth_tokens SET usado_em = now() WHERE usuario_id = $1 AND tipo IN ('reset_senha', 'link_acesso') AND usado_em IS NULL`, [
      t.usuario_id,
    ]);
    return t.email;
  });
}

/** Envia um link de acesso sem senha (só para contas confirmadas). Não revela se o e-mail existe. */
export async function solicitarLinkAcesso(email: string): Promise<void> {
  const dados = await withSystem(async (db) => {
    const { rows } = await db.query<{ id: string; nome: string; email: string }>(
      'SELECT id, nome, email FROM usuarios WHERE lower(email) = lower($1) AND email_verificado_em IS NOT NULL',
      [email.trim()]
    );
    if (!rows[0]) return null;
    return { ...rows[0], token: await emitirToken(db, 'link_acesso', rows[0].id, rows[0].email) };
  });
  if (!dados) return;
  const { html, text } = emailLayout({
    titulo: 'Seu link de acesso',
    paragrafos: [`Olá, ${dados.nome.split(' ')[0]}!`, 'Use o botão abaixo para entrar no Banket. O link vale por 15 minutos e só pode ser usado uma vez.'],
    cta: { texto: 'Entrar no Banket', url: appUrl(`/auth/entrar?token=${dados.token}`) },
    rodape: 'Se você não pediu este link, ignore este e-mail.',
  });
  await sendMail({ to: dados.email, subject: 'Seu link de acesso ao Banket', html, text });
}

export async function entrarComLink(token: string | null): Promise<ResultadoLogin> {
  const t = await withSystem((db) => consumirToken(db, 'link_acesso', token));
  if (!t) return { tipo: 'invalido' };
  const sessao = await sessaoDoUsuario(t.usuario_id);
  if (sessao) return { tipo: 'sessao', usuario: sessao };
  const { rows } = await systemQuery<OnboardingUser>('SELECT id, nome, email FROM usuarios WHERE id = $1', [t.usuario_id]);
  return rows[0] ? { tipo: 'onboarding', usuario: rows[0] } : { tipo: 'invalido' };
}
