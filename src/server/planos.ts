// Planos da empresa: catálogo, transições (único dono de `tenants.plano_id`), teste grátis, rebaixamento para o
// plano Busca, excedentes e avisos. Quem muda o plano: cadastro (`cadastroInicial`),
// o usuário (`iniciarTrial`/`recusarTrial`), o Manager Hwesta (`aplicarDoManager`) e o agendador (`varrerTrials`).
// As funções recebem `db` (withTenant da própria empresa ou withSystem no agendador/HCP): as linhas tocadas são
// sempre da empresa (tenants, tenant_usuarios, tenant_plano_historico, plano_avisos).
import { systemQuery, withSystem, type Db } from '../lib/db';
import { isAdmin, type SessionUser } from '../lib/auth';
import { UserError } from '../lib/forms';
import { invalidateMembership, invalidateTenant } from '../lib/membership';
import { appUrl, sendMail } from '../lib/mail';
import { ErroPlano, entitlements, invalidar, nivelEm, podeUsarEm, type Entitlements } from '../lib/planos/gating';
import { escolherExcedentes } from '../lib/planos/excedentes';
import { avisoDoDia, deveRebaixar, emSaoPaulo, fimDoTrial, recusaVigente, type AvisoTrial } from '../lib/planos/trial';
import type { HwestaEntitlements } from '../lib/hwesta/types';
import { emailLayout } from './emails';
import { aplicarExcedentesBusca, atualizarEnderecosPeloNome, sincronizarNivel } from './busca/perfil';

export interface Plano {
  id: string;
  slug: string;
  nome: string;
  descricao: string | null;
  gratuito: boolean;
  publico: boolean;
  ativo: boolean;
  ordem: number;
  preco_mensal: number | null;
  preco_anual: number | null;
  trial_dias: number;
  recursos: Record<string, boolean | number>;
  /** Tem preço no Stripe (mensal ou anual): dá para assinar pelo app */
  contratavel: boolean;
  anual_contratavel: boolean;
}

export type MotivoPlano =
  | 'cadastro' | 'migracao' | 'trial_iniciado' | 'trial_encerrado' | 'upgrade' | 'downgrade' | 'hwesta' | 'backoffice'
  | 'assinatura' | 'cancelamento' | 'plano_escolhido' | 'inadimplencia';
export type OrigemPlano = 'app' | 'hwesta' | 'agendador' | 'migracao' | 'stripe';

const COLUNAS = `id, slug, nome, descricao, gratuito, publico, ativo, ordem, preco_mensal, preco_anual, trial_dias, recursos,
  (stripe_price_mensal_id IS NOT NULL OR stripe_price_anual_id IS NOT NULL) AS contratavel,
  (stripe_price_anual_id IS NOT NULL) AS anual_contratavel`;

/** Planos ativos (todos ou só os públicos), na ordem do catálogo. */
export async function listarPlanos(db: Db, somentePublicos = true): Promise<Plano[]> {
  const { rows } = await db.query<Plano>(
    `SELECT ${COLUNAS} FROM planos WHERE ativo AND ($1 = false OR publico OR gratuito) ORDER BY ordem, nome`,
    [somentePublicos]
  );
  return rows;
}

export async function planoPorSlug(db: Db, slug: string): Promise<Plano | null> {
  const { rows } = await db.query<Plano>(`SELECT ${COLUNAS} FROM planos WHERE slug = $1`, [slug]);
  return rows[0] ?? null;
}

