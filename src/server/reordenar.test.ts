import { describe, expect, it } from 'vitest';
import { redistribuirPosicoes } from './reordenar';

describe('redistribuirPosicoes', () => {
  it('reaproveita as posições ocupadas (lista paginada não mexe no resto)', () => {
    expect(redistribuirPosicoes([7, 3, 5])).toEqual([3, 5, 7]);
  });

  it('posições repetidas viram sequência a partir da menor', () => {
    expect(redistribuirPosicoes([0, 0, 0])).toEqual([0, 1, 2]);
    expect(redistribuirPosicoes([4, 2, 2])).toEqual([2, 3, 4]);
  });
});
