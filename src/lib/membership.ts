// Confere, a cada requisição, se o vínculo usuário↔empresa continua ativo e qual o papel atual.
// Assim, desativar um usuário ou trocar seu papel vale imediatamente, sem esperar o JWT expirar.
// Cache curto em memória evita uma consulta por requisição.
import { systemQuery } from './db';
import { normalizeRole, type Role } from './auth';

interface Membership {
  role: Role;
  nome: string;
}

const TTL_MS = 30_000;
const cache = new Map<string, { value: Membership | null; expires: number }>();

export async function getMembership(usuarioId: string, tenantId: string): Promise<Membership | null> {
  const key = `${usuarioId}:${tenantId}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;

  const { rows } = await systemQuery<{ role: string; nome: string }>(
    `SELECT tu.role, u.nome
       FROM tenant_usuarios tu JOIN usuarios u ON u.id = tu.usuario_id
      WHERE tu.usuario_id = $1 AND tu.tenant_id = $2 AND tu.ativo`,
    [usuarioId, tenantId]
  );
  const value = rows[0] ? { role: normalizeRole(rows[0].role), nome: rows[0].nome } : null;
  cache.set(key, { value, expires: Date.now() + TTL_MS });
  return value;
}

/** Chamar após alterar papel/status de um usuário para refletir na hora. */
export function invalidateMembership(usuarioId: string, tenantId: string) {
  cache.delete(`${usuarioId}:${tenantId}`);
}
