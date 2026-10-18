// Confere, a cada requisição, se o vínculo usuário↔empresa continua ativo e qual o papel atual.
// Assim, desativar um usuário ou trocar seu papel vale imediatamente, sem esperar o JWT expirar.
// O status da empresa vem junto: suspensa/cancelada pelo Manager Hwesta (kill-switch), o middleware barra o acesso.
// Cache curto em memória evita uma consulta por requisição.
import { systemQuery } from './db';
import { normalizeRole, verifySession, type Role, type SessionUser } from './auth';

interface Membership {
  role: Role;
  nome: string;
  /** tenants.status: 'active' | 'suspended' | 'canceled' */
  tenantStatus: string;
  /** usuarios.sessoes_revogadas_em em segundos: sessão emitida antes não vale (troca ou redefinição de senha) */
  sessoesRevogadasEm: number | null;
}

const TTL_MS = 30_000;
const cache = new Map<string, { value: Membership | null; expires: number }>();

export async function getMembership(usuarioId: string, tenantId: string): Promise<Membership | null> {
  const key = `${usuarioId}:${tenantId}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;

  const { rows } = await systemQuery<{ role: string; nome: string; tenant_status: string; revogadas: number | null }>(
    `SELECT tu.role, u.nome, t.status AS tenant_status, (floor(extract(epoch FROM u.sessoes_revogadas_em)) - 1)::int8 AS revogadas
       FROM tenant_usuarios tu
       JOIN usuarios u ON u.id = tu.usuario_id
       JOIN tenants t ON t.id = tu.tenant_id
      WHERE tu.usuario_id = $1 AND tu.tenant_id = $2 AND tu.ativo`,
    [usuarioId, tenantId]
  );
  const value = rows[0]
    ? { role: normalizeRole(rows[0].role), nome: rows[0].nome, tenantStatus: rows[0].tenant_status, sessoesRevogadasEm: rows[0].revogadas }
    : null;
  cache.set(key, { value, expires: Date.now() + TTL_MS });
  return value;
}

/** Chamar após alterar papel/status de um usuário para refletir na hora. */
export function invalidateMembership(usuarioId: string, tenantId: string) {
  cache.delete(`${usuarioId}:${tenantId}`);
}

/** Derruba o cache de um usuário em todas as empresas (ex.: sessões revogadas pela troca de senha). */
export function invalidateUsuario(usuarioId: string) {
  for (const key of cache.keys()) if (key.startsWith(`${usuarioId}:`)) cache.delete(key);
}

/** Derruba o cache de todos os usuários de uma empresa (suspensão/reativação pelo Manager). */
export function invalidateTenant(tenantId: string) {
  for (const key of cache.keys()) if (key.endsWith(`:${tenantId}`)) cache.delete(key);
}

/**
 * Sessão do cookie conferida contra o banco: JWT válido, vínculo ativo e emitida depois da última troca de senha.
 * `sessao` sem `user` = cookie que não vale mais (vínculo desativado ou removido; `revogada` se a senha mudou).
 * Usada pelo middleware e pela verificação da Central de Ajuda (/api/ajuda/sessao).
 */
export async function conferirSessao(token: string | undefined): Promise<{
  sessao: SessionUser | null;
  membership: Membership | null;
  revogada: boolean;
  user: SessionUser | null;
}> {
  const sessao = await verifySession(token);
  const vinculo = sessao ? await getMembership(sessao.id, sessao.tenantId) : null;
  // Sessão emitida antes de uma troca ou redefinição de senha não vale mais (cookie roubado deixa de funcionar)
  const revogada = Boolean(sessao && vinculo?.sessoesRevogadasEm && (sessao.emitidaEm ?? 0) < vinculo.sessoesRevogadasEm);
  const membership = revogada ? null : vinculo;
  const user = sessao && membership ? { ...sessao, role: membership.role, nome: membership.nome } : null;
  return { sessao, membership, revogada, user };
}
