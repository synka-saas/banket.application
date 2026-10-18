// Reivindicação dos perfis importados no Banket Busca (migration 038). Um perfil é "reivindicável" quando a empresa
// veio da importação e ainda não tem nenhum usuário. A atribuição de propriedade é SEMPRE manual:
//   1. o dono pede na vitrine (/para-buffets/reivindicar) para assumir ou remover o perfil (registrarPedido);
//   2. a equipe confere a posse pelos canais reais do perfil (e-mail, WhatsApp) em /equipe/reivindicacoes;
//   3. aprovada a posse: assumir → link de criação do acesso no e-mail conferido (aprovarAssumir → assumirPerfil);
//      remover → o perfil sai e a base não o traz de volta (aprovarRemocao, busca_exclusoes); ou recusa (recusar).
// Conexão de sistema: quem pede não tem sessão nem empresa, e as tabelas cruzam empresas (como convites.ts).
import { systemQuery, withLeituraPublica, withSystem, type Db } from '../../lib/db';
import { permitir } from '../../lib/rateLimit';
import { UserError } from '../../lib/forms';
import { validarSenha } from '../../lib/senha';
import { generateToken, hashToken } from '../../lib/tokens';
import { appUrl, sendMail } from '../../lib/mail';
import { invalidateTenant } from '../../lib/membership';
import { invalidar as invalidarPlano } from '../../lib/planos/gating';
import { buscaUrl } from '../../lib/busca/url';
import { emailLayout } from '../emails';
import type { SessionUser } from '../../lib/auth';

export type AcaoReivindicacao = 'assumir' | 'remover';
export type StatusReivindicacao = 'pendente' | 'aprovada' | 'concluida' | 'recusada';
export const VALIDADE_HORAS = 72;

// ---------------------------------------------------------------------------
// Equipe Banket (quem analisa): e-mails em BANKET_EQUIPE_EMAILS, separados por vírgula
// ---------------------------------------------------------------------------
export function ehEquipe(email: string | null | undefined): boolean {
  const lista = (process.env.BANKET_EQUIPE_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  return Boolean(email) && lista.includes(email!.toLowerCase());
}

// ---------------------------------------------------------------------------
// Vitrine: perfil e pedido
// ---------------------------------------------------------------------------
export interface PerfilReivindicavel {
  perfilId: string;
  tenantId: string;
  slug: string;
  nome: string;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  /** Empresa da importação ainda sem usuário */
  reivindicavel: boolean;
  /** Canais do perfil mascarados, para a pessoa saber por onde a equipe vai conferir */
  canais: string[];
  /** Já há um pedido em análise para este perfil */
  emAnalise: boolean;
}

/** "contato@buffet.com.br" → "c•••@buffet.com.br" */
export function mascararEmail(email: string): string {
  const [local, dominio] = email.split('@');
  return dominio ? `${local.slice(0, 1)}•••@${dominio}` : '•••';
}

/** "11987654321" → "(11) 9••••-4321" */
export function mascararTelefone(digitos: string): string {
  const d = digitos.replace(/\D/g, '');
  if (d.length < 10) return '•••';
  return `(${d.slice(0, 2)}) ${d.length === 11 ? '9' : ''}••••-${d.slice(-4)}`;
}

export async function perfilParaReivindicar(ref: string | null): Promise<PerfilReivindicavel | null> {
  const r0 = (ref ?? '').trim().toLowerCase();
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(r0)) return null;
  // Página pública: leitura pelo pool da vitrine (somente leitura), não pelas conexões de login/cadastro
  const { rows } = await withLeituraPublica((db) => db.query(
    `SELECT p.id, p.tenant_id, p.slug, p.nome, p.bairro, c.nome AS cidade, c.uf, p.email_contato, p.whatsapp, p.telefone,
            (t.origem_cadastro = 'importacao' AND NOT EXISTS (SELECT 1 FROM tenant_usuarios tu WHERE tu.tenant_id = t.id)) AS reivindicavel,
            EXISTS (SELECT 1 FROM busca_reivindicacoes r WHERE r.perfil_id = p.id AND r.status IN ('pendente', 'aprovada')) AS em_analise
       FROM busca_perfis p JOIN tenants t ON t.id = p.tenant_id LEFT JOIN busca_cidades c ON c.id = p.cidade_id
      WHERE (p.slug = $1 OR p.id::text = $1 OR $1 = ANY(p.slugs_antigos)) AND p.publicado AND t.status = 'active'
      LIMIT 1`,
    [r0]
  ));
  const r = rows[0];
  if (!r) return null;
  const canais = [
    r.email_contato && `e-mail ${mascararEmail(r.email_contato)}`,
    r.whatsapp && `WhatsApp ${mascararTelefone(r.whatsapp)}`,
    !r.whatsapp && r.telefone && `telefone ${mascararTelefone(r.telefone)}`,
  ].filter(Boolean) as string[];
  return {
    perfilId: r.id, tenantId: r.tenant_id, slug: r.slug, nome: r.nome, bairro: r.bairro, cidade: r.cidade, uf: r.uf,
    reivindicavel: r.reivindicavel, canais, emAnalise: r.em_analise,
  };
}

