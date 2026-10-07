import type { APIRoute } from 'astro';
import crypto from 'node:crypto';
import { setFlash } from '../../../lib/flash';
import { assinarEstado, googleConfigurado, urlAutorizacao } from '../../../lib/google';
import { NONCE_COOKIE } from '../../auth/google';

// Vincula a conta Google ao usuário logado (ou reativa a agenda: ?agenda=1 força o consentimento e um refresh token novo).
export const GET: APIRoute = async ({ url, cookies, locals, redirect }) => {
  if (!googleConfigurado()) {
    setFlash(cookies, 'error', 'O login com o Google não está configurado neste servidor.');
    return redirect('/conta');
  }
  const nonce = crypto.randomBytes(16).toString('base64url');
  cookies.set(NONCE_COOKIE, nonce, { path: '/auth', httpOnly: true, secure: import.meta.env.PROD, sameSite: 'lax', maxAge: 600 });
  const state = await assinarEstado({ modo: 'vincular', usuarioId: locals.user.id, nonce });
  return redirect(urlAutorizacao(state, { forcarConsentimento: url.searchParams.get('agenda') === '1', loginHint: locals.user.email }));
};
