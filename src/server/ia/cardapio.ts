// Assistente de Orçamentos IA: cruza o cardápio de uma versão do orçamento com o catálogo (custo, preço, porção) e o estoque
// (saldo, validade, giro) e pede à IA sugestões de giro de estoque e substituições de maior margem.
// O servidor confere cada id sugerido, calcula o impacto no custo e pode aplicar a sugestão na versão em edição.
import type { Db } from '../../lib/db';
import type { SessionUser } from '../../lib/auth';
import { UserError } from '../../lib/forms';
import { formatMoney } from '../../lib/money';
import { modeloTexto, openAiJson } from '../../lib/openai';
import { calcularMargem } from '../../lib/calculo/margem';
import { NOMES_RESTRICOES, formatarQuantidade, novaChave, type ConteudoOrcamento, type ItemOrcamento, type UnidadePorcao } from '../../lib/calculo/orcamento';
import { carregarEvento } from '../eventos';
import { carregarVersao, salvarVersao } from '../orcamento';
import { registrarTimeline } from '../timeline';
import { AVISO_DADOS, conferirLimiteIa, dataBr, guardarAnalise, trecho } from './comum';

// ---------------------------------------------------------------------------
// Alertas de estoque (determinísticos): validade próxima e itens parados
// ---------------------------------------------------------------------------
export interface AlertaEstoque {
  id: string;
  nome: string;
  quantidade: number;
  unidade: UnidadePorcao;
  custo_unitario: number | null;
  validade: string | null;
  dias_para_vencer: number | null;
  dias_sem_saida: number;
  catalogo_item_id: string | null;
  motivo: 'validade' | 'parado';
}

const DIAS_VALIDADE = 15;
const DIAS_PARADO = 45;

/** Itens com saldo que vencem em até 15 dias ou estão há 45 dias ou mais sem saída. */
export async function alertasEstoque(db: Db): Promise<AlertaEstoque[]> {
  const { rows } = await db.query<Omit<AlertaEstoque, 'motivo'>>(
    `SELECT e.id, e.nome, e.quantidade, e.unidade, e.custo_unitario, e.catalogo_item_id,
            to_char(e.validade, 'YYYY-MM-DD') AS validade,
            (e.validade - current_date) AS dias_para_vencer,
            (current_date - COALESCE((SELECT max(m.created_at) FROM estoque_movimentos m WHERE m.estoque_item_id = e.id AND m.tipo = 'saida'), e.created_at)::date) AS dias_sem_saida
       FROM estoque_itens e
      WHERE e.ativo AND e.quantidade > 0 AND e.tipo = 'consumivel'`
  );
  return rows
    .map((r) => ({ ...r, quantidade: Number(r.quantidade), custo_unitario: r.custo_unitario === null ? null : Number(r.custo_unitario) }))
    .filter((r) => (r.dias_para_vencer !== null && r.dias_para_vencer <= DIAS_VALIDADE) || r.dias_sem_saida >= DIAS_PARADO)
    .map((r) => ({ ...r, motivo: r.dias_para_vencer !== null && r.dias_para_vencer <= DIAS_VALIDADE ? ('validade' as const) : ('parado' as const) }))
    .sort((a, b) => (a.dias_para_vencer ?? 9999) - (b.dias_para_vencer ?? 9999) || b.dias_sem_saida - a.dias_sem_saida);
}

// ---------------------------------------------------------------------------
// Catálogo de apoio
// ---------------------------------------------------------------------------
interface ItemCatalogo {
  id: string;
  secao_id: string;
  secao_nome: string;
  nome: string;
  descricao: string | null;
  preco: number | null;
  custo_unitario: number | null;
  porcao_qtd: number | null;
  porcao_unidade: UnidadePorcao | null;
  restricoes: string[];
  estoque_quantidade: number | null;
  estoque_unidade: UnidadePorcao | null;
}

