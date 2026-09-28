import { describe, expect, it } from 'vitest';
import { dominioReservado } from './mail';

describe('dominioReservado', () => {
  it('reconhece os domínios reservados usados pelos testes', () => {
    expect(dominioReservado('e2e-auto-1@example.com')).toBe(true);
    expect(dominioReservado('a@sub.example.org')).toBe(true);
    expect(dominioReservado('a@buffet.test')).toBe(true);
    expect(dominioReservado('A@EXAMPLE.NET ')).toBe(true);
  });

  it('não bloqueia domínios reais parecidos', () => {
    expect(dominioReservado('a@gmail.com')).toBe(false);
    expect(dominioReservado('a@example.com.br')).toBe(false);
    expect(dominioReservado('a@myexample.com')).toBe(false);
    expect(dominioReservado('a@teste.com')).toBe(false);
  });
});
