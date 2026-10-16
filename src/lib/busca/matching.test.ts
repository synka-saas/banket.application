import { describe, expect, it } from 'vitest';
import { lerCriterios } from './filtros';
import { atendimento, capacidadeAtende, compativel, disponibilidade, passaFiltros, type CandidatoBusca } from './matching';

const SA = { id: 1 }; // Santo André
const base: CandidatoBusca = {
  id: 'b', cidadeId: 1, cidadesAtendidas: [], tiposEvento: ['infantil', 'aniversario'], tiposServico: ['buffet_completo', 'kids'],
  restricoes: ['vegetariana'], atendeDomicilio: false, raioKm: null, espacoProprio: true, capacidadeMin: 40, capacidadeMax: 250,
  aceitaMenor: false, distanciaKm: 2, notaMedia: 4.8, usaAgenda: true, ocupado: false,
};
const crit = (q: string) => lerCriterios(new URLSearchParams(q), '2026-10-16');

describe('compatibilidade (eliminatória)', () => {
  it('tipo de evento precisa ser atendido', () => {
    expect(compativel(base, crit('tipo=infantil'), null)).toBe(true);
    expect(compativel(base, crit('tipo=casamento'), null)).toBe(false);
  });

  it('localização: mesma cidade, cidade atendida, domicílio no raio do buffet, espaço até o deslocamento', () => {
    const outra = { id: 2 };
    expect(compativel({ ...base, distanciaKm: 12 }, crit(''), outra)).toBe(true); // espaço a 12 km (≤ 30)
    expect(compativel({ ...base, distanciaKm: 45 }, crit(''), outra)).toBe(false);
    expect(compativel({ ...base, distanciaKm: 45 }, crit('raio=50'), outra)).toBe(true);
    const domicilio = { ...base, espacoProprio: false, atendeDomicilio: true, raioKm: 25 };
    expect(compativel({ ...domicilio, distanciaKm: 20 }, crit(''), outra)).toBe(true);
    expect(compativel({ ...domicilio, distanciaKm: 26 }, crit(''), outra)).toBe(false);
    expect(compativel({ ...domicilio, distanciaKm: 80, cidadesAtendidas: [2] }, crit(''), outra)).toBe(true);
  });

  it('capacidade entre mínimo e máximo; abaixo do mínimo só se aceita menores', () => {
    expect(capacidadeAtende(base, 250)).toBe(true);
    expect(capacidadeAtende(base, 251)).toBe(false);
    expect(capacidadeAtende(base, 30)).toBe(false);
    expect(capacidadeAtende({ ...base, aceitaMenor: true }, 30)).toBe(true);
    expect(capacidadeAtende(base, null)).toBe(true);
  });

  it('a data elimina só cliente com agenda e data ocupada; gratuito nunca', () => {
    expect(compativel({ ...base, ocupado: true }, crit('data=2026-11-14'), SA)).toBe(false);
    expect(compativel({ ...base, ocupado: true }, crit(''), SA)).toBe(true);
    expect(compativel({ ...base, usaAgenda: false, ocupado: true }, crit('data=2026-11-14'), SA)).toBe(true);
    expect(disponibilidade({ usaAgenda: false, ocupado: false }, '2026-11-14')).toBe('consultar');
    expect(disponibilidade({ usaAgenda: true, ocupado: false }, '2026-11-14')).toBe('disponivel');
    expect(disponibilidade({ usaAgenda: true, ocupado: false }, null)).toBeNull();
  });
});

describe('filtros secundários', () => {
  it('serviço (qualquer), restrição (todas), nota, raio e modo de atendimento', () => {
    expect(passaFiltros(base, crit('servico=churrasco&servico=kids'), SA)).toBe(true);
    expect(passaFiltros(base, crit('servico=churrasco'), SA)).toBe(false);
    expect(passaFiltros(base, crit('restricao=vegetariana&restricao=vegana'), SA)).toBe(false);
    // preço não é filtro: parâmetro antigo na URL é ignorado
    expect(passaFiltros(base, crit('preco_max=10'), SA)).toBe(true);
    expect(passaFiltros(base, crit('avaliacao=4.5'), SA)).toBe(true);
    expect(passaFiltros({ ...base, notaMedia: null }, crit('avaliacao=4'), SA)).toBe(false);
    expect(passaFiltros({ ...base, distanciaKm: 7 }, crit('raio=5'), SA)).toBe(false);
    expect(passaFiltros(base, crit('local=domicilio'), SA)).toBe(false);
    expect(passaFiltros(base, crit('local=espaco'), SA)).toBe(true);
  });

  it('sem cidade, o modo de atendimento vem do perfil', () => {
    expect(atendimento(base, null, null)).toEqual({ mesmaCidade: true, domicilio: false, espaco: true });
  });
});
