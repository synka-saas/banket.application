import type { APIRoute } from 'astro';
import { contentTypeFor, readFile } from '../../../lib/storage';

// Fotos e logos públicos do Banket Busca: só a pasta busca/ de cada empresa, só imagens rasterizadas (SVG pode
// conter script e ficaria servido na origem do app). Público e com cache; o resto de /uploads continua privado.
const PERMITIDOS = /^busca\/[0-9a-f-]{36}\.(png|jpe?g|webp)$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const naoEncontrado = () => new Response('Não encontrado', { status: 404, headers: { 'Cache-Control': 'no-store' } });

export const GET: APIRoute = async ({ params }) => {
  const tenantId = params.tenant ?? '';
  const key = params.key ?? '';
  if (!UUID.test(tenantId) || !PERMITIDOS.test(key)) return naoEncontrado();
  const file = await readFile(tenantId, key);
  if (!file) return naoEncontrado();
  return new Response(new Uint8Array(file), {
    headers: {
      'Content-Type': contentTypeFor(key),
      'Cache-Control': 'public, max-age=86400, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  });
};
