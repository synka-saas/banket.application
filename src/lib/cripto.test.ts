import { beforeAll, describe, expect, it } from 'vitest';
import { cifrar, decifrar } from './cripto';

describe('cripto', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'segredo-de-teste-com-pelo-menos-32-caracteres!!';
  });

  it('cifra e decifra com a chave derivada do JWT_SECRET', () => {
    const c = cifrar('1//refresh-token');
    expect(c.startsWith('v1.')).toBe(true);
    expect(c).not.toContain('refresh');
    expect(decifrar(c)).toBe('1//refresh-token');
  });

  it('devolve null para valores corrompidos ou de outra chave', () => {
    const c = cifrar('x');
    expect(decifrar(`${c}a`)).toBeNull();
    expect(decifrar('lixo')).toBeNull();
    expect(decifrar(null)).toBeNull();
  });
});
