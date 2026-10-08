// Orçamento versionado do evento: criação, versões congeladas, salvamento com recálculo no servidor.
import { z } from 'zod';
import type { Db } from '../lib/db';
import type { SessionUser } from '../lib/auth';
import { UserError } from '../lib/forms';
import { dataCurta, faixaHorario, horasTexto } from '../lib/datas';
import { espacosParaSelecao, referenciasLocacao } from './espacos';
import { estoqueParaLista } from './estoque';
import { situacaoEstoque, type SituacaoEstoque } from '../lib/calculo/estoque';
import { carregarEvento, type EventoDetalhe } from './eventos';
import { registrarTimeline } from './timeline';
import {
  NOMES_RESTRICOES,
  UNIDADES_PORCAO,
  calcularOrcamento,
  novaChave,
  type BlocoInfo,
  type Cabecalho,
  type ConteudoOrcamento,
  type EspacoRef,
  type ReferenciasLocacao,
  type UnidadePorcao,
} from '../lib/calculo/orcamento';

// ---------------------------------------------------------------------------
// Validação/normalização do conteúdo (aceita conteúdo antigo ou parcial, preenchendo padrões)
// ---------------------------------------------------------------------------
const num = z.coerce.number().finite();
const numNull = z.preprocess((v) => (v === '' || v === undefined ? null : v), num.nullable()).default(null);
const chave = z.string().min(1).max(64).default(() => novaChave());
const texto = (max = 500) => z.string().max(max).nullable().default(null);
const unidadePorcao = z.enum(Object.keys(UNIDADES_PORCAO) as [UnidadePorcao, ...UnidadePorcao[]]).nullable().default(null);

const itemSchema = z.object({
  key: chave,
  item_id: z.string().nullable().default(null),
  nome: z.string().max(300),
  descricao: texto(2000),
  selecionado: z.boolean().default(true),
  preco_catalogo: numNull,
  preco_manual: numNull,
  restricoes: z.array(z.string().max(40)).default([]),
  porcao_qtd: numNull,
  porcao_unidade: unidadePorcao,
  custo_unitario: numNull,
});

const secaoSchema = z.object({
  key: chave,
  secao_id: z.string().nullable().default(null),
  nome: z.string().max(200),
  escolha_qtd: z.preprocess((v) => (v === '' ? null : v), z.coerce.number().int().positive().nullable()).default(null),
  preco_catalogo: numNull,
  preco_manual: numNull,
  itens: z.array(itemSchema).default([]),
});

const regraSchema = z.object({
  cache_diaria: num.default(0),
  auxilio: num.default(0),
  por_evento: z.boolean().default(false),
  quantidade_fixa: z.coerce.number().int().positive().default(1),
  convidados_por_profissional: z.coerce.number().int().positive().nullable().default(null),
  minimo: z.coerce.number().int().min(0).default(0),
});

const blocoSchema = z.object({
  key: chave,
  titulo: z.string().max(200),
  auto: z.string().max(60).nullable().default(null),
  linhas: z
    .array(
      z.object({
        key: chave,
        label: z.string().max(200),
        valor: z.string().max(2000).default(''),
        auto: z.string().max(60).nullable().default(null),
      })
    )
    .default([]),
});

