import { describe, expect, it } from 'vitest';
import {
  calcularListaCompras,
  calcularOrcamento,
  faixaParaConvidados,
  formatarQuantidade,
  pagantesEquivalentes,
  precoSecao,
  type ConteudoOrcamento,
  type FaixaLocacaoRef,
  type ReferenciasLocacao,
  type ItemOrcamento,
  type SecaoOrcamento,
} from './orcamento';

const item = (nome: string, extra: Partial<ItemOrcamento> = {}): ItemOrcamento => ({
  key: nome,
  item_id: null,
  nome,
  descricao: null,
  selecionado: true,
  preco_catalogo: null,
  preco_manual: null,
  restricoes: [],
  ...extra,
});

const secao = (nome: string, itens: ItemOrcamento[], extra: Partial<SecaoOrcamento> = {}): SecaoOrcamento => ({
  key: nome,
  secao_id: null,
  nome,
  escolha_qtd: null,
  preco_catalogo: null,
  preco_manual: null,
  itens,
  ...extra,
});

const faixas: FaixaLocacaoRef[] = [
  { id: 'f1', espaco_id: 'salao', min_convidados: 0, max_convidados: 30, valor: 1000, descricao: 'Até 30' },
  { id: 'f2', espaco_id: 'salao', min_convidados: 31, max_convidados: 50, valor: 1500, descricao: '31 a 50' },
  { id: 'f3', espaco_id: 'salao', min_convidados: 51, max_convidados: null, valor: 2000, descricao: '51+' },
  // Faixa de outro espaço próprio: nunca entra no cálculo do salão
  { id: 'f4', espaco_id: 'jardim', min_convidados: 0, max_convidados: null, valor: 9000, descricao: 'Jardim' },
];

const refs: ReferenciasLocacao = {
  espacos: [
    { id: 'salao', nome: 'Salão', tipo: 'proprio', valor_referencia: null, ativo: true },
    { id: 'jardim', nome: 'Jardim', tipo: 'proprio', valor_referencia: null, ativo: true },
    { id: 'clube', nome: 'Clube', tipo: 'terceiro', valor_referencia: 3500, ativo: true },
    { id: 'sitio', nome: 'Sítio', tipo: 'terceiro', valor_referencia: null, ativo: true },
  ],
  faixas,
};

function base(extra: Partial<ConteudoOrcamento> = {}): ConteudoOrcamento {
  return {
    cabecalho: {
      evento: 'Teste', cliente: null, contato: null, telefone: null, data_evento: null, horario: null,
      local: null, formato_servico: null, duracao_evento: null, duracao_alimentacao: null,
    },
    pagantes: { convidados: 100, criancas_meia: 0, criancas_isentas: 0 },
    cardapios: [],
    bebidas: [],
    staff: [],
    locacao: { incluir: false, espaco_id: null, espaco_nome: null, faixa_id: null, descricao: null, valor_manual: null },
    extras: [],
    informacoes_complementares: [],
    condicoes_gerais: [],
    blocos_texto: [],
    lista_compras: [],
    total_manual: null,
    mostrar_valor_total: true,
    observacoes: null,
    ...extra,
  };
}

describe('pagantesEquivalentes', () => {
  it('conta crianças de meia como metade e isentas como zero', () => {
    expect(pagantesEquivalentes({ convidados: 100, criancas_meia: 10, criancas_isentas: 6 })).toBe(89);
  });

  it('nunca fica negativo', () => {
    expect(pagantesEquivalentes({ convidados: 5, criancas_meia: 0, criancas_isentas: 10 })).toBe(0);
  });
});

describe('precoSecao', () => {
  it('usa o preço da seção quando existe (catálogo ou manual)', () => {
    expect(precoSecao(secao('Soft drinks', [item('Água', { preco_catalogo: 5 })], { preco_catalogo: 20 }))).toBe(20);
    expect(precoSecao(secao('Soft drinks', [], { preco_catalogo: 20, preco_manual: 18 }))).toBe(18);
  });

  it('sem preço próprio, soma só os itens selecionados, respeitando o ajuste manual do item', () => {
    const s = secao('Extras', [
      item('A', { preco_catalogo: 10 }),
      item('B', { preco_catalogo: 5, preco_manual: 7 }),
      item('C', { preco_catalogo: 100, selecionado: false }),
      item('D'),
    ]);
    expect(precoSecao(s)).toBe(17);
  });
});

