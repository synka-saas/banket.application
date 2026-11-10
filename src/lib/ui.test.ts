import { describe, expect, it } from 'vitest';
import { mensagemAmigavel } from './ui';

describe('mensagemAmigavel', () => {
  it('troca erros técnicos do navegador por texto do usuário', () => {
    expect(mensagemAmigavel('Failed to fetch')).toMatch(/conexão com a internet/);
    expect(mensagemAmigavel('NetworkError when attempting to fetch resource.')).toMatch(/conexão/);
    expect(mensagemAmigavel('Load failed')).toMatch(/conexão/);
    expect(mensagemAmigavel('Unexpected token < in JSON at position 0')).toMatch(/resposta inesperada/);
    expect(mensagemAmigavel('HTTP 502')).toMatch(/nosso lado/);
    expect(mensagemAmigavel('')).toBe('Algo deu errado. Tente de novo.');
  });

  it('mantém as mensagens do sistema', () => {
    expect(mensagemAmigavel('Este evento ainda não tem orçamento.')).toBe('Este evento ainda não tem orçamento.');
    expect(mensagemAmigavel('Informe 500 convidados ou menos.')).toBe('Informe 500 convidados ou menos.');
  });
});
