import { describe, expect, it } from 'vitest';
import {
  calcularOrcamento,
  faixaParaConvidados,
  pagantesEquivalentes,
  precoSecao,
  type ConteudoOrcamento,
  type FaixaLocacaoRef,
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
  { id: 'f1', min_convidados: 0, max_convidados: 30, valor: 1000, descricao: 'Até 30' },
  { id: 'f2', min_convidados: 31, max_convidados: 50, valor: 1500, descricao: '31 a 50' },
  { id: 'f3', min_convidados: 51, max_convidados: null, valor: 2000, descricao: '51+' },
];

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
    locacao: { incluir: false, faixa_id: null, descricao: null, valor_manual: null },
    extras: [],
    informacoes_complementares: [],
    condicoes_gerais: [],
    blocos_texto: [],
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
  it('usa o preço da sessão quando existe (catálogo ou manual)', () => {
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
  it('cardápio: preço base da opção + sessões com preço, multiplicado pelos pagantes', () => {
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

  it('locação pela faixa de convidados, com ajuste manual e opção de não incluir', () => {
    expect(faixaParaConvidados(faixas, 30)?.id).toBe('f1');
    expect(faixaParaConvidados(faixas, 31)?.id).toBe('f2');
    expect(faixaParaConvidados(faixas, 500)?.id).toBe('f3');

    const locacao = { incluir: true, faixa_id: null, descricao: null, valor_manual: null };
    expect(calcularOrcamento(base({ pagantes: { convidados: 40, criancas_meia: 0, criancas_isentas: 0 }, locacao }), faixas).totais?.locacao).toBe(1500);
    expect(calcularOrcamento(base({ locacao: { ...locacao, valor_manual: 1200 } }), faixas).totais?.locacao).toBe(1200);
    expect(calcularOrcamento(base({ locacao: { ...locacao, incluir: false } }), faixas).totais?.locacao).toBe(0);
  });

  it('soma extras e compõe o total geral', () => {
    const r = calcularOrcamento(
      base({
        locacao: { incluir: true, faixa_id: null, descricao: null, valor_manual: 2000 },
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