export async function planoPorId(db: Db, id: string): Promise<Plano | null> {
  const { rows } = await db.query<Plano>(`SELECT ${COLUNAS} FROM planos WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function planoGratuito(db: Db): Promise<Plano> {
  const { rows } = await db.query<Plano>(`SELECT ${COLUNAS} FROM planos WHERE gratuito AND ativo ORDER BY ordem LIMIT 1`);
  if (!rows[0]) throw new Error('Plano gratuito não encontrado (migration 031).');
  return rows[0];
}

export interface HistoricoPlano {
  id: string;
  de: string | null;
  para: string | null;
  motivo: MotivoPlano;
  origem: OrigemPlano;
  usuario_nome: string | null;
  dados: Record<string, unknown>;
  created_at: Date;
}

export async function historicoPlano(db: Db, tenantId: string): Promise<HistoricoPlano[]> {
  const { rows } = await db.query<HistoricoPlano>(
    `SELECT h.id, pd.nome AS de, pp.nome AS para, h.motivo, h.origem, u.nome AS usuario_nome, h.dados, h.created_at
       FROM tenant_plano_historico h
       LEFT JOIN planos pd ON pd.id = h.de_plano_id
       LEFT JOIN planos pp ON pp.id = h.para_plano_id
       LEFT JOIN usuarios u ON u.id = h.usuario_id
      WHERE h.tenant_id = $1 ORDER BY h.created_at DESC LIMIT 50`,
    [tenantId]
  );
  return rows;
}

// ---------------------------------------------------------------------------
// Transições
// ---------------------------------------------------------------------------
interface MetaTroca {
  motivo: MotivoPlano;
  origem: OrigemPlano;
  usuarioId?: string | null;
  dados?: Record<string, unknown>;
  /** Mantém `trial_ate` (só o próprio início do teste usa) */
  manterTrial?: boolean;
}

/**
 * Troca o plano da empresa e registra o histórico. Devolve { de, para } ou null se nada mudou.
 * Ir para o plano gratuito aplica os excedentes; sair dele restaura o que estava bloqueado.
 * Qualquer troca que não seja o início do teste encerra o teste (trial_ate = NULL).
 */
export async function trocarPlano(db: Db, tenantId: string, paraPlanoId: string, meta: MetaTroca): Promise<{ de: string | null; para: string } | null> {
  const { rows } = await db.query<{ plano_id: string | null; trial_ate: string | null }>(
    'SELECT plano_id, trial_ate FROM tenants WHERE id = $1 FOR UPDATE',
    [tenantId]
  );
  if (!rows[0]) return null;
  const de = rows[0].plano_id;
  const destino = await planoPorId(db, paraPlanoId);
  if (!destino) throw new UserError('Plano não encontrado.');
  if (de === paraPlanoId && !meta.manterTrial) return null;
  const origemGratuita = de ? (await planoPorId(db, de))?.gratuito === true : false;

  await db.query(
    `UPDATE tenants
        SET plano_id = $2, plano_pendente_id = NULL,
            trial_ate = CASE WHEN $3 THEN trial_ate ELSE NULL END,
            plano_rebaixado_em = CASE WHEN $4 THEN now() ELSE NULL END,
            updated_at = now()
      WHERE id = $1`,
    [tenantId, paraPlanoId, meta.manterTrial === true, destino.gratuito && !origemGratuita]
  );
  await db.query(
    `INSERT INTO tenant_plano_historico (tenant_id, de_plano_id, para_plano_id, motivo, origem, usuario_id, dados)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [tenantId, de, paraPlanoId, meta.motivo, meta.origem, meta.usuarioId ?? null, JSON.stringify(meta.dados ?? {})]
  );
  invalidar(tenantId);
  // O Banket Busca segue os recursos do plano: Perfil Simples (plano Busca) ou Personalizado (planos pagos)
  const ent = await entitlements(tenantId, db);
  await sincronizarNivel(db, tenantId, nivelEm(ent));
  if (destino.gratuito) await aplicarExcedentes(db, tenantId);
  else {
    if (origemGratuita) await restaurarAposUpgrade(db, tenantId);
    if (podeUsarEm(ent, 'busca_personalizado')) {
      await restaurarBusca(db, tenantId);
      await atualizarEnderecosPeloNome(db, tenantId);
    } else {
      await aplicarExcedentesBusca(db, tenantId);
    }
  }
  return { de, para: paraPlanoId };
}

/**
 * Excedentes do plano atual (rebaixamento): usuários além do limite ficam com o vínculo desativado e marcados
 * com bloqueado_plano_em (o proprietário mais antigo nunca sai; ficam os mais recentes). Nada é apagado.
 * Itens do Banket Busca (fotos além do limite, tipos de evento e de serviço além do limite): aplicarExcedentesBusca.
 */
