import { describe, expect, it } from 'vitest';
import { lerOrdenacao, orderBy } from './ordenacao';

const MAPA = { nome: 'lower(c.nome)', eventos: 'total_eventos' };

describe('ordenação', () => {
  it('lê campo e direção da URL', () => {
    expect(lerOrdenacao(new URL('http://x/?ordem=nome&dir=desc'))).toEqual({ campo: 'nome', dir: 'desc' });
    expect(lerOrdenacao(new URL('http://x/'))).toEqual({ campo: null, dir: 'asc' });
  });

  it('só usa expressões do mapa; o resto cai na ordem padrão', () => {
    expect(orderBy({ campo: 'eventos', dir: 'desc' }, MAPA, 'lower(c.nome)')).toBe('total_eventos DESC NULLS LAST, lower(c.nome)');
    expect(orderBy({ campo: 'senha', dir: 'asc' }, MAPA, 'lower(c.nome)')).toBe('lower(c.nome)');
    expect(orderBy(lerOrdenacao(new URL('http://x/?ordem=1;drop%20table')), MAPA, 'x')).toBe('x');
    expect(orderBy(undefined, MAPA, 'x')).toBe('x');
  });
});
