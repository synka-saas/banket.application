// Adapter HCP do Banket. Destino: src/lib/hwesta/adapter.ts
// Modelo: tenants (conta) N:N usuarios via tenant_usuarios(role, ativo). O catálogo de planos é do próprio
// Banket (tabela `planos`, migration 031; plans_catalog = true): o Manager lê o catálogo, troca o plano de uma
// conta por `plan_slug` e envia `capabilities` como override por conta (hwesta_entitlements).
import pkg from '../../../package.json';
import { systemQuery, withSystem } from '../db';
import { invalidateTenant } from '../membership';
import { aplicarDoManager } from '../../server/planos';
import {
  HwestaError,
  type HwestaAccount, type HwestaAccountStatus, type HwestaAdapter, type HwestaEntitlements, type HwestaEvent, type HwestaPlan, type HwestaUser,
} from './types';

const ACCOUNT_SQL = `
  SELECT t.id, t.nome, t.razao_social, t.documento, t.email, t.telefone, t.status, t.slug,
         t.tipo_pessoa, t.segmento, t.porte, t.onboarding_completo, t.created_at, t.updated_at,
         t.trial_ate, t.origem_cadastro,
         o.nome AS owner_name, o.email AS owner_email, o.telefone AS owner_phone,
         (SELECT count(*)::int FROM tenant_usuarios tu WHERE tu.tenant_id = t.id AND tu.ativo) AS user_count,
         p.slug AS plan_slug, p.nome AS plan_name, p.gratuito AS plan_free,
         (t.trial_ate IS NOT NULL AND NOT p.gratuito AND t.trial_ate >= (now() AT TIME ZONE 'America/Sao_Paulo')::date) AS em_trial,
         e.status AS ent_status
    FROM tenants t
    LEFT JOIN LATERAL (
      SELECT u.nome, u.email, u.telefone
        FROM tenant_usuarios tu JOIN usuarios u ON u.id = tu.usuario_id
       WHERE tu.tenant_id = t.id AND tu.role = 'owner'
       ORDER BY tu.created_at ASC LIMIT 1
    ) o ON true
    LEFT JOIN planos p ON p.id = t.plano_id
    LEFT JOIN hwesta_entitlements e ON e.tenant_id = t.id`;

const iso = (v: unknown): string | null => (v ? new Date(v as string).toISOString() : null);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toAccount(r: any): HwestaAccount {
  // Em teste → 'trial'; inadimplência vem do Manager (past_due) até o Stripe existir no app
  const commercial: HwestaAccountStatus = r.em_trial ? 'trial' : r.ent_status === 'past_due' ? 'past_due' : 'active';
  return {
    id: r.id,
    name: r.nome,
    legal_name: r.razao_social ?? null,
    tax_id: r.documento ?? null,
    email: r.email ?? null,
    owner_name: r.owner_name ?? null,
    owner_email: r.owner_email ?? r.email ?? null,
    owner_phone: r.owner_phone ?? r.telefone ?? null,
    status: r.status === 'active' ? commercial : r.status,
    is_active: r.status === 'active',
    plan_slug: r.plan_slug ?? null,
    plan_name: r.plan_name ?? null,
    user_count: r.user_count ?? 0,
    created_at: iso(r.created_at),
    updated_at: iso(r.updated_at),
    extra: {
      slug: r.slug, tipo_pessoa: r.tipo_pessoa, segmento: r.segmento, porte: r.porte, onboarding_completo: r.onboarding_completo,
      plan_free: r.plan_free ?? null, trial_ends_at: r.trial_ate ? String(r.trial_ate).slice(0, 10) : null, signup_source: r.origem_cadastro ?? 'site',
    },
  };
}

function toUser(r: any): HwestaUser {
  return {
    id: r.id, name: r.nome, email: r.email, role: r.role,
    status: r.ativo ? 'active' : 'inactive',
    last_login_at: null, created_at: iso(r.created_at),
  };
}

