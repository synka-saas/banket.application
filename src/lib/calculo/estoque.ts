// Estoque × lista de compras (puro: roda no navegador e no servidor).
// Unidades: g/kg (massa), ml/l (volume) e un (unidade). Só se comparam quantidades da mesma dimensão.
import type { LinhaCompra, UnidadePorcao } from './orcamento';

type Dimensao = 'massa' | 'volume' | 'unidade';

const FATOR: Record<UnidadePorcao, { dimensao: Dimensao; fator: number }> = {
  g: { dimensao: 'massa', fator: 1 },
  kg: { dimensao: 'massa', fator: 1000 },
  ml: { dimensao: 'volume', fator: 1 },
  l: { dimensao: 'volume', fator: 1000 },
  un: { dimensao: 'unidade', fator: 1 },
};

/** Converte entre unidades da mesma dimensão (kg → g, l → ml…); null quando não há conversão (g → un). */
export function converter(qtd: number, de: UnidadePorcao, para: UnidadePorcao): number | null {
  const a = FATOR[de];
  const b = FATOR[para];
  if (!a || !b || a.dimensao !== b.dimensao) return null;
  return Math.round(((qtd * a.fator) / b.fator) * 1000) / 1000;
}

/** Item de estoque como a lista de compras precisa dele */
export interface EstoqueRef {
  id: string;
  nome: string;
  catalogo_item_id: string | null;
  unidade: UnidadePorcao;
  quantidade: number;
}

export type SituacaoEstoque =
  /** O saldo cobre a quantidade da lista */
  | { tipo: 'suficiente'; item: EstoqueRef; disponivel: number }
  /** Tem parte: `faltam` na unidade da linha */
  | { tipo: 'parcial'; item: EstoqueRef; disponivel: number; faltam: number }
  | { tipo: 'sem'; item: EstoqueRef; disponivel: number; faltam: number }
  /** Controlado no estoque, mas em unidade sem conversão (ex.: lista em g, estoque em un) ou sem quantidade na lista */
  | { tipo: 'incomparavel'; item: EstoqueRef }
  /** Não é gerenciado no estoque */
  | null;

const normalizar = (nome: string) => nome.trim().toLowerCase();

/** Item de estoque da linha: pelo item do cardápio ligado; senão, pelo mesmo nome (linhas avulsas e bebidas). */
export function estoqueDaLinha(linha: Pick<LinhaCompra, 'item_id' | 'nome'>, estoque: EstoqueRef[]): EstoqueRef | null {
  if (linha.item_id) {
    const ligado = estoque.find((e) => e.catalogo_item_id === linha.item_id);
    if (ligado) return ligado;
  }
  const nome = normalizar(linha.nome);
  return nome ? (estoque.find((e) => normalizar(e.nome) === nome) ?? null) : null;
}

/** Compara a quantidade da linha (manual ?? calculada) com o saldo do estoque, na unidade da linha. */
export function situacaoEstoque(linha: LinhaCompra, estoque: EstoqueRef[]): SituacaoEstoque {
  const item = estoqueDaLinha(linha, estoque);
  if (!item) return null;
  const necessario = linha.quantidade_manual ?? linha.quantidade_calc;
  const unidade = linha.unidade ?? item.unidade;
  const disponivel = converter(Math.max(0, item.quantidade), item.unidade, unidade);
  if (necessario === null || disponivel === null) return { tipo: 'incomparavel', item };
  if (disponivel >= necessario) return { tipo: 'suficiente', item, disponivel };
  const faltam = Math.round((necessario - disponivel) * 1000) / 1000;
  return disponivel > 0 ? { tipo: 'parcial', item, disponivel, faltam } : { tipo: 'sem', item, disponivel, faltam };
}
