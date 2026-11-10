import type { APIRoute } from 'astro';
import { buscaUrl } from '../../lib/busca/url';
import { respostaIndiceSitemap } from '../../server/busca/sitemap';

// Índice dos sitemaps do Banket Busca.
export const GET: APIRoute = () => respostaIndiceSitemap([buscaUrl('/sitemap-categorias.xml'), buscaUrl('/sitemap-cidades.xml')]);
