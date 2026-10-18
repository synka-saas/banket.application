import type { APIContext, MiddlewareNext } from 'astro';
import { defineMiddleware } from 'astro:middleware';
import { lerTokenSessao, clearSessionCookie, isAdmin, verifySession } from './lib/auth';
import { consumeFlash, setFlash } from './lib/flash';
import { getMembership } from './lib/membership';
import { ErroPlano, entitlements, podeUsarEm } from './lib/planos/gating';
import { inicioDoPlano, recursoDaRota } from './lib/planos/rotas';
import { PAGINA_ESCOLHA_PLANO, deveEscolherPlano, verificarTrialVencido } from './server/planos';
import { iniciarAgendador } from './server/agendador';
import { decidirHost } from './lib/busca/host';
import { appUrl } from './lib/mail';
import { hostVitrine, urlVitrine } from './lib/busca/url';

// Agendador do app (trials): um por processo, iniciado junto com o middleware
iniciarAgendador();

// Rotas acessíveis sem sessão
// /print/* é acessado pelo Chromium interno e exige um token de impressão (lib/printToken)
// /api/hwesta/* é chamado pelo Manager Hwesta (HCP): a autenticação é por Bearer nas próprias rotas (lib/hwesta)
// /api/webhooks/* recebe os webhooks do Resend (assinatura Svix conferida na própria rota)
// /p/* é a pesquisa de satisfação respondida pelo cliente (link com token)
// /busca-media/* serve só as fotos públicas do Banket Busca; /api/vitrine/* é a API pública da vitrine
const PUBLIC_PREFIXES = ['/auth/', '/f/', '/p/', '/api/public/', '/api/hwesta/', '/api/webhooks/', '/print/', '/_astro/', '/_image', '/busca-media/', '/api/vitrine/'];
const PUBLIC_EXACT = new Set(['/api/health', '/termos', '/privacidade']);

// Rotas restritas a owner/admin (inclui a aba Finanças do evento)
const ADMIN_PREFIXES = ['/configuracoes', '/api/configuracoes', '/financeiro', '/api/financeiro'];
const ADMIN_PADROES = [/^\/eventos\/[^/]+\/financas(\/|$)/];

// Empresa suspensa pelo Manager (kill-switch): só o aviso e a troca de empresa continuam acessíveis
const PAGINA_SUSPENSA = '/conta-suspensa';
const LIBERADAS_SUSPENSA = new Set([PAGINA_SUSPENSA, '/api/sessao/empresa']);

function isPublic(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  // Arquivos estáticos de /public (logo, favicon, imagens): só na raiz ou nas pastas de /public. Uma rota dinâmica com
  // extensão no fim (/eventos/x.png) não vira pública. Uploads são sempre protegidos.
  return /^\/(?:(?:busca|busca-demo|fonts|ref)\/(?:[^/]+\/)*)?[^/]+\.(?:png|jpe?g|svg|ico|webp|gif|css|js|map|woff2?|ttf|txt|pdf)$/i.test(pathname);
}

// Cabeçalhos de segurança em todas as respostas. O formulário público (/f/) pode ser incorporado
// no site do buffet; o resto do sistema não pode ser exibido em iframe de outro domínio.
function comCabecalhos(response: Response, pathname: string): Response {
  const cabecalhos: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  };
  if (!pathname.startsWith('/f/')) cabecalhos['X-Frame-Options'] = 'SAMEORIGIN';
  if (import.meta.env.PROD) cabecalhos['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  try {
    for (const [k, v] of Object.entries(cabecalhos)) if (!response.headers.has(k)) response.headers.set(k, v);
    return response;
  } catch {
    // Headers imutáveis (ex.: Response.redirect): copia a resposta
    const copia = new Response(response.body, response);
    for (const [k, v] of Object.entries(cabecalhos)) copia.headers.set(k, v);
    return copia;
  }
}

export const onRequest = defineMiddleware(async (context, next) => {
  // Banket Busca: no host da vitrine (BUSCA_URL), as páginas públicas são servidas por /vitrine/* com a URL limpa
  const host = decidirHost(context.url.host, context.url.pathname, context.url.search, hostVitrine(), urlVitrine(), appUrl(''));
  if (host.acao === 'redirecionar') return comCabecalhos(context.redirect(host.url, host.status), context.url.pathname);
  if (host.acao === 'reescrever') {
    context.locals.flash = null;
    context.locals.plano = null;
    return comCabecalhos(await next(new URL(host.caminho, context.url)), host.caminho);
  }
  return comCabecalhos(await autorizar(context, next), context.url.pathname);
});

