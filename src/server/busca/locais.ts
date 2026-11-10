// Páginas de categoria e de local do Banket Busca (/{categoria}/…, /buffets-em/…): o inventário dos perfis publicados
// (cidade, bairro, tipos, serviços e se o perfil está completo) fica em memória por alguns minutos e decide quais páginas
// existem, quais são indexáveis (pisos de lib/busca/categorias.ts), o que entra nos sitemaps e os links internos.
// A lista de cada página vem de buffetsPorIds (mesmos cards e ranking da busca). Leitura pública: só perfis publicados.
import { buffetsPorIds, leituraPublica, PERFIL_VISIVEL, type Cidade, type ItemResultado } from './publico';
import { ARQUIVO_FOTO_PADRAO } from '../../lib/busca/url';
import { TIPOS_EVENTO, rotuloServico } from '../../lib/busca/catalogos';
import {
  CATEGORIAS,
  PISO_BAIRRO,
  PISO_CIDADE,
  POR_PAGINA_LOCAL,
  caminhoCategoria,
  caminhoLocal,
  categoriaPorSlug,
  comPagina,
  descricaoPropria,
  encaixa,
  slugBairro,
  type Categoria,
  type FatosLocal,
} from '../../lib/busca/categorias';

export interface PerfilInventario {
  id: string;
  nome: string;
  cidadeId: number | null;
  /** Outras cidades atendidas (busca_perfil_cidades) */
  cidadesAtendidas: number[];
  bairro: string | null;
  bairroSlug: string | null;
  tiposEvento: string[];
  tiposServico: string[];
  atendeDomicilio: boolean;
  espacoProprio: boolean;
  capacidadeMax: number | null;
  notaMedia: number | null;
  totalAvaliacoes: number;
  /** Descrição própria + foto real + ao menos um serviço e um tipo de evento */
  completo: boolean;
}

interface Inventario {
  perfis: PerfilInventario[];
  cidades: Map<number, Cidade>;
  porSlug: Map<string, Cidade>;
}

const VALIDADE_MS = 10 * 60_000;
let cache: { em: number; dados: Promise<Inventario> } | null = null;

/** Inventário dos perfis publicados (cache de 10 min por processo; a página nova entra sozinha ao atingir o piso). */
export function inventario(): Promise<Inventario> {
  if (!cache || Date.now() - cache.em > VALIDADE_MS) {
    const dados = carregar().catch((e) => {
      cache = null;
      throw e;
    });
    cache = { em: Date.now(), dados };
  }
  return cache.dados;
}

async function carregar(): Promise<Inventario> {
  return leituraPublica(async (db) => {
    const { rows } = await db.query(
      `SELECT p.id, p.nome, p.cidade_id, p.bairro, p.descricao, p.tipos_evento, p.tipos_servico, p.atende_domicilio,
              p.espaco_proprio, p.capacidade_max, p.nota_media, p.total_avaliacoes,
              ARRAY(SELECT pc.cidade_id FROM busca_perfil_cidades pc WHERE pc.perfil_id = p.id) AS cidades,
              EXISTS (SELECT 1 FROM busca_fotos f WHERE f.perfil_id = p.id AND f.bloqueado_plano_em IS NULL
                         AND f.path <> $1 AND f.path NOT LIKE '/busca-demo/%') AS foto_real
         FROM busca_perfis p JOIN tenants t ON t.id = p.tenant_id
        WHERE ${PERFIL_VISIVEL}`,
      [ARQUIVO_FOTO_PADRAO]
    );
    const perfis: PerfilInventario[] = rows.map((r) => ({
      id: r.id,
      nome: r.nome,
      cidadeId: r.cidade_id,
      cidadesAtendidas: r.cidades ?? [],
      bairro: r.bairro?.trim() || null,
      bairroSlug: r.bairro?.trim() ? slugBairro(r.bairro.trim()) : null,
      tiposEvento: r.tipos_evento ?? [],
      tiposServico: r.tipos_servico ?? [],
      atendeDomicilio: r.atende_domicilio,
      espacoProprio: r.espaco_proprio,
      capacidadeMax: r.capacidade_max,
      notaMedia: r.nota_media == null ? null : Number(r.nota_media),
      totalAvaliacoes: r.total_avaliacoes ?? 0,
      completo: r.foto_real && descricaoPropria(r.descricao) && (r.tipos_servico ?? []).length > 0 && (r.tipos_evento ?? []).length > 0,
    }));
    const ids = [...new Set(perfis.flatMap((p) => [p.cidadeId, ...p.cidadesAtendidas]).filter((x): x is number => x != null))];
    const { rows: cs } = await db.query<Cidade>('SELECT id, nome, uf, slug, lat, lng FROM busca_cidades WHERE id = ANY($1::int[])', [ids]);
    return { perfis, cidades: new Map(cs.map((c) => [c.id, c])), porSlug: new Map(cs.map((c) => [c.slug, c])) };
  });
}

