import { describe, expect, it } from 'vitest';
import { aplicarMascara, formatarDinheiro, mascararCep, mascararTelefone } from './mascaras';

describe('mascararTelefone', () => {
  it('diferencia fixo (10 dígitos) de celular (11)', () => {
    expect(mascararTelefone('1133334444')).toBe('(11) 3333-4444');
    expect(mascararTelefone('11933334444')).toBe('(11) 93333-4444');
  });

  it('formata enquanto digita e descarta o excesso', () => {
    expect(mascararTelefone('1')).toBe('1');
    expect(mascararTelefone('11')).toBe('11');
    expect(mascararTelefone('119')).toBe('(11) 9');
    expect(mascararTelefone('1193333')).toBe('(11) 9333-3');
    expect(mascararTelefone('(11) 93333-44449999')).toBe('(11) 93333-4444');
  });
});

describe('mascararCep', () => {
  it('formata 00000-000', () => {
    expect(mascararCep('01310')).toBe('01310');
    expect(mascararCep('01310100')).toBe('01310-100');
    expect(mascararCep('01310-1009')).toBe('01310-100');
  });
});

describe('formatarDinheiro', () => {
  it('normaliza para o formato brasileiro', () => {
    expect(formatarDinheiro('1500')).toBe('1.500,00');
    expect(formatarDinheiro('1500,5')).toBe('1.500,50');
    expect(formatarDinheiro('R$ 1.234,56')).toBe('1.234,56');
    expect(formatarDinheiro('')).toBe('');
    expect(formatarDinheiro('abc')).toBe('abc');
  });
});

describe('aplicarMascara', () => {
  it('documento segue o tipo de pessoa', () => {
    expect(aplicarMascara('documento', '52998224725', 'PF')).toBe('529.982.247-25');
    expect(aplicarMascara('documento', '11222333000181', 'PJ')).toBe('11.222.333/0001-81');
    expect(aplicarMascara('cnpj', '11222333000181')).toBe('11.222.333/0001-81');
    expect(aplicarMascara('numero', '12a3')).toBe('123');
  });
});
