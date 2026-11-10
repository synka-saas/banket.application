import type { APIRoute } from 'astro';
import { buscaUrl } from '../../lib/busca/url';
import { paginasIndexaveis } from '../../server/busca/locais';
import { respostaSitemap } from '../../server/busca/sitemap';

// Páginas de local indexáveis (/buffets-em/{cidade-uf}/ e bairros com ao menos um buffet publicado).
export const GET: APIRoute = async () => respostaSitemap((await paginasIndexaveis()).locais.map((p) => buscaUrl(p.caminho)));
