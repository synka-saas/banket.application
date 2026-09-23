// Dimensionamento e custo de staff. Função pura: usada no servidor e no construtor de orçamento.

export interface RegraStaff {
  cache_diaria: number;
  auxilio: number;
  por_evento: boolean;
  quantidade_fixa: number;
  convidados_por_profissional: number | null;
  minimo: number;
}

/** Quantidade sugerida de profissionais para o número de convidados. */
export function quantidadeSugerida(regra: RegraStaff, convidados: number): number {
  if (regra.por_evento) return regra.quantidade_fixa;
  const proporcional =
    regra.convidados_por_profissional && convidados > 0 ? Math.ceil(convidados / regra.convidados_por_profissional) : 0;
  return Math.max(regra.minimo, proporcional);
}

/** Custo de um profissional por evento (cachê/diária + auxílio). */
export function custoUnitario(regra: Pick<RegraStaff, 'cache_diaria' | 'auxilio'>): number {
  return arredondar(regra.cache_diaria + regra.auxilio);
}

export function custoSugerido(regra: RegraStaff, convidados: number): { quantidade: number; unitario: number; total: number } {
  const quantidade = quantidadeSugerida(regra, convidados);
  const unitario = custoUnitario(regra);
  return { quantidade, unitario, total: arredondar(quantidade * unitario) };
}

/** Texto da regra, como nos cards: "1 profissional a cada 15 convidados". */
export function descreverRegra(regra: RegraStaff): string {
  if (regra.por_evento) {
    return `${regra.quantidade_fixa} ${regra.quantidade_fixa === 1 ? 'profissional' : 'profissionais'} por evento`;
  }
  if (regra.convidados_por_profissional) return `1 a cada ${regra.convidados_por_profissional} convidados`;
  return `${regra.minimo} fixo(s)`;
}

export function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100;
}