export const conteudoSchema = z.object({
  cabecalho: z
    .object({
      evento: z.string().default(''),
      cliente: texto(),
      contato: texto(),
      telefone: texto(),
      data_evento: texto(),
      horario: texto(),
      local: texto(),
      formato_servico: texto(),
      duracao_evento: texto(),
      duracao_alimentacao: texto(),
    })
    .default({
      evento: '', cliente: null, contato: null, telefone: null, data_evento: null, horario: null, local: null,
      formato_servico: null, duracao_evento: null, duracao_alimentacao: null,
    }),
  pagantes: z
    .object({
      convidados: z.coerce.number().int().min(0).default(0),
      criancas_meia: z.coerce.number().int().min(0).default(0),
      criancas_isentas: z.coerce.number().int().min(0).default(0),
    })
    .default({ convidados: 0, criancas_meia: 0, criancas_isentas: 0 })
    .refine((p) => p.criancas_meia + p.criancas_isentas <= p.convidados, {
      message: 'O número de crianças não pode passar o total de convidados.',
    }),
  cardapios: z
    .array(
      z.object({
        key: chave,
        opcao_id: z.string().nullable().default(null),
        nome: z.string().max(200),
        preco_base: numNull,
        preco_pp_manual: numNull,
        subtotal_manual: numNull,
        secoes: z.array(secaoSchema).default([]),
      })
    )
    .default([]),
  bebidas: z
    .array(
      z.object({
        key: chave,
        ref_id: z.string().nullable().default(null),
        nome: z.string().max(300),
        descricao: texto(2000),
        unidade: z.enum(['pessoa', 'unidade']).default('pessoa'),
        quantidade: z.coerce.number().min(0).default(0),
        preco_catalogo: numNull,
        preco_manual: numNull,
        subtotal_manual: numNull,
        porcao_qtd: numNull,
        porcao_unidade: unidadePorcao,
        custo_unitario: numNull,
      })
    )
    .default([]),
  staff: z
    .array(
      z.object({
        key: chave,
        servico_id: z.string().nullable().default(null),
        funcao: z.string().max(120),
        regra: regraSchema,
        quantidade_manual: z.preprocess((v) => (v === '' ? null : v), z.coerce.number().int().min(0).nullable()).default(null),
        valor_unit_manual: numNull,
      })
    )
    .default([]),
  locacao: z
    .object({
      incluir: z.boolean().default(false),
      espaco_id: z.string().nullable().default(null),
      espaco_nome: texto(120),
      faixa_id: z.string().nullable().default(null),
      descricao: texto(),
      // Guardado para versões congeladas (recalculadas sem as referências de locação)
      valor_calc: numNull,
      valor_manual: numNull,
    })
    .default({ incluir: false, espaco_id: null, espaco_nome: null, faixa_id: null, descricao: null, valor_calc: null, valor_manual: null }),
  extras: z
    .array(
      z.object({
        key: chave,
        descricao: z.string().max(300),
        quantidade: z.coerce.number().min(0).default(1),
        valor_unit: num.default(0),
      })
    )
    .default([]),
  informacoes_complementares: z.array(blocoSchema).default([]),
  condicoes_gerais: z.array(blocoSchema).default([]),
  blocos_texto: z
    .array(
      z.object({
        key: chave,
        bloco_id: z.string().nullable().default(null),
        titulo: z.string().max(150),
        texto: z.string().max(10_000).default(''),
        pagina: z.enum(['cardapio', 'bebidas', 'staff', 'informacoes', 'condicoes']).default('informacoes'),
      })
    )
    .default([]),
  lista_compras: z
    .array(
      z.object({
        key: chave,
        ref: z.string().max(120).nullable().default(null),
        item_id: z.string().nullable().default(null),
        nome: z.string().max(300),
        grupo: texto(200),
        origem: z.enum(['cardapio', 'bebida', 'manual']).default('manual'),
        unidade: unidadePorcao,
        porcao: numNull,
        quantidade_calc: numNull,
        quantidade_manual: z.preprocess((v) => (v === '' ? null : v), num.min(0).nullable()).default(null),
        comprado: z.boolean().default(false),
        observacao: texto(500),
      })
    )
    .default([]),
  total_manual: numNull,
  mostrar_valor_total: z.boolean().default(true),
  observacoes: texto(5000),
});

export function normalizarConteudo(raw: unknown): ConteudoOrcamento {
  const res = conteudoSchema.safeParse(raw ?? {});
  if (!res.success) throw new UserError(res.error.issues[0]?.message ?? 'Conteúdo do orçamento inválido.');
  return res.data as ConteudoOrcamento;
}

// ---------------------------------------------------------------------------
// Dados de apoio
// ---------------------------------------------------------------------------
/** A versão em edição acompanha o espaço escolhido no evento (as congeladas guardam o que foi proposto). */
function sincronizarLocacaoComEvento(conteudo: ConteudoOrcamento, e: EventoDetalhe): ConteudoOrcamento {
  return { ...conteudo, locacao: { ...conteudo.locacao, espaco_id: e.espaco_id, espaco_nome: e.espaco_nome } };
}

/**
 * A versão em edição acompanha a porção por pessoa e o custo cadastrados no catálogo (itens dos cardápios e bebidas);
 * as congeladas guardam o snapshot. Itens personalizados (sem id) ficam como estão.
 */
