import type { APIRoute } from 'astro';
import crypto from 'node:crypto';
import { setFlash } from '../../lib/flash';
import { assinarEstado, googleConfigurado, urlAutorizacao } from '../../lib/google';

export const NONCE_COOKIE = 'banket_google_nonce';

/** Começa o login com o Google: state assinado + nonce em cookie, e redireciona para o consentimento. */
export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  if (!googleConfigurado()) {
    setFlash(cookies, 'error', 'O login com o Google não está configurado neste servidor.');
    return redirect('/auth/login');
  }
  const nextParam = url.searchParams.get('next') ?? '';
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : undefined;
  const nonce = crypto.randomBytes(16).toString('base64url');
  cookies.set(NONCE_COOKIE, nonce, { path: '/auth', httpOnly: true, secure: import.meta.env.PROD, sameSite: 'lax', maxAge: 600 });
  const state = await assinarEstado({ modo: 'login', next, nonce });
  return redirect(urlAutorizacao(state, { loginHint: url.searchParams.get('email') ?? undefined }));
};