async function itensCatalogo(db: Db, filtro: { secoes?: string[]; ids?: string[] }): Promise<ItemCatalogo[]> {
  const { rows } = await db.query<ItemCatalogo>(
    `SELECT i.id, i.secao_id, s.nome AS secao_nome, i.nome, i.descricao, i.preco, i.custo_unitario, i.porcao_qtd, i.porcao_unidade, i.restricoes,
            CASE WHEN est.ativo THEN est.quantidade END AS estoque_quantidade, est.unidade AS estoque_unidade
       FROM catalogo_itens i JOIN catalogo_secoes s ON s.id = i.secao_id
       LEFT JOIN estoque_itens est ON est.catalogo_item_id = i.id
      WHERE i.ativo AND (i.secao_id = ANY($1::uuid[]) OR i.id = ANY($2::uuid[]))
      ORDER BY s.ordem, i.ordem`,
    [filtro.secoes ?? [], (filtro.ids ?? []).filter((id) => /^[0-9a-f-]{36}$/i.test(id))]
  );
  const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return rows.map((r) => ({ ...r, preco: n(r.preco), custo_unitario: n(r.custo_unitario), porcao_qtd: n(r.porcao_qtd), estoque_quantidade: n(r.estoque_quantidade) }));
}

const descreverItem = (i: { nome: string; custo_unitario?: number | null; preco?: number | null; porcao_qtd?: number | null; porcao_unidade?: UnidadePorcao | null; restricoes: string[] }) =>
  [
    i.nome,
    `custo/porção ${i.custo_unitario == null ? 'sem custo' : formatMoney(i.custo_unitario)}`,
    i.preco != null ? `preço ${formatMoney(i.preco)}` : null,
    i.porcao_qtd != null ? `porção ${formatarQuantidade(i.porcao_qtd, i.porcao_unidade ?? null)}` : null,
    i.restricoes.length ? `restrições: ${i.restricoes.map((r) => NOMES_RESTRICOES[r] ?? r).join(', ')}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

// ---------------------------------------------------------------------------
// Contexto e análise
// ---------------------------------------------------------------------------
export interface SugestaoGiro {
  incluir_item_id: string;
  incluir_nome: string;
  secao_nome: string;
  aproveita: string;
  motivo: string;
  impacto_custo: number | null;
  aplicavel: boolean;
}

export interface SugestaoTroca {
  remover_item_id: string;
  remover_nome: string;
  incluir_item_id: string;
  incluir_nome: string;
  secao_nome: string;
  justificativa: string;
  equivalencia: string;
  /** Variação no custo do evento (negativa = economia) */
  impacto_custo: number | null;
  aplicavel: boolean;
}

export interface AnaliseCardapio {
  resumo: string;
  giro_estoque: SugestaoGiro[];
  substituicoes: SugestaoTroca[];
  alertas: string[];
  margem: { receita: number; custo: number; margem_pct: number | null };
  convidados: number;
}

interface RespostaIa {
  resumo: string;
  giro_estoque: { incluir_item_id: string; aproveita: string; motivo: string }[];
  substituicoes: { remover_item_id: string; incluir_item_id: string; justificativa: string; equivalencia: string }[];
  alertas: string[];
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['resumo', 'giro_estoque', 'substituicoes', 'alertas'],
  properties: {
    resumo: { type: 'string', description: 'Leitura da margem e do cardápio em 2 a 3 frases.' },
    giro_estoque: {
      type: 'array',
      description: 'Itens do catálogo para incluir no cardápio que aproveitam estoque parado ou com validade próxima (até 4).',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['incluir_item_id', 'aproveita', 'motivo'],
        properties: {
          incluir_item_id: { type: 'string', description: 'id exato de um item listado em "Alternativas do catálogo".' },
          aproveita: { type: 'string', description: 'Item de estoque aproveitado.' },
          motivo: { type: 'string' },
        },
      },
    },
    substituicoes: {
      type: 'array',
      description: 'Trocas de um item selecionado por uma alternativa da mesma seção, com custo menor e equivalência gastronômica (até 5).',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['remover_item_id', 'incluir_item_id', 'justificativa', 'equivalencia'],
        properties: {
          remover_item_id: { type: 'string', description: 'id exato de um item em "Cardápio atual".' },
          incluir_item_id: { type: 'string', description: 'id exato de uma alternativa da mesma seção do catálogo.' },
          justificativa: { type: 'string' },
          equivalencia: { type: 'string', description: 'Por que a troca mantém o padrão gastronômico e respeita restrições do evento.' },
        },
      },
    },
    alertas: { type: 'array', items: { type: 'string' }, description: 'Riscos de margem ou de execução (ex.: itens sem custo, insumo caro, restrição não atendida).' },
  },
} as const;

const SISTEMA = [
  'Você é um chef consultor e controller de custos de buffets no Brasil.',
  'Sugira mudanças no cardápio de um evento para proteger a margem e dar vazão a insumos parados ou perto do vencimento,',
  'mantendo o padrão gastronômico, o formato de serviço e as restrições alimentares do evento.',
  'Use somente ids que aparecem no contexto. Troque apenas itens da mesma seção.',
  'Substituições só entre itens com custo cadastrado e quando a alternativa custa menos; nunca afirme ganho de margem sem custo.',
  'Itens sem custo cadastrado devem aparecer em "alertas"; um item só está sem custo quando o contexto diz "sem custo".',
  'Giro de estoque só com os itens listados em "Estoque com validade próxima ou parado" (campo "aproveita" exatamente com o nome listado).',
  'Nos textos (resumo, motivo, justificativa, equivalência, alertas) cite os itens pelo nome; nunca escreva ids.',
  'Se não houver boa sugestão, devolva a lista vazia.',
  AVISO_DADOS,
].join(' ');

async function montarContexto(db: Db, eventoId: string, numero: number) {
  const evento = await carregarEvento(db, eventoId);
  const versao = await carregarVersao(db, eventoId, numero);
  const c = versao.conteudo;
  const margem = calcularMargem(c);
  const secoesIds = [...new Set(c.cardapios.flatMap((x) => x.secoes.map((s) => s.secao_id)).filter((x): x is string => Boolean(x)))];
  const catalogo = await itensCatalogo(db, { secoes: secoesIds });
  const selecionados = new Set(c.cardapios.flatMap((x) => x.secoes.flatMap((s) => s.itens.filter((i) => i.selecionado).map((i) => i.item_id))));
  const alertas = await alertasEstoque(db);
  const ligados = new Map((await itensCatalogo(db, { ids: alertas.map((a) => a.catalogo_item_id).filter((x): x is string => Boolean(x)) })).map((i) => [i.id, i]));

  const linhas: string[] = [
    `# Otimização de margem: ${evento.titulo ?? 'Evento'} (versão ${String(numero).padStart(2, '0')})`,
    `Gerado em ${dataBr(new Date())}.`,
    '',
    '## Evento',
    `- Convidados: ${c.pagantes.convidados} · Formato de serviço: ${evento.formato_nome ?? '—'} · Ocasião: ${evento.categoria_nome ?? '—'}`,
    `- Estilo gastronômico: ${[evento.estilo_principal, evento.estilo_secundario].filter(Boolean).join(' / ') || '—'}`,
    `- Restrições alimentares do evento: ${evento.restricoes.map((r) => NOMES_RESTRICOES[r] ?? r).join(', ') || 'nenhuma'}`,
    '',
    '## Margem atual (alimentos e bebidas)',
    `- Receita: ${formatMoney(margem.receita)} · Custo dos insumos: ${formatMoney(margem.custo)} · Margem: ${margem.margem_pct === null ? '—' : `${margem.margem_pct}%`}`,
    `- Custo por convidado: ${formatMoney(margem.custo_por_convidado)}`,
    margem.sem_custo.length ? `- Itens sem custo cadastrado (margem superestimada): ${margem.sem_custo.join(', ')}` : '- Todos os itens têm custo cadastrado.',
    '',
    '## Cardápio atual (itens selecionados)',
  ];
  for (const card of c.cardapios) {
    linhas.push(`### ${card.nome}${card.preco_base ? ` (preço base ${formatMoney(card.preco_base)}/pessoa)` : ''}`);
    for (const s of card.secoes) {
      const itens = s.itens.filter((i) => i.selecionado);
      if (!itens.length) continue;
      linhas.push(`- Seção "${s.nome}"${s.escolha_qtd ? ` (cliente escolhe ${s.escolha_qtd})` : ''}:`);
      for (const i of itens) linhas.push(`  - [id ${i.item_id ?? 'personalizado'}] ${descreverItem({ ...i, preco: i.preco_manual ?? i.preco_catalogo })}`);
    }
  }
  if (c.bebidas.length) linhas.push('- Bebidas: ' + c.bebidas.map((b) => `${b.nome} (custo ${b.custo_unitario == null ? 'sem custo' : formatMoney(b.custo_unitario)})`).join('; '));
  linhas.push('', '## Alternativas do catálogo (mesmas seções, não selecionadas)');
  const porSecao = new Map<string, ItemCatalogo[]>();
  for (const i of catalogo) if (!selecionados.has(i.id)) porSecao.set(i.secao_nome, [...(porSecao.get(i.secao_nome) ?? []), i]);
  if (!porSecao.size) linhas.push('(nenhuma alternativa ativa nas seções do cardápio)');
  for (const [secao, itens] of porSecao) {
    linhas.push(`- Seção "${secao}":`);
    for (const i of itens) {
      const est = i.estoque_quantidade != null ? ` · em estoque: ${formatarQuantidade(i.estoque_quantidade, i.estoque_unidade)}` : '';
      linhas.push(`  - [id ${i.id}] ${descreverItem(i)}${est}${i.descricao ? ` — ${trecho(i.descricao, 160)}` : ''}`);
    }
  }
  linhas.push('', `## Estoque com validade próxima (até ${DIAS_VALIDADE} dias) ou parado (${DIAS_PARADO}+ dias sem saída)`);
  if (!alertas.length) linhas.push('(nenhum alerta de estoque)');
  for (const a of alertas) {
    linhas.push(
      `- ${a.nome}: ${formatarQuantidade(a.quantidade, a.unidade)}${a.custo_unitario != null ? ` · custo ${formatMoney(a.custo_unitario)}/${a.unidade}` : ''}` +
        `${a.validade ? ` · vence em ${a.dias_para_vencer} dias` : ''} · ${a.dias_sem_saida} dias sem saída` +
        (a.catalogo_item_id && ligados.get(a.catalogo_item_id)
          ? ` · é o próprio item do cardápio "${ligados.get(a.catalogo_item_id)!.nome}" (seção ${ligados.get(a.catalogo_item_id)!.secao_nome}, ${descreverItem(ligados.get(a.catalogo_item_id)!)}) — para incluí-lo use [id ${a.catalogo_item_id}]`
          : '')
    );
  }
  // Nomes dos itens citados (para trocar ids que escaparem nos textos da IA)
  const nomes = new Map<string, string>();
  for (const i of catalogo) nomes.set(i.id, i.nome);
  for (const i of ligados.values()) nomes.set(i.id, i.nome);
  for (const card of c.cardapios) for (const s of card.secoes) for (const i of s.itens) if (i.item_id) nomes.set(i.item_id, i.nome);
  return { contexto: linhas.join('\n').slice(0, 60_000), versao, margem, evento, alertas, nomes };
}