export interface PedidoReivindicacao {
  nome: string;
  cargo: string | null;
  email: string;
  telefone: string | null;
  mensagem: string | null;
}

/** Registra o pedido para a análise da equipe e avisa a equipe e quem pediu. */
export async function registrarPedido(perfilRef: string, acao: AcaoReivindicacao, dados: PedidoReivindicacao, ip: string): Promise<void> {
  const p = await perfilParaReivindicar(perfilRef);
  if (!p) throw new UserError('Não encontramos esse buffet. Busque de novo pelo nome.');
  if (!p.reivindicavel) throw new UserError('Este perfil já é administrado pelo próprio buffet. Se você é o responsável, entre na sua conta.');
  // Limites pelo perfil de fato (qualquer grafia do endereço cai no mesmo id), pelo e-mail e no total: cada pedido
  // manda e-mail à equipe e a quem pediu
  const email = dados.email.trim().toLowerCase();
  if (
    !permitir(`reivindicar-perfil:${p.perfilId}`, 4, 24 * 60 * 60_000) ||
    !permitir(`reivindicar-email:${email}`, 3, 24 * 60 * 60_000) ||
    !permitir('reivindicar-total', 60, 60 * 60_000)
  ) {
    throw new UserError('Muitos pedidos em pouco tempo. Tente de novo mais tarde.');
  }
  const { rows: pendente } = await systemQuery(
    `SELECT 1 FROM busca_reivindicacoes WHERE perfil_id = $1 AND lower(email) = $2 AND status = 'pendente' LIMIT 1`,
    [p.perfilId, email]
  );
  if (pendente.length) throw new UserError('Já recebemos o seu pedido para este buffet. A equipe responde em até 2 dias úteis.');
  await systemQuery(
    `INSERT INTO busca_reivindicacoes (perfil_id, tenant_id, buffet_nome, acao, nome, cargo, email, telefone, mensagem, ip)
     VALUES ($1, $2, $3, $4, $5, $6, lower($7), $8, $9, $10)`,
    [p.perfilId, p.tenantId, p.nome, acao, dados.nome, dados.cargo, dados.email, dados.telefone, dados.mensagem, ip]
  );
  const equipe = (process.env.BANKET_EQUIPE_EMAILS ?? '').split(',').map((e) => e.trim()).filter(Boolean);
  const oQue = acao === 'assumir' ? 'assumir o perfil' : 'remover o perfil';
  const aviso = emailLayout({
    titulo: `Novo pedido: ${oQue} do ${p.nome}`,
    paragrafos: [
      `${dados.nome}${dados.cargo ? ` (${dados.cargo})` : ''} · ${dados.email}${dados.telefone ? ` · ${dados.telefone}` : ''}`,
      dados.mensagem ? `Mensagem: ${dados.mensagem}` : '',
      'Confira a posse pelos canais do perfil antes de aprovar.',
    ].filter(Boolean),
    cta: { texto: 'Abrir a fila de reivindicações', url: appUrl('/equipe/reivindicacoes') },
  });
  if (equipe.length) await sendMail({ to: equipe, subject: `Banket Busca: pedido para ${oQue} do ${p.nome}`, ...aviso, replyTo: dados.email });
  else console.log(`[busca] pedido de reivindicação (${oQue}) do ${p.nome}; defina BANKET_EQUIPE_EMAILS para avisar a equipe`);
  const recibo = emailLayout({
    titulo: 'Recebemos o seu pedido',
    paragrafos: [
      // Sem o nome digitado: o recibo vai para o e-mail informado, ainda não confirmado
      `Olá! Recebemos o pedido para ${oQue} do ${p.nome} no Banket Busca.`,
      `Para proteger o seu buffet, a nossa equipe confirma a posse pelos contatos que já estão no perfil${p.canais.length ? ` (${p.canais.join(', ')})` : ''} antes de qualquer mudança. Respondemos em até 2 dias úteis.`,
      acao === 'assumir' ? 'Assim que confirmarmos, você recebe o link para criar o seu acesso gratuito e completar o perfil.' : 'Assim que confirmarmos, o perfil sai do Banket Busca.',
    ],
  });
  await sendMail({ to: dados.email, subject: `Pedido recebido: ${p.nome} no Banket Busca`, ...recibo });
}

