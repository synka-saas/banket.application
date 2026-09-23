import { describe, expect, it } from 'vitest';
import { cnpjValido, cpfValido, formatarDocumento } from './documento';

describe('cpfValido', () => {
  it('aceita CPF válido com ou sem máscara', () => {
    expect(cpfValido('529.982.247-25')).toBe(true);
    expect(cpfValido('52998224725')).toBe(true);
  });

  it('rejeita dígito verificador errado, tamanho errado e repetidos', () => {
    expect(cpfValido('529.982.247-24')).toBe(false);
    expect(cpfValido('1234567890')).toBe(false);
    expect(cpfValido('111.111.111-11')).toBe(false);
  });
});

describe('cnpjValido', () => {
  it('aceita CNPJ válido', () => {
    expect(cnpjValido('11.222.333/0001-81')).toBe(true);
  });

  it('rejeita CNPJ inválido', () => {
    expect(cnpjValido('11.222.333/0001-80')).toBe(false);
    expect(cnpjValido('00.000.000/0000-00')).toBe(false);
  });
});

describe('formatarDocumento', () => {
  it('aplica a máscara conforme o tamanho', () => {
    expect(formatarDocumento('52998224725')).toBe('529.982.247-25');
    expect(formatarDocumento('11222333000181')).toBe('11.222.333/0001-81');
    expect(formatarDocumento('')).toBe('');
  });
});
