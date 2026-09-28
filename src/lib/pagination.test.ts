import { describe, expect, it } from 'vitest';
import { pageParams, paginasVisiveis } from './pagination';

describe('paginasVisiveis', () => {
  it('mostra todas quando são poucas', () => {
    expect(paginasVisiveis(1, 1)).toEqual([1]);
    expect(paginasVisiveis(2, 3)).toEqual([1, 2, 3]);
  });

  it('usa reticências longe da atual', () => {
    expect(paginasVisiveis(1, 10)).toEqual([1, 2, null, 10]);
    expect(paginasVisiveis(5, 10)).toEqual([1, null, 4, 5, 6, null, 10]);
    expect(paginasVisiveis(10, 10)).toEqual([1, null, 9, 10]);
  });
});

describe('pageParams', () => {
  it('aceita só os tamanhos oferecidos', () => {
    expect(pageParams(new URL('http://x/?por=50&page=2'))).toEqual({ page: 2, pageSize: 50, offset: 50 });
    expect(pageParams(new URL('http://x/?por=1000')).pageSize).toBe(20);
    expect(pageParams(new URL('http://x/?page=-3')).page).toBe(1);
  });
});