// ---------------------------------------------------------------------------
// Equipe: fila e decisões
// ---------------------------------------------------------------------------
export interface ReivindicacaoNaFila {
  id: string;
  acao: AcaoReivindicacao;
  status: StatusReivindicacao;
  buffet_nome: string;
  perfil_slug: string | null;
  reivindicavel: boolean;
  nome: string;
  cargo: string | null;
  email: string;
  telefone: string | null;
  mensagem: string | null;
  email_destino: string | null;
  observacao: string | null;
  analisado_por_nome: string | null;
  analisado_em: Date | null;
  created_at: Date;
  /** Canais reais do perfil (só a equipe vê) */
  perfil_email: string | null;
  perfil_whatsapp: string | null;
  perfil_telefone: string | null;
  perfil_instagram: string | null;
  perfil_site: string | null;
  perfil_endereco: string | null;
}

export async function listarPedidos(status: StatusReivindicacao | 'todos'): Promise<ReivindicacaoNaFila[]> {
  const { rows } = await systemQuery<ReivindicacaoNaFila>(
    `SELECT r.id, r.acao, r.status, r.buffet_nome, p.slug AS perfil_slug, r.nome, r.cargo, r.email, r.telefone, r.mensagem,
            r.email_destino, r.observacao, u.nome AS analisado_por_nome, r.analisado_em, r.created_at,
            coalesce(t.origem_cadastro = 'importacao' AND NOT EXISTS (SELECT 1 FROM tenant_usuarios tu WHERE tu.tenant_id = t.id), false) AS reivindicavel,
            p.email_contato AS perfil_email, p.whatsapp AS perfil_whatsapp, p.telefone AS perfil_telefone,
            p.instagram AS perfil_instagram, p.site AS perfil_site,
            nullif(concat_ws(', ', nullif(concat_ws(' ', p.logradouro, p.numero), ''), p.bairro), '') AS perfil_endereco
       FROM busca_reivindicacoes r
       LEFT JOIN busca_perfis p ON p.id = r.perfil_id
       LEFT JOIN tenants t ON t.id = r.tenant_id
       LEFT JOIN usuarios u ON u.id = r.analisado_por
      WHERE $1 = 'todos' OR r.status = $1
      ORDER BY (r.status = 'pendente') DESC, r.created_at DESC
      LIMIT 200`,
    [status]
  );
  return rows;
}

