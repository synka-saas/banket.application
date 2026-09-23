// Estrutura e cálculo do conteúdo de uma versão de orçamento.
// Função pura, usada no construtor (ilha) e no servidor, que recalcula antes de gravar.
//
// Regra geral de preço: todo valor tem um "calculado" (vindo do catálogo/regras) e um "manual" opcional;
// o valor efetivo é sempre manual ?? calculado.
import { arredondar, custoSugerido, type RegraStaff } from './staff';

export type Unidade = 'pessoa' | 'unidade';

export interface ItemOrcamento {
  key: string;
  item_id: string | null;
  nome: string;
  descricao: string | null;
  selecionado: boolean;
  /** Preço do catálogo no momento em que o item entrou no orçamento (snapshot) */
  preco_catalogo: number | null;
  preco_manual: number | null;
  restricoes: string[];
}

export interface SecaoOrcamento {
  key: string;
  secao_id: string | null;
  nome: string;
  escolha_qtd: number | null;
  preco_catalogo: number | null;
  preco_manual: number | null;
  itens: ItemOrcamento[];
}

export interface CardapioOrcamento {
  key: string;
  opcao_id: string | null;
  nome: string;
  /** Preço base por pessoa da opção pronta (0 quando montado do zero) */
  preco_base: number | null;
  /** Ajuste manual do preço por pessoa do cardápio inteiro */
  preco_pp_manual: number | null;
  subtotal_manual: number | null;
  secoes: SecaoOrcamento[];
  // calculados
  preco_pp_calc?: number;
  subtotal_calc?: number;
}

export interface BebidaOrcamento {
  key: string;
  ref_id: string | null;
  nome: string;
  descricao: string | null;
  unidade: Unidade;
  quantidade: number;
  preco_catalogo: number | null;
  preco_manual: number | null;
  subtotal_manual: number | null;
  subtotal_calc?: number;
}

export interface StaffOrcamento {
  key: string;
  servico_id: string | null;
  funcao: string;
  regra: RegraStaff;
  quantidade_manual: number | null;
  valor_unit_manual: number | null;
  quantidade_calc?: number;
  valor_unit_calc?: number;
  subtotal_calc?: number;
}

export interface ExtraOrcamento {
  key: string;
  descricao: string;
  quantidade: number;
  valor_unit: number;
  subtotal_calc?: number;
}

export interface FaixaLocacaoRef {
  id: string;
  min_convidados: number;
  max_convidados: number | null;
  valor: number;
  descricao: string;
}

export interface LocacaoOrcamento {
  incluir: boolean;
  faixa_id: string | null;
  descricao: string | null;
  valor_calc?: number;
  valor_manual: number | null;
}

export interface LinhaInfo {
  key: string;
  label: string;
  valor: string;
  /** Linha preenchida automaticamente (ex.: "restricao:vegana"); vira manual quando o usuário edita */
  auto?: string | null;
}

export interface BlocoInfo {
  key: string;
  titulo: string;
  /** Bloco com linhas geradas automaticamente (ex.: "staff") enquanto não for editado */
  auto?: string | null;
  linhas: LinhaInfo[];
}

/** Bloco de texto da proposta (cópia do cadastro de Templates › Blocos no momento da inclusão) */
export interface BlocoTexto {
  key: string;
  bloco_id: string | null;
  titulo: string;
  texto: string;
  pagina: 'cardapio' | 'bebidas' | 'staff' | 'informacoes' | 'condicoes';
}

export interface Pagantes {
  convidados: number;
  criancas_meia: number;
  criancas_isentas: number;
}

export interface Cabecalho {
  evento: string;
  cliente: string | null;
  contato: string | null;
  telefone: string | null;
  data_evento: string | null;
  horario: string | null;
  local: string | null;
  formato_servico: string | null;
  duracao_evento: string | null;
  duracao_alimentacao: string | null;
}

export interface Totais {
  alimentos: number;
  bebidas: number;
  staff: number;
  locacao: number;
  extras: number;
  total_calc: number;
  total: number;
  pagantes_equivalentes: number;
}

export interface ConteudoOrcamento {
  cabecalho: Cabecalho;
  pagantes: Pagantes;
  cardapios: CardapioOrcamento[];
  bebidas: BebidaOrcamento[];
  staff: StaffOrcamento[];
  locacao: LocacaoOrcamento;
  extras: ExtraOrcamento[];
  informacoes_complementares: BlocoInfo[];
  condicoes_gerais: BlocoInfo[];
  blocos_texto: BlocoTexto[];
  total_manual: number | null;
  mostrar_valor_total: boolean;
  observacoes: string | null;
  totais?: Totais;
}

const efetivo = (manual: number | null | undefined, calc: number | null | undefined) =>
  manual ?? calc ?? 0;

/** Convidados que pagam inteira + metade dos que pagam meia. */
export function pagantesEquivalentes(p: Pagantes): number {
  const isentas = Math.max(0, p.criancas_isentas);
  const meia = Math.max(0, p.criancas_meia);
  const inteira = Math.max(0, p.convidados - isentas - meia);
  return inteira + meia * 0.5;
}

/** Preço por pessoa de uma sessão: preço próprio (manual ou catálogo) ou soma dos itens selecionados com preço. */
export function precoSecao(secao: SecaoOrcamento): number {
  if (secao.preco_manual !== null) return secao.preco_manual;
  if (secao.preco_catalogo !== null) return secao.preco_catalogo;
  return secao.itens
    .filter((i) => i.selecionado)
    .reduce((acc, i) => acc + (i.preco_manual ?? i.preco_catalogo ?? 0), 0);
}

