import { describe, expect, it } from 'vitest';
import { estadoCobranca, fimDoTesteNoStripe, prazoDoDia, taxIdDoDocumento, valorDoCiclo, type DadosCobranca } from './cobranca';

// Instante em São Paulo (UTC−3)
const sp = (iso: string) => new Date(`${iso}-03:00`);
const base: DadosCobranca = { gratuito: false, trialAte: null, assinaturaId: null, assinaturaStatus: null, faturaAberta: null };

describe('estadoCobranca', () => {
  it('plano gratuito nunca cobra nem rebaixa', () => {
    expect(estadoCobranca({ ...base, gratuito: true, trialAte: '2026-01-01' }, sp('2026-10-17T15:00')).estado).toBe('gratuito');
  });

  it('teste vigente até as 12h do dia seguinte ao último dia', () => {
    const d = { ...base, trialAte: '2026-10-15' };
    expect(estadoCobranca(d, sp('2026-10-15T23:00')).estado).toBe('trial');
    expect(estadoCobranca(d, sp('2026-10-16T11:59')).estado).toBe('trial');
    expect(estadoCobranca(d, sp('2026-10-16T12:00'))).toEqual({ estado: 'rebaixar', motivo: 'trial_encerrado' });
  });

  it('plano pago sem teste nem assinatura é manual (Manager, empresas antigas)', () => {
    expect(estadoCobranca(base, sp('2026-10-17T15:00')).estado).toBe('manual');
    expect(estadoCobranca({ ...base, semPlano: true }, sp('2026-10-17T15:00')).estado).toBe('manual');
  });

  it('assinatura em dia, em teste no Stripe e com fatura vencida', () => {
    const viva = { ...base, assinaturaId: 'sub_1', assinaturaStatus: 'active' };
    expect(estadoCobranca(viva, sp('2026-10-17T10:00')).estado).toBe('ativa');
    expect(estadoCobranca({ ...viva, assinaturaStatus: 'trialing', trialAte: '2026-10-01' }, sp('2026-10-17T10:00')).estado).toBe('trial');
    const aberta = { ...viva, faturaAberta: { vencimento: '2026-10-15', motivo: 'subscription_cycle' } };
    expect(estadoCobranca(aberta, sp('2026-10-15T20:00')).estado).toBe('ativa');
    expect(estadoCobranca(aberta, sp('2026-10-16T09:00')).estado).toBe('vencida');
    expect(estadoCobranca(aberta, sp('2026-10-16T12:00'))).toEqual({ estado: 'rebaixar', motivo: 'inadimplencia' });
  });

  it('assinatura incobrável ou encerrada rebaixa', () => {
    expect(estadoCobranca({ ...base, assinaturaId: 'sub_1', assinaturaStatus: 'unpaid' }).motivo).toBe('inadimplencia');
    expect(estadoCobranca({ ...base, assinaturaId: 'sub_1', assinaturaStatus: 'canceled' }).motivo).toBe('cancelamento');
  });

  it('1ª fatura (Pix) em aberto: vale a regra do teste', () => {
    const d = { ...base, trialAte: '2026-10-20', assinaturaId: 'sub_1', assinaturaStatus: 'active', faturaAberta: { vencimento: '2026-10-10', motivo: 'subscription_create' } };
    expect(estadoCobranca(d, sp('2026-10-17T15:00')).estado).toBe('trial');
    expect(estadoCobranca({ ...d, trialAte: null }, sp('2026-10-17T15:00')).estado).toBe('manual');
  });

  it('1ª fatura cobrada no fim do teste e nunca paga: vale a regra do teste, não os 7 dias da fatura', () => {
    const d: DadosCobranca = {
      ...base, trialAte: '2026-10-15', assinaturaId: 'sub_1', assinaturaStatus: 'active', teveFaturaPaga: false,
      faturaAberta: { vencimento: '2026-10-23', motivo: 'subscription_cycle' },
    };
    expect(estadoCobranca(d, sp('2026-10-16T11:00')).estado).toBe('trial');
    expect(estadoCobranca(d, sp('2026-10-16T12:00'))).toEqual({ estado: 'rebaixar', motivo: 'trial_encerrado' });
    // Já pagou antes: é renovação, valem os prazos da fatura
    expect(estadoCobranca({ ...d, teveFaturaPaga: true }, sp('2026-10-16T12:00')).estado).toBe('ativa');
  });

  it('assinatura encerrada sem nunca ter pago: segue o teste, não rebaixa por cancelamento', () => {
    const d: DadosCobranca = { ...base, trialAte: '2026-10-20', assinaturaId: 'sub_1', assinaturaStatus: 'canceled', teveFaturaPaga: false };
    expect(estadoCobranca(d, sp('2026-10-17T15:00')).estado).toBe('trial');
    expect(estadoCobranca({ ...d, teveFaturaPaga: true }, sp('2026-10-17T15:00')).motivo).toBe('cancelamento');
  });
});

describe('datas', () => {
  it('prazo às 12h de São Paulo do dia seguinte', () => {
    expect(prazoDoDia('2026-10-15').toISOString()).toBe('2026-10-16T15:00:00.000Z');
  });
  it('fim do teste no Stripe à meia-noite do dia seguinte', () => {
    expect(fimDoTesteNoStripe('2026-10-15').toISOString()).toBe('2026-10-16T03:00:00.000Z');
  });
});

describe('auxiliares', () => {
  it('valor do ciclo', () => {
    const p = { preco_mensal: 97, preco_anual: 970 };
    expect(valorDoCiclo(p, 'mes')).toBe(97);
    expect(valorDoCiclo(p, 'ano')).toBe(970);
    expect(valorDoCiclo({ preco_mensal: null, preco_anual: null }, 'mes')).toBeNull();
  });
  it('CPF/CNPJ no formato do Stripe', () => {
    expect(taxIdDoDocumento('123.456.789-09')).toEqual({ type: 'br_cpf', value: '123.456.789-09', digitos: '12345678909' });
    expect(taxIdDoDocumento('11222333000181')?.type).toBe('br_cnpj');
    expect(taxIdDoDocumento('123')).toBeNull();
  });
});
