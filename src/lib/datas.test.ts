import { describe, expect, it } from 'vitest';
import { dataComDiaSemana, dataCurta, faixaHorario, horasTexto, normalizarHora, somarMeses } from './datas';

describe('datas', () => {
  it('formata datas sem sofrer com fuso horário', () => {
    expect(dataCurta('2027-12-21')).toBe('21/12/2027');
    expect(dataComDiaSemana('2027-12-21')).toBe('21/12/2027 · Terça-feira');
    expect(dataComDiaSemana('2026-01-01')).toBe('01/01/2026 · Quinta-feira');
    expect(dataCurta(null)).toBe('-');
  });

  it('descreve faixas de horário', () => {
    expect(faixaHorario('12:00', '20:00')).toBe('12h às 20h');
    expect(faixaHorario('19:30', null)).toBe('19:30');
    expect(faixaHorario(null, null)).toBe('-');
  });

  it('descreve durações', () => {
    expect(horasTexto(1)).toBe('1 hora');
    expect(horasTexto(2.5)).toBe('2,5 horas');
    expect(horasTexto(5)).toBe('5 horas');
  });
});

describe('somarMeses', () => {
  it('soma meses limitando ao fim do mês', () => {
    expect(somarMeses('2026-09-23', 1)).toBe('2026-10-23');
    expect(somarMeses('2026-01-31', 1)).toBe('2026-02-28');
    expect(somarMeses('2026-11-30', 3)).toBe('2027-02-28');
    expect(somarMeses('2026-08-31', 6)).toBe('2027-02-28');
  });
});

describe('normalizarHora', () => {
  it('converte o que foi digitado em HH:MM', () => {
    expect(normalizarHora('1200')).toBe('12:00');
    expect(normalizarHora('930')).toBe('09:30');
    expect(normalizarHora('9')).toBe('09:00');
    expect(normalizarHora('12h')).toBe('12:00');
    expect(normalizarHora('12h30')).toBe('12:30');
    expect(normalizarHora('18:00')).toBe('18:00');
    expect(normalizarHora('7.45')).toBe('07:45');
  });

  it('mantém o que não é horário', () => {
    expect(normalizarHora('2500')).toBe('2500');
    expect(normalizarHora('1260')).toBe('1260');
    expect(normalizarHora('Após o evento')).toBe('Após o evento');
    expect(normalizarHora('')).toBe('');
  });
});