async function sincronizarPorcoes(db: Db, conteudo: ConteudoOrcamento): Promise<ConteudoOrcamento> {
  const ids = new Set<string>();
  for (const c of conteudo.cardapios) for (const s of c.secoes) for (const i of s.itens) if (i.item_id) ids.add(i.item_id);
  for (const b of conteudo.bebidas) if (b.ref_id) ids.add(b.ref_id);
  if (!ids.size) return conteudo;
  const { rows } = await db.query<{ id: string; porcao_qtd: number | null; porcao_unidade: UnidadePorcao | null; custo_unitario: number | null }>(
    'SELECT id, porcao_qtd, porcao_unidade, custo_unitario FROM catalogo_itens WHERE id = ANY($1::uuid[])',
    [[...ids].filter((id) => /^[0-9a-f-]{36}$/i.test(id))]
  );
  const n = (v: number | null) => (v === null ? null : Number(v));
  const porcoes = new Map(rows.map((r) => [r.id, { porcao_qtd: n(r.porcao_qtd), porcao_unidade: r.porcao_unidade, custo_unitario: n(r.custo_unitario) }]));
  const aplicar = <T extends { porcao_qtd?: number | null; porcao_unidade?: UnidadePorcao | null; custo_unitario?: number | null }>(x: T, id: string | null): T =>
    id && porcoes.has(id) ? { ...x, ...porcoes.get(id)! } : x;
  return {
    ...conteudo,
    cardapios: conteudo.cardapios.map((c) => ({ ...c, secoes: c.secoes.map((s) => ({ ...s, itens: s.itens.map((i) => aplicar(i, i.item_id)) })) })),
    bebidas: conteudo.bebidas.map((b) => aplicar(b, b.ref_id)),
  };
}

export function cabecalhoDoEvento(e: EventoDetalhe): Cabecalho {
  return {
    evento: e.titulo ?? 'Evento',
    cliente: e.cliente_nome,
    contato: e.responsavel_nome ?? e.cliente_nome ?? null,
    telefone: e.responsavel_whatsapp ?? e.cliente_telefone ?? null,
    data_evento: e.data_evento ? dataCurta(e.data_evento) : null,
    horario: e.hora_inicio ? faixaHorario(e.hora_inicio, e.hora_fim) : null,
    local: e.espaco_nome ?? e.local_nome ?? null,
    formato_servico: e.formato_nome,
    duracao_evento: e.duracao_evento_horas ? horasTexto(e.duracao_evento_horas) : null,
    duracao_alimentacao: e.duracao_alimentacao_horas ? horasTexto(e.duracao_alimentacao_horas) : null,
  };
}

const POLITICA_CANCELAMENTO =
  '30 dias ou mais da data do evento: multa de 30% sobre o valor total. De 29 a 11 dias: multa de 50%. De 10 dias até o dia do evento: multa de 80%.';

