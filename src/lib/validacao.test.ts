import { describe, expect, it } from 'vitest';
import { mensagemValidacao } from './validacao';

describe('mensagemValidacao', () => {
  it('campo obrigatório conforme o tipo', () => {
    expect(mensagemValidacao({ valueMissing: true }, { tipo: 'text' })).toBe('Preencha este campo.');
    expect(mensagemValidacao({ valueMissing: true }, { tipo: 'radio' })).toBe('Selecione uma das opções.');
    expect(mensagemValidacao({ valueMissing: true }, { tipo: 'select' })).toBe('Selecione uma das opções.');
    expect(mensagemValidacao({ valueMissing: true }, { tipo: 'checkbox' })).toBe('Marque esta opção para continuar.');
  });

  it('formato, tamanho e limites', () => {
    expect(mensagemValidacao({ typeMismatch: true }, { tipo: 'email' })).toMatch(/e-mail válido/);
    expect(mensagemValidacao({ tooShort: true }, { tipo: 'text', minLength: '80' })).toBe('Use pelo menos 80 caracteres.');
    expect(mensagemValidacao({ rangeOverflow: true }, { tipo: 'number', max: '500' })).toBe('O valor máximo é 500.');
    expect(mensagemValidacao({ rangeUnderflow: true }, { tipo: 'date', min: '2026-11-10' })).toBe('Escolha uma data a partir de 10/11/2026.');
    expect(mensagemValidacao({ patternMismatch: true }, { tipo: 'text', titulo: 'Use letras minúsculas.' })).toBe('Use letras minúsculas.');
  });

  it('sem problema, sem mensagem', () => {
    expect(mensagemValidacao({}, { tipo: 'text' })).toBe('');
  });
});
