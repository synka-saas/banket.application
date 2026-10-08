import { describe, expect, it } from 'vitest';
import { semIds } from './cardapio';

describe('semIds', () => {
  const nomes = new Map([['d79ce89e-265a-4f74-98bb-8cb2e5b1faa4', 'Pão de fermentação natural']]);
  it('troca o id pelo nome e remove ids desconhecidos', () => {
    expect(semIds('Não há custo para o item do cardápio [id d79ce89e-265a-4f74-98bb-8cb2e5b1faa4] Pão de fermentação natural, que vence.', nomes)).toBe(
      'Não há custo para o item do cardápio "Pão de fermentação natural", que vence.'
    );
    expect(semIds('Use o item id: 0e64de9b-432a-4099-a944-a4fd3ba553f2 agora', nomes)).toBe('Use o item agora');
    expect(semIds('Sem ids aqui', nomes)).toBe('Sem ids aqui');
  });
});
