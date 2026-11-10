import { describe, expect, it, vi } from 'vitest';

vi.mock('./publico', () => ({
  PERFIL_VISIVEL: 'p.publicado AND t.status = \'active\'',
  buffetsPorIds: vi.fn(),
  leituraPublica: (fn: (db: unknown) => unknown) => fn({
    query: async (sql: string) => ({ rows: sql.includes('FROM busca_perfis') ? [{
      id: 'perfil-1', slug: 'buffet-de-teste', nome: 'Buffet de teste', cidade_id: 1, bairro: 'Centro',
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
import { GET as categorias } from '../../pages/vitrine/sitemap-categorias.xml';
import { GET as cidades } from '../../pages/vitrine/sitemap-cidades.xml';
import { GET as perfis } from '../../pages/vitrine/sitemap-perfis.xml';

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

  it('liga os três sitemaps ao índice e entrega as URLs de cada grupo', async () => {
    const contexto = {} as Parameters<typeof GET>[0];
    const resposta = await GET(contexto);
    const xml = await resposta.text();
    expect(xml).toContain('<sitemapindex');
    expect(xml.match(/<loc>/g)).toHaveLength(3);
    for (const grupo of ['categorias', 'cidades', 'perfis']) expect(xml).toContain(`/sitemap-${grupo}.xml</loc>`);
    const [cat, cid, perfil] = await Promise.all([categorias(contexto), cidades(contexto), perfis(contexto)]);
    const catXml = await cat.text();
    expect(catXml.match(/<url>/g)).toHaveLength(4);
    expect(catXml).toContain('/buffet-para-casamento/cidade-sede-sp/centro/</loc>');
    expect(catXml).not.toContain('/buffet-para-bodas/');
    expect((await cid.text()).match(/<url>/g)).toHaveLength(3);
    expect(await perfil.text()).toContain('/buffet/buffet-de-teste</loc>');
  });
});
