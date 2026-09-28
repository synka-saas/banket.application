// Ordenação de listagens por coluna (?ordem=campo&dir=asc|desc).
// O campo da URL só escolhe entre expressões SQL fixas definidas no servidor: nada da URL entra no SQL.

export type Direcao = 'asc' | 'desc';

export interface Ordenacao {
  campo: string | null;
  dir: Direcao;
}

export function lerOrdenacao(url: URL): Ordenacao {
  const campo = url.searchParams.get('ordem');
  return { campo: campo && /^[a-z_]+$/.test(campo) ? campo : null, dir: url.searchParams.get('dir') === 'desc' ? 'desc' : 'asc' };
}

/**
 * Monta o ORDER BY: a coluna escolhida (se estiver no mapa) e depois a ordem padrão como desempate.
 * `mapa` associa o nome da coluna na URL à expressão SQL (constante do servidor).
 */
export function orderBy(ord: Ordenacao | undefined, mapa: Record<string, string>, padrao: string): string {
  const expr = ord?.campo ? mapa[ord.campo] : undefined;
  if (!expr) return padrao;
  return `${expr} ${ord!.dir === 'desc' ? 'DESC' : 'ASC'} NULLS LAST, ${padrao}`;
}
