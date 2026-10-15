import { describe, expect, it } from 'vitest';
import { escolherExcedentes } from './excedentes';

const itens = [
  { id: 'a', atualizadoEm: '2026-01-01' },
  { id: 'b', atualizadoEm: '2026-03-01' },
  { id: 'c', atualizadoEm: '2026-02-01' },
  { id: 'd', atualizadoEm: null },
];

describe('escolherExcedentes', () => {
  it('sem limite (null ou -1) ou dentro do limite, mantém tudo', () => {
    expect(escolherExcedentes(itens, null)).toEqual({ manter: ['a', 'b', 'c', 'd'], bloquear: [] });
    expect(escolherExcedentes(itens, -1).bloquear).toEqual([]);
    expect(escolherExcedentes(itens, 4).bloquear).toEqual([]);
  });

  it('mantém os mais recentes até o limite', () => {
    expect(escolherExcedentes(itens, 2)).toEqual({ manter: ['b', 'c'], bloquear: ['a', 'd'] });
  });

  it('quem sempre fica nunca é bloqueado, mesmo acima do limite', () => {
    const r = escolherExcedentes(itens, 1, { sempreFica: ['a'] });
    expect(r.manter).toEqual(['a']);
    expect(r.bloquear).toEqual(['b', 'c', 'd']);
    expect(escolherExcedentes(itens, 0, { sempreFica: ['a'] }).manter).toEqual(['a']);
  });

  it('preferidos do usuário entram antes dos mais recentes', () => {
    const r = escolherExcedentes(itens, 2, { sempreFica: ['a'], preferidos: ['d'] });
    expect(r.manter).toEqual(['a', 'd']);
    expect(r.bloquear).toEqual(['b', 'c']);
  });

  it('ignora preferidos que não existem', () => {
    expect(escolherExcedentes(itens, 1, { preferidos: ['zzz'] }).manter).toEqual(['b']);
  });
});
