import type { APIRoute } from 'astro';
import { setFlash } from '../../lib/flash';
import { setOnboardingCookie, setSessionCookie, signOnboarding, signSession } from '../../lib/auth';
import { entrarComLink } from '../../server/autoatendimento';

// Link de acesso recebido por e-mail (uso único).
export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const r = await entrarComLink(url.searchParams.get('token'));
  if (r.tipo === 'sessao') {
    setSessionCookie(cookies, await signSession(r.usuario));
    return redirect('/dashboard');
  }
  if (r.tipo === 'onboarding') {
    setOnboardingCookie(cookies, await signOnboarding(r.usuario));
    return redirect('/auth/cadastro-complemento');
  }
  setFlash(cookies, 'error', 'Este link de acesso é inválido, expirou ou já foi usado. Peça um novo.');
  return redirect('/auth/link-acesso');
};
