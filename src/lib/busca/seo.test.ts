import { describe, expect, it } from 'vitest';
import { jsonLdLista, jsonLdPerfil, textoLanding } from './seo';

const perfil = {
  nome: 'Buffet Teste', slug: 'buffet-teste', descricao: 'Festas no ABC.', url: 'https://busca.banket.com.br/buffet/buffet-teste',
  logo: null, fotos: ['https://x/1.jpg'], cidade: 'Santo André', uf: 'SP', bairro: 'Jardim', notaMedia: 4.756, totalAvaliacoes: 4, precoMin: 89,
  pacotes: [{ nome: 'Festa completa', preco_pessoa: 129 }, { nome: 'Sob consulta', preco_pessoa: null }],
  avaliacoes: [{ nome: 'Ana', nota: 5, texto: 'Ótimo', data: '2026-09-01T10:00:00Z' }],
};

describe('JSON-LD do perfil', () => {
  it('LocalBusiness com AggregateRating, ofertas com preço e avaliações', () => {
    const ld = jsonLdPerfil(perfil) as any;
    expect(ld['@type']).toEqual(['LocalBusiness', 'FoodEstablishment']);
    expect(ld.aggregateRating).toEqual({ '@type': 'AggregateRating', ratingValue: 4.76, reviewCount: 4, bestRating: 5, worstRating: 1 });
    expect(ld.makesOffer).toHaveLength(1);
    expect(ld.makesOffer[0]).toMatchObject({ price: 129, priceCurrency: 'BRL' });
    expect(ld.review[0]).toMatchObject({ author: { name: 'Ana' }, datePublished: '2026-09-01' });
    expect(ld.address).toMatchObject({ addressLocality: 'Santo André', addressRegion: 'SP' });
    expect(ld).not.toHaveProperty('logo');
  });

  it('sem avaliações não declara nota (o Google penaliza nota sem avaliação)', () => {
    const ld = jsonLdPerfil({ ...perfil, notaMedia: null, totalAvaliacoes: 0, avaliacoes: [] }) as any;
    expect(ld).not.toHaveProperty('aggregateRating');
    expect(ld).not.toHaveProperty('review');
  });

  it('ItemList numera a partir de 1', () => {
    const ld = jsonLdLista([{ nome: 'A', url: 'u1' }, { nome: 'B', url: 'u2' }]) as any;
    expect(ld.itemListElement.map((i: any) => i.position)).toEqual([1, 2]);
  });
});

describe('textos das landings', () => {
  it('usa números reais e o plural do tipo', () => {
    const t = textoLanding('infantil', 'Santo André', 3, 89.5);
    expect(t.titulo).toBe('Buffet para festa infantil em Santo André');
    expect(t.descricao).toContain('3 buffets para festas infantis em Santo André');
    expect(t.descricao).toContain('R$ 90 por pessoa');
    expect(textoLanding('casamento', 'Campinas', 1, null).descricao.startsWith('1 buffet para casamentos')).toBe(true);
  });
});