describe('calcularOrcamento', () => {
  it('cardápio: preço base da opção + seções com preço, multiplicado pelos pagantes', () => {
    const r = calcularOrcamento(
      base({
        pagantes: { convidados: 100, criancas_meia: 10, criancas_isentas: 0 },
        cardapios: [
          {
            key: 'c1', opcao_id: 'o1', nome: 'Brunch', preco_base: 250, preco_pp_manual: null, subtotal_manual: null,
            secoes: [secao('Pães', [item('Pão')]), secao('Soft', [], { preco_catalogo: 20 })],
          },
        ],
      })
    );
    expect(r.cardapios[0].preco_pp_calc).toBe(270);
    expect(r.cardapios[0].subtotal_calc).toBe(270 * 95);
    expect(r.totais?.alimentos).toBe(25650);
  });

  it('ajuste manual prevalece em cada nível (preço por pessoa, subtotal e total)', () => {
    const cardapio = {
      key: 'c1', opcao_id: null, nome: 'X', preco_base: 100, preco_pp_manual: 90, subtotal_manual: null, secoes: [],
    };
    const r1 = calcularOrcamento(base({ cardapios: [cardapio] }));
    expect(r1.cardapios[0].preco_pp_calc).toBe(100);
    expect(r1.totais?.alimentos).toBe(9000);

    const r2 = calcularOrcamento(base({ cardapios: [{ ...cardapio, subtotal_manual: 5000 }] }));
    expect(r2.totais?.alimentos).toBe(5000);

    const r3 = calcularOrcamento(base({ cardapios: [cardapio], total_manual: 8000 }));
    expect(r3.totais?.total_calc).toBe(9000);
    expect(r3.totais?.total).toBe(8000);
  });

  it('bebidas por pessoa usam pagantes; por unidade usam a quantidade', () => {
    const r = calcularOrcamento(
      base({
        pagantes: { convidados: 50, criancas_meia: 0, criancas_isentas: 10 },
        bebidas: [
          { key: 'b1', ref_id: null, nome: 'Soft drinks', descricao: null, unidade: 'pessoa', quantidade: 0, preco_catalogo: 20, preco_manual: null, subtotal_manual: null },
          { key: 'b2', ref_id: null, nome: 'Chope 30L', descricao: null, unidade: 'unidade', quantidade: 2, preco_catalogo: 600, preco_manual: 550, subtotal_manual: null },
        ],
      })
    );
    expect(r.bebidas[0].subtotal_calc).toBe(800);
    expect(r.bebidas[1].subtotal_calc).toBe(1100);
    expect(r.totais?.bebidas).toBe(1900);
  });

  it('staff é calculado pelas regras sobre o total de convidados, com ajuste de quantidade e valor', () => {
    const garcom = { cache_diaria: 250, auxilio: 0, por_evento: false, quantidade_fixa: 1, convidados_por_profissional: 15, minimo: 0 };
    const r = calcularOrcamento(
      base({
        pagantes: { convidados: 100, criancas_meia: 20, criancas_isentas: 20 },
        staff: [
          { key: 's1', servico_id: null, funcao: 'Garçom', regra: garcom, quantidade_manual: null, valor_unit_manual: null },
          { key: 's2', servico_id: null, funcao: 'Garçom extra', regra: garcom, quantidade_manual: 2, valor_unit_manual: 300 },
        ],
      })
    );
    expect(r.staff[0].quantidade_calc).toBe(7);
    expect(r.staff[0].subtotal_calc).toBe(1750);
    expect(r.staff[1].subtotal_calc).toBe(600);
    expect(r.totais?.staff).toBe(2350);
  });

  it('locação pela faixa de convidados do espaço próprio, com ajuste manual e opção de não incluir', () => {
    expect(faixaParaConvidados(faixas, 30)?.id).toBe('f1');
    expect(faixaParaConvidados(faixas, 31)?.id).toBe('f2');
    expect(faixaParaConvidados(faixas, 500)?.id).toBe('f3');

    const locacao = { incluir: true, espaco_id: 'salao', espaco_nome: null, faixa_id: null, descricao: null, valor_manual: null };
    const r = calcularOrcamento(base({ pagantes: { convidados: 40, criancas_meia: 0, criancas_isentas: 0 }, locacao }), refs);
    expect(r.totais?.locacao).toBe(1500);
    expect(r.locacao.faixa_id).toBe('f2');
    expect(r.locacao.espaco_nome).toBe('Salão');
    expect(calcularOrcamento(base({ locacao: { ...locacao, valor_manual: 1200 } }), refs).totais?.locacao).toBe(1200);
    expect(calcularOrcamento(base({ locacao: { ...locacao, incluir: false } }), refs).totais?.locacao).toBe(0);
    // A faixa do jardim (9000) nunca vale para o salão
    expect(calcularOrcamento(base({ locacao }), refs).totais?.locacao).toBe(2000);
  });

  it('locação de espaço de terceiro usa o valor de referência; sem espaço ou espaço apagado o valor é zero', () => {
    const locacao = { incluir: true, espaco_id: 'clube', espaco_nome: null, faixa_id: null, descricao: null, valor_manual: null };
    const clube = calcularOrcamento(base({ locacao }), refs);
    expect(clube.totais?.locacao).toBe(3500);
    expect(clube.locacao.descricao).toBe('Valor de referência do espaço');
    expect(clube.locacao.espaco_nome).toBe('Clube');

    const sitio = calcularOrcamento(base({ locacao: { ...locacao, espaco_id: 'sitio' } }), refs);
    expect(sitio.totais?.locacao).toBe(0);
    expect(sitio.locacao.descricao).toBeNull();

    expect(calcularOrcamento(base({ locacao: { ...locacao, espaco_id: null } }), refs).totais?.locacao).toBe(0);
    const apagado = calcularOrcamento(base({ locacao: { ...locacao, espaco_id: 'x', espaco_nome: 'Antigo' } }), refs);
    expect(apagado.totais?.locacao).toBe(0);
    expect(apagado.locacao.espaco_nome).toBe('Antigo');
  });

  it('sem referências (versão congelada) a locação preserva o valor calculado gravado', () => {
    const locacao = { incluir: true, espaco_id: 'salao', espaco_nome: 'Salão', faixa_id: 'f1', descricao: 'Até 30', valor_calc: 1000, valor_manual: null };
    const r = calcularOrcamento(base({ locacao }));
    expect(r.totais?.locacao).toBe(1000);
    expect(r.locacao).toEqual(locacao);
  });

  it('soma extras e compõe o total geral', () => {
    const r = calcularOrcamento(
      base({
        locacao: { incluir: true, espaco_id: null, espaco_nome: null, faixa_id: null, descricao: null, valor_manual: 2000 },
        extras: [{ key: 'e1', descricao: 'Hora adicional', quantidade: 2, valor_unit: 600 }],
      })
    );
    expect(r.totais?.extras).toBe(1200);
    expect(r.totais?.total).toBe(3200);
  });

  it('preenche linhas automáticas de restrições e equipe nas informações complementares', () => {
    const r = calcularOrcamento(
      base({
        cardapios: [
          {
            key: 'c1', opcao_id: null, nome: 'X', preco_base: 0, preco_pp_manual: null, subtotal_manual: null,
            secoes: [secao('S', [item('A', { restricoes: ['vegana', 'vegetariana'] }), item('B', { restricoes: ['vegetariana'] }), item('C', { restricoes: ['vegana'], selecionado: false })])],
          },
        ],
        staff: [{ key: 's1', servico_id: null, funcao: 'Chef', regra: { cache_diaria: 450, auxilio: 0, por_evento: true, quantidade_fixa: 1, convidados_por_profissional: null, minimo: 0 }, quantidade_manual: null, valor_unit_manual: null }],
        informacoes_complementares: [
          { key: 'r', titulo: 'Restrições', linhas: [
            { key: 'l1', label: 'Vegetariano', valor: '', auto: 'restricao:vegetariana' },
            { key: 'l2', label: 'Vegano', valor: '', auto: 'restricao:vegana' },
            { key: 'l3', label: 'Observação', valor: 'livre' },
          ] },
          { key: 'e', titulo: 'Equipe', auto: 'staff', linhas: [] },
        ],
      })
    );
    const [restricoes, equipe] = r.informacoes_complementares;
    expect(restricoes.linhas.map((l) => l.valor)).toEqual(['2 opções', '1 opção', 'livre']);
    expect(equipe.linhas).toEqual([{ key: 'auto-s1', label: 'Chef', valor: '1 profissional', auto: 'staff' }]);
  });
});

