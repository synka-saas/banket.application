// Estrutura e cálculo do conteúdo de uma versão de orçamento.
// Função pura, usada no construtor (ilha) e no servidor, que recalcula antes de gravar.
//
// Regra geral de preço: todo valor tem um "calculado" (vindo do catálogo/regras) e um "manual" opcional;
// o valor efetivo é sempre manual ?? calculado.
import { arredondar, custoSugerido, type RegraStaff } from './staff';

export type Unidade = 'pessoa' | 'unidade';

/** Unidade da porção por pessoa cadastrada no item (base da lista de compras) */
export type UnidadePorcao = 'g' | 'kg' | 'ml' | 'l' | 'un';
export const UNIDADES_PORCAO: Record<UnidadePorcao, string> = { g: 'g', kg: 'kg', ml: 'ml', l: 'l', un: 'un' };

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
  /** Porção por pessoa do catálogo (snapshot; a versão em edição acompanha o cadastro) */
  porcao_qtd?: number | null;
  porcao_unidade?: UnidadePorcao | null;
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
  porcao_qtd?: number | null;
  porcao_unidade?: UnidadePorcao | null;
  subtotal_calc?: number;
}

/**
 * Linha da lista de compras do evento. As linhas de origem "cardapio"/"bebida" são derivadas dos itens
 * selecionados no orçamento (quantidade = porção × convidados) e só guardam os ajustes do usuário
 * (quantidade manual, comprado, observação); as de origem "manual" são inteiramente do usuário.
 */
export interface LinhaCompra {
  key: string;
  /** Identidade da linha derivada ("item:<id>" ou "nome:<nome>"); null nas manuais */
  ref: string | null;
  item_id: string | null;
  nome: string;
  /** Seção do cardápio (ou "Bebidas") de onde o item veio */
  grupo: string | null;
  origem: 'cardapio' | 'bebida' | 'manual';
  unidade: UnidadePorcao | null;
  /** Porção por pessoa que gerou o cálculo */
  porcao: number | null;
  quantidade_calc: number | null;
  quantidade_manual: number | null;
  comprado: boolean;
  observacao: string | null;
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
  /** Espaço próprio dono da faixa (null só em dados antigos, tratados como do espaço padrão pelo servidor) */
  espaco_id: string | null;
  min_convidados: number;
  max_convidados: number | null;
  valor: number;
  descricao: string;
}

/** Espaço de eventos cadastrado (próprio = locação por faixa; terceiro = valor de referência) */
export interface EspacoRef {
  id: string;
  nome: string;
  tipo: 'proprio' | 'terceiro';
  valor_referencia: number | null;
  ativo: boolean;
}

/** Dados de apoio da locação: todos os espaços da empresa e as faixas de cada espaço próprio */
export interface ReferenciasLocacao {
  espacos: EspacoRef[];
  faixas: FaixaLocacaoRef[];
}

export interface LocacaoOrcamento {
  incluir: boolean;
  /** Espaço escolhido (acompanha o evento na versão em edição) */
  espaco_id: string | null;
  /** Snapshot do nome, para versões congeladas e espaços apagados */
  espaco_nome: string | null;
  faixa_id: string | null;
  descricao: string | null;
  valor_calc?: number;
  valor_manual: number | null;
}

export const DESCRICAO_VALOR_REFERENCIA = 'Valor de referência do espaço';

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
  lista_compras: LinhaCompra[];
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

/** Preço por pessoa de uma seção: preço próprio (manual ou catálogo) ou soma dos itens selecionados com preço. */
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
 * Locação pelo espaço escolhido: espaço próprio usa a faixa de convidados; espaço de terceiro usa o valor de
 * referência; sem espaço (ou espaço apagado) o valor calculado é zero. O nome fica guardado como snapshot.
 */
export function calcularLocacao(locacao: LocacaoOrcamento, refs: ReferenciasLocacao, convidados: number): LocacaoOrcamento {
  const base = { ...locacao, faixa_id: null, descricao: null, valor_calc: 0 };
  if (!locacao.espaco_id) return { ...base, espaco_nome: null };
  const espaco = refs.espacos.find((e) => e.id === locacao.espaco_id);
  if (!espaco) return base;
  if (espaco.tipo === 'terceiro') {
    return {
      ...base,
      espaco_nome: espaco.nome,
      descricao: espaco.valor_referencia === null ? null : DESCRICAO_VALOR_REFERENCIA,
      valor_calc: espaco.valor_referencia ?? 0,
    };
  }
  const faixa = faixaParaConvidados(refs.faixas.filter((f) => f.espaco_id === espaco.id), convidados);
  return { ...base, espaco_nome: espaco.nome, faixa_id: faixa?.id ?? null, descricao: faixa?.descricao ?? null, valor_calc: faixa?.valor ?? 0 };
}

/**
 * Recalcula todos os valores derivados. Não altera os valores manuais.
 * `refs` é opcional: sem ele, a locação mantém o valor calculado já presente (versões congeladas).
 */
