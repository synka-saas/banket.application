import { describe, expect, it } from 'vitest';
import { moneyInput, parseMoney } from './money';

describe('moneyInput', () => {
  it('formata com separador de milhar e duas casas', () => {
    expect(moneyInput(39250)).toBe('39.250,00');
    expect(moneyInput(250)).toBe('250,00');
    expect(moneyInput(1234567.5)).toBe('1.234.567,50');
    expect(moneyInput(null)).toBe('');
  });

  it('volta ao mesmo número pelo parseMoney', () => {
    for (const v of [0, 0.5, 250, 39250, 1234567.89]) expect(parseMoney(moneyInput(v))).toBe(v);
  });
});
