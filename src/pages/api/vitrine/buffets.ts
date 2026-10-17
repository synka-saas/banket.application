import type { APIRoute } from 'astro';
import { ipDaRequisicao, permitir } from '../../../lib/rateLimit';
import { buffetsPorNome } from '../../../server/busca/publico';

// Instant search da vitrine: buffets publicados pelo nome. GET ?q=bisu. 120 consultas por minuto por IP.
export const GET: APIRoute = async ({ url, request, clientAddress }) => {
  if (!permitir(`buffets-nome:${ipDaRequisicao(request, clientAddress)}`, 120, 60_000)) {
    return Response.json({ error: 'Muitas consultas. Aguarde um instante.' }, { status: 429 });
  }
  const itens = await buffetsPorNome(url.searchParams.get('q') ?? '', Number(url.searchParams.get('limite') ?? 6));
  return Response.json(itens, { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' } });
};