async function travarPedido(db: Db, id: string, acao: AcaoReivindicacao) {
  const { rows } = await db.query<{ id: string; status: string; acao: string; perfil_id: string | null; tenant_id: string | null; buffet_nome: string; nome: string; email: string }>(
    'SELECT id, status, acao, perfil_id, tenant_id, buffet_nome, nome, email FROM busca_reivindicacoes WHERE id = $1 FOR UPDATE',
    [id]
  );
  const r = rows[0];
  if (!r) throw new UserError('Pedido não encontrado.');
  if (r.status !== 'pendente' && !(r.status === 'aprovada' && acao === 'assumir')) throw new UserError('Este pedido já foi analisado.');
  if (r.acao !== acao) throw new UserError('Ação diferente da pedida.');
  if (!r.perfil_id || !r.tenant_id) throw new UserError('O perfil deste pedido não existe mais.');
  const { rows: tn } = await db.query<{ livre: boolean }>(
    `SELECT t.origem_cadastro = 'importacao' AND NOT EXISTS (SELECT 1 FROM tenant_usuarios tu WHERE tu.tenant_id = t.id) AS livre
       FROM tenants t WHERE t.id = $1 FOR UPDATE`,
    [r.tenant_id]
  );
  if (!tn[0]?.livre) throw new UserError('Este perfil já tem um responsável.');
  return r as typeof r & { perfil_id: string; tenant_id: string };
}

/**
 * Posse conferida pela equipe: envia ao e-mail conferido o link para criar o acesso (ou entrar, se já tiver conta) e
 * assumir a empresa. Reenviar gera um link novo e invalida o anterior.
 */
export async function aprovarAssumir(id: string, emailDestino: string, observacao: string | null, equipeId: string): Promise<void> {
  const email = emailDestino.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new UserError('Informe o e-mail conferido que vai receber o link.');
  const token = generateToken();
  const nome = await withSystem(async (db) => {
    const r = await travarPedido(db, id, 'assumir');
    await db.query(`UPDATE auth_tokens SET usado_em = now() WHERE tipo = 'reivindicacao' AND usado_em IS NULL AND payload->>'reivindicacao_id' = $1`, [id]);
    await db.query(
      `INSERT INTO auth_tokens (tipo, token_hash, email, tenant_id, payload, expira_em, criado_por)
       VALUES ('reivindicacao', $1, $2, $3, $4, now() + make_interval(hours => $5), $6)`,
      [hashToken(token), email, r.tenant_id, JSON.stringify({ perfil_id: r.perfil_id, reivindicacao_id: id }), VALIDADE_HORAS, equipeId]
    );
    await db.query(
      `UPDATE busca_reivindicacoes SET status = 'aprovada', email_destino = $2, observacao = coalesce($3, observacao),
              analisado_por = $4, analisado_em = now() WHERE id = $1`,
      [id, email, observacao, equipeId]
    );
    return r.buffet_nome;
  });
  const { html, text } = emailLayout({
    titulo: `Pronto: o perfil do ${nome} é seu`,
    paragrafos: [
      `Confirmamos que você é o responsável pelo ${nome}. Agora é só criar o seu acesso gratuito ao Banket para assumir o perfil no Banket Busca.`,
      'Depois de entrar, complete o perfil com fotos, tipos de evento, serviços, capacidade e região de atendimento. Perfis completos aparecem melhor nas buscas e ajudam o cliente a escolher.',
      `O link vale por ${VALIDADE_HORAS} horas.`,
    ],
    cta: { texto: 'Criar meu acesso e assumir o perfil', url: appUrl(`/auth/reivindicar?token=${token}`) },
    rodape: 'Você recebeu este e-mail porque pediu para assumir este perfil no Banket Busca.',
  });
  await sendMail({ to: email, subject: `Assuma o perfil do ${nome} no Banket Busca`, html, text });
}

