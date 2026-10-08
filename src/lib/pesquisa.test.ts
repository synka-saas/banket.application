import { describe, expect, it } from 'vitest';
import { calcularNps, classeNps, validarRespostas, zonaNps, type PerguntaPublica } from './pesquisa';

const p = (id: string, tipo: PerguntaPublica['tipo'], extra: Partial<PerguntaPublica> = {}): PerguntaPublica => ({
  id, tipo, texto: id, ajuda: null, opcoes: [], obrigatoria: false, ordem: 0, ...extra,
});

describe('NPS', () => {
  it('classifica e calcula', () => {
    expect([10, 9, 8, 7, 6, 0].map(classeNps)).toEqual(['promotor', 'promotor', 'neutro', 'neutro', 'detrator', 'detrator']);
    expect(calcularNps({ promotores: 6, neutros: 2, detratores: 2 })).toBe(40);
    expect(calcularNps({ promotores: 0, neutros: 0, detratores: 0 })).toBeNull();
    expect(zonaNps(-10).tom).toBe('danger');
    expect(zonaNps(80).tom).toBe('success');
  });
});

describe('validarRespostas', () => {
  const perguntas = [
    p('nps', 'nps', { obrigatoria: true }),
    p('comida', 'nota'),
    p('exp', 'escolha', { opcoes: ['Superou', 'Atendeu'] }),
    p('canais', 'multipla', { opcoes: ['Instagram', 'Indicação'] }),
    p('melhorar', 'texto'),
  ];

  it('aceita respostas válidas e pula opcionais vazias', () => {
    const r = validarRespostas(perguntas, { p_nps: '9', p_exp: 'Atendeu', p_canais: ['Instagram', 'Indicação'], p_melhorar: '  Mais doces  ' });
    expect(r.map((x) => x.pergunta.id)).toEqual(['nps', 'exp', 'canais', 'melhorar']);
    expect(r[0].nota).toBe(9);
    expect(r[3].texto).toBe('Mais doces');
  });

  it('recusa obrigatória vazia, nota fora do intervalo e opção inexistente', () => {
    expect(() => validarRespostas(perguntas, {})).toThrow(/Responda/);
    expect(() => validarRespostas(perguntas, { p_nps: '11' })).toThrow();
    expect(() => validarRespostas(perguntas, { p_nps: '8', p_comida: '0' })).toThrow();
    expect(() => validarRespostas(perguntas, { p_nps: '8', p_exp: 'Outra' })).toThrow();
    expect(() => validarRespostas(perguntas, { p_nps: '8', p_exp: ['Superou', 'Atendeu'] })).toThrow();
  });
});