/** Item de catálogo no formato do orçamento (com ou sem preço próprio, como os vizinhos da seção). */
function itemDoCatalogo(i: ItemCatalogo, comPreco: boolean): ItemOrcamento {
  return {
    key: novaChave('i'), item_id: i.id, nome: i.nome, descricao: i.descricao, selecionado: true,
    preco_catalogo: comPreco ? i.preco : null, preco_manual: null, restricoes: i.restricoes ?? [],
    porcao_qtd: i.porcao_qtd, porcao_unidade: i.porcao_unidade, custo_unitario: i.custo_unitario,
  };
}

/** Onde o item entra numa inclusão: primeira seção do orçamento ligada à mesma seção do catálogo. */
function secaoDestino(c: ConteudoOrcamento, secaoId: string) {
  for (const card of c.cardapios) for (const s of card.secoes) if (s.secao_id === secaoId) return { card, secao: s };
  return null;
}

const UUID = /\[?\s*(?:id\s*[:=]?\s*)?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s*\]?/gi;

/** Troca ids que a IA deixar escapar no texto pelo nome do item (ou remove, se desconhecido). */
export function semIds(texto: string, nomes: Map<string, string>): string {
  return texto
    .replace(UUID, (_, id: string) => {
      const nome = nomes.get(id.toLowerCase());
      return nome ? ` "${nome}" ` : ' ';
    })
    .replace(/"([^"]+)"\s+\1/g, '"$1"')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:!?)])/g, '$1')
    .trim();
}

