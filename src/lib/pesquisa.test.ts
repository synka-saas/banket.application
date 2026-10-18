import { describe, expect, it } from 'vitest';
import { avaliacaoDaPesquisa, calcularNps, classeNps, nomeDeExibicao, validarRespostas, zonaNps, type PerguntaPublica } from './pesquisa';

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

describe('avaliação no Banket Busca', () => {
  const autorizacao = (sim: boolean) => ({ tipo: 'escolha' as const, texto: 'Podemos usar a sua avaliação como depoimento?', nota: null, opcoes: [sim ? 'Sim' : 'Não'], resposta: null });
  const aberta = { tipo: 'texto' as const, texto: 'Do que você mais gostou?', nota: null, opcoes: null, resposta: 'A comida estava ótima e a equipe foi muito atenciosa.' };

  it('nota = média CSAT; sem CSAT, NPS convertido', () => {
    const notas = [4, 5, 5].map((nota) => ({ tipo: 'nota' as const, texto: 'x', nota, opcoes: null, resposta: null }));
    expect(avaliacaoDaPesquisa([...notas, { tipo: 'nps', texto: 'nps', nota: 2, opcoes: null, resposta: null }]).nota).toBe(4.67);
    expect(avaliacaoDaPesquisa([{ tipo: 'nps', texto: 'nps', nota: 10, opcoes: null, resposta: null }]).nota).toBe(5);
    expect(avaliacaoDaPesquisa([{ tipo: 'nps', texto: 'nps', nota: 0, opcoes: null, resposta: null }]).nota).toBe(1);
    expect(avaliacaoDaPesquisa([aberta]).nota).toBeNull();
  });

  it('depoimento só com autorização e texto de 20+ caracteres', () => {
    expect(avaliacaoDaPesquisa([aberta, autorizacao(true)]).depoimento).toBe(aberta.resposta);
    expect(avaliacaoDaPesquisa([aberta, autorizacao(false)]).depoimento).toBeNull();
    expect(avaliacaoDaPesquisa([{ ...aberta, resposta: 'Bom.' }, autorizacao(true)]).depoimento).toBeNull();
  });

  it('nome de exibição', () => {
    expect(nomeDeExibicao('Mariana Souza Lima')).toBe('Mariana L.');
    expect(nomeDeExibicao('Ana')).toBe('Ana');
    expect(nomeDeExibicao(null)).toBe('Cliente');
  });
});
