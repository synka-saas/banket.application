// Margem projetada de alimentos e bebidas de uma versão do orçamento (puro: construtor, servidor e otimizador).
// Custo dos insumos = custo por porção do catálogo × convidados (cada convidado consome uma porção do item);
// bebida por unidade = custo × quantidade do orçamento. Staff, locação e extras ficam fora (não são insumos).
import type { ConteudoOrcamento } from './orcamento';

export interface CustoItem {
  key: string;
  item_id: string | null;
  nome: string;
  grupo: string;
  custo_unitario: number;
  quantidade: number;
  custo_total: number;
}

export interface Margem {
  receita: number;
  custo: number;
  margem_valor: number;
  /** null quando não há receita ou nenhum item tem custo (a margem não pode ser estimada) */
  margem_pct: number | null;
  custo_por_convidado: number;
  itens: CustoItem[];
  /** Itens selecionados sem custo cadastrado (a margem fica superestimada) */
  sem_custo: string[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function calcularMargem(conteudo: Pick<ConteudoOrcamento, 'cardapios' | 'bebidas' | 'pagantes' | 'totais'>): Margem {
  const convidados = Math.max(0, conteudo.pagantes.convidados);
  const itens: CustoItem[] = [];
  const semCusto: string[] = [];
  for (const c of conteudo.cardapios)
    for (const s of c.secoes)
      for (const i of s.itens) {
        if (!i.selecionado) continue;
        if (i.custo_unitario === null || i.custo_unitario === undefined) {
          semCusto.push(i.nome);
          continue;
        }
        itens.push({ key: i.key, item_id: i.item_id, nome: i.nome, grupo: s.nome, custo_unitario: i.custo_unitario, quantidade: convidados, custo_total: r2(i.custo_unitario * convidados) });
      }
  for (const b of conteudo.bebidas) {
    if (b.custo_unitario === null || b.custo_unitario === undefined) {
      semCusto.push(b.nome);
      continue;
    }
    const qtd = b.unidade === 'unidade' ? Math.max(0, b.quantidade) : convidados;
    itens.push({ key: b.key, item_id: b.ref_id, nome: b.nome, grupo: 'Bebidas', custo_unitario: b.custo_unitario, quantidade: qtd, custo_total: r2(b.custo_unitario * qtd) });
  }
  const receita = r2((conteudo.totais?.alimentos ?? 0) + (conteudo.totais?.bebidas ?? 0));
  const custo = r2(itens.reduce((a, i) => a + i.custo_total, 0));
  return {
    receita,
    custo,
    margem_valor: r2(receita - custo),
    margem_pct: receita > 0 && itens.length > 0 ? Math.round(((receita - custo) / receita) * 1000) / 10 : null,
    custo_por_convidado: convidados > 0 ? r2(custo / convidados) : 0,
    itens: itens.sort((a, b) => b.custo_total - a.custo_total),
    sem_custo: semCusto,
  };
}
