// Adapter HCP do Banket. Destino: src/lib/hwesta/adapter.ts
// Modelo: tenants (conta) N:N usuarios via tenant_usuarios(role, ativo). Sem planos no app:
// o catálogo vive no Manager e chega aqui como snapshot em hwesta_entitlements.
import pkg from '../../../package.json';
import { systemQuery, withSystem } from '../db';
import { invalidateTenant } from '../membership';
import {
  HwestaError,
  type HwestaAccount, type HwestaAccountStatus, type HwestaAdapter, type HwestaEntitlements, type HwestaEvent, type HwestaUser,
} from './types';

const ACCOUNT_SQL = `
  SELECT t.id, t.nome, t.razao_social, t.documento, t.email, t.telefone, t.status, t.slug,
         t.tipo_pessoa, t.segmento, t.porte, t.onboarding_completo, t.created_at, t.updated_at,
         o.nome AS owner_name, o.email AS owner_email, o.telefone AS owner_phone,
         (SELECT count(*)::int FROM tenant_usuarios tu WHERE tu.tenant_id = t.id AND tu.ativo) AS user_count,
         e.plan_slug, e.plan_name, e.status AS ent_status
    FROM tenants t
    LEFT JOIN LATERAL (
      SELECT u.nome, u.email, u.telefone
        FROM tenant_usuarios tu JOIN usuarios u ON u.id = tu.usuario_id
       WHERE tu.tenant_id = t.id AND tu.role = 'owner'
       ORDER BY tu.created_at ASC LIMIT 1
    ) o ON true
    LEFT JOIN hwesta_entitlements e ON e.tenant_id = t.id`;

const iso = (v: unknown): string | null => (v ? new Date(v as string).toISOString() : null);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toAccount(r: any): HwestaAccount {
  const commercial: HwestaAccountStatus = ['trial', 'past_due'].includes(r.ent_status) ? r.ent_status : 'active';
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
    extra: { slug: r.slug, tipo_pessoa: r.tipo_pessoa, segmento: r.segmento, porte: r.porte, onboarding_completo: r.onboarding_completo },
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
    accounts: true, users: true, plans_catalog: false, entitlements_push: true, kill_switch: true,
    users_status: true, users_reset_password: false, events: true, tickets: true,
  },

  async listPlans() { return []; },

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

  async applyEntitlements(accountId, ent) {
    if (!UUID_RE.test(accountId)) return false;
    const { rowCount } = await systemQuery(
      `INSERT INTO hwesta_entitlements (tenant_id, plan_slug, plan_name, status, capabilities, expires_at, source, pushed_at, synced_at)
       SELECT t.id, $2, $3, $4, $5::jsonb, $6, $7, $8, now() FROM tenants t WHERE t.id = $1
       ON CONFLICT (tenant_id) DO UPDATE SET
         plan_slug = EXCLUDED.plan_slug, plan_name = EXCLUDED.plan_name, status = EXCLUDED.status,
         capabilities = EXCLUDED.capabilities, expires_at = EXCLUDED.expires_at, source = EXCLUDED.source,
         pushed_at = EXCLUDED.pushed_at, synced_at = now()`,
      [accountId, ent.plan_slug, ent.plan_name, ent.status, JSON.stringify(ent.capabilities ?? {}), ent.expires_at, ent.source ?? null, ent.pushed_at ?? null]);
    return (rowCount ?? 0) > 0;
  },

  async getEntitlements(accountId) {
    if (!UUID_RE.test(accountId)) return null;
    const { rows } = await systemQuery(
      `SELECT plan_slug, plan_name, status, capabilities, expires_at, source, pushed_at FROM hwesta_entitlements WHERE tenant_id = $1`, [accountId]);
    const r = rows[0];
    if (!r) return null;
    return { ...r, expires_at: iso(r.expires_at), pushed_at: iso(r.pushed_at) ?? undefined } as HwestaEntitlements;
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