/** Posse conferida: remove o perfil (e a empresa, se não sobrar unidade) e guarda a exclusão. Avisa quem pediu. */
export async function aprovarRemocao(id: string, observacao: string | null, equipeId: string): Promise<void> {
  const pedido = await withSystem(async (db) => {
    const r = await travarPedido(db, id, 'remover');
    const { rows } = await db.query<{ id: string; nome: string; documento: string | null; email_contato: string | null; telefone: string | null; whatsapp: string | null; espaco_id: string | null; place_id: string | null }>(
      `SELECT p.id, p.nome, p.documento, p.email_contato, p.telefone, p.whatsapp, p.espaco_id, i.place_id
         FROM busca_perfis p LEFT JOIN busca_importacao i ON i.perfil_id = p.id WHERE p.id = $1 FOR UPDATE OF p`,
      [r.perfil_id]
    );
    const p = rows[0];
    if (!p) throw new UserError('O perfil deste pedido não existe mais.');
    await db.query(
      `INSERT INTO busca_exclusoes (place_id, nome, documento, emails, telefones, reivindicacao_id) VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (place_id) DO NOTHING`,
      [p.place_id, p.nome, p.documento, [p.email_contato].filter(Boolean), [p.telefone, p.whatsapp].filter(Boolean), id]
    );
    await db.query(
      `UPDATE busca_reivindicacoes SET status = 'concluida', concluida_em = now(), observacao = coalesce($2, observacao),
              analisado_por = $3, analisado_em = now() WHERE id = $1`,
      [id, observacao, equipeId]
    );
    await db.query('DELETE FROM busca_perfis WHERE id = $1', [p.id]);
    if (p.espaco_id) await db.query('DELETE FROM espacos WHERE id = $1', [p.espaco_id]);
    const { rows: resto } = await db.query('SELECT 1 FROM busca_perfis WHERE tenant_id = $1 LIMIT 1', [r.tenant_id]);
    if (!resto.length) await db.query('DELETE FROM tenants WHERE id = $1', [r.tenant_id]);
    return r;
  });
  const { html, text } = emailLayout({
    titulo: `${pedido.buffet_nome} saiu do Banket Busca`,
    paragrafos: [
      `Olá, ${pedido.nome.split(' ')[0]}. Conforme o seu pedido, o perfil do ${pedido.buffet_nome} foi removido do Banket Busca e os dados de contato foram apagados.`,
      `Se quiser voltar um dia, é só cadastrar o buffet de graça em ${buscaUrl('/')}.`,
    ],
  });
  await sendMail({ to: pedido.email, subject: `${pedido.buffet_nome} foi removido do Banket Busca`, html, text });
}

/** A posse não se confirmou: encerra o pedido e responde a quem pediu com o motivo. */
export async function recusar(id: string, motivo: string, equipeId: string): Promise<void> {
  const texto = motivo.trim();
  if (texto.length < 10) throw new UserError('Explique o motivo da recusa (ele vai para quem pediu).');
  const r = await withSystem(async (db) => {
    const { rows } = await db.query<{ buffet_nome: string; nome: string; email: string; acao: string }>(
      `UPDATE busca_reivindicacoes SET status = 'recusada', observacao = $2, analisado_por = $3, analisado_em = now()
        WHERE id = $1 AND status IN ('pendente', 'aprovada') RETURNING buffet_nome, nome, email, acao`,
      [id, texto, equipeId]
    );
    if (!rows[0]) throw new UserError('Este pedido já foi analisado.');
    await db.query(`UPDATE auth_tokens SET usado_em = now() WHERE tipo = 'reivindicacao' AND usado_em IS NULL AND payload->>'reivindicacao_id' = $1`, [id]);
    return rows[0];
  });
  const { html, text } = emailLayout({
    titulo: 'Não conseguimos confirmar o seu pedido',
    paragrafos: [
      `Olá, ${r.nome.split(' ')[0]}. Analisamos o pedido para ${r.acao === 'assumir' ? 'assumir' : 'remover'} o perfil do ${r.buffet_nome} no Banket Busca e não conseguimos confirmar a posse.`,
      texto,
      'Se precisar, responda este e-mail com mais informações.',
    ],
  });
  await sendMail({ to: r.email, subject: `Seu pedido sobre o ${r.buffet_nome} no Banket Busca`, html, text });
}

// ---------------------------------------------------------------------------
// Link aprovado: criação do acesso
// ---------------------------------------------------------------------------
export interface ReivindicacaoValida {
  email: string;
  buffet: string;
  bairro: string | null;
  cidade: string | null;
  /** Já existe conta Banket com esse e-mail (pede a senha em vez de criar) */
  contaExistente: boolean;
  /** O perfil continua sem dono */
  disponivel: boolean;
}

