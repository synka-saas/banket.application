import { describe, expect, it } from 'vitest';
import {
  CATEGORIAS,
  caminhoCategoria,
  caminhoLocal,
  categoriaDaBusca,
  categoriaPorSlug,
  comPagina,
  contarPalavras,
  descricaoPagina,
  descricaoPropria,
  encaixa,
  introPagina,
  migalhas,
  slugBairro,
  tituloH1,
  tituloPagina,
  type FatosLocal,
} from './categorias';
import { TIPOS_EVENTO, TIPOS_SERVICO } from './catalogos';

const fatos = (over: Partial<FatosLocal> = {}): FatosLocal => ({
  total: 42,
  espacoProprio: 30,
  domicilio: 12,
  bairros: [{ nome: 'Moema', total: 6 }, { nome: 'Aclimação', total: 4 }, { nome: 'Tatuapé', total: 3 }],
  servicos: [{ rotulo: 'Buffet completo', total: 20 }, { rotulo: 'Finger food', total: 9 }],
  eventos: [{ rotulo: 'casamentos', total: 30 }],
  capacidadeMax: 800,
  avaliados: 5,
  notaMedia: 4.6,
  ...over,
});

describe('tabela de categorias', () => {
  it('slugs em minúsculas, sem acento e com hífen; tipos e serviços existem no catálogo', () => {
    for (const c of CATEGORIAS) {
      expect(c.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      for (const t of c.tipos) expect(TIPOS_EVENTO.some((x) => x.slug === t)).toBe(true);
      for (const s of c.servicos) expect(TIPOS_SERVICO.some((x) => x.slug === s)).toBe(true);
    }
    expect(categoriaPorSlug('buffet-para-casamento')?.nome).toBe('Buffet para casamento');
    expect(categoriaPorSlug('buffet-para-confraternizacao')?.tipos).toEqual(['confraternizacao']);
    for (const tipo of TIPOS_EVENTO) expect(CATEGORIAS.some((c) => c.tipos.includes(tipo.slug))).toBe(true);
  });

  it('equivalência das buscas antigas (301)', () => {
    expect(categoriaDaBusca('casamento', [])?.slug).toBe('buffet-para-casamento');
    expect(categoriaDaBusca('casamento', ['buffet_casamento'])?.slug).toBe('buffet-para-casamento');
    expect(categoriaDaBusca(null, ['kids'])?.slug).toBe('buffet-infantil');
    expect(categoriaDaBusca(null, ['buffet_domicilio'])?.slug).toBe('buffet-a-domicilio');
    expect(categoriaDaBusca('debutante', [])?.slug).toBe('buffet-para-festa-de-15-anos');
    // Sem equivalente: tipo sem categoria, serviço sem categoria ou mistura de categorias
    expect(categoriaDaBusca('confraternizacao', [])?.slug).toBe('buffet-para-confraternizacao');
    expect(categoriaDaBusca(null, ['finger_food'])).toBeNull();
    expect(categoriaDaBusca('casamento', ['churrasco'])).toBeNull();
    expect(categoriaDaBusca(null, [])).toBeNull();
  });

  it('o perfil entra pela categoria do evento, do serviço ou do domicílio', () => {
    const infantil = categoriaPorSlug('buffet-infantil')!;
    const domicilio = categoriaPorSlug('buffet-a-domicilio')!;
    expect(encaixa({ tiposEvento: [], tiposServico: ['kids'], atendeDomicilio: false }, infantil)).toBe(true);
    expect(encaixa({ tiposEvento: ['casamento'], tiposServico: [], atendeDomicilio: false }, infantil)).toBe(false);
    expect(encaixa({ tiposEvento: [], tiposServico: [], atendeDomicilio: true }, domicilio)).toBe(true);
  });
});

describe('endereços', () => {
  it('sempre com barra no fim, cidade com UF e bairro em slug', () => {
    const c = categoriaPorSlug('buffet-para-casamento')!;
    expect(caminhoCategoria(c)).toBe('/buffet-para-casamento/');
    expect(caminhoCategoria(c, 'sao-paulo-sp')).toBe('/buffet-para-casamento/sao-paulo-sp/');
    expect(caminhoCategoria(c, 'sao-paulo-sp', slugBairro('Jardim América'))).toBe('/buffet-para-casamento/sao-paulo-sp/jardim-america/');
    expect(caminhoLocal('sao-paulo-sp')).toBe('/buffets-em/sao-paulo-sp/');
    expect(caminhoLocal('sao-paulo-sp', slugBairro('Aclimação'))).toBe('/buffets-em/sao-paulo-sp/aclimacao/');
    expect(comPagina('/buffets-em/sao-paulo-sp/', 1)).toBe('/buffets-em/sao-paulo-sp/');
    expect(comPagina('/buffets-em/sao-paulo-sp/', 3)).toBe('/buffets-em/sao-paulo-sp/?pagina=3');
  });
});

describe('perfil completo', () => {
  it('descrição gerada na importação não conta como própria', () => {
    expect(descricaoPropria('Buffet da Val fica no bairro Grajaú, em São Paulo (SP). Serviços: buffet de casamento, buffet infantil e buffet em domicílio.')).toBe(false);
    expect(descricaoPropria('Ag C&C Festas Buffet fica em Manaus (AM). Tem espaço próprio para eventos e recebe até cem convidados no salão.')).toBe(false);
    expect(descricaoPropria('Há 20 anos fazemos casamentos e festas com cozinha própria, cardápio autoral e equipe treinada para eventos grandes.')).toBe(true);
    expect(descricaoPropria('Curta demais.')).toBe(false);
  });
});

describe('textos', () => {
  const cat = categoriaPorSlug('buffet-para-casamento')!;

  it('H1 e title no formato combinado', () => {
    expect(tituloH1(cat, { nome: 'São Paulo' })).toBe('Buffet para casamento em São Paulo');
    expect(tituloH1(cat, { nome: 'Aclimação', cidade: 'São Paulo' })).toBe('Buffet para casamento em Aclimação, São Paulo');
    expect(tituloH1(null, { nome: 'São Paulo' })).toBe('Buffets em São Paulo');
    expect(tituloPagina(cat, { nome: 'São Paulo' }, 42)).toBe('Buffet para casamento em São Paulo: 42 buffets com orçamento grátis | Banket Busca');
    expect(tituloPagina(null, { nome: 'São Paulo' }, 42)).toBe('Buffets em São Paulo: 42 opções com orçamento grátis | Banket Busca');
    expect(tituloPagina(cat, { nome: 'São Paulo' }, 42, 2)).toContain('(página 2)');
  });

  it('descrição curta e com o local', () => {
    const d = descricaoPagina(cat, { nome: 'São Paulo' }, fatos());
    expect(d).toContain('42 buffets para casamentos em São Paulo');
    expect(d.length).toBeLessThanOrEqual(165);
  });

  it('intro entre 80 e 150 palavras, diferente para cada local', () => {
    const sp = introPagina(cat, { nome: 'São Paulo' }, fatos());
    const campinas = introPagina(cat, { nome: 'Campinas' }, fatos({ total: 7, bairros: [{ nome: 'Cambuí', total: 3 }], capacidadeMax: 300, avaliados: 0, notaMedia: null }));
    const pouco = introPagina(null, { nome: 'Aclimação', cidade: 'São Paulo' }, fatos({ total: 1, espacoProprio: 0, domicilio: 0, bairros: [], servicos: [], eventos: [], capacidadeMax: null, avaliados: 0, notaMedia: null }));
    for (const t of [sp, campinas, pouco]) {
      expect(contarPalavras(t)).toBeGreaterThanOrEqual(80);
      expect(contarPalavras(t)).toBeLessThanOrEqual(150);
    }
    expect(sp).not.toBe(campinas);
    expect(sp).toContain('Moema (6)');
  });
});

describe('breadcrumb', () => {
  it('categoria × bairro e local × bairro', () => {
    const cat = categoriaPorSlug('buffet-infantil')!;
    const sp = { slug: 'sao-paulo-sp', nome: 'São Paulo' };
    const acl = { slug: 'aclimacao', nome: 'Aclimação' };
    expect(migalhas(cat, sp, acl).map((m) => m.rotulo)).toEqual(['Início', 'Buffet infantil', 'São Paulo', 'Aclimação']);
    expect(migalhas(null, sp, acl).map((m) => [m.rotulo, m.caminho, m.atual])).toEqual([
      ['Início', '/', false],
      ['Buffets em São Paulo', '/buffets-em/sao-paulo-sp/', false],
      ['Aclimação', '/buffets-em/sao-paulo-sp/aclimacao/', true],
    ]);
  });
});
