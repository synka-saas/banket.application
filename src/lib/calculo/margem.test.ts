import { describe, expect, it } from 'vitest';
import { calcularMargem } from './margem';

describe('calcularMargem', () => {
  it('custo = custo por porção × convidados; bebida por unidade usa a quantidade; itens sem custo são listados', () => {
    const m = calcularMargem({
      pagantes: { convidados: 100, criancas_meia: 0, criancas_isentas: 0 },
      totais: { alimentos: 10000, bebidas: 2000, staff: 0, locacao: 0, extras: 0, total_calc: 12000, total: 12000, pagantes_equivalentes: 100 },
      cardapios: [{
        key: 'c', opcao_id: null, nome: 'C', preco_base: null, preco_pp_manual: null, subtotal_manual: null,
        secoes: [{ key: 's', secao_id: null, nome: 'Salgados', escolha_qtd: null, preco_catalogo: null, preco_manual: null, itens: [
          { key: 'a', item_id: 'i1', nome: 'Coxinha', descricao: null, selecionado: true, preco_catalogo: null, preco_manual: null, restricoes: [], custo_unitario: 12.5 },
          { key: 'b', item_id: 'i2', nome: 'Sem custo', descricao: null, selecionado: true, preco_catalogo: null, preco_manual: null, restricoes: [] },
          { key: 'c', item_id: 'i3', nome: 'Fora', descricao: null, selecionado: false, preco_catalogo: null, preco_manual: null, restricoes: [], custo_unitario: 99 },
        ] }],
      }],
      bebidas: [{ key: 'b1', ref_id: 'x', nome: 'Vinho', descricao: null, unidade: 'unidade', quantidade: 10, preco_catalogo: null, preco_manual: null, subtotal_manual: null, custo_unitario: 40 }],
    });
    expect(m.custo).toBe(1250 + 400);
    expect(m.receita).toBe(12000);
    expect(m.margem_valor).toBe(10350);
    expect(m.margem_pct).toBe(86.3);
    expect(m.custo_por_convidado).toBe(16.5);
    expect(m.sem_custo).toEqual(['Sem custo']);
    expect(m.itens[0].nome).toBe('Coxinha');
  });

  it('sem nenhum custo cadastrado, a margem não é estimada', () => {
    const m = calcularMargem({
      pagantes: { convidados: 10, criancas_meia: 0, criancas_isentas: 0 },
      totais: { alimentos: 1000, bebidas: 0, staff: 0, locacao: 0, extras: 0, total_calc: 1000, total: 1000, pagantes_equivalentes: 10 },
      cardapios: [],
      bebidas: [{ key: 'b', ref_id: null, nome: 'Suco', descricao: null, unidade: 'pessoa', quantidade: 0, preco_catalogo: null, preco_manual: null, subtotal_manual: null }],
    });
    expect(m.margem_pct).toBeNull();
    expect(m.sem_custo).toEqual(['Suco']);
  });
});