export async function buscarReivindicacao(token: string | null): Promise<ReivindicacaoValida | null> {
  if (!token) return null;
  const { rows } = await systemQuery(
    `SELECT a.email, p.nome, p.bairro, c.nome AS cidade,
            EXISTS (SELECT 1 FROM usuarios u WHERE lower(u.email) = lower(a.email)) AS conta,
            (t.origem_cadastro = 'importacao' AND NOT EXISTS (SELECT 1 FROM tenant_usuarios tu WHERE tu.tenant_id = t.id)) AS disponivel
       FROM auth_tokens a
       JOIN busca_perfis p ON p.id::text = a.payload->>'perfil_id'
       JOIN tenants t ON t.id = p.tenant_id
       LEFT JOIN busca_cidades c ON c.id = p.cidade_id
      WHERE a.token_hash = $1 AND a.tipo = 'reivindicacao' AND a.usado_em IS NULL AND a.expira_em > now()`,
    [hashToken(token)]
  );
  const r = rows[0];
  return r ? { email: r.email, buffet: r.nome, bairro: r.bairro, cidade: r.cidade, contaExistente: r.conta, disponivel: r.disponivel } : null;
}

/**
 * Cria o acesso (ou confere a senha de quem já tem conta), vincula como proprietário da empresa inteira (todas as
 * unidades) e aplica os padrões do app, que a importação não criou. O plano continua o Busca.
 */
export async function assumirPerfil(token: string, dados: { nome?: string; senha: string; confirmacao?: string }): Promise<SessionUser> {
  const user = await withSystem(async (db) => {
    const { rows } = await db.query<{ id: string; email: string; tenant_id: string; payload: { reivindicacao_id?: string } }>(
      `SELECT id, email, tenant_id, payload FROM auth_tokens
        WHERE token_hash = $1 AND tipo = 'reivindicacao' AND usado_em IS NULL AND expira_em > now() FOR UPDATE`,
      [hashToken(token)]
    );
    const t = rows[0];
    if (!t) throw new UserError('Este link é inválido ou expirou. Fale com a nossa equipe para receber um novo.');
    const { rows: tn } = await db.query<{ livre: boolean }>(
      `SELECT t.origem_cadastro = 'importacao' AND NOT EXISTS (SELECT 1 FROM tenant_usuarios tu WHERE tu.tenant_id = t.id) AS livre
         FROM tenants t WHERE t.id = $1 FOR UPDATE`,
      [t.tenant_id]
    );
    if (!tn[0]?.livre) throw new UserError('Este perfil já tem um responsável. Se for você, entre na sua conta.');
    const { rows: existentes } = await db.query<{ id: string; nome: string; ok: boolean }>(
      'SELECT id, nome, senha_hash = crypt($2, senha_hash) AS ok FROM usuarios WHERE lower(email) = lower($1)',
      [t.email, dados.senha]
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
      // O link chegou nesse e-mail, conferido pela equipe: já está confirmado
      const { rows: novo } = await db.query<{ id: string; nome: string }>(
        `INSERT INTO usuarios (nome, email, senha_hash, email_verificado_em, origem_cadastro)
         VALUES ($1, lower($2), crypt($3, gen_salt('bf')), now(), 'busca') RETURNING id, nome`,
        [nome, t.email, dados.senha]
      );
      usuario = novo[0];
    }
    await db.query(`INSERT INTO tenant_usuarios (tenant_id, usuario_id, role, ativo) VALUES ($1, $2, 'owner', true)`, [t.tenant_id, usuario.id]);
    await db.query('SELECT aplicar_padroes_tenant_completo($1)', [t.tenant_id]);
    await db.query(`UPDATE tenants SET email = coalesce(email, lower($2)), updated_at = now() WHERE id = $1`, [t.tenant_id, t.email]);
    await db.query('UPDATE auth_tokens SET usado_em = now(), usuario_id = $2 WHERE id = $1', [t.id, usuario.id]);
    if (t.payload.reivindicacao_id) {
      await db.query(`UPDATE busca_reivindicacoes SET status = 'concluida', concluida_em = now(), usuario_id = $2 WHERE id = $1`, [
        t.payload.reivindicacao_id, usuario.id,
      ]);
    }
    return { id: usuario.id, nome: usuario.nome, email: t.email, tenantId: t.tenant_id, role: 'owner' as const };
  });
  invalidateTenant(user.tenantId);
  invalidarPlano(user.tenantId);
  return user;
}
