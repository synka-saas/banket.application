import { describe, expect, it, vi } from 'vitest';

vi.mock('./publico', () => ({
  PERFIL_VISIVEL: 'p.publicado AND t.status = \'active\'',
  buffetsPorIds: vi.fn(),
  leituraPublica: (fn: (db: unknown) => unknown) => fn({
    query: async (sql: string) => ({ rows: sql.includes('FROM busca_perfis') ? [{
      id: 'perfil-1', nome: 'Buffet de teste', cidade_id: 1, bairro: 'Centro',
      descricao: null, tipos_evento: ['casamento'], tipos_servico: [],
      cidades: [2], foto_real: false,
    }] : [
      { id: 1, nome: 'Cidade sede', uf: 'SP', slug: 'cidade-sede-sp' },
      { id: 2, nome: 'Cidade atendida', uf: 'SP', slug: 'cidade-atendida-sp' },
    ] }),
  }),
}));

import { paginaLocal, paginasIndexaveis } from './locais';
import { GET } from '../../pages/vitrine/sitemap.xml';

describe('indexação com um buffet publicado, mesmo sem perfil completo', () => {
  it('inclui hub, cidades de sede e atendimento e bairro da sede, sem inventar combinações', async () => {
    const paginas = await paginasIndexaveis();
    expect(paginas.categorias.map((p) => p.caminho).sort()).toEqual([
      '/buffet-para-casamento/',
      '/buffet-para-casamento/cidade-atendida-sp/',
      '/buffet-para-casamento/cidade-sede-sp/',
      '/buffet-para-casamento/cidade-sede-sp/centro/',
    ]);
    expect(paginas.locais.map((p) => p.caminho).sort()).toEqual([
      '/buffets-em/cidade-atendida-sp/',
      '/buffets-em/cidade-sede-sp/',
      '/buffets-em/cidade-sede-sp/centro/',
    ]);
    const pagina = await paginaLocal(null, 'cidade-sede-sp', 'centro');
    expect(pagina).toMatchObject({ indexavel: true, completos: 0, total: 1 });
    expect(await paginaLocal(null, 'cidade-atendida-sp', 'centro')).toBeNull();
  });

  it('entrega as URLs diretamente no sitemap.xml', async () => {
    const resposta = await GET({} as Parameters<typeof GET>[0]);
    const xml = await resposta.text();
    expect(xml).toContain('<urlset');
    expect(xml.match(/<loc>/g)).toHaveLength(7);
    expect(xml).toContain('/buffet-para-casamento/cidade-sede-sp/centro/</loc>');
    expect(xml).not.toContain('<sitemapindex');
  });
});
