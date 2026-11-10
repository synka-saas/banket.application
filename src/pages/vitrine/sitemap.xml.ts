import type { APIRoute } from 'astro';
import { buscaUrl } from '../../lib/busca/url';
import { paginasIndexaveis } from '../../server/busca/locais';
import { respostaSitemap } from '../../server/busca/sitemap';

// Lista completa das páginas de categoria e local com ao menos um buffet publicado.
export const GET: APIRoute = async () => {
  const { categorias, locais } = await paginasIndexaveis();
  return respostaSitemap([...categorias, ...locais].map((p) => buscaUrl(p.caminho)));
};
