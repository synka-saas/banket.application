import { describe, expect, it } from 'vitest';
import { TIPOS_EVENTO, TIPOS_SERVICO, ehTipoEvento, filtrarSlugs, naturezaDoEvento, rotuloEvento } from './catalogos';

describe('catálogos do Banket Busca', () => {
  it('slugs únicos', () => {
    expect(new Set(TIPOS_EVENTO.map((t) => t.slug)).size).toBe(TIPOS_EVENTO.length);
    expect(new Set(TIPOS_SERVICO.map((t) => t.slug)).size).toBe(TIPOS_SERVICO.length);
  });

  it('valida e rotula', () => {
    expect(ehTipoEvento('casamento')).toBe(true);
    expect(ehTipoEvento('show')).toBe(false);
    expect(rotuloEvento('infantil')).toBe('Festa infantil');
    expect(rotuloEvento('xyz')).toBe('xyz');
  });

  it('mapeia para Social ou Corporativo', () => {
    expect(naturezaDoEvento('casamento')).toBe('social');
    expect(naturezaDoEvento('coffee_break')).toBe('corporativo');
    expect(naturezaDoEvento('desconhecido')).toBe('social');
  });

  it('filtra slugs válidos na ordem do catálogo, sem repetir', () => {
    expect(filtrarSlugs(['infantil', 'xyz', 'casamento', 'infantil'], TIPOS_EVENTO)).toEqual(['casamento', 'infantil']);
    expect(filtrarSlugs('formatura', TIPOS_EVENTO)).toEqual(['formatura']);
    expect(filtrarSlugs(null, TIPOS_EVENTO)).toEqual([]);
  });
});