const adapter: HwestaAdapter = {
  appId: 'banket',
  name: 'Banket',
  version: (pkg as { version?: string }).version ?? '0.0.0',
  capabilities: {
    accounts: true, users: true, plans_catalog: true, entitlements_push: true, kill_switch: true,
    users_status: true, users_reset_password: false, events: true, tickets: true,
  },

  /** Catálogo do Banket (tabela planos): um item por plano ativo, com os recursos como capabilities. */
  async listPlans(): Promise<HwestaPlan[]> {
    const { rows } = await systemQuery(
      `SELECT id, slug, nome, gratuito, publico, ativo, preco_mensal, recursos FROM planos WHERE ativo ORDER BY ordem, nome`
    );
    return rows.map((p: any) => ({
      id: p.id, slug: p.slug, name: p.nome, price: Number(p.preco_mensal ?? 0), billing_cycle: 'monthly' as const,
      is_active: p.ativo, capabilities: { ...(p.recursos ?? {}), is_free: p.gratuito, is_public: p.publico },
    }));
  },

  async listAccounts({ page, perPage, updatedSince, q }) {
    const where = `WHERE ($1::text IS NULL OR t.nome ILIKE '%' || $1 || '%' OR t.razao_social ILIKE '%' || $1 || '%'
                          OR t.documento ILIKE '%' || $1 || '%' OR t.email ILIKE '%' || $1 || '%')
                     AND ($2::timestamptz IS NULL OR t.updated_at >= $2::timestamptz)`;
    const args = [q?.trim() || null, updatedSince || null];
    const [rows, count] = await Promise.all([
      systemQuery(`${ACCOUNT_SQL} ${where} ORDER BY t.created_at DESC LIMIT $3 OFFSET $4`, [...args, perPage, (page - 1) * perPage]),
      systemQuery<{ total: number }>(`SELECT count(*)::int AS total FROM tenants t ${where}`, args),
    ]);
    return { data: rows.rows.map(toAccount), total: count.rows[0]?.total ?? 0 };
  },

  async getAccount(id) {
    if (!UUID_RE.test(id)) return null;
    const { rows } = await systemQuery(`${ACCOUNT_SQL} WHERE t.id = $1`, [id]);
    return rows[0] ? toAccount(rows[0]) : null;
  },

  async listUsers(accountId) {
    if (!UUID_RE.test(accountId)) return [];
    const { rows } = await systemQuery(
      `SELECT u.id, u.nome, u.email, u.email_verificado_em, tu.role, tu.ativo, tu.created_at
         FROM tenant_usuarios tu JOIN usuarios u ON u.id = tu.usuario_id
        WHERE tu.tenant_id = $1 ORDER BY tu.created_at ASC`, [accountId]);
    return rows.map(toUser);
  },

  async setAccountStatus(id, status, reason) {
    if (!UUID_RE.test(id)) return null;
    const { rowCount } = await systemQuery(
      `UPDATE tenants SET status = $2::text,
              suspenso_em = CASE WHEN $2::text = 'active' THEN NULL ELSE now() END,
              suspenso_motivo = CASE WHEN $2::text = 'active' THEN NULL ELSE $3::text END,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $1`, [id, status, reason]);
    if (!rowCount) return null;
    invalidateTenant(id); // o middleware passa a barrar a conta já na próxima requisição deste processo
    return adapter.getAccount(id);
  },

  /**
   * Push do Manager: `plan_slug` do catálogo troca o plano da conta (server/planos.ts, com histórico);
   * `capabilities` ficam como override por conta. `plan_slug` desconhecido → 409.
   */
  async applyEntitlements(accountId, ent) {
    if (!UUID_RE.test(accountId)) return false;
    if (ent.plan_slug) {
      const { rows } = await systemQuery('SELECT 1 FROM planos WHERE slug = $1 AND ativo', [ent.plan_slug]);
      if (!rows.length) throw new HwestaError(`Plano "${ent.plan_slug}" não existe no catálogo do Banket.`, 409);
    }
    return aplicarDoManager(accountId, ent);
  },

  /** Plano atual (fonte: tenants.plano_id) + override enviado pelo Manager. */
  async getEntitlements(accountId) {
    if (!UUID_RE.test(accountId)) return null;
    const { rows } = await systemQuery(
      `SELECT p.slug AS plan_slug, p.nome AS plan_name, p.recursos,
              (t.trial_ate IS NOT NULL AND NOT p.gratuito AND t.trial_ate >= (now() AT TIME ZONE 'America/Sao_Paulo')::date) AS em_trial,
              t.trial_ate, e.capabilities, e.expires_at, e.source, e.pushed_at
         FROM tenants t LEFT JOIN planos p ON p.id = t.plano_id LEFT JOIN hwesta_entitlements e ON e.tenant_id = t.id
        WHERE t.id = $1`, [accountId]);
    const r = rows[0];
    if (!r) return null;
    return {
      plan_slug: r.plan_slug ?? null, plan_name: r.plan_name ?? null, status: r.em_trial ? 'trial' : 'active',
      capabilities: { ...(r.recursos ?? {}), ...(r.capabilities ?? {}) },
      expires_at: r.trial_ate ? String(r.trial_ate).slice(0, 10) : iso(r.expires_at),
      source: r.source ?? undefined, pushed_at: iso(r.pushed_at) ?? undefined,
    } as HwestaEntitlements;
  },

  async setUserStatus(accountId, userId, status) {
    if (!UUID_RE.test(accountId) || !UUID_RE.test(userId)) return null;
    return withSystem(async (db) => {
      // Não deixa a empresa sem nenhum proprietário ativo.
      if (status === 'inactive') {
        const { rows } = await db.query(
          `SELECT (SELECT role FROM tenant_usuarios WHERE tenant_id = $1 AND usuario_id = $2) AS role,
                  (SELECT count(*)::int FROM tenant_usuarios WHERE tenant_id = $1 AND role = 'owner' AND ativo) AS owners`, [accountId, userId]);
        if (rows[0]?.role === 'owner' && rows[0].owners <= 1) throw new HwestaError('A empresa precisa de ao menos um proprietário ativo.');
      }
      const { rows } = await db.query(
        `UPDATE tenant_usuarios tu SET ativo = $3 FROM usuarios u
          WHERE tu.tenant_id = $1 AND tu.usuario_id = $2 AND u.id = tu.usuario_id
        RETURNING u.id, u.nome, u.email, u.email_verificado_em, tu.role, tu.ativo, tu.created_at`,
        [accountId, userId, status === 'active']);
      if (!rows[0]) return null;
      invalidateTenant(accountId);
      return toUser(rows[0]);
    });
  },

  async recordEvent(event: HwestaEvent) {
    const { rowCount } = await systemQuery(
      `INSERT INTO hwesta_events (id, type, payload) VALUES ($1, $2, $3::jsonb) ON CONFLICT (id) DO NOTHING`,
      [event.id, event.type, JSON.stringify(event)]);
    return (rowCount ?? 0) > 0;
  },

  async onEvent(event) {
    // O Banket ainda não tem central de notificações: o evento fica registrado em hwesta_events e a
    // resposta do suporte aparece quando o usuário abre o chamado (a tela lê do Manager ao vivo).
    // Quando houver notificações in-app/e-mail, disparar aqui para event.data.user_id.
    await systemQuery(`UPDATE hwesta_events SET processed_at = now() WHERE id = $1`, [event.id]);
  },

  resolveRequester({ locals }) {
    const u = locals.user;
    if (!u?.id || !u?.tenantId) return null;
    return { userId: u.id, accountId: u.tenantId, name: u.nome ?? null, email: u.email ?? null };
  },
};

export default adapter;
