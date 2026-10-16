import { describe, expect, it } from 'vitest';
import { PESOS_PADRAO, fatores, lerPesos, ordenar, pontuar, type Rankeavel } from './ranking';

const r = (id: string, extra: Partial<Rankeavel> = {}): Rankeavel => ({
  id, nome: id, prioridade: false, completude: 80, notaMedia: 4.5, totalAvaliacoes: 10, taxaResposta: 0.8, distanciaKm: 5, ...extra,
});

describe('pesos', () => {
  it('padrão soma 1; JSON parcial é normalizado; inválido volta ao padrão', () => {
    expect(Object.values(PESOS_PADRAO).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    const p = lerPesos('{"avaliacao": 0.6}');
    expect(Object.values(p).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(p.avaliacao).toBeGreaterThan(PESOS_PADRAO.avaliacao);
    expect(lerPesos('{"avaliacao": -1}')).toEqual(PESOS_PADRAO);
    expect(lerPesos('não é json')).toEqual(PESOS_PADRAO);
    expect(lerPesos(undefined)).toEqual(PESOS_PADRAO);
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

  it('pontuação maior para perfil mais completo, bem avaliado e perto', () => {
    expect(pontuar(r('a', { completude: 100, distanciaKm: 1 }))).toBeGreaterThan(pontuar(r('b', { completude: 40, distanciaKm: 25 })));
  });
});

describe('ordenar', () => {
  it('clientes com prioridade vêm sempre antes, mesmo com pontuação menor', () => {
    const lista = [r('gratis-otimo', { completude: 100, notaMedia: 5 }), r('cliente-fraco', { prioridade: true, completude: 30, notaMedia: 3 })];
    expect(ordenar(lista).map((x) => x.id)).toEqual(['cliente-fraco', 'gratis-otimo']);
    expect(ordenar(lista, 'avaliacao').map((x) => x.id)).toEqual(['cliente-fraco', 'gratis-otimo']);
  });

  it('dentro do grupo: relevância, distância e avaliação; nulos no fim', () => {
    const lista = [r('perto', { distanciaKm: 1 }), r('longe', { distanciaKm: 9 }), r('sem-local', { distanciaKm: null })];
    expect(ordenar(lista, 'distancia').map((x) => x.id)).toEqual(['perto', 'longe', 'sem-local']);
    const notas = [r('a', { notaMedia: 4 }), r('b', { notaMedia: 4.9 }), r('c', { notaMedia: null })];
    expect(ordenar(notas, 'avaliacao').map((x) => x.id)).toEqual(['b', 'a', 'c']);
  });

  it('empate total: mais avaliações e depois nome', () => {
    const lista = [r('b'), r('a')];
    expect(ordenar(lista).map((x) => x.id)).toEqual(['a', 'b']);
    // mesma pontuação: quem tem mais avaliações passa à frente
    expect(ordenar([r('x', { totalAvaliacoes: 10 }), r('y', { totalAvaliacoes: 30 })]).map((x) => x.id)).toEqual(['y', 'x']);
  });
});
