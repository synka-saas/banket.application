import { describe, expect, it } from 'vitest';
import { dataHoraCurta, reuniaoSchema, somarMinutos } from './reunioes';

describe('reuniões', () => {
  it('somarMinutos atravessa a meia-noite', () => {
    expect(somarMinutos('2026-10-10', '14:00', 90)).toEqual({ data: '2026-10-10', hora: '15:30' });
    expect(somarMinutos('2026-10-10', '23:30', 60)).toEqual({ data: '2026-10-11', hora: '00:30' });
  });

  it('schema: participantes aceitam vírgula, ponto e vírgula ou quebra de linha, sem repetidos', () => {
    const r = reuniaoSchema.parse({ titulo: 'Degustação', data: '2026-10-10', hora: '14:00', duracao_min: '45', participantes: 'a@x.com, B@x.com;\na@x.com' });
    expect(r.participantes).toEqual(['a@x.com', 'b@x.com']);
    expect(r.duracao_min).toBe(45);
    expect(r.evento_id).toBeNull();
  });

  it('schema: rejeita e-mail inválido e horário fora do formato', () => {
    expect(() => reuniaoSchema.parse({ titulo: 'x', data: '2026-10-10', hora: '14:00', participantes: 'nao-e-email' })).toThrow();
    expect(() => reuniaoSchema.parse({ titulo: 'x', data: '2026-10-10', hora: '2pm', participantes: '' })).toThrow();
  });

  it('dataHoraCurta', () => {
    expect(dataHoraCurta({ data: '2027-12-21', hora: '14:00' })).toBe('21/12/2027 às 14:00');
  });
});
