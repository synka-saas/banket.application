// Filtros da busca na URL (query string), nos dois sentidos: ler (`lerCriterios`) e escrever (`urlDaBusca`).
// Puro e tolerante: valor inválido é ignorado, nunca vira erro. Testes em filtros.test.ts.
import { RESTRICOES, TIPOS_EVENTO, TIPOS_SERVICO, ehTipoEvento, filtrarSlugs } from './catalogos';

export type Ordem = 'relevancia' | 'avaliacao' | 'distancia';
export type ModoLocal = 'domicilio' | 'espaco';

export interface Criterios {
  tipo: string | null;
  /** Slug da cidade (busca_cidades.slug, "santo-andre-sp") */
  cidade: string | null;
  /** "YYYY-MM-DD" */
  data: string | null;
  convidados: number | null;
  servicos: string[];
  restricoes: string[];
  local: ModoLocal | null;
  /** Nota mínima: 4 ou 4.5 */
  avaliacao: number | null;
  /** Distância máxima até o buffet, em km */
  raio: number | null;
  ordem: Ordem;
  pagina: number;
}

export const POR_PAGINA = 12;
export const RAIOS = [5, 10, 25, 50] as const;
export const NOTAS = [4, 4.5] as const;
export const ORDENS: { valor: Ordem; rotulo: string }[] = [
  { valor: 'relevancia', rotulo: 'Mais relevantes' },
  { valor: 'avaliacao', rotulo: 'Melhor avaliados' },
  { valor: 'distancia', rotulo: 'Mais próximos' },
];

const inteiro = (v: string | null, min: number, max: number): number | null => {
  if (v == null || v.trim() === '') return null;
  const n = Number(v.replace(/\D/g, ''));
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};

/** Data "YYYY-MM-DD" ou "dd/mm/aaaa" válida e a partir de `hoje`. */
export function dataValida(v: string | null, hoje: string): string | null {
  if (!v) return null;
  let iso = v.trim();
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(iso);
  if (br) iso = `${br[3]}-${br[2]}-${br[1]}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso) return null;
  return iso >= hoje ? iso : null;
}

/** Lê os critérios de uma URL da vitrine. `hoje` em "YYYY-MM-DD" (fuso de São Paulo). */
export function lerCriterios(params: URLSearchParams, hoje: string): Criterios {
  const tipo = params.get('tipo');
  const cidade = params.get('cidade')?.trim().toLowerCase() ?? '';
  const local = params.get('local');
  const nota = Number(params.get('avaliacao'));
  const raio = Number(params.get('raio'));
  const ordem = params.get('ordem') as Ordem;
  return {
    tipo: ehTipoEvento(tipo) ? tipo : null,
    cidade: /^[a-z0-9-]{3,140}$/.test(cidade) ? cidade : null,
    data: dataValida(params.get('data'), hoje),
    convidados: inteiro(params.get('convidados'), 1, 5000),
    servicos: filtrarSlugs(params.getAll('servico'), TIPOS_SERVICO),
    restricoes: filtrarSlugs(params.getAll('restricao'), RESTRICOES),
    local: local === 'domicilio' || local === 'espaco' ? local : null,
    avaliacao: (NOTAS as readonly number[]).includes(nota) ? nota : null,
    raio: (RAIOS as readonly number[]).includes(raio) ? raio : null,
    ordem: ORDENS.some((o) => o.valor === ordem) ? ordem : 'relevancia',
    pagina: inteiro(params.get('pagina'), 1, 50) ?? 1,
  };
}

/** Query string de uma busca (só o que está preenchido), na ordem estável dos campos. */
export function queryDaBusca(c: Partial<Criterios>): string {
  const p = new URLSearchParams();
  if (c.tipo) p.set('tipo', c.tipo);
  if (c.cidade) p.set('cidade', c.cidade);
  if (c.data) p.set('data', c.data);
  if (c.convidados) p.set('convidados', String(c.convidados));
  for (const s of c.servicos ?? []) p.append('servico', s);
  for (const r of c.restricoes ?? []) p.append('restricao', r);
  if (c.local) p.set('local', c.local);
  if (c.avaliacao) p.set('avaliacao', String(c.avaliacao));
  if (c.raio) p.set('raio', String(c.raio));
  if (c.ordem && c.ordem !== 'relevancia') p.set('ordem', c.ordem);
  if (c.pagina && c.pagina > 1) p.set('pagina', String(c.pagina));
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** Tem algum filtro secundário (além de tipo, cidade, data e convidados)? Usado no estado vazio e no "Limpar". */
export const temFiltrosSecundarios = (c: Criterios) =>
  c.servicos.length > 0 || c.restricoes.length > 0 || c.local != null || c.avaliacao != null || c.raio != null;

/** Os mesmos critérios sem os filtros secundários. */
export const semFiltrosSecundarios = (c: Criterios): Criterios => ({
  ...c, servicos: [], restricoes: [], local: null, avaliacao: null, raio: null, pagina: 1,
});

/** Rótulo curto de cada filtro ativo (chips removíveis) com a busca sem ele. */
export function chipsDosFiltros(c: Criterios, rotulos: { servico: (s: string) => string; restricao: (s: string) => string }): { rotulo: string; sem: Criterios }[] {
  const chips: { rotulo: string; sem: Criterios }[] = [];
  const base = { ...c, pagina: 1 };
  for (const s of c.servicos) chips.push({ rotulo: rotulos.servico(s), sem: { ...base, servicos: c.servicos.filter((x) => x !== s) } });
  for (const r of c.restricoes) chips.push({ rotulo: rotulos.restricao(r), sem: { ...base, restricoes: c.restricoes.filter((x) => x !== r) } });
  if (c.local) chips.push({ rotulo: c.local === 'espaco' ? 'Espaço próprio' : 'Em domicílio', sem: { ...base, local: null } });
  if (c.avaliacao) chips.push({ rotulo: `Nota ${String(c.avaliacao).replace('.', ',')}+`, sem: { ...base, avaliacao: null } });
  if (c.raio) chips.push({ rotulo: `Até ${c.raio} km`, sem: { ...base, raio: null } });
  return chips;
}

export const TIPOS_EVENTO_URL = TIPOS_EVENTO.map((t) => ({ slug: t.slug, url: t.slug.replace(/_/g, '-') }));
/** Tipo de evento a partir do segmento da URL das landings ("coffee-break" → "coffee_break"). */
export const tipoDaUrl = (segmento: string): string | null => TIPOS_EVENTO_URL.find((t) => t.url === segmento)?.slug ?? null;
export const urlDoTipo = (slug: string): string => slug.replace(/_/g, '-');