export async function aplicarExcedentes(db: Db, tenantId: string): Promise<{ usuariosBloqueados: string[] }> {
  const ent = await entitlements(tenantId, db);
  const limiteUsuarios = ent ? limiteNumerico(ent, 'usuarios') : null;
  const { rows: vinculos } = await db.query<{ usuario_id: string; role: string; ativo: boolean; bloqueado: boolean; created_at: Date }>(
    `SELECT usuario_id, role, ativo, bloqueado_plano_em IS NOT NULL AS bloqueado, created_at
       FROM tenant_usuarios WHERE tenant_id = $1 AND (ativo OR bloqueado_plano_em IS NOT NULL)
      ORDER BY created_at`,
    [tenantId]
  );
  const dono = vinculos.find((v) => v.role === 'owner')?.usuario_id;
  const escolha = escolherExcedentes(
    vinculos.map((v) => ({ id: v.usuario_id, atualizadoEm: v.created_at })),
    limiteUsuarios,
    { sempreFica: dono ? [dono] : [] }
  );
  if (escolha.bloquear.length) {
    await db.query(
      `UPDATE tenant_usuarios SET ativo = false, bloqueado_plano_em = COALESCE(bloqueado_plano_em, now())
        WHERE tenant_id = $1 AND usuario_id = ANY($2::uuid[])`,
      [tenantId, escolha.bloquear]
    );
  }
  const reativar = vinculos.filter((v) => v.bloqueado && escolha.manter.includes(v.usuario_id)).map((v) => v.usuario_id);
  if (reativar.length) {
    await db.query(
      `UPDATE tenant_usuarios SET ativo = true, bloqueado_plano_em = NULL WHERE tenant_id = $1 AND usuario_id = ANY($2::uuid[])`,
      [tenantId, reativar]
    );
  }
  invalidateTenant(tenantId);
  await aplicarExcedentesBusca(db, tenantId);
  return { usuariosBloqueados: escolha.bloquear };
}

/** Upgrade a partir do gratuito: reativa quem foi bloqueado pelo plano (quem foi desativado à mão não é tocado). */
export async function restaurarAposUpgrade(db: Db, tenantId: string): Promise<void> {
  await db.query(
    `UPDATE tenant_usuarios SET ativo = true, bloqueado_plano_em = NULL WHERE tenant_id = $1 AND bloqueado_plano_em IS NOT NULL`,
    [tenantId]
  );
  await db.query('UPDATE tenants SET plano_rebaixado_em = NULL WHERE id = $1', [tenantId]);
  await restaurarBusca(db, tenantId);
  invalidateTenant(tenantId);
}

/** Banket Busca no Perfil Personalizado: fotos voltam ao perfil e os tipos guardados voltam aos arrays. */
async function restaurarBusca(db: Db, tenantId: string): Promise<void> {
  await db.query('UPDATE busca_fotos SET bloqueado_plano_em = NULL WHERE tenant_id = $1 AND bloqueado_plano_em IS NOT NULL', [tenantId]);
  await db.query(
    `UPDATE busca_perfis
        SET tipos_evento = ARRAY(SELECT DISTINCT unnest(tipos_evento || COALESCE(ARRAY(SELECT jsonb_array_elements_text(excedentes -> 'tipos_evento')), '{}'))),
            tipos_servico = ARRAY(SELECT DISTINCT unnest(tipos_servico || COALESCE(ARRAY(SELECT jsonb_array_elements_text(excedentes -> 'tipos_servico')), '{}'))),
            excedentes = '{}'::jsonb, updated_at = now()
      WHERE tenant_id = $1 AND excedentes <> '{}'::jsonb`,
    [tenantId]
  );
}

const limiteNumerico = (ent: Entitlements, recurso: string): number | null => {
  if (ent.semPlano) return null;
  const v = ent.recursos[recurso];
  return typeof v === 'number' && v >= 0 ? v : null;
};

// ---------------------------------------------------------------------------
// Cadastro, teste grátis e rebaixamento
// ---------------------------------------------------------------------------

