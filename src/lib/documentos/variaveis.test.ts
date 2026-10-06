import { describe, expect, it } from 'vitest';
import { aplicarVariaveis, camposExtras, extrairVariaveis, rotuloDoCampo } from './variaveis';

describe('variáveis de documento', () => {
  it('extrai as variáveis na ordem, sem repetir e sem diferenciar maiúsculas', () => {
    expect(extrairVariaveis('Olá {cliente}, {Cliente} e {numero_parcelas}. {2x} não vale.')).toEqual(['cliente', 'numero_parcelas']);
  });

  it('separa os campos extras das variáveis do sistema, com rótulo legível', () => {
    expect(camposExtras('{cliente} paga em {numero_parcelas} vezes até {prazo_pagamento_saldo}', 'Título {evento}')).toEqual([
      { chave: 'numero_parcelas', rotulo: 'Numero parcelas' },
      { chave: 'prazo_pagamento_saldo', rotulo: 'Prazo pagamento saldo' },
    ]);
    expect(camposExtras(null, undefined, '')).toEqual([]);
    expect(rotuloDoCampo('comarca')).toBe('Comarca');
  });

  it('aplica os valores e deixa o que não conhece', () => {
    expect(aplicarVariaveis('{cliente} – {x}', { cliente: 'Ana' })).toBe('Ana – {x}');
  });
});
