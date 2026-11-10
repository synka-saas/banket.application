// Páginas de categoria e de local do Banket Busca (SEO, 10/11/2026). Puro e testado (categorias.test.ts).
//   /{categoria}/                         hub nacional da categoria
//   /{categoria}/{cidade-uf}/             categoria × cidade
//   /{categoria}/{cidade-uf}/{bairro}/    categoria × bairro
//   /buffets-em/{cidade-uf}/[{bairro}/]   só o local
// Slugs em minúsculas, sem acento e com hífen; a cidade sempre com a UF (busca_cidades.slug); barra final sempre.
// A tabela CATEGORIAS é a configuração: só entram categorias com inventário (sem confraternização, batizado…).
import { slugTexto } from './geo';

export interface Categoria {
  slug: string;
  /** Nome usado no H1 e no title ("Buffet para casamento") */
  nome: string;
  /** Rótulo curto para chips e links ("Casamento") */
  curto: string;
  icone: string;
  /** Tipos de evento (catalogos.TIPOS_EVENTO) que entram na categoria */
  tipos: string[];
  /** Tipos de serviço (catalogos.TIPOS_SERVICO) que entram na categoria */
  servicos: string[];
  /** Também entra quem atende em domicílio (busca_perfis.atende_domicilio) */
  domicilio?: boolean;
  /** Termo no plural para os textos ("casamentos") */
  plural: string;
}

export const CATEGORIAS: Categoria[] = [
  { slug: 'buffet-para-casamento', nome: 'Buffet para casamento', curto: 'Casamento', icone: 'heart', tipos: ['casamento'], servicos: ['buffet_casamento'], plural: 'casamentos' },
  { slug: 'buffet-infantil', nome: 'Buffet infantil', curto: 'Festa infantil', icone: 'balloon', tipos: ['infantil'], servicos: ['buffet_infantil', 'kids'], plural: 'festas infantis' },
  { slug: 'buffet-para-aniversario', nome: 'Buffet para aniversário', curto: 'Aniversário', icone: 'cake', tipos: ['aniversario'], servicos: [], plural: 'aniversários' },
  { slug: 'buffet-para-festa-de-15-anos', nome: 'Buffet para festa de 15 anos', curto: 'Festa de 15 anos', icone: 'sparkles', tipos: ['debutante'], servicos: [], plural: 'festas de 15 anos' },
  { slug: 'buffet-para-formatura', nome: 'Buffet para formatura', curto: 'Formatura', icone: 'school', tipos: ['formatura'], servicos: [], plural: 'formaturas' },
  { slug: 'buffet-para-eventos-corporativos', nome: 'Buffet para eventos corporativos', curto: 'Evento corporativo', icone: 'briefcase', tipos: ['corporativo'], servicos: [], plural: 'eventos corporativos' },
  { slug: 'coffee-break', nome: 'Coffee break', curto: 'Coffee break', icone: 'coffee', tipos: ['coffee_break'], servicos: ['coffee_break'], plural: 'coffee breaks' },
  { slug: 'buffet-de-churrasco', nome: 'Buffet de churrasco', curto: 'Churrasco', icone: 'flame', tipos: ['churrasco'], servicos: ['churrasco'], plural: 'churrascos' },
  { slug: 'buffet-a-domicilio', nome: 'Buffet a domicílio', curto: 'Buffet a domicílio', icone: 'home', tipos: [], servicos: ['buffet_domicilio'], domicilio: true, plural: 'eventos em casa' },
];

/** Prefixo das páginas só de local. */
export const PREFIXO_LOCAL = 'buffets-em';


/** Buffets por página nas listagens de categoria e local. */
export const POR_PAGINA_LOCAL = 24;

const POR_SLUG = new Map(CATEGORIAS.map((c) => [c.slug, c]));
export const categoriaPorSlug = (slug: string | null | undefined): Categoria | null => (slug ? POR_SLUG.get(slug) ?? null : null);