async function conteudoInicial(db: Db, e: EventoDetalhe, refs: ReferenciasLocacao): Promise<ConteudoOrcamento> {
  const { rows: servicos } = await db.query(
    `SELECT id, funcao, cache_diaria, auxilio, por_evento, quantidade_fixa, convidados_por_profissional, minimo
       FROM staff_servicos WHERE ativo AND incluir_por_padrao ORDER BY ordem, lower(funcao)`
  );
  const { rows: cfg } = await db.query<{ validade_proposta_dias: number }>(
    'SELECT validade_proposta_dias FROM configuracoes_tenant'
  );
  const validade = cfg[0]?.validade_proposta_dias ?? 5;
  const { rows: blocos } = await db.query<{ id: string; titulo: string; texto: string; pagina: string }>(
    `SELECT id, titulo, texto, pagina FROM orcamento_blocos_info WHERE ativo_por_padrao
      ORDER BY array_position(ARRAY['cardapio','bebidas','staff','informacoes','condicoes']::text[], pagina), ordem`
  );

  const restricoes = e.restricoes.length ? e.restricoes : ['vegetariana', 'sem_gluten', 'vegana'];
  const linha = (label: string, valor: string, auto: string | null = null) => ({ key: novaChave('l'), label, valor, auto });

  const informacoes: BlocoInfo[] = [
    {
      key: novaChave('b'),
      titulo: 'Logística e cronograma',
      auto: null,
      linhas: [
        linha('Início do serviço', e.hora_inicio ?? ''),
        linha('Encerramento do serviço', e.hora_fim ?? ''),
        linha('Limite para desmontagem', ''),
      ],
    },
    {
      key: novaChave('b'),
      titulo: 'Restrições alimentares',
      auto: null,
      linhas: restricoes.map((r) => linha(NOMES_RESTRICOES[r] ?? r, '', `restricao:${r}`)),
    },
    {
      key: novaChave('b'),
      titulo: 'Dinâmica de serviço',
      auto: null,
      linhas: [linha('Formato de execução', e.formato_nome ?? ''), linha('Estilo de utensílios', '')],
    },
    { key: novaChave('b'), titulo: 'Dimensionamento da equipe', auto: 'staff', linhas: [] },
  ];

  const condicoes: BlocoInfo[] = [
    {
      key: novaChave('b'),
      titulo: 'Condições financeiras',
      auto: null,
      linhas: [
        linha('Forma de pagamento acordada', e.forma_pagamento ?? ''),
        linha('Prazo de validade da proposta', `${validade} dias corridos`),
        linha('Política de cancelamento', POLITICA_CANCELAMENTO),
      ],
    },
  ];

  return normalizarConteudo({
    cabecalho: cabecalhoDoEvento(e),
    pagantes: { convidados: e.numero_convidados ?? 0, criancas_meia: 0, criancas_isentas: 0 },
    staff: servicos.map((s) => ({
      key: novaChave('s'),
      servico_id: s.id,
      funcao: s.funcao,
      regra: {
        cache_diaria: Number(s.cache_diaria),
        auxilio: Number(s.auxilio),
        por_evento: s.por_evento,
        quantidade_fixa: s.quantidade_fixa,
        convidados_por_profissional: s.convidados_por_profissional,
        minimo: s.minimo,
      },
    })),
    locacao: {
      // Espaço próprio entra com a faixa; terceiro só quando tem valor de referência cadastrado
      incluir:
        e.espaco_tipo === 'proprio' ||
        (e.espaco_tipo === 'terceiro' && refs.espacos.find((x) => x.id === e.espaco_id)?.valor_referencia != null),
      espaco_id: e.espaco_id,
      espaco_nome: e.espaco_nome,
      faixa_id: null,
      descricao: null,
      valor_manual: null,
    },
    informacoes_complementares: informacoes,
    condicoes_gerais: condicoes,
    blocos_texto: blocos.map((b) => ({ key: novaChave('t'), bloco_id: b.id, titulo: b.titulo, texto: b.texto, pagina: b.pagina })),
  });
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------
export interface VersaoResumo {
  numero: number;
  valor_total: number;
  congelada: boolean;
  created_at: Date;
  updated_at: Date;
  pdf_gerado_em: Date | null;
  enviado_em: Date | null;
  enviado_para: string | null;
}

export interface OrcamentoInfo {
  id: string;
  versao_atual: number;
  template_id: string | null;
  versoes: VersaoResumo[];
}

export async function carregarOrcamento(db: Db, eventoId: string): Promise<OrcamentoInfo | null> {
  const { rows } = await db.query<{ id: string; versao_atual: number; template_id: string | null }>(
    'SELECT id, versao_atual, template_id FROM orcamentos WHERE evento_id = $1',
    [eventoId]
  );
  if (!rows[0]) return null;
  const { rows: versoes } = await db.query<VersaoResumo>(
    `SELECT numero, valor_total, congelada, created_at, updated_at, pdf_gerado_em, enviado_em, enviado_para
       FROM orcamento_versoes WHERE orcamento_id = $1 ORDER BY numero DESC`,
    [rows[0].id]
  );
  return { ...rows[0], versoes };
}

export interface Versao {
  id: string;
  numero: number;
  congelada: boolean;
  conteudo: ConteudoOrcamento;
  valor_total: number;
  updated_at: Date;
}

export async function carregarVersao(db: Db, eventoId: string, numero: number): Promise<Versao> {
  const { rows } = await db.query<{ id: string; numero: number; congelada: boolean; conteudo: unknown; valor_total: number; updated_at: Date }>(
    `SELECT v.id, v.numero, v.congelada, v.conteudo, v.valor_total, v.updated_at
       FROM orcamento_versoes v JOIN orcamentos o ON o.id = v.orcamento_id
      WHERE o.evento_id = $1 AND v.numero = $2`,
    [eventoId, numero]
  );
  const v = rows[0];
  if (!v) throw new UserError('Versão do orçamento não encontrada.');
  let conteudo = normalizarConteudo(v.conteudo);
  // A versão em edição acompanha os dados atuais do evento; as congeladas preservam o que foi proposto
  // (recalculadas sem as referências de locação, para manter o valor gravado)
  if (v.congelada) {
    conteudo = calcularOrcamento(conteudo);
  } else {
    const evento = await carregarEvento(db, eventoId);
    const pagantes =
      conteudo.pagantes.convidados === 0 && evento.numero_convidados
        ? { ...conteudo.pagantes, convidados: evento.numero_convidados }
        : conteudo.pagantes;
    conteudo = calcularOrcamento(
      await sincronizarPorcoes(db, sincronizarLocacaoComEvento({ ...conteudo, pagantes, cabecalho: cabecalhoDoEvento(evento) }, evento)),
      await referenciasLocacao(db)
    );
  }
  return { ...v, conteudo };
}

// ---------------------------------------------------------------------------
// Escrita
// ---------------------------------------------------------------------------
export async function criarOrcamento(db: Db, user: SessionUser, eventoId: string): Promise<{ statusAlterado: boolean }> {
  const existente = await carregarOrcamento(db, eventoId);
  if (existente) return { statusAlterado: false };
  const evento = await carregarEvento(db, eventoId);
  const refs = await referenciasLocacao(db);
  const conteudo = calcularOrcamento(await conteudoInicial(db, evento, refs), refs);

  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO orcamentos (tenant_id, evento_id, valor_total, versao_atual) VALUES ($1, $2, $3, 1) RETURNING id`,
    [user.tenantId, eventoId, conteudo.totais!.total]
  );
  await db.query(
    `INSERT INTO orcamento_versoes (tenant_id, orcamento_id, numero, conteudo, valor_total, criado_por)
     VALUES ($1, $2, 1, $3, $4, $5)`,
    [user.tenantId, rows[0].id, conteudo, conteudo.totais!.total, user.id]
  );
  const ctx = { tenantId: user.tenantId, eventoId, usuarioId: user.id };
  await registrarTimeline(db, ctx, 'orcamento_criado', 'Orçamento iniciado (versão 01)');

  // Evento que ainda estava na entrada passa para a primeira coluna "em andamento"
  let statusAlterado = false;
  if (evento.status_variante === 'novo') {
    const { rows: prox } = await db.query<{ id: string; nome: string }>(
      `SELECT id, nome FROM status_orcamento WHERE variante = 'negociacao' ORDER BY ordem LIMIT 1`
    );
    if (prox[0]) {
      await db.query('UPDATE eventos SET status_id = $1, updated_at = now() WHERE id = $2', [prox[0].id, eventoId]);
      await registrarTimeline(db, ctx, 'status', `Status alterado de "${evento.status_nome}" para "${prox[0].nome}"`, {
        status_id: prox[0].id,
      });
      statusAlterado = true;
    }
  }
  return { statusAlterado };
}

const PARTES_EDITAVEIS = [
  'pagantes', 'cardapios', 'bebidas', 'staff', 'locacao', 'extras', 'informacoes_complementares', 'condicoes_gerais', 'blocos_texto',
  'lista_compras', 'total_manual', 'mostrar_valor_total', 'observacoes',
] as const;

/**
 * Trocar o espaço na seção Locação do orçamento também muda o espaço do evento (o briefing e o orçamento
 * apontam sempre para o mesmo lugar). O id vem do navegador: confere no tenant antes de gravar (FK não passa pelo RLS).
 */
async function aplicarEspacoAoEvento(db: Db, user: SessionUser, evento: EventoDetalhe, espacoId: string | null) {
  let nome: string | null = null;
  let tipo: 'casa' | 'externo' = 'externo';
  let endereco: string | null = null;
  if (espacoId) {
    const { rows } = await db.query<{ nome: string; tipo: 'proprio' | 'terceiro'; endereco: string | null }>(
      'SELECT nome, tipo, endereco FROM espacos WHERE id = $1',
      [espacoId]
    );
    if (!rows[0]) throw new UserError('Espaço não encontrado.');
    nome = rows[0].nome;
    tipo = rows[0].tipo === 'proprio' ? 'casa' : 'externo';
    endereco = rows[0].endereco;
  }
  await db.query(
    `UPDATE eventos SET espaco_id = $2, local_tipo = $3, local_nome = COALESCE($4, local_nome),
            endereco = COALESCE($5, endereco), updated_at = now()
      WHERE id = $1`,
    [evento.id, espacoId, tipo, nome, endereco]
  );
  await registrarTimeline(
    db,
    { tenantId: user.tenantId, eventoId: evento.id, usuarioId: user.id },
    'editado',
    `Espaço do evento alterado para "${nome ?? 'outro local'}" pelo orçamento`,
    { espaco_id: espacoId, anterior: evento.espaco_nome }
  );
}

/** Salva (parcialmente) a versão em edição e devolve o conteúdo recalculado. */
export async function salvarVersao(
  db: Db,
  user: SessionUser,
  eventoId: string,
  numero: number,
  parcial: Record<string, unknown>
): Promise<ConteudoOrcamento> {
  const { rows } = await db.query<{ id: string; orcamento_id: string; congelada: boolean; conteudo: unknown; versao_atual: number }>(
    `SELECT v.id, v.orcamento_id, v.congelada, v.conteudo, o.versao_atual
       FROM orcamento_versoes v JOIN orcamentos o ON o.id = v.orcamento_id
      WHERE o.evento_id = $1 AND v.numero = $2
      FOR UPDATE OF v`,
    [eventoId, numero]
  );
  const v = rows[0];
  if (!v) throw new UserError('Versão do orçamento não encontrada.');
  if (v.congelada) throw new UserError('Esta versão está congelada. Crie uma nova versão para alterar a proposta.');

  const atual = normalizarConteudo(v.conteudo);
  const mesclado: Record<string, unknown> = { ...atual };
  for (const parte of PARTES_EDITAVEIS) if (parte in parcial) mesclado[parte] = parcial[parte];

  let evento = await carregarEvento(db, eventoId);
  const normalizado = normalizarConteudo(mesclado);
  if ('locacao' in parcial && (normalizado.locacao.espaco_id ?? null) !== (evento.espaco_id ?? null)) {
    await aplicarEspacoAoEvento(db, user, evento, normalizado.locacao.espaco_id ?? null);
    evento = await carregarEvento(db, eventoId);
  }
  const conteudo = calcularOrcamento(
    await sincronizarPorcoes(db, sincronizarLocacaoComEvento({ ...normalizado, cabecalho: cabecalhoDoEvento(evento) }, evento)),
    await referenciasLocacao(db)
  );
  const total = conteudo.totais!.total;
  await db.query('UPDATE orcamento_versoes SET conteudo = $1, valor_total = $2, updated_at = now() WHERE id = $3', [
    conteudo,
    total,
    v.id,
  ]);
  if (v.versao_atual === numero) {
    await db.query('UPDATE orcamentos SET valor_total = $1, updated_at = now() WHERE id = $2', [total, v.orcamento_id]);
  }
  return conteudo;
}

/**
 * Cria uma nova versão a partir da versão informada (padrão: a atual), congelando a que estava aberta.
 * Usado tanto para "Criar nova versão" quanto para "restaurar" uma versão antiga como nova.
 */
export async function criarNovaVersao(
  db: Db,
  user: SessionUser,
  eventoId: string,
  baseNumero?: number,
  motivo: 'manual' | 'envio' = 'manual'
): Promise<number> {
  const orc = await carregarOrcamento(db, eventoId);
  if (!orc) throw new UserError('Este evento ainda não tem orçamento.');
  const base = baseNumero ?? orc.versao_atual;
  const { rows } = await db.query<{ conteudo: unknown }>(
    'SELECT conteudo FROM orcamento_versoes WHERE orcamento_id = $1 AND numero = $2',
    [orc.id, base]
  );
  if (!rows[0]) throw new UserError('Versão de origem não encontrada.');

  const evento = await carregarEvento(db, eventoId);
  const conteudo = calcularOrcamento(
    await sincronizarPorcoes(db, sincronizarLocacaoComEvento({ ...normalizarConteudo(rows[0].conteudo), cabecalho: cabecalhoDoEvento(evento) }, evento)),
    await referenciasLocacao(db)
  );
  const numero = Math.max(...orc.versoes.map((v) => v.numero)) + 1;

  // Congela a versão atual antes de abrir a próxima (índice garante uma única aberta)
  await db.query('UPDATE orcamento_versoes SET congelada = true WHERE orcamento_id = $1 AND NOT congelada', [orc.id]);
  await db.query(
    `INSERT INTO orcamento_versoes (tenant_id, orcamento_id, numero, conteudo, valor_total, criado_por)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [user.tenantId, orc.id, numero, conteudo, conteudo.totais!.total, user.id]
  );
  await db.query('UPDATE orcamentos SET versao_atual = $1, valor_total = $2, updated_at = now() WHERE id = $3', [
    numero,
    conteudo.totais!.total,
    orc.id,
  ]);
  const pad = (n: number) => String(n).padStart(2, '0');
  await registrarTimeline(
    db,
    { tenantId: user.tenantId, eventoId, usuarioId: user.id },
    'orcamento_versao',
    motivo === 'envio'
      ? `Versão ${pad(base)} congelada após o envio ao cliente; ajustes seguem na versão ${pad(numero)}`
      : base === orc.versao_atual
        ? `Nova versão do orçamento criada (versão ${pad(numero)}); versão ${pad(base)} congelada`
        : `Versão ${pad(base)} restaurada como nova versão (${pad(numero)})`
  );
  return numero;
}

