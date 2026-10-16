import { describe, expect, it } from 'vitest';
import { slugDaCidadeDigitada } from './vitrine';

describe('cidade digitada (sem JavaScript)', () => {
  it('aceita o formato do autocomplete, cidade com bairro e só o nome', () => {
    expect(slugDaCidadeDigitada('Santo André · SP')).toBe('santo-andre-sp');
    expect(slugDaCidadeDigitada('Moema, São Paulo')).toBe('sao-paulo');
    expect(slugDaCidadeDigitada('campinas')).toBe('campinas');
    expect(slugDaCidadeDigitada('São Bernardo do Campo - SP')).toBe('sao-bernardo-do-campo-sp');
    expect(slugDaCidadeDigitada(' ')).toBeNull();
    expect(slugDaCidadeDigitada(null)).toBeNull();
  });
});
