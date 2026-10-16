// Roteamento por host da vitrine (puro, testado). Com BUSCA_URL configurada:
//   - no host da vitrine, "/buffet/x" é servido por dentro como "/vitrine/buffet/x" (URL pública limpa); arquivos
//     estáticos, fotos públicas e a API da vitrine passam direto; "/vitrine/..." redireciona para a forma limpa;
//   - no host do app, "/vitrine/..." redireciona (301) para o host da vitrine (uma só URL indexável).
// Sem BUSCA_URL (dev), nada muda: a vitrine fica em /vitrine.

export type DecisaoHost = { acao: 'seguir' } | { acao: 'reescrever'; caminho: string } | { acao: 'redirecionar'; url: string };

const DIRETOS = ['/_astro/', '/_image', '/busca-media/', '/busca-demo/', '/api/vitrine/', '/api/health', '/fonts/'];
const ESTATICO = /\.(png|jpe?g|svg|ico|webp|gif|css|js|map|woff2?|ttf|txt|xml)$/i;

const semPrefixo = (pathname: string) => pathname.replace(/^\/vitrine(?=\/|$)/, '') || '/';

export function decidirHost(host: string, pathname: string, search: string, hostVitrine: string | null, urlVitrine: string | null): DecisaoHost {
  if (!hostVitrine) return { acao: 'seguir' };
  const ehVitrine = host.toLowerCase() === hostVitrine.toLowerCase();
  const prefixada = pathname === '/vitrine' || pathname.startsWith('/vitrine/');
  if (ehVitrine) {
    if (prefixada) return { acao: 'redirecionar', url: `${semPrefixo(pathname)}${search}` };
    if (DIRETOS.some((p) => pathname.startsWith(p)) || (ESTATICO.test(pathname) && !pathname.startsWith('/sitemap') && pathname !== '/robots.txt')) {
      return { acao: 'seguir' };
    }
    return { acao: 'reescrever', caminho: `/vitrine${pathname === '/' ? '' : pathname}${search}` };
  }
  if (prefixada && urlVitrine) {
    const base = urlVitrine.replace(/\/$/, '');
    const resto = semPrefixo(pathname);
    return { acao: 'redirecionar', url: `${base}${resto === '/' ? '/' : resto}${search}` };
  }
  return { acao: 'seguir' };
}