// ---------------------------------------------------------------------------
// Catálogo e regras para o construtor
// ---------------------------------------------------------------------------
export interface CatalogoConstrutor {
  secoes: {
    id: string;
    nome: string;
    descricao: string | null;
    preco: number | null;
    unidade: 'pessoa' | 'unidade';
    bebida: boolean;
    itens: {
      id: string;
      nome: string;
      descricao: string | null;
      preco: number | null;
      unidade: 'pessoa' | 'unidade';
      restricoes: string[];
      porcao_qtd: number | null;
      porcao_unidade: UnidadePorcao | null;
      custo_unitario: number | null;
    }[];
  }[];
  opcoes: {
    id: string;
    nome: string;
    preco_por_pessoa: number | null;
    secoes: { secao_id: string; titulo: string | null; escolha_qtd: number | null; preco: number | null; itens: string[] }[];
  }[];
  servicos: { id: string; funcao: string; regra: z.infer<typeof regraSchema> }[];
}

export async function catalogoConstrutor(db: Db): Promise<CatalogoConstrutor> {
  const { rows: secoes } = await db.query(
    `SELECT s.id, s.nome, s.descricao, s.preco, s.unidade_cobranca AS unidade,
            bool_or(ci.nome = 'Bebida') AS bebida,
            COALESCE(json_agg(json_build_object(
              'id', i.id, 'nome', i.nome, 'descricao', i.descricao, 'preco', i.preco,
              'unidade', i.unidade_cobranca, 'restricoes', i.restricoes,
              'porcao_qtd', i.porcao_qtd, 'porcao_unidade', i.porcao_unidade, 'custo_unitario', i.custo_unitario
            ) ORDER BY i.ordem, lower(i.nome)) FILTER (WHERE i.id IS NOT NULL AND i.ativo), '[]') AS itens
       FROM catalogo_secoes s
       LEFT JOIN catalogo_itens i ON i.secao_id = s.id
       LEFT JOIN categorias_item ci ON ci.id = i.categoria_principal_id
      GROUP BY s.id ORDER BY s.ordem, lower(s.nome)`
  );
  const { rows: opcoes } = await db.query(
    `SELECT o.id, o.nome, o.preco_por_pessoa,
            COALESCE((SELECT json_agg(json_build_object(
                        'secao_id', os.secao_id, 'titulo', os.titulo, 'escolha_qtd', os.escolha_qtd, 'preco', os.preco,
                        'itens', COALESCE((SELECT json_agg(oi.item_id ORDER BY oi.ordem) FROM cardapio_opcao_itens oi
                                            WHERE oi.opcao_secao_id = os.id), '[]'))
                      ORDER BY os.ordem)
                        FROM cardapio_opcao_secoes os WHERE os.opcao_id = o.id), '[]') AS secoes
       FROM cardapio_opcoes o WHERE o.ativo ORDER BY lower(o.nome)`
  );
  const { rows: servicos } = await db.query(
    `SELECT id, funcao, cache_diaria, auxilio, por_evento, quantidade_fixa, convidados_por_profissional, minimo
       FROM staff_servicos WHERE ativo ORDER BY ordem, lower(funcao)`
  );
  const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return {
    secoes: secoes.map((s) => ({
      ...s,
      bebida: Boolean(s.bebida),
      preco: n(s.preco),
      itens: s.itens.map((i: { preco: unknown; porcao_qtd: unknown; custo_unitario: unknown }) => ({
        ...i, preco: n(i.preco), porcao_qtd: n(i.porcao_qtd), custo_unitario: n(i.custo_unitario),
      })),
    })),
    opcoes: opcoes.map((o) => ({
      ...o,
      preco_por_pessoa: n(o.preco_por_pessoa),
      secoes: o.secoes.map((s: { preco: unknown }) => ({ ...s, preco: n(s.preco) })),
    })),
    servicos: servicos.map((s) => ({
      id: s.id,
      funcao: s.funcao,
      regra: {
        cache_diaria: Number(s.cache_diaria),
        auxilio: Number(s.auxilio),
        por_evento: s.por_evento,
        quantidade_fixa: s.quantidade_fixa,
        convidados_por_profissional: s.convidados_por_profissional,
        minimo: s.minimo,
      },
    })),
  };
}

