// Paginação e filtros de listagem via query string (?q=&page=).

export const DEFAULT_PAGE_SIZE = 20;

export interface PageParams {
  page: number;
  pageSize: number;
  offset: number;
}

export function pageParams(url: URL, pageSize = DEFAULT_PAGE_SIZE): PageParams {
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export interface PageInfo {
  page: number;
  totalPages: number;
  total: number;
}

export function pageInfo(params: PageParams, total: number): PageInfo {
  return { page: params.page, total, totalPages: Math.max(1, Math.ceil(total / params.pageSize)) };
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

/** Termo de busca pronto para ILIKE (escapa curingas). */
export function searchTerm(url: URL, param = 'q'): string | null {
  const q = url.searchParams.get(param)?.trim();
  if (!q) return null;
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
