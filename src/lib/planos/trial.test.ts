import { describe, expect, it } from 'vitest';
import { avisoDoDia, deveRebaixar, diasRestantes, emSaoPaulo, fimDoTrial, recusaVigente, somarDias } from './trial';

// Instante "data hora" em São Paulo (UTC−3): 2026-10-16 15:00 SP = 18:00 UTC
const sp = (data: string, hora: number) => {
  const [a, m, d] = data.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d, hora + 3));
};

describe('datas', () => {
  it('converte para o fuso de São Paulo', () => {
    expect(emSaoPaulo(sp('2026-10-16', 15))).toEqual({ data: '2026-10-16', hora: 15 });
    // 01:00 UTC ainda é o dia anterior em SP
    expect(emSaoPaulo(new Date('2026-10-17T01:00:00Z')).data).toBe('2026-10-16');
  });

  it('soma dias e calcula o fim do teste', () => {
    expect(somarDias('2026-10-31', 1)).toBe('2026-11-01');
    expect(fimDoTrial('2026-10-15')).toBe('2026-11-14');
    expect(fimDoTrial('2026-10-15', 7)).toBe('2026-10-22');
    expect(diasRestantes('2026-11-14', '2026-11-14')).toBe(0);
    expect(diasRestantes('2026-11-14', '2026-11-16')).toBe(-2);
  });
});

describe('deveRebaixar (D+1 12h)', () => {
  it('não rebaixa no último dia nem na manhã do dia seguinte', () => {
    expect(deveRebaixar('2026-10-15', sp('2026-10-15', 23))).toBe(false);
    expect(deveRebaixar('2026-10-15', sp('2026-10-16', 11))).toBe(false);
  });

  it('rebaixa a partir do meio-dia do dia seguinte e em qualquer dia depois', () => {
    expect(deveRebaixar('2026-10-15', sp('2026-10-16', 12))).toBe(true);
    expect(deveRebaixar('2026-10-15', sp('2026-10-20', 3))).toBe(true);
  });
});

describe('avisoDoDia', () => {
  it('D-7, D-1 e D0 só a partir das 9h', () => {
    expect(avisoDoDia('2026-10-22', sp('2026-10-15', 8))).toBeNull();
    expect(avisoDoDia('2026-10-22', sp('2026-10-15', 9))).toBe('d7');
    expect(avisoDoDia('2026-10-22', sp('2026-10-21', 10))).toBe('d1');
    expect(avisoDoDia('2026-10-22', sp('2026-10-22', 10))).toBe('d0');
    expect(avisoDoDia('2026-10-22', sp('2026-10-18', 10))).toBeNull();
  });
});

describe('recusaVigente', () => {
  it('vale por 30 dias', () => {
    const agora = new Date('2026-10-15T12:00:00Z');
    expect(recusaVigente(null, agora)).toBe(false);
    expect(recusaVigente('2026-10-01T00:00:00Z', agora)).toBe(true);
    expect(recusaVigente('2026-09-01T00:00:00Z', agora)).toBe(false);
  });
});