export async function analisarCardapio(db: Db, user: SessionUser, eventoId: string, numero: number): Promise<string> {
  conferirLimiteIa(user.tenantId);
  const { contexto, versao, margem, alertas, nomes } = await montarContexto(db, eventoId, numero);
  const c = versao.conteudo;
  if (!c.cardapios.some((x) => x.secoes.some((s) => s.itens.some((i) => i.selecionado)))) {
    throw new UserError('Monte o cardápio do orçamento antes de pedir sugestões.');
  }
  // "aproveita" só aceita itens reais do estoque com alerta (sem alertas, o giro fica vazio)
  const nomesEstoque = alertas.map((a) => a.nome);
  const schema = structuredClone(SCHEMA) as unknown as { properties: { giro_estoque: { maxItems?: number; items: { properties: { aproveita: Record<string, unknown> } } } } };
  schema.properties.giro_estoque.items.properties.aproveita = nomesEstoque.length
    ? { type: 'string', enum: nomesEstoque, description: 'Nome exato de um item de estoque com alerta.' }
    : { type: 'string', enum: ['nenhum'], description: 'Não há estoque com alerta: devolva giro_estoque vazio.' };
  const r = await openAiJson<RespostaIa>({
    sistema: SISTEMA,
    usuario: `Contexto (markdown):\n\n${contexto}`,
    nomeSchema: 'otimizacao_cardapio',
    schema: schema as unknown as Record<string, unknown>,
    timeoutMs: 55_000,
  });
  const limpar = (t: string) => semIds(t, nomes);

  // Confere os ids e calcula o impacto no custo (custo por porção × convidados)
  const ids = [...r.giro_estoque.map((g) => g.incluir_item_id), ...r.substituicoes.flatMap((s) => [s.incluir_item_id, s.remover_item_id])];
  const catalogo = new Map((await itensCatalogo(db, { ids })).map((i) => [i.id, i]));
  const convidados = c.pagantes.convidados;
  const noOrcamento = new Map<string, ItemOrcamento>();
  for (const card of c.cardapios) for (const s of card.secoes) for (const i of s.itens) if (i.item_id && i.selecionado) noOrcamento.set(i.item_id, i);
  const custoEvento = (custo: number | null | undefined) => (custo == null ? null : custo * convidados);

  const substituicoes: SugestaoTroca[] = r.substituicoes.flatMap((s) => {
    const sai = noOrcamento.get(s.remover_item_id);
    const entra = catalogo.get(s.incluir_item_id);
    const origem = catalogo.get(s.remover_item_id);
    if (!sai || !entra || s.remover_item_id === s.incluir_item_id) return [];
    if (origem && origem.secao_id !== entra.secao_id) return [];
    const antes = custoEvento(sai.custo_unitario);
    const depois = custoEvento(entra.custo_unitario);
    // "Maior margem" só com os dois custos conhecidos e a troca reduzindo o custo do evento
    if (antes === null || depois === null || depois >= antes) return [];
    return [{
      remover_item_id: s.remover_item_id, remover_nome: sai.nome, incluir_item_id: entra.id, incluir_nome: entra.nome, secao_nome: entra.secao_nome,
      justificativa: limpar(s.justificativa), equivalencia: limpar(s.equivalencia),
      impacto_custo: antes === null || depois === null ? null : Math.round((depois - antes) * 100) / 100,
      aplicavel: !versao.congelada && !noOrcamento.has(entra.id),
    }];
  });
  const giro: SugestaoGiro[] = r.giro_estoque.flatMap((g) => {
    const entra = catalogo.get(g.incluir_item_id);
    if (!entra || noOrcamento.has(entra.id) || !nomesEstoque.includes(g.aproveita)) return [];
    return [{
      incluir_item_id: entra.id, incluir_nome: entra.nome, secao_nome: entra.secao_nome, aproveita: g.aproveita, motivo: limpar(g.motivo),
      impacto_custo: custoEvento(entra.custo_unitario), aplicavel: !versao.congelada && secaoDestino(c, entra.secao_id) !== null,
    }];
  });

  const resultado: AnaliseCardapio = {
    resumo: limpar(r.resumo), giro_estoque: giro, substituicoes, alertas: r.alertas.map(limpar).filter(Boolean),
    margem: { receita: margem.receita, custo: margem.custo, margem_pct: margem.margem_pct }, convidados,
  };
  return guardarAnalise(db, user, eventoId, { tipo: 'cardapio', versao: numero, contexto, resultado, modelo: modeloTexto() });
}

