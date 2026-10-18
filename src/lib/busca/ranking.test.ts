import { describe, expect, it } from 'vitest';
import { PESOS_PADRAO, REGRAS_PADRAO, bonusPago, fatores, lerPesos, lerRegras, ordenar, pontuar, sementeDoDia, type Rankeavel } from './ranking';

const HOJE = new Date('2026-10-18T15:00:00Z');
const r = (id: string, extra: Partial<Rankeavel> = {}): Rankeavel => ({
  id, nome: id, prioridade: false, completude: 80, notaMedia: 4.5, totalAvaliacoes: 10, taxaResposta: 0.8, distanciaKm: 5,
  raioKm: null, atividadeEm: HOJE, ...extra,
});
const ids = (l: { id: string }[]) => l.map((x) => x.id);
const ord = (l: Rankeavel[], ordem: 'relevancia' | 'avaliacao' | 'distancia' = 'relevancia', extra = {}) => ordenar(l, ordem, { hoje: HOJE, ...extra });

describe('pesos e regras', () => {
  it('padrão soma 1; JSON parcial é normalizado; inválido volta ao padrão', () => {
    expect(Object.values(PESOS_PADRAO).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    const p = lerPesos('{"avaliacao": 0.6}');
    expect(Object.values(p).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(p.avaliacao).toBeGreaterThan(PESOS_PADRAO.avaliacao);
    expect(lerPesos('{"avaliacao": -1}')).toEqual(PESOS_PADRAO);
    expect(lerPesos('não é json')).toEqual(PESOS_PADRAO);
    expect(lerPesos(undefined)).toEqual(PESOS_PADRAO);
  });

  it('regras em snake_case; fora da faixa é ignorado', () => {
    expect(lerRegras('{"bonus_pago": 0.2, "vagas_destaque": 2}')).toEqual({ ...REGRAS_PADRAO, bonusPago: 0.2, vagasDestaque: 2 });
    expect(lerRegras('{"bonus_pago": 5, "max_pagos_seguidos": 0}')).toEqual(REGRAS_PADRAO);
    expect(lerRegras('{')).toEqual(REGRAS_PADRAO);
  });
});

describe('fatores e pontuação', () => {
  it('nota pesa proporcionalmente ao número de avaliações', () => {
    expect(fatores(r('a', { notaMedia: 5, totalAvaliacoes: 10 })).avaliacao).toBe(1);
    expect(fatores(r('a', { notaMedia: 5, totalAvaliacoes: 2 })).avaliacao).toBeCloseTo(0.2);
    expect(fatores(r('a', { notaMedia: null })).avaliacao).toBe(0);
  });

  it('sem taxa de resposta ou distância, o fator é neutro (0,5)', () => {
    const f = fatores(r('a', { taxaResposta: null, distanciaKm: null }));
    expect([f.resposta, f.distancia]).toEqual([0.5, 0.5]);
    expect(fatores(r('a', { distanciaKm: 60 })).distancia).toBe(0);
  });

  it('atividade cai de 1 a 0 em 90 dias; sem data = 0', () => {
    expect(fatores(r('a'), 30, HOJE).atividade).toBe(1);
    expect(fatores(r('a', { atividadeEm: new Date(HOJE.getTime() - 45 * 86_400_000) }), 30, HOJE).atividade).toBeCloseTo(0.5);
    expect(fatores(r('a', { atividadeEm: '2025-01-01' }), 30, HOJE).atividade).toBe(0);
    expect(fatores(r('a', { atividadeEm: null }), 30, HOJE).atividade).toBe(0);
  });

  it('pontuação maior para perfil mais completo, bem avaliado e perto', () => {
    expect(pontuar(r('a', { completude: 100, distanciaKm: 1 }))).toBeGreaterThan(pontuar(r('b', { completude: 40, distanciaKm: 25 })));
  });

  it('bônus: só pagante, proporcional à completude e cai até 0 em 2× o raio', () => {
    expect(bonusPago(r('a'))).toBe(0);
    expect(bonusPago(r('a', { prioridade: true, completude: 100 }))).toBeCloseTo(0.15);
    expect(bonusPago(r('a', { prioridade: true, completude: 50 }))).toBeCloseTo(0.075);
    expect(bonusPago(r('a', { prioridade: true, completude: 100, raioKm: 10, distanciaKm: 15 }))).toBeCloseTo(0.075);
    expect(bonusPago(r('a', { prioridade: true, completude: 100, raioKm: 10, distanciaKm: 25 }))).toBe(0);
  });
});

describe('ordenar por relevância', () => {
  it('pagante passa à frente de gratuito parecido', () => {
    const l = [r('gratis'), r('pago', { prioridade: true })];
    expect(ids(ord(l, 'relevancia', { regras: { ...REGRAS_PADRAO, vagasDestaque: 0 } }))).toEqual(['pago', 'gratis']);
  });

  it('gratuito muito melhor passa à frente de pagante fraco', () => {
    const l = [
      r('pago-fraco', { prioridade: true, completude: 40, notaMedia: null, distanciaKm: 28, atividadeEm: null }),
      r('gratis-otimo', { completude: 100, notaMedia: 4.9, distanciaKm: 2 }),
    ];
    const res = ord(l);
    expect(ids(res)).toEqual(['gratis-otimo', 'pago-fraco']);
    expect(res.every((x) => !x.destaque)).toBe(true); // pagante fraco não tem relevância mínima para o destaque
  });

  it('vagas de destaque: até 3 pagantes relevantes no topo, marcados', () => {
    const l = [
      r('g1', { completude: 100, notaMedia: 5, distanciaKm: 1 }),
      r('p1', { prioridade: true }), r('p2', { prioridade: true }), r('p3', { prioridade: true }), r('p4', { prioridade: true }),
    ];
    const res = ord(l);
    expect(res.slice(0, 3).every((x) => x.destaque && x.prioridade)).toBe(true);
    expect(res.slice(3).some((x) => x.destaque)).toBe(false);
  });

  it('nunca mais de 3 pagantes seguidos fora do destaque', () => {
    const pagos = Array.from({ length: 10 }, (_, i) => r(`p${i}`, { prioridade: true }));
    const gratis = Array.from({ length: 4 }, (_, i) => r(`g${i}`, { completude: 50 }));
    const res = ord([...pagos, ...gratis]);
    const comum = res.filter((x) => !x.destaque);
    let seguidos = 0;
    for (const [i, x] of comum.entries()) {
      // a contagem recomeça em cada página de 12 (posição absoluta = i + destaques)
      if ((i + 3) % 12 === 0) seguidos = 0;
      seguidos = x.prioridade ? seguidos + 1 : 0;
      if (gratis.length && comum.slice(i).some((y) => !y.prioridade)) expect(seguidos).toBeLessThanOrEqual(3);
    }
    expect(res).toHaveLength(14);
  });

  it('sem gratuito sobrando, os pagantes seguem em ordem', () => {
    const res = ord(Array.from({ length: 6 }, (_, i) => r(`p${i}`, { prioridade: true })));
    expect(res).toHaveLength(6);
  });

  it('ordenações explícitas ignoram bônus e destaque', () => {
    const l = [r('perto', { distanciaKm: 1 }), r('pago-longe', { prioridade: true, distanciaKm: 9 }), r('sem-local', { distanciaKm: null })];
    const res = ord(l, 'distancia');
    expect(ids(res)).toEqual(['perto', 'pago-longe', 'sem-local']);
    expect(res.some((x) => x.destaque)).toBe(false);
    const notas = [r('a', { notaMedia: 4 }), r('b', { notaMedia: 4.9 }), r('c', { notaMedia: null, prioridade: true })];
    expect(ids(ord(notas, 'avaliacao'))).toEqual(['b', 'a', 'c']);
  });

  it('rodízio estável no mesmo dia; sem semente, desempate por avaliações e nome', () => {
    const l = Array.from({ length: 8 }, (_, i) => r(`b${i}`));
    const s = sementeDoDia('santo-andre-sp', 'casamento', HOJE);
    expect(ids(ord(l, 'relevancia', { semente: s }))).toEqual(ids(ord([...l].reverse(), 'relevancia', { semente: s })));
    expect(ids(ord(l, 'relevancia', { semente: s }))).not.toEqual(ids(ord(l, 'relevancia', { semente: sementeDoDia('santo-andre-sp', 'casamento', new Date('2026-10-20T15:00:00Z')) })));
    expect(ids(ord([r('b'), r('a')]))).toEqual(['a', 'b']);
    expect(ids(ord([r('x', { totalAvaliacoes: 10 }), r('y', { totalAvaliacoes: 30 })]))).toEqual(['y', 'x']);
  });
});