/**
 * Plano inicial da empresa recém-criada: sempre o plano Busca (gratuito), como o Yosp. Quem veio do site (gestão) vai
 * em seguida para /planos?teste=1 escolher o plano: a escolha inicia o teste de 30 dias (`iniciarTrial`).
 */
export async function cadastroInicial(db: Db, tenantId: string, origem: 'site' | 'busca', usuarioId: string | null): Promise<void> {
  const gratuito = await planoGratuito(db);
  await trocarPlano(db, tenantId, gratuito.id, { motivo: 'cadastro', origem: 'app', usuarioId, dados: { origem } });
}

/** Página de entrada de uma empresa do site que ainda não escolheu o plano do teste. */
export const PAGINA_ESCOLHA_PLANO = '/planos?teste=1';

/** A empresa veio do site, está no plano gratuito e ainda pode começar o teste: deve escolher o plano. */
export const deveEscolherPlano = (ent: Entitlements | null): boolean =>
  Boolean(ent && ent.gratuito && ent.origemCadastro === 'site' && !ent.trialUsado && !ent.assinaturaViva);

/** Oferta de teste disponível? (plano gratuito, nunca testou e não recusou nos últimos 30 dias) */
export function ofertaDeTrial(ent: Entitlements | null, agora = new Date()): 'disponivel' | 'recusada' | 'usada' | 'nao_se_aplica' {
  if (!ent || !ent.gratuito) return 'nao_se_aplica';
  if (ent.trialUsado) return 'usada';
  if (recusaVigente(ent.trialRecusadoEm, agora)) return 'recusada';
  return 'disponivel';
}

/** Começa o teste grátis de um plano pago a partir do plano gratuito. Só owner/admin, uma vez por empresa. */
export async function iniciarTrial(db: Db, user: SessionUser, planoId: string): Promise<{ ate: string; plano: Plano }> {
  if (!isAdmin(user)) throw new UserError('Só proprietários e administradores podem iniciar o teste.');
  const ent = await entitlements(user.tenantId, db);
  if (!ent || !ent.gratuito) throw new ErroPlano('TRIAL_INDISPONIVEL', 'trial', 'O teste grátis é para empresas no plano gratuito.');
  if (ent.trialUsado) throw new ErroPlano('TRIAL_INDISPONIVEL', 'trial', 'Sua empresa já usou o teste grátis. Para continuar, escolha um plano.');
  const plano = await planoPorId(db, planoId);
  if (!plano || plano.gratuito || !plano.publico || !plano.ativo) throw new UserError('Escolha um dos planos disponíveis para o teste.');
  const hoje = emSaoPaulo(new Date()).data;
  const ate = fimDoTrial(hoje, plano.trial_dias);
  await db.query(
    'UPDATE tenants SET trial_ate = $2, trial_iniciado_em = now(), trial_usado_em = now(), trial_recusado_em = NULL WHERE id = $1',
    [user.tenantId, ate]
  );
  await trocarPlano(db, user.tenantId, plano.id, { motivo: 'trial_iniciado', origem: 'app', usuarioId: user.id, dados: { trial_ate: ate }, manterTrial: true });
  await registrarUpsell(db, user, 'trial_iniciado', null, { plano: plano.slug });
  await depoisDoCommit(user.tenantId, `trial:${ate}:inicio`, db, () => enviarEmailTrial(user.tenantId, 'inicio', { planoNome: plano.nome, ate }));
  return { ate, plano };
}

/** "Não tenho interesse no momento": a oferta some por 30 dias. */
export async function recusarTrial(db: Db, user: SessionUser): Promise<void> {
  if (!isAdmin(user)) throw new UserError('Só proprietários e administradores podem responder à oferta.');
  await db.query('UPDATE tenants SET trial_recusado_em = now() WHERE id = $1', [user.tenantId]);
  invalidar(user.tenantId);
  await registrarUpsell(db, user, 'trial_recusado', null, {});
}

/**
 * Troca o plano durante o teste, sem pagamento e sem mexer no prazo (como o select-plan do Yosp). Com assinatura,
 * a troca é pelo Stripe (server/assinatura.ts → trocarPlanoDaAssinatura).
 */
