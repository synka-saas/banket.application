import type { APIRoute } from 'astro';
import { setFlash } from '../../lib/flash';
import { setOnboardingCookie, setSessionCookie, signOnboarding, signSession } from '../../lib/auth';
import { sessaoDoUsuario, verificarEmail } from '../../server/autoatendimento';

// Link do e-mail de confirmação: valida a conta e segue para o cadastro da empresa.
export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const usuario = await verificarEmail(url.searchParams.get('token'));
  if (!usuario) {
    setFlash(cookies, 'error', 'Este link de confirmação é inválido ou expirou. Faça login para receber um novo.');
    return redirect('/auth/login');
  }
  // Conta que já tem empresa (ex.: aceitou um convite antes de confirmar): entra direto
  const sessao = await sessaoDoUsuario(usuario.id);
  if (sessao) {
    setSessionCookie(cookies, await signSession(sessao));
    return redirect('/dashboard');
  }
  setOnboardingCookie(cookies, await signOnboarding(usuario));
  return redirect('/auth/cadastro-complemento?validado=1');
};
