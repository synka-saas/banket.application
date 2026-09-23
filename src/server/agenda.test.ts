import { describe, expect, it } from 'vitest';
import { gradeDoMes, semanaDe, somarDias } from './agenda';

describe('agenda', () => {
  it('monta a grade do mês de domingo a sábado cobrindo o mês inteiro', () => {
    // Setembro/2026 começa numa terça e termina numa quarta
    const g = gradeDoMes('2026-09-15');
    expect(g.inicio).toBe('2026-08-30');
    expect(g.fim).toBe('2026-10-03');
    expect(g.semanas).toHaveLength(5);
    expect(g.semanas.every((s) => s.length === 7)).toBe(true);
  });

  it('fevereiro de ano bissexto', () => {
    const g = gradeDoMes('2028-02-01');
    expect(g.semanas.flat()).toContain('2028-02-29');
    expect(g.semanas.flat()).not.toContain('2028-03-05');
  });

  it('semana começa no domingo e atravessa meses/anos', () => {
    expect(semanaDe('2026-12-31')).toEqual(['2026-12-27', '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
    expect(somarDias('2026-03-01', -1)).toBe('2026-02-28');
  });
});