/** Categoria do tipo de evento (para links de tipos e para os 301 de /buscar?tipo=). */
export const categoriaDoTipo = (tipo: string | null | undefined): Categoria | null =>
  tipo ? CATEGORIAS.find((c) => c.tipos.includes(tipo)) ?? null : null;

/** Categoria do tipo de serviço (para links de serviço e para os 301 de /buscar?servico=). */
export const categoriaDoServico = (servico: string | null | undefined): Categoria | null =>
  servico ? CATEGORIAS.find((c) => c.servicos.includes(servico)) ?? null : null;

/**
 * Categoria equivalente a uma busca só por tipo e/ou serviços (os 301 de /buscar): o tipo manda; os serviços precisam
 * ser todos da mesma categoria. `null` quando não há equivalente (tipo sem categoria, serviços de categorias diferentes).
 */
export function categoriaDaBusca(tipo: string | null, servicos: string[]): Categoria | null {
  const doTipo = tipo ? categoriaDoTipo(tipo) : null;
  if (tipo && !doTipo) return null;
  const doServico = servicos.map(categoriaDoServico);
  if (doServico.some((c) => !c)) return null;
  const cats = new Set([...(doTipo ? [doTipo] : []), ...(doServico as Categoria[])]);
  return cats.size === 1 ? [...cats][0] : null;
}

/** O perfil entra na categoria: algum tipo de evento ou serviço dela (ou atende em domicílio, quando ela pede). */
export function encaixa(p: { tiposEvento: string[]; tiposServico: string[]; atendeDomicilio: boolean }, c: Categoria): boolean {
  return (
    c.tipos.some((t) => p.tiposEvento.includes(t)) ||
    c.servicos.some((s) => p.tiposServico.includes(s)) ||
    (Boolean(c.domicilio) && p.atendeDomicilio)
  );
}

/** Slug do bairro ("Jardim América" → "jardim-america"). */
export const slugBairro = (bairro: string): string => slugTexto(bairro, 80);

/**
 * Descrição escrita pelo buffet (não a frase neutra gerada na importação: "X fica no bairro Y, em Cidade (UF). …").
 * Base do "perfil completo" (descrição própria + foto real + ao menos um serviço e um tipo de evento).
 */
export function descricaoPropria(descricao: string | null | undefined): boolean {
  const t = (descricao ?? '').trim();
  return t.length >= 80 && !/^.+ fica (?:no bairro .+, )?em .+ \([A-Z]{2}\)\./.test(t);
}

// ---------------------------------------------------------------------------
// Endereços (sempre com barra no fim; sem o prefixo /vitrine: quem chama usa caminhoVitrine/buscaUrl)
// ---------------------------------------------------------------------------
export function caminhoCategoria(c: Categoria | string, cidade?: string | null, bairro?: string | null): string {
  const slug = typeof c === 'string' ? c : c.slug;
  return `/${slug}/${cidade ? `${cidade}/` : ''}${cidade && bairro ? `${bairro}/` : ''}`;
}

export function caminhoLocal(cidade: string, bairro?: string | null): string {
  return `/${PREFIXO_LOCAL}/${cidade}/${bairro ? `${bairro}/` : ''}`;
}

/** Página da listagem: a 1ª é a URL base; as demais levam ?pagina=N (canonical própria). */
export const comPagina = (caminho: string, pagina: number): string => (pagina > 1 ? `${caminho}?pagina=${pagina}` : caminho);

// ---------------------------------------------------------------------------
// Textos
// ---------------------------------------------------------------------------
export interface LocalTexto {
  /** "São Paulo" ou "Aclimação" */
  nome: string;
  /** Cidade do bairro ("São Paulo"): o H1 fica "… em Aclimação, São Paulo" */
  cidade?: string | null;
}

const qtd = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const ondeLocal = (l: LocalTexto | null) => (l ? (l.cidade ? `${l.nome}, ${l.cidade}` : l.nome) : null);

