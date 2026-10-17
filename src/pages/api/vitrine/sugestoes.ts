import type { APIRoute } from 'astro';
import { ipDaRequisicao, permitir } from '../../../lib/rateLimit';
import { rotuloEvento, tiposPorTexto, tipoEvento } from '../../../lib/busca/catalogos';
import { buffetsPorNome, buscarCidades } from '../../../server/busca/publico';

// Busca única da home: sugestões de buffets (nome), tipos de evento e cidades para o mesmo texto. GET ?q=casa.
// 120 consultas por minuto por IP.
export const GET: APIRoute = async ({ url, request, clientAddress }) => {
  if (!permitir(`sugestoes:${ipDaRequisicao(request, clientAddress)}`, 120, 60_000)) {
    return Response.json({ error: 'Muitas consultas. Aguarde um instante.' }, { status: 429 });
  }
  const q = (url.searchParams.get('q') ?? '').slice(0, 80);
  // Leituras em transações separadas (pool da vitrine): podem rodar juntas
  const [buffets, cidades] = await Promise.all([buffetsPorNome(q, 5), buscarCidades(q, 4)]);
  const tipos = tiposPorTexto(q).parecidos.slice(0, 3).map((slug) => ({ slug, rotulo: rotuloEvento(slug), icone: tipoEvento(slug)?.icone ?? 'confetti' }));
  return Response.json(
    { buffets, tipos, cidades: cidades.map((c) => ({ nome: c.nome, uf: c.uf, slug: c.slug })) },
    { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' } }
  );
};
