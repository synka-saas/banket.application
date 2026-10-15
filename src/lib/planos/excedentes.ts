// Excedentes de um limite no rebaixamento (regra pura, testada): ficam os mais recentes (updated_at desc),
// respeitando quem nunca pode sair (ex.: o proprietário) e as preferências do usuário. Nada é apagado:
// quem excede é marcado como bloqueado pelo plano e volta no upgrade.

export interface ItemExcedente {
  id: string;
  /** Data de referência para "mais recente" (ISO ou Date) */
  atualizadoEm: Date | string | null;
}

export interface EscolhaExcedentes {
  manter: string[];
  bloquear: string[];
}

/**
 * @param itens   todos os itens em uso (ativos ou já bloqueados pelo plano)
 * @param limite  máximo permitido (null, undefined ou negativo = sem limite)
 * @param opcoes  semprefica: ids que nunca saem; preferidos: ids que o usuário quer manter (na ordem)
 */
export function escolherExcedentes(
  itens: ItemExcedente[],
  limite: number | null | undefined,
  opcoes: { sempreFica?: string[]; preferidos?: string[] } = {}
): EscolhaExcedentes {
  if (limite == null || limite < 0 || itens.length <= limite) return { manter: itens.map((i) => i.id), bloquear: [] };
  const sempre = new Set(opcoes.sempreFica ?? []);
  const preferidos = (opcoes.preferidos ?? []).filter((id) => itens.some((i) => i.id === id));
  const manter: string[] = [];
  for (const i of itens) if (sempre.has(i.id)) manter.push(i.id);
  for (const id of preferidos) if (manter.length < limite && !manter.includes(id)) manter.push(id);
  const porData = [...itens].sort((a, b) => tempo(b.atualizadoEm) - tempo(a.atualizadoEm));
  for (const i of porData) if (manter.length < limite && !manter.includes(i.id)) manter.push(i.id);
  // O obrigatório pode ultrapassar o limite (nunca se bloqueia o proprietário)
  const manterSet = new Set(manter);
  return { manter, bloquear: itens.filter((i) => !manterSet.has(i.id)).map((i) => i.id) };
}

const tempo = (v: Date | string | null): number => {
  if (!v) return 0;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
};