async function autorizar(context: APIContext, next: MiddlewareNext): Promise<Response> {
  const { pathname } = context.url;
  context.locals.plano = null;
  // Vitrine: páginas cacheáveis, sem cookie de flash (consumi-lo poria Set-Cookie numa resposta pública)
  if (pathname === '/vitrine' || pathname.startsWith('/vitrine/')) {
    context.locals.flash = null;
    return next();
  }
  context.locals.flash = consumeFlash(context.cookies);

  if (isPublic(pathname)) return next();

  const session = await verifySession(lerTokenSessao(context.cookies));
  const vinculo = session ? await getMembership(session.id, session.tenantId) : null;
  // Sessão emitida antes de uma troca ou redefinição de senha não vale mais (cookie roubado deixa de funcionar)
  const revogada = Boolean(session && vinculo?.sessoesRevogadasEm && (session.emitidaEm ?? 0) < vinculo.sessoesRevogadasEm);
  const membership = revogada ? null : vinculo;
  const user = session && membership ? { ...session, role: membership.role, nome: membership.nome } : null;
  if (session && !membership) {
    clearSessionCookie(context.cookies);
    setFlash(context.cookies, 'error', revogada ? 'A senha da conta mudou. Entre de novo.' : 'Seu acesso a esta empresa foi desativado.');
  }
  if (!user) {
    if (pathname.startsWith('/api/')) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }
    const destino = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname + context.url.search)}`;
    return context.redirect(`/auth/login${destino}`);
  }
  context.locals.user = user;

  const suspensa = membership?.tenantStatus !== 'active';
  if (suspensa && !LIBERADAS_SUSPENSA.has(pathname)) {
    if (pathname.startsWith('/api/')) {
      return Response.json({ error: 'Conta suspensa', code: 'ACCOUNT_SUSPENDED' }, { status: 403 });
    }
    return context.redirect(PAGINA_SUSPENSA);
  }
  if (!suspensa && pathname === PAGINA_SUSPENSA) return context.redirect('/dashboard');

  const restrita = ADMIN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`)) || ADMIN_PADROES.some((re) => re.test(pathname));
  if (restrita && !isAdmin(user)) {
    if (pathname.startsWith('/api/')) {
      return Response.json({ error: 'Acesso restrito a administradores' }, { status: 403 });
    }
    setFlash(context.cookies, 'error', 'Acesso restrito a administradores.');
    return context.redirect('/dashboard');
  }

  // Plano da empresa (fonte única: fn_tenant_entitlements, cache 15 s). Teste vencido: rebaixa na hora (D+1 12h)
  let plano = await entitlements(user.tenantId);
  if (plano?.trialVencido && (await verificarTrialVencido(plano))) plano = await entitlements(user.tenantId);
  context.locals.plano = plano;

  // Página inicial por plano: quem não tem o Painel de Propostas cai no Banket Busca (sem painel de upsell). Quem se
  // cadastrou pelo site e ainda não escolheu o plano do teste vai para a seleção de planos (a escolha inicia o teste).
  const temPropostas = podeUsarEm(plano, 'propostas');
  if ((pathname === '/dashboard' || pathname === '/') && !temPropostas) {
    return context.redirect(deveEscolherPlano(plano) && isAdmin(user) ? PAGINA_ESCOLHA_PLANO : '/busca');
  }

  // Gate por plano: rota de módulo fora do plano → 403 padronizado na API, upsell nas páginas
  const recurso = recursoDaRota(pathname);
  if (recurso && !podeUsarEm(plano, recurso)) {
    if (pathname.startsWith('/api/') || pathname.startsWith('/print/')) {
      return Response.json(new ErroPlano('RECURSO_FORA_DO_PLANO', recurso, 'Este recurso não faz parte do seu plano.').toJSON(), { status: 403 });
    }
    return context.redirect(`${inicioDoPlano(temPropostas)}?bloqueado=${encodeURIComponent(recurso)}`);
  }

  return next();
}
