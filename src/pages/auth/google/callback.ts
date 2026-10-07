import type { APIRoute } from 'astro';
import { SESSION_COOKIE, setOnboardingCookie, setSessionCookie, signOnboarding, signSession, verifySession } from '../../../lib/auth';
import { setFlash } from '../../../lib/flash';
import { userMessage } from '../../../lib/forms';
import { trocarCodigo, verificarEstado } from '../../../lib/google';
import { entrarComGoogle, vincularGoogle } from '../../../server/googleConta';
import { NONCE_COOKIE } from '../google';

// Retorno do Google (login ou vínculo da conta). O state assinado precisa casar com o nonce do cookie.
export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const estado = await verificarEstado(url.searchParams.get('state'));
  const nonce = cookies.get(NONCE_COOKIE)?.value;
  cookies.delete(NONCE_COOKIE, { path: '/auth' });
  const voltar = estado?.modo === 'vincular' ? '/conta' : '/auth/login';

  if (!estado || !nonce || nonce !== estado.nonce) {
    setFlash(cookies, 'error', 'Não foi possível validar o retorno do Google. Tente novamente.');
    return redirect(voltar);
  }
  const code = url.searchParams.get('code');
  if (!code) {
    const erro = url.searchParams.get('error');
    setFlash(cookies, 'error', erro === 'access_denied' ? 'Acesso com o Google cancelado.' : 'O Google não autorizou o acesso. Tente novamente.');
    return redirect(voltar);
  }

  try {
    const tokens = await trocarCodigo(code);

    if (estado.modo === 'vincular') {
      const sessao = await verifySession(cookies.get(SESSION_COOKIE)?.value);
      if (!sessao || sessao.id !== estado.usuarioId) {
        setFlash(cookies, 'error', 'Entre na sua conta para vincular o Google.');
        return redirect('/auth/login?next=%2Fconta');
      }
      const conta = await vincularGoogle(sessao.id, tokens);
      setFlash(
        cookies,
        conta.agenda_ativa ? 'success' : 'info',
        conta.agenda_ativa
          ? `Conta Google ${conta.email} vinculada. A agenda está ativa: você já pode agendar reuniões com Google Meet.`
          : `Conta Google ${conta.email} vinculada, mas sem acesso à agenda. Use "Ativar agenda" e aceite a permissão do Google Agenda.`
      );
      return redirect('/conta');
    }

    const r = await entrarComGoogle(tokens);
    switch (r.tipo) {
      case 'sessao':
        setSessionCookie(cookies, await signSession(r.usuario));
        return redirect(estado.next ?? '/dashboard');
      case 'onboarding':
        setOnboardingCookie(cookies, await signOnboarding(r.usuario));
        return redirect('/auth/cadastro-complemento');
      default:
        setFlash(cookies, 'error', 'Sua conta não tem acesso ativo a nenhuma empresa. Peça um convite ao administrador.');
        return redirect('/auth/login');
    }
  } catch (err) {
    console.error('[google] falha no callback OAuth', err);
    setFlash(cookies, 'error', userMessage(err, 'Não foi possível concluir o acesso com o Google. Tente novamente.'));
    return redirect(voltar);
  }
};