export async function escolherPlanoNoTeste(db: Db, user: SessionUser, planoId: string): Promise<Plano> {
  if (!isAdmin(user)) throw new UserError('Só proprietários e administradores podem trocar o plano.');
  const ent = await entitlements(user.tenantId, db);
  if (ent?.assinaturaViva) throw new UserError('Sua empresa já tem assinatura: a troca de plano é feita em Configurações › Financeiro.');
  if (!ent?.trial) throw new UserError('A troca de plano sem pagamento só vale durante o teste. Assine o plano escolhido.');
  const plano = await planoPorId(db, planoId);
  if (!plano || plano.gratuito || !plano.publico || !plano.ativo) throw new UserError('Escolha um dos planos disponíveis.');
  if (plano.id === ent.planoId) return plano;
  await trocarPlano(db, user.tenantId, plano.id, {
    motivo: 'plano_escolhido', origem: 'app', usuarioId: user.id, dados: { trial_ate: ent.trialAte }, manterTrial: true,
  });
  return plano;
}

/** Rebaixa uma empresa em plano pago para o plano gratuito. Idempotente (já gratuita → null). */
export async function rebaixarParaBusca(
  db: Db,
  tenantId: string,
  motivo: Extract<MotivoPlano, 'trial_encerrado' | 'cancelamento' | 'inadimplencia' | 'hwesta' | 'backoffice'>,
  origem: OrigemPlano,
  dados: Record<string, unknown> = {}
): Promise<boolean> {
  const ent = await entitlements(tenantId, db);
  if (!ent || ent.gratuito) return false;
  const gratuito = await planoGratuito(db);
  const troca = await trocarPlano(db, tenantId, gratuito.id, { motivo, origem, dados: { ...dados, plano_anterior: ent.planoSlug } });
  if (!troca) return false;
  await registrarUpsell(db, { id: null, tenantId }, 'rebaixado', null, { motivo, plano_anterior: ent.planoSlug });
  if (motivo === 'trial_encerrado') {
    await depoisDoCommit(tenantId, `trial:${ent.trialAte ?? ''}:fim`, db, () =>
      enviarEmailTrial(tenantId, 'fim', { planoNome: ent.planoNome ?? '', ate: ent.trialAte ?? '' })
    );
  }
  return true;
}

/**
 * Chamado pelo middleware quando o entitlements diz `trialVencido`: rebaixa se já passou de D+1 12h. Empresa com
 * assinatura no Stripe fica para o agendador/webhook (server/assinatura.ts), que confere a fatura e cancela no Stripe.
 */
export async function verificarTrialVencido(ent: Entitlements): Promise<boolean> {
  if (!ent.trialVencido || !ent.trialAte || ent.assinaturaViva || !deveRebaixar(ent.trialAte, new Date())) return false;
  return withSystem((db) => rebaixarParaBusca(db, ent.tenantId, 'trial_encerrado', 'app'));
}

/**
 * E-mail que só pode sair se a transação de quem chama for confirmada. Grava a chave em plano_avisos dentro da
 * transação (dedup: a mesma chave nunca sai duas vezes) e envia por outra conexão alguns segundos depois, só se a
 * chave estiver gravada (rollback = nada sai). Nunca usa o client da transação.
 */
async function depoisDoCommit(tenantId: string, chave: string, db: Db, enviar: () => Promise<void>): Promise<void> {
  const k = chave.slice(0, 80);
  const { rowCount } = await db.query('INSERT INTO plano_avisos (tenant_id, chave) VALUES ($1, $2) ON CONFLICT DO NOTHING', [tenantId, k]);
  if (!rowCount) return;
  setTimeout(async () => {
    try {
      const { rowCount: gravada } = await systemQuery('SELECT 1 FROM plano_avisos WHERE tenant_id = $1 AND chave = $2', [tenantId, k]);
      if (gravada) await enviar();
    } catch (err) {
      console.error('[planos] e-mail após o commit:', k, err);
    }
  }, 3_000).unref?.();
}