/** H1 da página. */
export function tituloH1(cat: Categoria | null, local: LocalTexto | null): string {
  const onde = ondeLocal(local);
  if (cat) return onde ? `${cat.nome} em ${onde}` : cat.nome;
  return onde ? `Buffets em ${onde}` : 'Buffets';
}

/** <title> completo, com a marca. */
export function tituloPagina(cat: Categoria | null, local: LocalTexto | null, total: number, pagina = 1): string {
  const h1 = tituloH1(cat, local);
  const sufixo = pagina > 1 ? ` (página ${pagina})` : '';
  const oferta = cat ? `${qtd(total, 'buffet', 'buffets')} com orçamento grátis` : `${qtd(total, 'opção', 'opções')} com orçamento grátis`;
  return `${h1}: ${oferta}${sufixo} | Banket Busca`;
}

/** Fatos reais do local que tornam cada texto único. */
export interface FatosLocal {
  total: number;
  espacoProprio: number;
  domicilio: number;
  /** Bairros com mais buffets (nome e quantidade), do maior para o menor */
  bairros: { nome: string; total: number }[];
  /** Serviços mais comuns (rótulo e quantidade) */
  servicos: { rotulo: string; total: number }[];
  /** Tipos de evento mais comuns (rótulo no plural e quantidade) */
  eventos: { rotulo: string; total: number }[];
  capacidadeMax: number | null;
  avaliados: number;
  notaMedia: number | null;
  /** Hub nacional: cidades com buffets */
  cidades?: { nome: string; total: number }[];
}

/** Meta description (até ~160 caracteres), com o número e os bairros/cidades do local. */
export function descricaoPagina(cat: Categoria | null, local: LocalTexto | null, f: FatosLocal): string {
  const onde = ondeLocal(local) ?? 'todo o Brasil';
  const quem = cat ? `${qtd(f.total, 'buffet', 'buffets')} para ${cat.plural}` : qtd(f.total, 'buffet', 'buffets');
  const lugares = (f.cidades ?? f.bairros).slice(0, 2).map((b) => b.nome);
  const destaque = lugares.length ? ` (${lugares.join(', ')} e mais)` : '';
  const texto = `${quem} em ${onde}${destaque}. Compare fotos, serviços e avaliações e peça orçamento grátis a vários de uma vez.`;
  return texto.length <= 165 ? texto : `${quem} em ${onde}. Compare fotos, serviços e avaliações e peça orçamento grátis.`;
}

const palavras = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
const juntar = (itens: string[]) => (itens.length <= 1 ? itens.join('') : `${itens.slice(0, -1).join(', ')} e ${itens.at(-1)}`);

/**
 * Introdução da página (80–150 palavras), montada só com fatos do local: quantos buffets, onde ficam, o que oferecem,
 * capacidade e avaliações. Frases de apoio entram até passar de 80 palavras; nada passa de 150.
 */
