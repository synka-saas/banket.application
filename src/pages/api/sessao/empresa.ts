import type { APIRoute } from 'astro';
import { setSessionCookie, signSession } from '../../../lib/auth';
import { setFlash } from '../../../lib/flash';
import { sessaoDoUsuario } from '../../../server/autoatendimento';

// Troca a empresa ativa da sessão (usuário vinculado a mais de uma empresa).
export const POST: APIRoute = async ({ request, locals, cookies, redirect }) => {
  const tenantId = (await request.formData()).get('tenant_id')?.toString() ?? '';
  const sessao = /^[0-9a-f-]{36}$/i.test(tenantId) ? await sessaoDoUsuario(locals.user.id, tenantId) : null;
  if (!sessao) {
    setFlash(cookies, 'error', 'Você não tem acesso a essa empresa.');
    return redirect('/dashboard');
  }
  setSessionCookie(cookies, await signSession(sessao));
  return redirect('/dashboard');
};