/**
 * Varredura do agendador: rebaixa testes vencidos (D+1 12h) e envia os avisos D-7, D-1 e D0 (9h), com dedup em
 * plano_avisos. Uma transação por empresa (um erro numa não desfaz as outras) e e-mail só depois do commit.
 */
export async function varrerTrials(agora = new Date()): Promise<{ rebaixadas: number; avisos: number }> {
  // Com assinatura no Stripe (mesmo a 1ª fatura Pix ainda em aberto), o rebaixamento é do server/assinatura.ts
  // (cancela no Stripe antes) e os avisos do teste não fazem sentido: a empresa já contratou.
  const { rows } = await systemQuery<{ id: string; trial_ate: string; plano_nome: string }>(
    `SELECT t.id, to_char(t.trial_ate, 'YYYY-MM-DD') AS trial_ate, p.nome AS plano_nome
       FROM tenants t JOIN planos p ON p.id = t.plano_id
      WHERE t.trial_ate IS NOT NULL AND NOT p.gratuito AND t.status = 'active' AND t.stripe_assinatura_id IS NULL`
  );
  let rebaixadas = 0;
  let avisos = 0;
  for (const t of rows) {
    try {
      if (deveRebaixar(t.trial_ate, agora)) {
        if (await withSystem((db) => rebaixarParaBusca(db, t.id, 'trial_encerrado', 'agendador'))) rebaixadas++;
        continue;
      }
      const aviso = avisoDoDia(t.trial_ate, agora);
      if (!aviso) continue;
      const { rowCount } = await systemQuery('INSERT INTO plano_avisos (tenant_id, chave) VALUES ($1, $2) ON CONFLICT DO NOTHING', [
        t.id,
        `trial:${t.trial_ate}:${aviso}`,
      ]);
      if (!rowCount) continue;
      await enviarEmailTrial(t.id, aviso, { planoNome: t.plano_nome, ate: t.trial_ate });
      avisos++;
    } catch (err) {
      console.error(`[planos] varredura do trial falhou para ${t.id}:`, err);
    }
  }
  return { rebaixadas, avisos };
}

// ---------------------------------------------------------------------------
// Manager Hwesta (HCP)
// ---------------------------------------------------------------------------

/**
 * Push do Manager: `plan_slug` existente no catálogo troca o plano (motivo 'hwesta'); `capabilities` viram override
 * em hwesta_entitlements (a tabela passa a significar override + espelho do último push).
 */
