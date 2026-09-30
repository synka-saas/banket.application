// Confere, a cada requisição, se o vínculo usuário↔empresa continua ativo e qual o papel atual.
// Assim, desativar um usuário ou trocar seu papel vale imediatamente, sem esperar o JWT expirar.
// O status da empresa vem junto: suspensa/cancelada pelo Manager Hwesta (kill-switch), o middleware barra o acesso.
// Cache curto em memória evita uma consulta por requisição.
import { systemQuery } from './db';
import { normalizeRole, type Role } from './auth';

interface Membership {
  role: Role;
  nome: string;
  /** tenants.status: 'active' | 'suspended' | 'canceled' */
  tenantStatus: string;
}

const TTL_MS = 30_000;
const cache = new Map<string, { value: Membership | null; expires: number }>();

export async function getMembership(usuarioId: string, tenantId: string): Promise<Membership | null> {
  const key = `${usuarioId}:${tenantId}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;

  const { rows } = await systemQuery<{ role: string; nome: string; tenant_status: string }>(
    `SELECT tu.role, u.nome, t.status AS tenant_status
       FROM tenant_usuarios tu
       JOIN usuarios u ON u.id = tu.usuario_id
       JOIN tenants t ON t.id = tu.tenant_id
      WHERE tu.usuario_id = $1 AND tu.tenant_id = $2 AND tu.ativo`,
    [usuarioId, tenantId]
  );
  const value = rows[0]
    ? { role: normalizeRole(rows[0].role), nome: rows[0].nome, tenantStatus: rows[0].tenant_status }
    : null;
  cache.set(key, { value, expires: Date.now() + TTL_MS });
  return value;
}

/** Chamar após alterar papel/status de um usuário para refletir na hora. */
export function invalidateMembership(usuarioId: string, tenantId: string) {
  cache.delete(`${usuarioId}:${tenantId}`);
}

/** Derruba o cache de todos os usuários de uma empresa (suspensão/reativação pelo Manager). */
export function invalidateTenant(tenantId: string) {
  for (const key of cache.keys()) if (key.endsWith(`:${tenantId}`)) cache.delete(key);
}
