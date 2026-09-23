import { SignJWT, jwtVerify } from 'jose';
import type { AstroCookies } from 'astro';

export const SESSION_COOKIE = 'banket_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 dias

export type Role = 'owner' | 'admin' | 'usuario';

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  usuario: 'Usuário',
};

export interface SessionUser {
  id: string;
  nome: string;
  email: string;
  tenantId: string;
  role: Role;
}

let secretKey: Uint8Array | null = null;
function getSecret(): Uint8Array {
  if (secretKey) return secretKey;
  const secret = process.env.JWT_SECRET ?? (import.meta.env as Record<string, string | undefined>).JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET ausente ou curto demais (mínimo 32 caracteres). Configure-o no .env.');
  }
  secretKey = new TextEncoder().encode(secret);
  return secretKey;
}

export function normalizeRole(role: string | null | undefined): Role {
  if (role === 'owner' || role === 'admin') return role;
  return 'usuario';
}

export function isAdmin(user: Pick<SessionUser, 'role'> | null | undefined): boolean {
  return user?.role === 'owner' || user?.role === 'admin';
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({ nome: user.nome, email: user.email, tenant_id: user.tenantId, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySession(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.sub || typeof payload.tenant_id !== 'string') return null;
    return {
      id: payload.sub,
      nome: String(payload.nome ?? ''),
      email: String(payload.email ?? ''),
      tenantId: payload.tenant_id,
      role: normalizeRole(payload.role as string),
    };
  } catch {
    return null;
  }
}

export function setSessionCookie(cookies: AstroCookies, token: string) {
  cookies.set(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(cookies: AstroCookies) {
  cookies.delete(SESSION_COOKIE, { path: '/' });
}