// ---------------------------------------------------------------------------
// Contexto das abas do orçamento (Orçamento, Informações complementares, Condições gerais)
// ---------------------------------------------------------------------------
export async function contextoOrcamento(db: Db, eventoId: string, versaoParam: string | null) {
  const evento = await carregarEvento(db, eventoId);
  const orcamento = await carregarOrcamento(db, eventoId);
  const vazio = { espacos: [] as EspacoRef[], faixas: [] } as ReferenciasLocacao;
  if (!orcamento) return { evento, orcamento: null, versao: null, refs: vazio, espacos: [] as EspacoRef[] };
  const pedida = Number.parseInt(versaoParam ?? '', 10);
  const numero = orcamento.versoes.some((v) => v.numero === pedida) ? pedida : orcamento.versao_atual;
  const versao = await carregarVersao(db, eventoId, numero);
  // Espaços para o select da seção Locação: ativos mais o que a versão já usa (mesmo inativo)
  const [refs, espacos] = await Promise.all([referenciasLocacao(db), espacosParaSelecao(db, versao.conteudo.locacao.espaco_id)]);
  return { evento, orcamento, versao, refs, espacos };
}

/** Lista de compras da versão em CSV (";" e BOM para o Excel em português). */
export async function exportarListaComprasCsv(db: Db, eventoId: string, versaoParam: string | null): Promise<{ csv: string; numero: number }> {
  const { versao } = await contextoOrcamento(db, eventoId, versaoParam);
  if (!versao) throw new UserError('Este evento ainda não tem orçamento.');
  const celula = (v: string | number | null | undefined) => {
    const t = v === null || v === undefined ? '' : String(v);
    return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const numero = (v: number | null) => (v === null ? '' : String(v).replace('.', ','));
  const estoque = await estoqueParaLista(db);
  const linhas = [
    ['Item', 'Origem', 'Porção por pessoa', 'Quantidade calculada', 'Quantidade', 'Unidade', 'Comprado', 'Estoque', 'Observação'],
    ...versao.conteudo.lista_compras.map((l) => [
      l.nome,
      l.origem === 'manual' ? 'Avulso' : (l.grupo ?? ''),
      numero(l.porcao),
      numero(l.quantidade_calc),
      numero(l.quantidade_manual ?? l.quantidade_calc),
      l.unidade ?? '',
      l.comprado ? 'Sim' : 'Não',
      textoEstoque(situacaoEstoque(l, estoque), l.unidade),
      l.observacao ?? '',
    ]),
  ];
  return { csv: `\uFEFF${linhas.map((l) => l.map(celula).join(';')).join('\r\n')}`, numero: versao.numero };
}

/** Situação no estoque em texto (CSV e PDF): "Em estoque", "Faltam 2 kg", "Sem estoque" ou vazio. */
export function textoEstoque(s: SituacaoEstoque, unidade: string | null): string {
  if (!s) return '';
  if (s.tipo === 'suficiente') return 'Em estoque';
  if (s.tipo === 'parcial') return `Faltam ${String(s.faltam).replace('.', ',')} ${unidade ?? s.item.unidade}`;
  if (s.tipo === 'sem') return 'Sem estoque';
  return 'Ver estoque';
}

/** Dados da lista de compras para impressão (página /print/compras/:versaoId, aberta pelo Chromium com print token). */
export async function listaComprasParaImpressao(db: Db, versaoId: string) {
  const { rows } = await db.query<{ evento_id: string; numero: number; empresa: string }>(
    `SELECT o.evento_id, v.numero, t.nome AS empresa
       FROM orcamento_versoes v JOIN orcamentos o ON o.id = v.orcamento_id JOIN tenants t ON t.id = v.tenant_id
      WHERE v.id = $1`,
    [versaoId]
  );
  if (!rows[0]) throw new UserError('Versão do orçamento não encontrada.');
  const versao = await carregarVersao(db, rows[0].evento_id, rows[0].numero);
  return { empresa: rows[0].empresa, numero: rows[0].numero, conteudo: versao.conteudo, estoque: await estoqueParaLista(db) };
}

/** Template usado no PDF da proposta (null = template padrão da empresa) */
export async function definirTemplate(db: Db, eventoId: string, templateId: string | null): Promise<void> {
  if (templateId) {
    const { rowCount } = await db.query('SELECT 1 FROM orcamento_templates WHERE id = $1', [templateId]);
    if (!rowCount) throw new UserError('Template não encontrado.');
  }
  await db.query('UPDATE orcamentos SET template_id = $2, updated_at = now() WHERE evento_id = $1', [eventoId, templateId]);
}
