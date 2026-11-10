import type { APIRoute } from 'astro';
import { buscaUrl } from '../../lib/busca/url';
import { respostaIndiceSitemap } from '../../server/busca/sitemap';

// Um único endereço para enviar ao Search Console; cada arquivo agrupa um tipo de URL.
export const GET: APIRoute = () => respostaIndiceSitemap([
  buscaUrl('/sitemap-categorias.xml'),
  buscaUrl('/sitemap-cidades.xml'),
  buscaUrl('/sitemap-perfis.xml'),
]);