/**
 * Aplica uma sugestão na versão em edição: troca (o item sai e o novo entra no mesmo lugar) ou inclusão
 * (na seção do orçamento ligada à mesma seção do catálogo). Grava pelo salvarVersao (recalcula tudo).
 */
export async function aplicarSugestao(
  db: Db,
  user: SessionUser,
  eventoId: string,
  numero: number,
  pedido: { incluirId: string; removerId: string | null }
): Promise<string> {
  const versao = await carregarVersao(db, eventoId, numero);
  if (versao.congelada) throw new UserError('Esta versão está congelada. Aplique as sugestões na versão em edição.');
  const [entra] = await itensCatalogo(db, { ids: [pedido.incluirId] });
  if (!entra) throw new UserError('O item sugerido não está mais ativo no catálogo.');
  const c = versao.conteudo;
  const jaTem = c.cardapios.some((x) => x.secoes.some((s) => s.itens.some((i) => i.item_id === entra.id && i.selecionado)));
  if (jaTem) throw new UserError(`"${entra.nome}" já está no cardápio.`);

  let descricao: string;
  let cardapios = c.cardapios;
  if (pedido.removerId) {
    let achou = false;
    let nomeSai = '';
    cardapios = c.cardapios.map((card) => ({
      ...card,
      secoes: card.secoes.map((s) => ({
        ...s,
        itens: s.itens
          // Uma cópia desmarcada do item que entra (alternativa já listada na seção) dá lugar à troca
          .filter((i) => !(i.item_id === entra.id && !i.selecionado && s.itens.some((x) => x.item_id === pedido.removerId && x.selecionado)))
          .map((i) => {
            if (achou || i.item_id !== pedido.removerId || !i.selecionado) return i;
            achou = true;
            nomeSai = i.nome;
            return itemDoCatalogo(entra, i.preco_catalogo !== null);
          }),
      })),
    }));
    if (!achou) throw new UserError('O item a substituir não está mais no cardápio.');
    descricao = `Sugestão da IA aplicada (versão ${String(numero).padStart(2, '0')}): "${nomeSai}" trocado por "${entra.nome}"`;
  } else {
    const destino = secaoDestino(c, entra.secao_id);
    if (!destino) throw new UserError(`O cardápio não tem a seção "${entra.secao_nome}" para incluir o item.`);
    const comPreco = destino.secao.itens.some((i) => i.preco_catalogo !== null) || (destino.secao.preco_catalogo === null && destino.secao.itens.length === 0);
    cardapios = c.cardapios.map((card) =>
      card.key !== destino.card.key
        ? card
        : { ...card, secoes: card.secoes.map((s) => (s.key === destino.secao.key ? { ...s, itens: [...s.itens, itemDoCatalogo(entra, comPreco)] } : s)) }
    );
    descricao = `Sugestão da IA aplicada (versão ${String(numero).padStart(2, '0')}): "${entra.nome}" incluído em "${destino.secao.nome}"`;
  }
  await salvarVersao(db, user, eventoId, numero, { cardapios });
  await registrarTimeline(db, { tenantId: user.tenantId, eventoId, usuarioId: user.id }, 'editado', descricao, { ia: true, incluir: entra.id, remover: pedido.removerId });
  return descricao.replace(/^Sugestão da IA aplicada \(versão \d+\): /, '');
}
