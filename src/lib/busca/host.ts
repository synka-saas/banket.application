// Roteamento por host do Banket Busca (puro, testado). Com BUSCA_URL configurada, em busca.banket.com.br:
//   - vitrine pública ("/", "/buscar", "/buffet/…", "/orcamento", sitemap, robots…): servida por dentro em /vitrine/…
//     com a URL limpa; "/vitrine/…" redireciona para a forma limpa;
//   - área do buffet e autenticação ("/busca", "/planos", "/auth", "/conta", "/suporte" e as APIs delas), arquivos
//     estáticos, fotos públicas e a API da vitrine: seguem direto (mesmo app, sessão no domínio .banket.com.br);
//   - qualquer outra rota do app (ex.: "/dashboard"): redireciona para o host do app.
// No host do app, "/vitrine/…" redireciona (301) para o host da vitrine, exceto a prévia do perfil (?previa=1).
// Sem BUSCA_URL (dev), nada muda: a vitrine fica em /vitrine e a área em /busca.

export type DecisaoHost =
  | { acao: 'seguir' }
  | { acao: 'reescrever'; caminho: string }
  | { acao: 'redirecionar'; url: string; status: 301 | 302 };

const DIRETOS = ['/_astro/', '/_image', '/busca-media/', '/busca-demo/', '/api/vitrine/', '/api/health', '/fonts/', '/uploads/'];
/** Rotas do app que também respondem no host do Busca (área do buffet e o que ela usa). */
export const AREA_NO_HOST_BUSCA = [
  '/busca', '/planos', '/auth', '/conta', '/conta-suspensa', '/suporte', '/termos', '/privacidade',
  '/api/busca', '/api/planos', '/api/sessao', '/api/suporte',
];
/** Rotas da vitrine (servidas por /vitrine no host do Busca). */
export const VITRINE = ['/buscar', '/buffet', '/orcamento', '/para-buffets', '/avaliar', '/sitemap.xml', '/robots.txt'];
const ESTATICO = /\.(png|jpe?g|svg|ico|webp|gif|css|js|map|woff2?|ttf|txt)$/i;

const casa = (pathname: string, prefixo: string) => pathname === prefixo || pathname.startsWith(`${prefixo}/`) || pathname.startsWith(`${prefixo}?`);
const semPrefixo = (pathname: string) => pathname.replace(/^\/vitrine(?=\/|$)/, '') || '/';
const ehPrevia = (search: string) => /(?:^\?|&)previa=1(?:&|$)/.test(search);

export function decidirHost(
  host: string,
  pathname: string,
  search: string,
  hostVitrine: string | null,
  urlVitrine: string | null,
  urlApp: string | null = null
): DecisaoHost {
  if (!hostVitrine) return { acao: 'seguir' };
  const ehVitrine = host.toLowerCase() === hostVitrine.toLowerCase();
  const prefixada = casa(pathname, '/vitrine');
  if (ehVitrine) {
    if (prefixada) return { acao: 'redirecionar', url: `${semPrefixo(pathname)}${search}`, status: 301 };
    if (pathname === '/' || VITRINE.some((p) => casa(pathname, p))) {
      return { acao: 'reescrever', caminho: `/vitrine${pathname === '/' ? '' : pathname}${search}` };
    }
    if (DIRETOS.some((p) => pathname.startsWith(p)) || AREA_NO_HOST_BUSCA.some((p) => casa(pathname, p)) || ESTATICO.test(pathname)) {
      return { acao: 'seguir' };
    }
    // Rota do app fora da área do Busca: vai para o host do app (a sessão vale nos dois)
    if (urlApp) return { acao: 'redirecionar', url: `${urlApp.replace(/\/$/, '')}${pathname}${search}`, status: 302 };
    return { acao: 'reescrever', caminho: `/vitrine${pathname}${search}` };
  }
  if (prefixada && ehPrevia(search)) return { acao: 'seguir' };
  if (prefixada && urlVitrine) {
    const resto = semPrefixo(pathname);
    return { acao: 'redirecionar', url: `${urlVitrine.replace(/\/$/, '')}${resto}${search}`, status: 301 };
  }
  return { acao: 'seguir' };
}
