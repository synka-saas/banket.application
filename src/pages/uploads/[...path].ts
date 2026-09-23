import type { APIRoute } from 'astro';
import { contentTypeFor, readFile } from '../../lib/storage';

// Resposta de erro que nenhum cache (Cloudflare, navegador) pode guardar
const naoEncontrado = () =>
  new Response('Não encontrado', { status: 404, headers: { 'Cache-Control': 'no-store' } });

// Serve arquivos enviados, apenas do tenant do usuário logado.
export const GET: APIRoute = async ({ params, locals }) => {
  const [tenantId, ...rest] = (params.path ?? '').split('/');
  const key = rest.join('/');
  if (!key || tenantId !== locals.user.tenantId) return naoEncontrado();
  const file = await readFile(tenantId, key);
  if (!file) return naoEncontrado();
  return new Response(new Uint8Array(file), {
    headers: {
      'Content-Type': contentTypeFor(key),
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  });
};