export function calcularOrcamento(conteudo: ConteudoOrcamento, refs?: ReferenciasLocacao): ConteudoOrcamento {
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

  const locacao = refs ? calcularLocacao(conteudo.locacao, refs, convidados) : conteudo.locacao;
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
    lista_compras: calcularListaCompras(parcial),
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

/** Atualiza linhas/blocos automáticos das Informações complementares (restrições e equipe). */
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

// ---------------------------------------------------------------------------
// Lista de compras
// ---------------------------------------------------------------------------
const arredondarQtd = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Monta a lista de compras a partir dos itens selecionados nos cardápios e das bebidas:
 * quantidade = porção por pessoa × convidados (todos os convidados comem, inclusive crianças);
 * bebida cobrada por unidade usa a quantidade do orçamento. O mesmo item em dois cardápios soma.
 * Linhas derivadas preservam os ajustes do usuário (quantidade manual, comprado, observação) pela `ref`;
 * linhas manuais ficam como estão; linhas derivadas cujo item saiu do orçamento desaparecem.
 */
export function calcularListaCompras(conteudo: Pick<ConteudoOrcamento, 'cardapios' | 'bebidas' | 'pagantes' | 'lista_compras'>): LinhaCompra[] {
  const convidados = Math.max(0, conteudo.pagantes.convidados);
  const anteriores = new Map<string, LinhaCompra>();
  for (const l of conteudo.lista_compras ?? []) if (l.ref) anteriores.set(l.ref, l);

  const derivadas = new Map<string, LinhaCompra>();
  const incluir = (
    ref: string,
    base: Pick<LinhaCompra, 'item_id' | 'nome' | 'grupo' | 'origem' | 'unidade' | 'porcao'>,
    quantidade: number | null
  ) => {
    const existente = derivadas.get(ref);
    if (existente) {
      // Mesmo item em mais de um cardápio: soma as quantidades calculadas
      if (quantidade !== null) existente.quantidade_calc = arredondarQtd((existente.quantidade_calc ?? 0) + quantidade);
      return;
    }
    const anterior = anteriores.get(ref);
    derivadas.set(ref, {
      key: anterior?.key ?? novaChave('lc'),
      ref,
      ...base,
      quantidade_calc: quantidade === null ? null : arredondarQtd(quantidade),
      quantidade_manual: anterior?.quantidade_manual ?? null,
      comprado: anterior?.comprado ?? false,
      observacao: anterior?.observacao ?? null,
    });
  };

  const refDe = (item_id: string | null, nome: string) => (item_id ? `item:${item_id}` : `nome:${nome.trim().toLowerCase()}`);

  for (const c of conteudo.cardapios)
    for (const s of c.secoes)
      for (const i of s.itens) {
        if (!i.selecionado) continue;
        const porcao = i.porcao_qtd ?? null;
        incluir(
          refDe(i.item_id, i.nome),
          { item_id: i.item_id, nome: i.nome, grupo: s.nome, origem: 'cardapio', unidade: i.porcao_unidade ?? null, porcao },
          porcao === null ? null : porcao * convidados
        );
      }

  for (const b of conteudo.bebidas) {
    const porcao = b.porcao_qtd ?? null;
    const porUnidade = b.unidade === 'unidade';
    incluir(
      refDe(b.ref_id, b.nome),
      {
        item_id: b.ref_id,
        nome: b.nome,
        grupo: 'Bebidas',
        origem: 'bebida',
        unidade: porUnidade ? 'un' : (b.porcao_unidade ?? null),
        porcao: porUnidade ? null : porcao,
      },
      porUnidade ? Math.max(0, b.quantidade) : porcao === null ? null : porcao * convidados
    );
  }

  // Ordem: derivadas na ordem do orçamento, depois as manuais na ordem em que foram criadas
  const manuais = (conteudo.lista_compras ?? []).filter((l) => l.ref === null);
  return [...derivadas.values(), ...manuais];
}

/** Quantidade efetiva de uma linha (manual ?? calculada). */
export const quantidadeCompra = (l: LinhaCompra): number | null => l.quantidade_manual ?? l.quantidade_calc;

/** "15000 g" → "15 kg"; "2500 ml" → "2,5 l"; "120 un" → "120 un". Sem unidade, só o número. */
export function formatarQuantidade(qtd: number | null | undefined, unidade: UnidadePorcao | null): string {
  if (qtd === null || qtd === undefined) return '—';
  let valor = qtd;
  let un: string = unidade ?? '';
  if (unidade === 'g' && valor >= 1000) {
    valor = valor / 1000;
    un = 'kg';
  } else if (unidade === 'ml' && valor >= 1000) {
    valor = valor / 1000;
    un = 'l';
  }
  const texto = valor.toLocaleString('pt-BR', { maximumFractionDigits: unidade === 'un' ? 0 : 3 });
  return un ? `${texto} ${un}` : texto;
}

let seq = 0;
/** Chave local única para listas editáveis. */
export function novaChave(prefixo = 'k'): string {
  seq += 1;
  return `${prefixo}${Date.now().toString(36)}${seq.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
