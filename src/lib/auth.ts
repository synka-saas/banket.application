import { SignJWT, jwtVerify } from 'jose';
import type { AstroCookies } from 'astro';

export const SESSION_COOKIE = 'banket_session';
/**
 * Com COOKIE_DOMAIN (produção: ".banket.com.br") a sessão vale em app.banket.com.br e em busca.banket.com.br. Ela usa um
 * nome próprio para não colidir com o cookie antigo, só do host do app (que continua aceito até expirar).
 */
export const SESSION_COOKIE_DOMINIO = 'banket_sessao';

function env(name: string): string | undefined {
  return process.env[name] ?? (import.meta.env as Record<string, string | undefined>)[name];
}
/** Domínio dos cookies de sessão e de onboarding (ex.: ".banket.com.br"); vazio = só o host atual. */
export const dominioCookies = (): string | undefined => env('COOKIE_DOMAIN')?.trim() || undefined;

/** Token de sessão da requisição: o do domínio (subdomínios) ou o antigo, do host do app. */
export function lerTokenSessao(cookies: AstroCookies): string | undefined {
  return cookies.get(SESSION_COOKIE_DOMINIO)?.value ?? cookies.get(SESSION_COOKIE)?.value;
}
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

export function setSessionCookie(cookies: AstroCookies, token: string, persistente = true) {
  const dominio = dominioCookies();
  cookies.set(dominio ? SESSION_COOKIE_DOMINIO : SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
    ...(dominio ? { domain: dominio } : {}),
    // Sem "manter conectado", o cookie dura só a sessão do navegador (o JWT continua com validade própria)
    ...(persistente ? { maxAge: SESSION_TTL_SECONDS } : {}),
  });
  // Ao passar a usar o cookie do domínio, o antigo (só do host) sai
  if (dominio && cookies.has(SESSION_COOKIE)) cookies.delete(SESSION_COOKIE, { path: '/' });
}

export function clearSessionCookie(cookies: AstroCookies) {
  const dominio = dominioCookies();
  cookies.delete(SESSION_COOKIE, { path: '/' });
  if (dominio) cookies.delete(SESSION_COOKIE_DOMINIO, { path: '/', domain: dominio });
}

// ---------------------------------------------------------------------------
// Onboarding: conta com e-mail confirmado que ainda não tem empresa. Cookie curto e separado da sessão,
// aceito só pela tela de cadastro complementar.
// ---------------------------------------------------------------------------
export const ONBOARDING_COOKIE = 'banket_onboarding';
const ONBOARDING_TTL_SECONDS = 60 * 60 * 2; // 2 horas

export interface OnboardingUser {
  id: string;
  nome: string;
  email: string;
}

export async function signOnboarding(user: OnboardingUser): Promise<string> {
  return new SignJWT({ nome: user.nome, email: user.email, purpose: 'onboarding' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${ONBOARDING_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifyOnboarding(token: string | undefined): Promise<OnboardingUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.purpose !== 'onboarding' || !payload.sub) return null;
    return { id: payload.sub, nome: String(payload.nome ?? ''), email: String(payload.email ?? '') };
  } catch {
    return null;
  }
}

export function setOnboardingCookie(cookies: AstroCookies, token: string) {
  const dominio = dominioCookies();
  cookies.set(ONBOARDING_COOKIE, token, {
    path: '/auth',
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
    ...(dominio ? { domain: dominio } : {}),
    maxAge: ONBOARDING_TTL_SECONDS,
  });
}

export function clearOnboardingCookie(cookies: AstroCookies) {
  const dominio = dominioCookies();
  cookies.delete(ONBOARDING_COOKIE, { path: '/auth', ...(dominio ? { domain: dominio } : {}) });
}
