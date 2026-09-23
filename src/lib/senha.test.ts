import { describe, expect, it } from 'vitest';
import { validarSenha } from './senha';

describe('validarSenha', () => {
  it('aceita senha com letras, números e símbolos', () => {
    expect(validarSenha('Banket.2026')).toBeNull();
    expect(validarSenha('Banket.2026', 'Banket.2026')).toBeNull();
  });

  it('rejeita senhas fracas com a mensagem da regra violada', () => {
    expect(validarSenha('Ab1.')).toMatch(/8 caracteres/);
    expect(validarSenha('12345678.')).toMatch(/letras/);
    expect(validarSenha('Banket.abc')).toMatch(/números/);
    expect(validarSenha('Banket2026')).toMatch(/símbolo/);
  });

  it('exige confirmação igual', () => {
    expect(validarSenha('Banket.2026', 'Banket.2027')).toMatch(/não conferem/);
  });
});