export function introPagina(cat: Categoria | null, local: LocalTexto | null, f: FatosLocal): string {
  const onde = ondeLocal(local) ?? 'várias cidades do Brasil';
  const assunto = cat ? `${cat.nome.toLowerCase()}` : 'buffets';
  const fatos: string[] = [];
  fatos.push(
    cat
      ? `Reunimos ${qtd(f.total, 'buffet que atende', 'buffets que atendem')} ${cat.plural} em ${onde}, com fotos, serviços, capacidade e avaliações de quem já contratou.`
      : `Reunimos ${qtd(f.total, 'buffet', 'buffets')} em ${onde}, para festas sociais e eventos corporativos, com fotos, serviços, capacidade e avaliações de quem já contratou.`
  );
  if (f.cidades?.length) fatos.push(`As cidades com mais opções são ${juntar(f.cidades.slice(0, 4).map((c) => `${c.nome} (${c.total})`))}.`);
  else if (f.bairros.length) fatos.push(`${f.bairros.length === 1 ? 'O bairro com opções é' : 'Os bairros com mais opções são'} ${juntar(f.bairros.slice(0, 4).map((b) => `${b.nome} (${b.total})`))}.`);
  if (f.espacoProprio || f.domicilio) {
    const partes = [
      f.espacoProprio ? `${qtd(f.espacoProprio, 'tem espaço próprio para receber o evento', 'têm espaço próprio para receber o evento')}` : null,
      f.domicilio ? `${qtd(f.domicilio, 'leva a estrutura até a sua casa ou empresa', 'levam a estrutura até a sua casa ou empresa')}` : null,
    ].filter(Boolean) as string[];
    fatos.push(`${juntar(partes).replace(/^./, (l) => l.toUpperCase())}.`);
  }
  if (f.servicos.length) fatos.push(`Entre os serviços mais oferecidos estão ${juntar(f.servicos.slice(0, 3).map((s) => s.rotulo.toLowerCase()))}.`);
  if (!cat && f.eventos.length) fatos.push(`Os eventos mais atendidos são ${juntar(f.eventos.slice(0, 3).map((e) => e.rotulo))}.`);
  if (f.capacidadeMax) fatos.push(`Há opções para eventos de até ${f.capacidadeMax.toLocaleString('pt-BR')} convidados.`);
  if (f.avaliados && f.notaMedia) {
    fatos.push(`${qtd(f.avaliados, 'buffet já tem', 'buffets já têm')} avaliações de clientes, com nota média de ${f.notaMedia.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}.`);
  }
  const apoio = [
    `Compare os perfis de ${assunto} lado a lado, veja quem atende o número de convidados do seu evento e confira o que cada um inclui.`,
    'Para pedir orçamento, escolha os buffets que combinam com você e envie um único pedido com a data, o local e o número de convidados.',
    'O pedido é grátis e sem compromisso, e cada buffet responde direto para você, por e-mail ou WhatsApp.',
    'Buffets clientes Banket mostram a data livre a partir da própria agenda; nos demais, a disponibilidade vem na resposta.',
  ];
  let texto = fatos.join(' ');
  for (const frase of apoio) {
    if (palavras(texto) >= 80 && palavras(`${texto} ${frase}`) > 120) break;
    if (palavras(`${texto} ${frase}`) > 150) break;
    texto = `${texto} ${frase}`;
  }
  // Teto de 150 palavras: corta na última frase inteira
  if (palavras(texto) > 150) {
    const frases = texto.match(/[^.]+\./g) ?? [texto];
    texto = '';
    for (const fr of frases) {
      if (palavras(`${texto}${fr}`) > 150) break;
      texto += fr;
    }
  }
  return texto.trim();
}

/** Contagem de palavras (exportada para os testes). */
export const contarPalavras = palavras;

export interface Migalha {
  rotulo: string;
  /** Caminho na vitrine (sem host) */
  caminho: string;
  /** Página atual: aparece sem link */
  atual: boolean;
}

/** Breadcrumb: Home > Categoria > Cidade > Bairro, ou Home > Buffets em Cidade > Bairro. */
export function migalhas(cat: Categoria | null, cidade: { slug: string; nome: string } | null, bairro: { slug: string; nome: string } | null): Migalha[] {
  const lista: Omit<Migalha, 'atual'>[] = [{ rotulo: 'Início', caminho: '/' }];
  if (cat) {
    lista.push({ rotulo: cat.nome, caminho: caminhoCategoria(cat) });
    if (cidade) lista.push({ rotulo: cidade.nome, caminho: caminhoCategoria(cat, cidade.slug) });
    if (cidade && bairro) lista.push({ rotulo: bairro.nome, caminho: caminhoCategoria(cat, cidade.slug, bairro.slug) });
  } else if (cidade) {
    lista.push({ rotulo: `Buffets em ${cidade.nome}`, caminho: caminhoLocal(cidade.slug) });
    if (bairro) lista.push({ rotulo: bairro.nome, caminho: caminhoLocal(cidade.slug, bairro.slug) });
  }
  return lista.map((m, i) => ({ ...m, atual: i === lista.length - 1 }));
}