export function faixaParaConvidados(faixas: FaixaLocacaoRef[], convidados: number): FaixaLocacaoRef | null {
  return (
    faixas.find((f) => convidados >= f.min_convidados && (f.max_convidados === null || convidados <= f.max_convidados)) ??
    null
  );
}

/** Contagem de itens selecionados (em todos os cardápios) compatíveis com cada restrição. */
export function contarRestricoes(conteudo: Pick<ConteudoOrcamento, 'cardapios'>): Record<string, number> {
  const contagem: Record<string, number> = {};
  for (const c of conteudo.cardapios)
    for (const s of c.secoes)
      for (const i of s.itens)
        if (i.selecionado) for (const r of i.restricoes) contagem[r] = (contagem[r] ?? 0) + 1;
  return contagem;
}

/**
 * Recalcula todos os valores derivados. Não altera os valores manuais.
 * `faixas` é opcional: sem ela, a locação mantém o valor calculado já presente.
 */
export function calcularOrcamento(conteudo: ConteudoOrcamento, faixas?: FaixaLocacaoRef[]): ConteudoOrcamento {
  const equivalentes = pagantesEquivalentes(conteudo.pagantes);
  const convidados = Math.max(0, conteudo.pagantes.convidados);

  const cardapios = conteudo.cardapios.map((c) => {
    const preco_pp_calc = arredondar((c.preco_base ?? 0) + c.secoes.reduce((acc, s) => acc + precoSecao(s), 0));
    const pp = efetivo(c.preco_pp_manual, preco_pp_calc);
    return { ...c, preco_pp_calc, subtotal_calc: arredondar(pp * equivalentes) };
  });

  const bebidas = conteudo.bebidas.map((b) => {
    const unit = efetivo(b.preco_manual, b.preco_catalogo);
    const base = b.unidade === 'pessoa' ? equivalentes : Math.max(0, b.quantidade);
    return { ...b, subtotal_calc: arredondar(unit * base) };
  });

  const staff = conteudo.staff.map((s) => {
    const sugerido = custoSugerido(s.regra, convidados);
    const qtd = efetivo(s.quantidade_manual, sugerido.quantidade);
    const unit = efetivo(s.valor_unit_manual, sugerido.unitario);
    return {
      ...s,
      quantidade_calc: sugerido.quantidade,
      valor_unit_calc: sugerido.unitario,
      subtotal_calc: arredondar(qtd * unit),
    };
  });

  const extras = conteudo.extras.map((e) => ({ ...e, subtotal_calc: arredondar(e.quantidade * e.valor_unit) }));

  let locacao = conteudo.locacao;
  if (faixas) {
    const faixa = faixaParaConvidados(faixas, convidados);
    locacao = { ...locacao, faixa_id: faixa?.id ?? null, descricao: faixa?.descricao ?? null, valor_calc: faixa?.valor ?? 0 };
  }
  const valorLocacao = locacao.incluir ? efetivo(locacao.valor_manual, locacao.valor_calc) : 0;

  const alimentos = arredondar(cardapios.reduce((a, c) => a + efetivo(c.subtotal_manual, c.subtotal_calc), 0));
  const totalBebidas = arredondar(bebidas.reduce((a, b) => a + efetivo(b.subtotal_manual, b.subtotal_calc), 0));
  const totalStaff = arredondar(staff.reduce((a, s) => a + (s.subtotal_calc ?? 0), 0));
  const totalExtras = arredondar(extras.reduce((a, e) => a + (e.subtotal_calc ?? 0), 0));
  const total_calc = arredondar(alimentos + totalBebidas + totalStaff + valorLocacao + totalExtras);

  const parcial = { ...conteudo, cardapios, bebidas, staff, extras, locacao };
  return {
    ...parcial,
    informacoes_complementares: preencherAutomaticos(parcial.informacoes_complementares, parcial),
    totais: {
      alimentos,
      bebidas: totalBebidas,
      staff: totalStaff,
      locacao: arredondar(valorLocacao),
      extras: totalExtras,
      total_calc,
      total: efetivo(conteudo.total_manual, total_calc),
      pagantes_equivalentes: equivalentes,
    },
  };
}

export const NOMES_RESTRICOES: Record<string, string> = {
  vegetariana: 'Vegetariano',
  vegana: 'Vegano',
  sem_gluten: 'Sem glúten',
  sem_lactose: 'Sem lactose',
  alergenicos: 'Contém alergênicos',
};

/** Atualiza linhas/blocos automáticos das Informações Complementares (restrições e equipe). */
function preencherAutomaticos(blocos: BlocoInfo[], conteudo: ConteudoOrcamento): BlocoInfo[] {
  const restricoes = contarRestricoes(conteudo);
  return blocos.map((b) => {
    if (b.auto === 'staff') {
      return {
        ...b,
        linhas: conteudo.staff.map((s) => {
          const qtd = s.quantidade_manual ?? s.quantidade_calc ?? 0;
          return { key: `auto-${s.key}`, label: s.funcao, valor: `${qtd} ${qtd === 1 ? 'profissional' : 'profissionais'}`, auto: 'staff' };
        }),
      };
    }
    return {
      ...b,
      linhas: b.linhas.map((l) => {
        if (l.auto?.startsWith('restricao:')) {
          const n = restricoes[l.auto.slice('restricao:'.length)] ?? 0;
          return { ...l, valor: `${n} ${n === 1 ? 'opção' : 'opções'}` };
        }
        return l;
      }),
    };
  });
}

let seq = 0;
/** Chave local única para listas editáveis. */
export function novaChave(prefixo = 'k'): string {
  seq += 1;
  return `${prefixo}${Date.now().toString(36)}${seq.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
