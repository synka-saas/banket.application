import { describe, expect, it } from 'vitest';
import { custoSugerido, descreverRegra, quantidadeSugerida, type RegraStaff } from './staff';

const garcom: RegraStaff = { cache_diaria: 250, auxilio: 0, por_evento: false, quantidade_fixa: 1, convidados_por_profissional: 15, minimo: 0 };
const chef: RegraStaff = { cache_diaria: 450, auxilio: 0, por_evento: true, quantidade_fixa: 1, convidados_por_profissional: null, minimo: 0 };

describe('quantidadeSugerida', () => {
  it('arredonda para cima a proporção de convidados (1 garçom a cada 15)', () => {
    expect(quantidadeSugerida(garcom, 15)).toBe(1);
    expect(quantidadeSugerida(garcom, 16)).toBe(2);
    expect(quantidadeSugerida(garcom, 540)).toBe(36);
  });

  it('respeita o mínimo exigido', () => {
    expect(quantidadeSugerida({ ...garcom, minimo: 3 }, 20)).toBe(3);
    expect(quantidadeSugerida({ ...garcom, minimo: 3 }, 100)).toBe(7);
  });

  it('usa quantidade fixa quando a regra é por evento', () => {
    expect(quantidadeSugerida(chef, 10)).toBe(1);
    expect(quantidadeSugerida({ ...chef, quantidade_fixa: 2 }, 500)).toBe(2);
  });

  it('sem convidados só conta o mínimo', () => {
    expect(quantidadeSugerida(garcom, 0)).toBe(0);
    expect(quantidadeSugerida({ ...garcom, minimo: 2 }, 0)).toBe(2);
  });
});

describe('custoSugerido', () => {
  it('multiplica a quantidade pelo cachê + auxílio', () => {
    expect(custoSugerido({ ...garcom, auxilio: 50 }, 100)).toEqual({ quantidade: 7, unitario: 300, total: 2100 });
  });

  it('evita erro de ponto flutuante', () => {
    expect(custoSugerido({ ...garcom, cache_diaria: 0.1, auxilio: 0.2, convidados_por_profissional: 1 }, 3).total).toBe(0.9);
  });
});

describe('descreverRegra', () => {
  it('descreve cada tipo de regra', () => {
    expect(descreverRegra(garcom)).toBe('1 a cada 15 convidados');
    expect(descreverRegra(chef)).toBe('1 profissional por evento');
  });
});
