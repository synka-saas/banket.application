// Respostas XML dos sitemaps do Banket Busca (cache público de 1 h: o inventário muda devagar).
const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function resposta(corpo: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n${corpo}\n`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=600, s-maxage=3600' },
  });
}

export function respostaSitemap(urls: string[]): Response {
  return resposta(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${xml(u)}</loc></url>`).join('\n')}\n</urlset>`);
}

export function respostaIndiceSitemap(sitemaps: string[]): Response {
  return resposta(`<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemaps.map((u) => `  <sitemap><loc>${xml(u)}</loc></sitemap>`).join('\n')}\n</sitemapindex>`);
}