describe('calcularListaCompras', () => {
  const cardapio = (itens: ItemOrcamento[], nomeSecao = 'Salgados') => ({
    key: 'c', opcao_id: null, nome: 'Cardápio', preco_base: null, preco_pp_manual: null, subtotal_manual: null,
    secoes: [secao(nomeSecao, itens)],
  });

  it('quantidade = porção por pessoa × convidados (todos os convidados, inclusive crianças)', () => {
    const r = calcularListaCompras(
      base({
        pagantes: { convidados: 120, criancas_meia: 10, criancas_isentas: 5 },
        cardapios: [cardapio([item('Coxinha', { item_id: 'i1', porcao_qtd: 3, porcao_unidade: 'un' }), item('Arroz', { item_id: 'i2', porcao_qtd: 80, porcao_unidade: 'g' })])],
      })
    );
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ ref: 'item:i1', nome: 'Coxinha', grupo: 'Salgados', origem: 'cardapio', unidade: 'un', porcao: 3, quantidade_calc: 360 });
    expect(r[1]).toMatchObject({ ref: 'item:i2', unidade: 'g', quantidade_calc: 9600, quantidade_manual: null, comprado: false });
  });

  it('item sem porção entra com quantidade nula; item não selecionado fica de fora', () => {
    const r = calcularListaCompras(
      base({ cardapios: [cardapio([item('Sem porção', { item_id: 'i1' }), item('Fora', { item_id: 'i2', porcao_qtd: 1, selecionado: false })])] })
    );
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ nome: 'Sem porção', quantidade_calc: null, unidade: null });
  });

  it('mesmo item em dois cardápios soma; itens personalizados são identificados pelo nome', () => {
    const r = calcularListaCompras(
      base({
        pagantes: { convidados: 10, criancas_meia: 0, criancas_isentas: 0 },
        cardapios: [
          cardapio([item('Pão', { item_id: 'i1', porcao_qtd: 2, porcao_unidade: 'un' })]),
          cardapio([item('Pão', { item_id: 'i1', porcao_qtd: 2, porcao_unidade: 'un' }), item('Especial da casa', { porcao_qtd: 50, porcao_unidade: 'g' })]),
        ],
      })
    );
    expect(r.map((l) => [l.ref, l.quantidade_calc])).toEqual([
      ['item:i1', 40],
      ['nome:especial da casa', 500],
    ]);
  });

  it('bebidas: por pessoa usa a porção; por unidade usa a quantidade do orçamento', () => {
    const r = calcularListaCompras(
      base({
        pagantes: { convidados: 50, criancas_meia: 0, criancas_isentas: 0 },
        bebidas: [
          { key: 'b1', ref_id: 'b1', nome: 'Refrigerante', descricao: null, unidade: 'pessoa', quantidade: 0, preco_catalogo: null, preco_manual: null, subtotal_manual: null, porcao_qtd: 600, porcao_unidade: 'ml' },
          { key: 'b2', ref_id: 'b2', nome: 'Cerveja', descricao: null, unidade: 'unidade', quantidade: 120, preco_catalogo: null, preco_manual: null, subtotal_manual: null },
        ],
      })
    );
    expect(r[0]).toMatchObject({ grupo: 'Bebidas', origem: 'bebida', unidade: 'ml', quantidade_calc: 30000 });
    expect(r[1]).toMatchObject({ unidade: 'un', porcao: null, quantidade_calc: 120 });
  });

  it('preserva os ajustes do usuário nas linhas derivadas e mantém as linhas avulsas no fim', () => {
    const anterior = calcularListaCompras(
      base({ pagantes: { convidados: 10, criancas_meia: 0, criancas_isentas: 0 }, cardapios: [cardapio([item('Pão', { item_id: 'i1', porcao_qtd: 1, porcao_unidade: 'un' })])] })
    );
    const ajustada = [
      { ...anterior[0], quantidade_manual: 15, comprado: true, observacao: 'Padaria do João' },
      { key: 'm1', ref: null, item_id: null, nome: 'Gelo', grupo: null, origem: 'manual' as const, unidade: 'kg' as const, porcao: null, quantidade_calc: null, quantidade_manual: 20, comprado: false, observacao: null },
    ];
    // Convidados mudaram: o calculado acompanha, os ajustes ficam
    const r = calcularListaCompras(
      base({
        pagantes: { convidados: 30, criancas_meia: 0, criancas_isentas: 0 },
        cardapios: [cardapio([item('Pão', { item_id: 'i1', porcao_qtd: 1, porcao_unidade: 'un' })])],
        lista_compras: ajustada,
      })
    );
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ key: anterior[0].key, quantidade_calc: 30, quantidade_manual: 15, comprado: true, observacao: 'Padaria do João' });
    expect(r[1]).toMatchObject({ key: 'm1', nome: 'Gelo', quantidade_manual: 20 });
  });

  it('linha derivada some quando o item sai do orçamento', () => {
    const r = calcularListaCompras(
      base({
        cardapios: [],
        lista_compras: [{ key: 'x', ref: 'item:i1', item_id: 'i1', nome: 'Pão', grupo: 'Pães', origem: 'cardapio', unidade: 'un', porcao: 1, quantidade_calc: 10, quantidade_manual: 12, comprado: false, observacao: null }],
      })
    );
    expect(r).toEqual([]);
  });

  it('calcularOrcamento devolve a lista junto com os totais', () => {
    const r = calcularOrcamento(base({ cardapios: [cardapio([item('Pão', { item_id: 'i1', porcao_qtd: 2, porcao_unidade: 'un' })])] }), refs);
    expect(r.lista_compras[0].quantidade_calc).toBe(200);
  });
});

describe('formatarQuantidade', () => {
  it('converte g→kg e ml→l a partir de 1000 e formata em pt-BR', () => {
    expect(formatarQuantidade(15000, 'g')).toBe('15 kg');
    expect(formatarQuantidade(2500, 'ml')).toBe('2,5 l');
    expect(formatarQuantidade(800, 'g')).toBe('800 g');
    expect(formatarQuantidade(120, 'un')).toBe('120 un');
    expect(formatarQuantidade(null, 'g')).toBe('—');
  });
});