export async function aplicarDoManager(tenantId: string, ent: HwestaEntitlements): Promise<boolean> {
  return withSystem(async (db) => {
    const { rows } = await db.query('SELECT 1 FROM tenants WHERE id = $1', [tenantId]);
    if (!rows.length) return false;
    await db.query(
      `INSERT INTO hwesta_entitlements (tenant_id, plan_slug, plan_name, status, capabilities, expires_at, source, pushed_at, synced_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, now())
       ON CONFLICT (tenant_id) DO UPDATE SET
         plan_slug = EXCLUDED.plan_slug, plan_name = EXCLUDED.plan_name, status = EXCLUDED.status,
         capabilities = EXCLUDED.capabilities, expires_at = EXCLUDED.expires_at, source = EXCLUDED.source,
         pushed_at = EXCLUDED.pushed_at, synced_at = now()`,
      [tenantId, ent.plan_slug, ent.plan_name, ent.status, JSON.stringify(ent.capabilities ?? {}), ent.expires_at, ent.source ?? null, ent.pushed_at ?? null]
    );
    if (ent.plan_slug) {
      const plano = await planoPorSlug(db, ent.plan_slug);
      if (plano) {
        if (plano.gratuito) await rebaixarParaBusca(db, tenantId, 'hwesta', 'hwesta', { status: ent.status });
        else await trocarPlano(db, tenantId, plano.id, { motivo: 'hwesta', origem: 'hwesta', dados: { status: ent.status, source: ent.source ?? null } });
      }
    }
    invalidar(tenantId);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Eventos de funil (upsell) e e-mails
// ---------------------------------------------------------------------------
export type TipoUpsell =
  | 'cadeado_visto' | 'cta_clicado' | 'planos_visitado' | 'trial_iniciado' | 'trial_recusado' | 'assinatura_concluida' | 'rebaixado'
  | 'checkout_iniciado';

/**
 * Evento do funil de upsell. Nunca lança nem aborta a transação de quem chama (SAVEPOINT): é métrica, não regra.
 * `usuarioId` null nos eventos do agendador.
 */
export async function registrarUpsell(db: Db, user: { id: string | null; tenantId: string }, tipo: TipoUpsell, recurso: string | null, dados: Record<string, unknown>): Promise<void> {
  try {
    await db.query('SAVEPOINT upsell');
    await db.query(
      `INSERT INTO busca_upsell_eventos (tenant_id, usuario_id, tipo, recurso, dados) VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [user.tenantId, user.id, tipo, recurso, JSON.stringify(dados)]
    );
    await db.query('RELEASE SAVEPOINT upsell');
  } catch (err) {
    await db.query('ROLLBACK TO SAVEPOINT upsell').catch(() => undefined);
    console.error('[planos] evento de upsell:', err);
  }
}

export async function destinatarios(db: Db, tenantId: string): Promise<{ nome: string; email: string; empresa: string }[]> {
  const { rows } = await db.query<{ nome: string; email: string; empresa: string }>(
    `SELECT u.nome, u.email, t.nome AS empresa
       FROM tenant_usuarios tu JOIN usuarios u ON u.id = tu.usuario_id JOIN tenants t ON t.id = tu.tenant_id
      WHERE tu.tenant_id = $1 AND tu.ativo AND tu.role IN ('owner', 'admin') AND u.email_verificado_em IS NOT NULL`,
    [tenantId]
  );
  return rows;
}

const dataBR = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '');

async function enviarEmailTrial(tenantId: string, tipo: AvisoTrial | 'inicio' | 'fim', ctx: { planoNome: string; ate: string }): Promise<void> {
  const pessoas = await withSystem((db) => destinatarios(db, tenantId));
  if (!pessoas.length) return;
  const empresa = pessoas[0].empresa;
  const textos: Record<typeof tipo, { assunto: string; titulo: string; paragrafos: (nome: string) => string[]; cta: { texto: string; url: string } }> = {
    inicio: {
      assunto: `Seu teste do plano ${ctx.planoNome} começou`,
      titulo: 'Seu teste grátis começou',
      paragrafos: (nome) => [
        `Olá, ${nome}!`,
        `A ${empresa} tem acesso a tudo do plano ${ctx.planoNome} até ${dataBR(ctx.ate)}. Explore o Painel de Propostas, os orçamentos em PDF, o Inbox e o resto do Banket.`,
        'Durante o teste você pode trocar de plano à vontade. Para continuar depois dele, assine em Configurações › Financeiro (cartão ou Pix). Sem assinatura, a empresa volta ao plano Busca sem perder nenhum dado.',
      ],
      cta: { texto: 'Abrir o Banket', url: appUrl('/dashboard') },
    },
    d7: {
      assunto: `Faltam 7 dias para o fim do seu teste do ${ctx.planoNome}`,
      titulo: 'Seu teste termina em 7 dias',
      paragrafos: (nome) => [
        `Olá, ${nome}!`,
        `O teste do plano ${ctx.planoNome} da ${empresa} vai até ${dataBR(ctx.ate)}. Para continuar com o Painel de Propostas, os orçamentos e o Inbox, assine o seu plano: no cartão, a cobrança pode ficar para o fim do teste.`,
      ],
      cta: { texto: 'Assinar o plano', url: appUrl('/configuracoes/financeiro') },
    },
    d1: {
      assunto: `Amanhã é o último dia do seu teste do ${ctx.planoNome}`,
      titulo: 'Seu teste termina amanhã',
      paragrafos: (nome) => [
        `Olá, ${nome}!`,
        `Amanhã (${dataBR(ctx.ate)}) é o último dia do teste do plano ${ctx.planoNome} da ${empresa}. Depois disso a empresa volta ao plano Busca: os dados ficam guardados, mas os módulos do plano deixam de abrir.`,
      ],
      cta: { texto: 'Assinar o plano', url: appUrl('/configuracoes/financeiro') },
    },
    d0: {
      assunto: `Hoje é o último dia do seu teste do ${ctx.planoNome}`,
      titulo: 'Último dia do teste',
      paragrafos: (nome) => [
        `Olá, ${nome}!`,
        `Hoje é o último dia do teste do plano ${ctx.planoNome} da ${empresa}. Amanhã, ao meio-dia, a empresa volta ao plano Busca. Para continuar sem interrupção, assine o seu plano.`,
      ],
      cta: { texto: 'Assinar o plano', url: appUrl('/configuracoes/financeiro') },
    },
    fim: {
      assunto: 'Seu período de teste terminou',
      titulo: 'Seu período de teste terminou',
      paragrafos: (nome) => [
        `Olá, ${nome}!`,
        `O teste do plano ${ctx.planoNome} da ${empresa} terminou e a empresa voltou ao plano Busca. Nada foi apagado: o perfil no Banket Busca e os pedidos continuam, e todo o resto fica guardado para quando você assinar um plano.`,
        'Usuários além do limite do plano gratuito ficaram sem acesso até a assinatura.',
      ],
      cta: { texto: 'Ver planos', url: appUrl('/planos') },
    },
  };
  const t = textos[tipo];
  for (const p of pessoas) {
    const { html, text } = emailLayout({
      titulo: t.titulo,
      paragrafos: t.paragrafos(p.nome.split(' ')[0]),
      cta: t.cta,
      rodape: `Você recebeu esta mensagem porque é responsável pela conta da ${empresa} no Banket.`,
    });
    await sendMail({ to: p.email, subject: t.assunto, html, text });
  }
}

// ---------------------------------------------------------------------------
// Contagens de uso dos limites (um SQL por recurso; rodam dentro do tenant)
// ---------------------------------------------------------------------------
export const CONTAGEM_SQL: Record<string, string> = {
  usuarios: `SELECT (SELECT count(*) FROM tenant_usuarios WHERE ativo)
                  + (SELECT count(*) FROM auth_tokens WHERE tipo = 'convite' AND usado_em IS NULL AND expira_em > now()) AS n`,
  espacos_qtd: 'SELECT count(*) AS n FROM espacos WHERE ativo',
  templates_qtd: 'SELECT count(*) AS n FROM orcamento_templates',
  cardapios_opcoes: 'SELECT count(*) AS n FROM cardapio_opcoes WHERE ativo',
  formularios_qtd: 'SELECT count(*) AS n FROM formularios WHERE ativo',
  documento_modelos: 'SELECT count(*) AS n FROM documento_modelos WHERE ativo',
  email_modelos: 'SELECT count(*) AS n FROM email_modelos WHERE ativo',
  estoque_itens: 'SELECT count(*) AS n FROM estoque_itens WHERE ativo',
  ia_analises_mes: `SELECT count(*) AS n FROM ia_analises
                     WHERE created_at >= date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo'`,
  ia_fundos_mes: `SELECT count(*) AS n FROM template_fundos_ia
                   WHERE created_at >= date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo'`,
};

/** Uso atual dos limites numéricos do plano (para /planos e para o card da sidebar). */
export async function usoDosLimites(db: Db, ent: Entitlements): Promise<Record<string, { uso: number; limite: number }>> {
  const saida: Record<string, { uso: number; limite: number }> = {};
  for (const [recurso, sql] of Object.entries(CONTAGEM_SQL)) {
    const v = ent.recursos[recurso];
    if (ent.semPlano || typeof v !== 'number' || v < 0) continue;
    const { rows } = await db.query<{ n: number }>(sql);
    saida[recurso] = { uso: Number(rows[0]?.n ?? 0), limite: v };
  }
  return saida;
}

export function invalidarMembros(tenantId: string, usuarioId?: string) {
  if (usuarioId) invalidateMembership(usuarioId, tenantId);
  else invalidateTenant(tenantId);
}