// ---------------------------------------------------------------------------
// Quem entra em cada página
// ---------------------------------------------------------------------------
/** Buffets do local: com sede na cidade ou que a atendem (cidades atendidas); no bairro, só os com sede nele. */
function doLocal(perfis: PerfilInventario[], cidadeId: number | null, bairro: string | null): PerfilInventario[] {
  if (cidadeId == null) return perfis;
  if (bairro) return perfis.filter((p) => p.cidadeId === cidadeId && p.bairroSlug === bairro);
  return perfis.filter((p) => p.cidadeId === cidadeId || p.cidadesAtendidas.includes(cidadeId));
}

const daCategoria = (perfis: PerfilInventario[], cat: Categoria | null) => (cat ? perfis.filter((p) => encaixa(p, cat)) : perfis);

/** Piso de indexação: bairro 8, cidade (e hub nacional) 5 buffets com perfil completo. */
export const indexavel = (lista: PerfilInventario[], bairro: string | null) =>
  lista.filter((p) => p.completo).length >= (bairro ? PISO_BAIRRO : PISO_CIDADE);

/** Nome mais usado de um bairro (o mesmo slug pode vir escrito de jeitos diferentes). */
function nomeDoBairro(lista: PerfilInventario[], slug: string): string | null {
  const contagem = new Map<string, number>();
  for (const p of lista) if (p.bairroSlug === slug && p.bairro) contagem.set(p.bairro, (contagem.get(p.bairro) ?? 0) + 1);
  return [...contagem.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function agrupar<T>(itens: T[], chave: (i: T) => string | null): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const i of itens) {
    const k = chave(i);
    if (k) m.set(k, [...(m.get(k) ?? []), i]);
  }
  return m;
}

