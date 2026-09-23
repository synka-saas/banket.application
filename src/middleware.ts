import { defineMiddleware } from 'astro:middleware';
import { SESSION_COOKIE, clearSessionCookie, isAdmin, verifySession } from './lib/auth';
import { consumeFlash, setFlash } from './lib/flash';
import { getMembership } from './lib/membership';

// Rotas acessíveis sem sessão
// /print/* é acessado pelo Chromium interno e exige um token de impressão (lib/printToken)
const PUBLIC_PREFIXES = ['/auth/', '/f/', '/api/public/', '/print/', '/_astro/', '/_image'];
const PUBLIC_EXACT = new Set(['/api/health']);

// Rotas restritas a owner/admin
const ADMIN_PREFIXES = ['/configuracoes', '/api/configuracoes'];

function isPublic(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  // Arquivos estáticos de /public (logo, favicon, imagens). Uploads são sempre protegidos.
  return !pathname.startsWith('/uploads/') && /\.(png|jpe?g|svg|ico|webp|gif|css|js|map|woff2?|ttf|txt)$/i.test(pathname);
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  context.locals.flash = consumeFlash(context.cookies);

  if (isPublic(pathname)) return next();

  const session = await verifySession(context.cookies.get(SESSION_COOKIE)?.value);
  const membership = session ? await getMembership(session.id, session.tenantId) : null;
  const user = session && membership ? { ...session, role: membership.role, nome: membership.nome } : null;
  if (session && !membership) {
    clearSessionCookie(context.cookies);
    setFlash(context.cookies, 'error', 'Seu acesso a esta empresa foi desativado.');
  }
  if (!user) {
    if (pathname.startsWith('/api/')) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }
    const destino = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname + context.url.search)}`;
    return context.redirect(`/auth/login${destino}`);
  }
  context.locals.user = user;

  if (ADMIN_PREFIXES.some((p) => pathname.startsWith(p)) && !isAdmin(user)) {
    if (pathname.startsWith('/api/')) {
      return Response.json({ error: 'Acesso restrito a administradores' }, { status: 403 });
    }
    setFlash(context.cookies, 'error', 'Acesso restrito a administradores.');
    return context.redirect('/dashboard');
  }

  return next();
});
