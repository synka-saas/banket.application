import { describe, expect, it } from 'vitest';
import { converter, estoqueDaLinha, situacaoEstoque, type EstoqueRef } from './estoque';
import type { LinhaCompra } from './orcamento';

const linha = (extra: Partial<LinhaCompra>): LinhaCompra => ({
  key: 'k', ref: null, item_id: null, nome: 'Item', grupo: null, origem: 'cardapio', unidade: 'g', porcao: null,
  quantidade_calc: null, quantidade_manual: null, comprado: false, observacao: null, ...extra,
});
const estoque: EstoqueRef[] = [
  { id: 'e1', nome: 'Croissant', catalogo_item_id: 'c1', unidade: 'un', quantidade: 80 },
  { id: 'e2', nome: 'Farinha de trigo', catalogo_item_id: null, unidade: 'kg', quantidade: 5 },
  { id: 'e3', nome: 'Arroz', catalogo_item_id: 'c3', unidade: 'kg', quantidade: 0 },
];

describe('converter', () => {
  it('converte dentro da mesma dimensão e recusa dimensões diferentes', () => {
    expect(converter(2.5, 'kg', 'g')).toBe(2500);
    expect(converter(750, 'ml', 'l')).toBe(0.75);
    expect(converter(3, 'un', 'un')).toBe(3);
    expect(converter(1, 'kg', 'un')).toBeNull();
    expect(converter(1, 'l', 'g')).toBeNull();
  });
});

describe('situacaoEstoque', () => {
  it('liga pelo item do cardápio e, sem ligação, pelo nome', () => {
    expect(estoqueDaLinha({ item_id: 'c1', nome: 'Outro nome' }, estoque)?.id).toBe('e1');
    expect(estoqueDaLinha({ item_id: null, nome: '  farinha DE trigo ' }, estoque)?.id).toBe('e2');
    expect(estoqueDaLinha({ item_id: 'x', nome: 'Pimentão' }, estoque)).toBeNull();
  });

  it('suficiente quando o saldo cobre a quantidade (com conversão de unidade)', () => {
    const s = situacaoEstoque(linha({ item_id: null, nome: 'Farinha de trigo', unidade: 'g', quantidade_calc: 4000 }), estoque);
    expect(s).toMatchObject({ tipo: 'suficiente', disponivel: 5000 });
  });

  it('usa a quantidade manual e informa quanto falta', () => {
    const s = situacaoEstoque(linha({ item_id: 'c1', unidade: 'un', quantidade_calc: 50, quantidade_manual: 100 }), estoque);
    expect(s).toMatchObject({ tipo: 'parcial', disponivel: 80, faltam: 20 });
  });

  it('sem saldo, incomparável e não gerenciado', () => {
    expect(situacaoEstoque(linha({ item_id: 'c3', unidade: 'g', quantidade_calc: 6000 }), estoque)).toMatchObject({ tipo: 'sem', faltam: 6000 });
    expect(situacaoEstoque(linha({ item_id: 'c1', unidade: 'g', quantidade_calc: 10 }), estoque)?.tipo).toBe('incomparavel');
    expect(situacaoEstoque(linha({ item_id: 'c1', unidade: 'un', quantidade_calc: null }), estoque)?.tipo).toBe('incomparavel');
    expect(situacaoEstoque(linha({ nome: 'Pimentão', quantidade_calc: 1 }), estoque)).toBeNull();
  });
});
