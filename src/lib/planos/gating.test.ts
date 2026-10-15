import { describe, expect, it } from 'vitest';
import { ErroPlano, limiteEm, nivelEm, podeUsarEm, type Entitlements } from './gating';

const base: Entitlements = {
  tenantId: 't', semPlano: false, planoId: 'p', planoSlug: 'busca', planoNome: 'Plano Busca', gratuito: true,
  trial: null, trialVencido: false, trialAte: null, trialUsado: false, trialRecusadoEm: null,
  recursos: { propostas: false, busca: true, usuarios: 1, busca_fotos: 5, historico_meses: 3, templates_qtd: 0, ia_analises_mes: -1 },
};

describe('podeUsarEm', () => {
  it('lê booleanos e trata número diferente de zero como liberado', () => {
    expect(podeUsarEm(base, 'busca')).toBe(true);
    expect(podeUsarEm(base, 'propostas')).toBe(false);
    expect(podeUsarEm(base, 'usuarios')).toBe(true);
    expect(podeUsarEm(base, 'templates_qtd')).toBe(false);
  });

  it('recurso ausente é bloqueado; empresa sem plano é permissiva', () => {
    expect(podeUsarEm(base, 'inexistente')).toBe(false);
    expect(podeUsarEm({ ...base, semPlano: true, recursos: {} }, 'inexistente')).toBe(true);
    expect(podeUsarEm(null, 'propostas')).toBe(true);
  });
});

describe('limiteEm', () => {
  it('devolve o número, Infinity para -1, ausente ou sem plano', () => {
    expect(limiteEm(base, 'usuarios')).toBe(1);
    expect(limiteEm(base, 'busca_fotos')).toBe(5);
    expect(limiteEm(base, 'ia_analises_mes')).toBe(Number.POSITIVE_INFINITY);
    expect(limiteEm(base, 'outro')).toBe(Number.POSITIVE_INFINITY);
    expect(limiteEm({ ...base, semPlano: true }, 'usuarios')).toBe(Number.POSITIVE_INFINITY);
    expect(limiteEm(null, 'usuarios')).toBe(Number.POSITIVE_INFINITY);
  });

  it('zero é um limite real (nada pode ser criado)', () => {
    expect(limiteEm(base, 'templates_qtd')).toBe(0);
  });
});

describe('nivelEm e ErroPlano', () => {
  it('gratuito versus cliente', () => {
    expect(nivelEm(base)).toBe('gratuito');
    expect(nivelEm({ ...base, gratuito: false })).toBe('cliente');
    expect(nivelEm(null)).toBe('cliente');
  });

  it('serializa o 403 padronizado', () => {
    const e = new ErroPlano('LIMITE_DO_PLANO', 'usuarios', 'Limite.', 1, 1);
    expect(e.toJSON()).toEqual({ error: 'Limite.', code: 'LIMITE_DO_PLANO', recurso: 'usuarios', limite: 1, uso: 1, upgrade_url: '/planos' });
    expect(e.name).toBe('ErroPlano');
  });
});
