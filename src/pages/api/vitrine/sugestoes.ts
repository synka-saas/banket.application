import type { APIRoute } from 'astro';
import { ipDaRequisicao, permitir } from '../../../lib/rateLimit';
import { rotuloEvento, tiposPorTexto, tipoEvento } from '../../../lib/busca/catalogos';
import { buffetsPorNome, buscarCidades } from '../../../server/busca/publico';
import { caminhoCategoria, caminhoLocal, categoriaDoTipo } from '../../../lib/busca/categorias';
import { caminhoVitrine } from '../../../lib/busca/url';
import { existePagina, localIndexavel } from '../../../server/busca/locais';

// Busca única da home: sugestões de buffets (nome), tipos de evento e cidades para o mesmo texto. GET ?q=casa.
// Tipos e cidades já vêm com o endereço: a página da categoria / do local quando existe (local: indexável), senão a busca.
// 120 consultas por minuto por IP.
export const GET: APIRoute = async ({ url, request, clientAddress }) => {
  if (!permitir(`sugestoes:${ipDaRequisicao(request, clientAddress)}`, 120, 60_000)) {
    return Response.json({ error: 'Muitas consultas. Aguarde um instante.' }, { status: 429 });
  }
  const q = (url.searchParams.get('q') ?? '').slice(0, 80);
  // Leituras em transações separadas (pool da vitrine): podem rodar juntas
  const [buffets, cidades] = await Promise.all([buffetsPorNome(q, 5), buscarCidades(q, 4)]);
  const tipos = await Promise.all(
    tiposPorTexto(q).parecidos.slice(0, 3).map(async (slug) => {
      const cat = categoriaDoTipo(slug);
      const url = caminhoVitrine(cat && (await existePagina(cat, null)) ? caminhoCategoria(cat) : `/buscar?tipo=${encodeURIComponent(slug)}`);
      return { slug, rotulo: rotuloEvento(slug), icone: tipoEvento(slug)?.icone ?? 'confetti', url };
    })
  );
  const comUrl = await Promise.all(
    cidades.map(async (c) => ({
      nome: c.nome, uf: c.uf, slug: c.slug,
      url: caminhoVitrine((await localIndexavel(c.slug)) ? caminhoLocal(c.slug) : `/buscar?cidade=${encodeURIComponent(c.slug)}`),
    }))
  );
  return Response.json(
    { buffets, tipos, cidades: comUrl },
    { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' } }
  );
};
