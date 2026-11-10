import type { APIRoute } from 'astro';
import { buscaUrl } from '../../lib/busca/url';
import { respostaSitemap } from '../../server/busca/sitemap';

// Páginas gerais indexáveis da vitrine.
export const GET: APIRoute = () => respostaSitemap([buscaUrl('/')]);
