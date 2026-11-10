// Dados estruturados (schema.org) e textos das páginas públicas do Banket Busca. Puro e testado.

export interface PerfilSeo {
  nome: string;
  slug: string;
  descricao: string | null;
  url: string;
  logo: string | null;
  fotos: string[];
  cidade: string | null;
  uf: string | null;
  bairro: string | null;
  notaMedia: number | null;
  totalAvaliacoes: number;
  avaliacoes: { nome: string; nota: number; texto: string | null; data: Date | string }[];
}

const limpar = <T extends Record<string, unknown>>(o: T): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && !(Array.isArray(v) && v.length === 0))) as T;

/** LocalBusiness (FoodEstablishment) + AggregateRating do perfil público (o Busca não divulga preço). */
export function jsonLdPerfil(p: PerfilSeo): Record<string, unknown> {
  const temNota = p.notaMedia != null && p.totalAvaliacoes > 0;
  return limpar({
    '@context': 'https://schema.org',
    '@type': ['LocalBusiness', 'FoodEstablishment'],
    name: p.nome,
    description: p.descricao ?? undefined,
    url: p.url,
    logo: p.logo ?? undefined,
    image: p.fotos.slice(0, 6),
    servesCuisine: 'Buffet',
    address: p.cidade
      ? limpar({ '@type': 'PostalAddress', addressLocality: p.cidade, addressRegion: p.uf ?? undefined, streetAddress: p.bairro ?? undefined, addressCountry: 'BR' })
      : undefined,
    aggregateRating: temNota
      ? { '@type': 'AggregateRating', ratingValue: Number(p.notaMedia!.toFixed(2)), reviewCount: p.totalAvaliacoes, bestRating: 5, worstRating: 1 }
      : undefined,
    review: p.avaliacoes.slice(0, 5).map((a) =>
      limpar({
        '@type': 'Review',
        author: { '@type': 'Person', name: a.nome },
        reviewRating: { '@type': 'Rating', ratingValue: a.nota, bestRating: 5, worstRating: 1 },
        reviewBody: a.texto ?? undefined,
        datePublished: new Date(a.data).toISOString().slice(0, 10),
      })
    ),
  });
}

/** Lista de resultados (ItemList) com os perfis na ordem exibida. */
export function jsonLdLista(itens: { nome: string; url: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: itens.map((i, n) => ({ '@type': 'ListItem', position: n + 1, name: i.nome, url: i.url })),
  };
}

/** Site com a busca interna (caixa de busca nos resultados do Google). */
export function jsonLdSite(urlBase: string, urlBusca: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Banket Busca',
    url: urlBase,
    potentialAction: { '@type': 'SearchAction', target: `${urlBusca}?cidade_texto={search_term_string}`, 'query-input': 'required name=search_term_string' },
  };
}

/** Breadcrumb (BreadcrumbList) das páginas de categoria e local; `url` monta o endereço absoluto de cada caminho. */
export function jsonLdMigalhas(itens: { rotulo: string; caminho: string }[], url: (caminho: string) => string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: itens.map((m, n) => ({ '@type': 'ListItem', position: n + 1, name: m.rotulo, item: url(m.caminho) })),
  };
}
