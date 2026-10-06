import { describe, expect, it } from 'vitest';
import { dataPorExtenso, numeroPorExtenso, valorPorExtenso } from './extenso';

describe('numeroPorExtenso', () => {
  it('escreve unidades, dezenas, centenas e milhares', () => {
    expect(numeroPorExtenso(0)).toBe('zero');
    expect(numeroPorExtenso(1)).toBe('um');
    expect(numeroPorExtenso(15)).toBe('quinze');
    expect(numeroPorExtenso(21)).toBe('vinte e um');
    expect(numeroPorExtenso(100)).toBe('cem');
    expect(numeroPorExtenso(101)).toBe('cento e um');
    expect(numeroPorExtenso(250)).toBe('duzentos e cinquenta');
    expect(numeroPorExtenso(1000)).toBe('mil');
    expect(numeroPorExtenso(1234)).toBe('mil duzentos e trinta e quatro');
    expect(numeroPorExtenso(2000)).toBe('dois mil');
    expect(numeroPorExtenso(2500)).toBe('dois mil e quinhentos');
    expect(numeroPorExtenso(1_000_000)).toBe('um milhão');
    expect(numeroPorExtenso(3_200_015)).toBe('três milhões duzentos mil e quinze');
  });
});

describe('valorPorExtenso', () => {
  it('escreve reais e centavos', () => {
    expect(valorPorExtenso(0)).toBe('zero reais');
    expect(valorPorExtenso(1)).toBe('um real');
    expect(valorPorExtenso(0.5)).toBe('cinquenta centavos');
    expect(valorPorExtenso(1250)).toBe('mil duzentos e cinquenta reais');
    expect(valorPorExtenso(25400.1)).toBe('vinte e cinco mil e quatrocentos reais e dez centavos');
    expect(valorPorExtenso(6850.01)).toBe('seis mil oitocentos e cinquenta reais e um centavo');
  });
});

describe('dataPorExtenso', () => {
  it('escreve a data ISO por extenso e ignora inválidas', () => {
    expect(dataPorExtenso('2026-10-06')).toBe('6 de outubro de 2026');
    expect(dataPorExtenso('2027-01-15')).toBe('15 de janeiro de 2027');
    expect(dataPorExtenso('x')).toBe('');
    expect(dataPorExtenso(null)).toBe('');
  });
});
