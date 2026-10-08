import { describe, expect, it } from 'vitest';
import { gerarParcelas, rotuloParcela, situacaoConta } from './financeiro';

describe('gerarParcelas', () => {
  it('pagamento à vista vira parcela única', () => {
    const r = gerarParcelas({ valor_total: 1000, entrada_valor: null, entrada_vencimento: null, parcelas: 1, primeiro_vencimento: '2026-11-10', intervalo_meses: 1 });
    expect(r).toEqual([{ parcela: 1, parcelas: 1, valor: 1000, vencimento: '2026-11-10' }]);
  });

  it('entrada + saldo em parcelas mensais, centavos na última', () => {
    const r = gerarParcelas({ valor_total: 1000, entrada_valor: 300, entrada_vencimento: '2026-10-10', parcelas: 3, primeiro_vencimento: '2026-11-30', intervalo_meses: 1 });
    expect(r.map((p) => p.valor)).toEqual([300, 233.33, 233.33, 233.34]);
    expect(r.map((p) => p.vencimento)).toEqual(['2026-10-10', '2026-11-30', '2026-12-30', '2027-01-30']);
    expect(r[0].parcela).toBe(0);
    expect(r.reduce((s, p) => s + p.valor, 0)).toBeCloseTo(1000, 2);
  });

  it('entrada que quita tudo dispensa parcelas', () => {
    const r = gerarParcelas({ valor_total: 500, entrada_valor: 500, entrada_vencimento: '2026-10-10', parcelas: 0, primeiro_vencimento: null, intervalo_meses: 1 });
    expect(r).toHaveLength(1);
  });

  it('valida entrada maior que o total e falta de vencimentos', () => {
    expect(() => gerarParcelas({ valor_total: 100, entrada_valor: 200, entrada_vencimento: '2026-10-10', parcelas: 1, primeiro_vencimento: '2026-11-10', intervalo_meses: 1 })).toThrow();
    expect(() => gerarParcelas({ valor_total: 100, entrada_valor: null, entrada_vencimento: null, parcelas: 2, primeiro_vencimento: null, intervalo_meses: 1 })).toThrow();
    expect(() => gerarParcelas({ valor_total: 100, entrada_valor: null, entrada_vencimento: null, parcelas: 0, primeiro_vencimento: '2026-11-10', intervalo_meses: 1 })).toThrow();
  });
});

describe('situação e rótulos', () => {
  it('conta aberta vencida', () => {
    expect(situacaoConta('aberta', '2026-10-01', '2026-10-08')).toBe('vencida');
    expect(situacaoConta('aberta', '2026-10-08', '2026-10-08')).toBe('aberta');
    expect(situacaoConta('paga', '2026-10-01', '2026-10-08')).toBe('paga');
  });

  it('rótulo da parcela', () => {
    expect(rotuloParcela(0, 3)).toBe('Entrada');
    expect(rotuloParcela(1, 1)).toBe('Parcela única');
    expect(rotuloParcela(2, 4)).toBe('Parcela 2/4');
  });
});
