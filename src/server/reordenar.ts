// Reordenação por arrastar (seções do cardápio, blocos de informação, etapas do funil).
// Recebe a lista de ids na nova ordem e redistribui entre eles as posições que já ocupavam: numa lista paginada
// ou filtrada, os itens fora da tela não mudam de lugar.
import { z } from 'zod';
import type { Db } from '../lib/db';
import { UserError } from '../lib/forms';

const TABELAS = {
  secoes: 'catalogo_secoes',
  blocos: 'orcamento_blocos_info',
  status: 'status_orcamento',
} as const;

export type RecursoOrdenavel = keyof typeof TABELAS;

export const reordenarSchema = z.object({
  ids: z.array(z.uuid('Identificador inválido.')).min(1).max(200),
});

/** Posições: as mesmas já ocupadas pelos itens; repetidas (ex.: todas 0) viram uma sequência a partir da menor. */
export function redistribuirPosicoes(atuais: number[]): number[] {
  const ordenadas = [...atuais].sort((a, b) => a - b);
  const repetidas = new Set(ordenadas).size !== ordenadas.length;
  return repetidas ? ordenadas.map((_, i) => ordenadas[0] + i) : ordenadas;
}

export async function reordenar(db: Db, recurso: RecursoOrdenavel, ids: string[]) {
  const tabela = TABELAS[recurso];
  if (new Set(ids).size !== ids.length) throw new UserError('Lista com itens repetidos.');
  // RLS: só enxerga itens da empresa; se faltar algum, a lista da tela está desatualizada
  const { rows } = await db.query<{ id: string; ordem: number }>(`SELECT id, ordem FROM ${tabela} WHERE id = ANY($1::uuid[])`, [ids]);
  if (rows.length !== ids.length) throw new UserError('A lista mudou desde que a página foi aberta. Recarregue e tente de novo.');
  const posicoes = redistribuirPosicoes(rows.map((r) => r.ordem ?? 0));
  for (const [i, id] of ids.entries()) {
    await db.query(`UPDATE ${tabela} SET ordem = $1 WHERE id = $2`, [posicoes[i], id]);
  }
}
