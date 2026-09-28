// Paginação e filtros de listagem via query string (?q=&page=&por=).

export const DEFAULT_PAGE_SIZE = 20;
export const TAMANHOS_PAGINA = [20, 50, 100] as const;

export interface PageParams {
  page: number;
  pageSize: number;
  offset: number;
}

export function pageParams(url: URL, padrao = DEFAULT_PAGE_SIZE): PageParams {
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  // ?por= só aceita os tamanhos oferecidos na tela
  const por = Number.parseInt(url.searchParams.get('por') ?? '', 10);
  const pageSize = (TAMANHOS_PAGINA as readonly number[]).includes(por) ? por : padrao;
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export interface PageInfo {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
}

export function pageInfo(params: PageParams, total: number): PageInfo {
  return { page: params.page, total, pageSize: params.pageSize, totalPages: Math.max(1, Math.ceil(total / params.pageSize)) };
}

/** Números de página a exibir: primeira, última e vizinhas da atual; null marca um salto ("…"). */
export function paginasVisiveis(atual: number, total: number, vizinhas = 1): (number | null)[] {
  const paginas: (number | null)[] = [];
  for (let p = 1; p <= total; p++) {
    if (p === 1 || p === total || Math.abs(p - atual) <= vizinhas) paginas.push(p);
    else if (paginas.at(-1) !== null) paginas.push(null);
  }
  return paginas;
}

/** Mantém os filtros atuais trocando apenas os parâmetros informados. */
export function withQuery(url: URL, changes: Record<string, string | number | null>): string {
  const next = new URL(url);
  for (const [key, value] of Object.entries(changes)) {
    if (value === null || value === '') next.searchParams.delete(key);
    else next.searchParams.set(key, String(value));
  }
  return next.pathname + next.search;
}

/** A lista está filtrada (busca ou filtro)? Paginação, ordenação e modo de exibição não contam. */
export function estaFiltrando(url: URL): boolean {
  return [...url.searchParams.keys()].some((k) => !['page', 'por', 'ordem', 'dir', 'view'].includes(k));
}

/** Termo de busca pronto para ILIKE (escapa curingas). */
export function searchTerm(url: URL, param = 'q'): string | null {
  const q = url.searchParams.get(param)?.trim();
  if (!q) return null;
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