const TIPO_PLURAL = new Map(TIPOS_EVENTO.map((t) => [t.slug, t.plural]));
const contar = (valores: string[]) => {
  const m = new Map<string, number>();
  for (const v of valores) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

/** Fatos da página para o title, a description e a introdução. */
function fatosDe(lista: PerfilInventario[], inv: Inventario, nacional: boolean): FatosLocal {
  const avaliados = lista.filter((p) => p.totalAvaliacoes > 0 && p.notaMedia != null);
  const somaNotas = avaliados.reduce((s, p) => s + p.notaMedia! * p.totalAvaliacoes, 0);
  const somaAv = avaliados.reduce((s, p) => s + p.totalAvaliacoes, 0);
  const caps = lista.map((p) => p.capacidadeMax).filter((x): x is number => x != null && x > 0);
  const bairros = [...agrupar(lista, (p) => p.bairroSlug).entries()]
    .map(([slug, ps]) => ({ nome: nomeDoBairro(ps, slug) ?? slug, total: ps.length }))
    .sort((a, b) => b.total - a.total);
  return {
    total: lista.length,
    espacoProprio: lista.filter((p) => p.espacoProprio).length,
    domicilio: lista.filter((p) => p.atendeDomicilio).length,
    bairros: nacional ? [] : bairros,
    servicos: contar(lista.flatMap((p) => p.tiposServico)).slice(0, 4).map(([s, n]) => ({ rotulo: rotuloServico(s), total: n })),
    eventos: contar(lista.flatMap((p) => p.tiposEvento)).filter(([t]) => t !== 'outros').slice(0, 4).map(([t, n]) => ({ rotulo: TIPO_PLURAL.get(t) ?? t, total: n })),
    capacidadeMax: caps.length ? Math.max(...caps) : null,
    avaliados: avaliados.length,
    notaMedia: somaAv ? somaNotas / somaAv : null,
    cidades: nacional
      ? [...agrupar(lista, (p) => (p.cidadeId == null ? null : String(p.cidadeId))).entries()]
          .map(([id, ps]) => ({ nome: inv.cidades.get(Number(id))?.nome ?? '', total: ps.length }))
          .filter((c) => c.nome)
          .sort((a, b) => b.total - a.total)
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------
export interface LinkLocal {
  rotulo: string;
  caminho: string;
  total: number;
}

export interface PaginaLocal {
  categoria: Categoria | null;
  cidade: Cidade | null;
  bairro: { slug: string; nome: string } | null;
  /** Ids dos buffets da página (todos, na ordem do inventário; o ranking vem depois) */
  ids: string[];
  total: number;
  completos: number;
  indexavel: boolean;
  fatos: FatosLocal;
  /** Na cidade: os bairros (com página); no hub: as cidades */
  locais: LinkLocal[];
  /** Outras categorias neste mesmo local (chips) */
  categorias: LinkLocal[];
}

/**
 * Dados de uma página de categoria e/ou local. `null` quando a página não existe: categoria/cidade/bairro desconhecidos
 * ou nenhum buffet (sem página vazia).
 */
export async function paginaLocal(cat: Categoria | null, cidadeSlug: string | null, bairroSlug: string | null): Promise<PaginaLocal | null> {
  const inv = await inventario();
  const cidade = cidadeSlug ? inv.porSlug.get(cidadeSlug) ?? null : null;
  if (cidadeSlug && !cidade) return null;
  if (!cat && !cidade) return null;
  const doLugar = doLocal(inv.perfis, cidade?.id ?? null, bairroSlug);
  const lista = daCategoria(doLugar, cat);
  if (!lista.length) return null;
  const bairro = bairroSlug ? { slug: bairroSlug, nome: nomeDoBairro(lista, bairroSlug) ?? bairroSlug } : null;

  // Links: na cidade, os bairros com buffets (desta categoria); no hub, as cidades
  let locais: LinkLocal[] = [];
  if (cidade && !bairroSlug) {
    const naCidade = lista.filter((p) => p.cidadeId === cidade.id);
    locais = [...agrupar(naCidade, (p) => p.bairroSlug).entries()]
      .map(([slug, ps]) => ({ rotulo: nomeDoBairro(ps, slug) ?? slug, caminho: cat ? caminhoCategoria(cat, cidade.slug, slug) : caminhoLocal(cidade.slug, slug), total: ps.length }))
      .sort((a, b) => b.total - a.total || a.rotulo.localeCompare(b.rotulo, 'pt-BR'))
      .slice(0, 40);
  } else if (!cidade && cat) {
    locais = [...agrupar(lista, (p) => (p.cidadeId == null ? null : String(p.cidadeId))).entries()]
      .map(([id, ps]) => {
        const c = inv.cidades.get(Number(id))!;
        return { rotulo: `${c.nome} · ${c.uf}`, caminho: caminhoCategoria(cat, c.slug), total: ps.length };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 40);
  }

  // Chips: as outras categorias neste local (ou "todos os buffets" do local, nas páginas de categoria)
  const categorias: LinkLocal[] = cidade
    ? CATEGORIAS.filter((c) => c.slug !== cat?.slug)
        .map((c) => ({ rotulo: c.curto, caminho: caminhoCategoria(c, cidade.slug, bairroSlug), total: daCategoria(doLugar, c).length }))
        .filter((l) => l.total > 0)
    : CATEGORIAS.filter((c) => c.slug !== cat?.slug).map((c) => ({ rotulo: c.curto, caminho: caminhoCategoria(c), total: daCategoria(inv.perfis, c).length })).filter((l) => l.total > 0);

  const completos = lista.filter((p) => p.completo).length;
  return {
    categoria: cat,
    cidade,
    bairro,
    ids: lista.map((p) => p.id),
    total: lista.length,
    completos,
    indexavel: indexavel(lista, bairroSlug),
    // No bairro, a lista de bairros seria ele mesmo: sai dos fatos
    fatos: bairroSlug ? { ...fatosDe(lista, inv, false), bairros: [] } : fatosDe(lista, inv, !cidade),
    locais,
    categorias,
  };
}

// ---------------------------------------------------------------------------
// Sitemaps e links internos
// ---------------------------------------------------------------------------
export interface PaginaIndexavel {
  caminho: string;
  total: number;
}

/** Todas as páginas indexáveis: categorias (hub, cidade, bairro) e locais (cidade, bairro). */
export async function paginasIndexaveis(): Promise<{ categorias: PaginaIndexavel[]; locais: PaginaIndexavel[] }> {
  const inv = await inventario();
  const categorias: PaginaIndexavel[] = [];
  const locais: PaginaIndexavel[] = [];
  const cidadesComPerfil = [...inv.cidades.values()];
  for (const cat of [null, ...CATEGORIAS]) {
    const daCat = daCategoria(inv.perfis, cat);
    if (cat && indexavel(daCat, null)) categorias.push({ caminho: caminhoCategoria(cat), total: daCat.length });
    for (const c of cidadesComPerfil) {
      const naCidade = doLocal(daCat, c.id, null);
      if (!indexavel(naCidade, null)) continue;
      (cat ? categorias : locais).push({ caminho: cat ? caminhoCategoria(cat, c.slug) : caminhoLocal(c.slug), total: naCidade.length });
      for (const [b, ps] of agrupar(daCat.filter((p) => p.cidadeId === c.id), (p) => p.bairroSlug)) {
        if (indexavel(ps, b)) (cat ? categorias : locais).push({ caminho: cat ? caminhoCategoria(cat, c.slug, b) : caminhoLocal(c.slug, b), total: ps.length });
      }
    }
  }
  return { categorias, locais };
}

/** A página de um local (cidade, opcionalmente bairro) é indexável? Usada pelo campo Cidade da busca. */
export async function localIndexavel(cidadeSlug: string, bairroSlug: string | null = null): Promise<boolean> {
  const inv = await inventario();
  const cidade = inv.porSlug.get(cidadeSlug);
  return cidade ? indexavel(doLocal(inv.perfis, cidade.id, bairroSlug), bairroSlug) : false;
}

/** Existe página (ao menos um buffet) para a categoria nesta cidade? Usado nos 301 de /buscar. */
export async function existePagina(cat: Categoria | null, cidadeSlug: string | null): Promise<boolean> {
  const inv = await inventario();
  const cidade = cidadeSlug ? inv.porSlug.get(cidadeSlug) : null;
  if (cidadeSlug && !cidade) return false;
  return daCategoria(doLocal(inv.perfis, cidade?.id ?? null, null), cat).length > 0;
}

/** Cidades com mais buffets (home: "Cidades mais buscadas"; rodapé). */
export async function cidadesEmAlta(limite = 8): Promise<LinkLocal[]> {
  const inv = await inventario();
  return [...agrupar(inv.perfis, (p) => (p.cidadeId == null ? null : String(p.cidadeId))).entries()]
    .map(([id, ps]) => ({ c: inv.cidades.get(Number(id))!, total: ps.length }))
    .filter((x) => x.c)
    .sort((a, b) => b.total - a.total)
    .slice(0, limite)
    .map(({ c, total }) => ({ rotulo: c.nome, caminho: caminhoLocal(c.slug), total }));
}

/** Pares categoria × cidade com mais buffets (rodapé). */
export async function paresEmAlta(limite = 8): Promise<LinkLocal[]> {
  const inv = await inventario();
  const cidades = (await cidadesEmAlta(4)).map((l) => l.caminho.split('/')[2]);
  const pares: LinkLocal[] = [];
  for (const slug of cidades) {
    const c = inv.porSlug.get(slug);
    if (!c) continue;
    const naCidade = doLocal(inv.perfis, c.id, null);
    for (const cat of CATEGORIAS) {
      const total = daCategoria(naCidade, cat).length;
      if (total) pares.push({ rotulo: `${cat.curto} em ${c.nome}`, caminho: caminhoCategoria(cat, c.slug), total });
    }
  }
  return pares.sort((a, b) => b.total - a.total).slice(0, limite);
}

/** Quantos buffets em cada categoria (home e rodapé). */
export async function totaisPorCategoria(): Promise<Record<string, number>> {
  const inv = await inventario();
  return Object.fromEntries(CATEGORIAS.map((c) => [c.slug, daCategoria(inv.perfis, c).length]));
}

// ---------------------------------------------------------------------------
// Resolução de uma URL de página (as rotas só renderizam ou redirecionam)
// ---------------------------------------------------------------------------
export type ResolucaoPagina =
  | { acao: 'nao-existe' }
  | { acao: 'redirecionar'; caminho: string }
  | { acao: 'mostrar'; pagina: PaginaLocal; caminho: string; numero: number; totalPaginas: number; itens: ItemResultado[]; todos: ItemResultado[] };

/**
 * Valida a URL de uma página de categoria/local e devolve o que mostrar. Caminhos sem `/vitrine` (quem chama aplica
 * caminhoVitrine). Barra final e minúsculas padronizadas (301); `?pagina=1` ou além da última vão para a URL base (301);
 * os demais parâmetros não mudam a página (a canonical é sempre a base ou a base com ?pagina=N).
 */
export async function resolverPagina(url: URL, segmentos: { categoria?: string; cidade?: string; bairro?: string }): Promise<ResolucaoPagina> {
  const cat = segmentos.categoria !== undefined ? categoriaPorSlug(segmentos.categoria.toLowerCase()) : null;
  if (segmentos.categoria !== undefined && !cat) return { acao: 'nao-existe' };
  const cidadeSlug = segmentos.cidade?.toLowerCase() ?? null;
  const bairroSlug = segmentos.bairro?.toLowerCase() ?? null;
  const caminho = cat ? caminhoCategoria(cat, cidadeSlug, bairroSlug) : caminhoLocal(cidadeSlug!, bairroSlug);
  const pedido = url.pathname.replace(/^\/vitrine(?=\/)/, '');
  const paginaParam = url.searchParams.get('pagina');
  const numero = paginaParam && /^\d{1,3}$/.test(paginaParam) ? Number(paginaParam) : 1;
  if (pedido !== caminho || (paginaParam !== null && numero <= 1)) return { acao: 'redirecionar', caminho: comPagina(caminho, numero) };

  const pagina = await paginaLocal(cat, cidadeSlug, bairroSlug);
  if (!pagina) return { acao: 'nao-existe' };
  const totalPaginas = Math.max(1, Math.ceil(pagina.total / POR_PAGINA_LOCAL));
  if (numero > totalPaginas) return { acao: 'redirecionar', caminho };
  const todos = await buffetsPorIds(pagina.ids, pagina.cidade, { cidade: pagina.cidade?.slug ?? null, tipo: cat?.tipos[0] ?? null }, POR_PAGINA_LOCAL);
  const itens = todos.slice((numero - 1) * POR_PAGINA_LOCAL, numero * POR_PAGINA_LOCAL);
  return { acao: 'mostrar', pagina, caminho, numero, totalPaginas, itens, todos };
}
