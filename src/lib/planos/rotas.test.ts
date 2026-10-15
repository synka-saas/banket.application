import { describe, expect, it } from 'vitest';
import { inicioDoPlano, recursoDaRota } from './rotas';

describe('recursoDaRota', () => {
  it('associa os módulos pelos prefixos de página e de API', () => {
    expect(recursoDaRota('/dashboard')).toBe('propostas');
    expect(recursoDaRota('/eventos')).toBe('propostas');
    expect(recursoDaRota('/eventos/abc/orcamento')).toBe('propostas');
    expect(recursoDaRota('/api/orcamentos/abc/versoes/1')).toBe('propostas');
    expect(recursoDaRota('/inbox/123')).toBe('inbox');
    expect(recursoDaRota('/cardapio/itens')).toBe('cardapios');
    expect(recursoDaRota('/api/cardapio/opcoes')).toBe('cardapios');
    expect(recursoDaRota('/financeiro/receber')).toBe('financeiro');
    expect(recursoDaRota('/configuracoes/usuarios')).toBe('configuracoes');
    expect(recursoDaRota('/templates/novo')).toBe('templates');
  });

  it('abas do evento com regra própria vencem o prefixo geral', () => {
    expect(recursoDaRota('/eventos/abc/financas')).toBe('financeiro');
    expect(recursoDaRota('/eventos/abc/negociacao')).toBe('ia');
    expect(recursoDaRota('/eventos/abc/assistente-orcamento')).toBe('ia');
    expect(recursoDaRota('/eventos/abc/ia-contexto/xyz')).toBe('ia');
    expect(recursoDaRota('/eventos/abc/reunioes')).toBe('reunioes');
  });

  it('não confunde prefixos parecidos', () => {
    expect(recursoDaRota('/eventosx')).toBeNull();
    expect(recursoDaRota('/agendamento')).toBeNull();
  });

  it('deixa livres as rotas fora do mapa', () => {
    for (const r of ['/busca', '/busca/cadastro', '/api/busca/perfil', '/planos', '/api/planos/trial', '/conta', '/suporte', '/api/sessao/empresa', '/uploads/x/y.png', '/conta-suspensa']) {
      expect(recursoDaRota(r), r).toBeNull();
    }
  });
});

describe('inicioDoPlano', () => {
  it('leva ao dashboard com propostas e ao Banket Busca sem', () => {
    expect(inicioDoPlano(true)).toBe('/dashboard');
    expect(inicioDoPlano(false)).toBe('/busca');
  });
});
