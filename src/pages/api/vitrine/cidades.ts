import type { APIRoute } from 'astro';
import { ipDaRequisicao, permitir } from '../../../lib/rateLimit';
import { buscarCidades } from '../../../server/busca/publico';

// Autocomplete público de cidades (vitrine e onboarding): GET ?q=santo. 60 consultas por minuto por IP.
export const GET: APIRoute = async ({ url, request, clientAddress }) => {
  if (!permitir(`cidades:${ipDaRequisicao(request, clientAddress)}`, 60, 60_000)) {
    return Response.json({ error: 'Muitas consultas. Aguarde um instante.' }, { status: 429 });
  }
  const cidades = await buscarCidades(url.searchParams.get('q') ?? '', Number(url.searchParams.get('limite') ?? 8));
  return Response.json(
    cidades.map((c) => ({ id: c.id, nome: c.nome, uf: c.uf, slug: c.slug })),
    { headers: { 'Cache-Control': 'public, max-age=3600' } }
  );
};
