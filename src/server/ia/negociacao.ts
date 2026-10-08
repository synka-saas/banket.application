// Assistente de Negociação IA: consolida o histórico da negociação de um evento num markdown e pede à IA o diagnóstico
// (objeções, temperatura do fechamento, sugestões de abordagem e próximos passos).
import type { Db } from '../../lib/db';
import type { SessionUser } from '../../lib/auth';
import { isAdmin } from '../../lib/auth';
import { formatMoney } from '../../lib/money';
import { dataCurta, faixaHorario } from '../../lib/datas';
import { modeloTexto, openAiJson } from '../../lib/openai';
import { carregarEvento } from '../eventos';
import { NOMES_RESTRICOES } from '../../lib/calculo/orcamento';
import { AVISO_DADOS, conferirLimiteIa, dataBr, guardarAnalise, trecho } from './comum';

export interface AnaliseNegociacao {
  resumo: string;
  temperatura: { nivel: 'fria' | 'morna' | 'quente'; pontuacao: number; estagio: string; urgencia: 'baixa' | 'media' | 'alta'; justificativa: string };
  objecoes: { titulo: string; categoria: string; evidencia: string; gravidade: 'alta' | 'media' | 'baixa'; como_tratar: string }[];
  sugestoes: { titulo: string; canal: 'whatsapp' | 'email' | 'ligacao' | 'reuniao'; argumento: string; roteiro: string }[];
  sinais_positivos: string[];
  proximos_passos: string[];
  lacunas: string[];
}

export const CATEGORIAS_OBJECAO: Record<string, string> = {
  preco: 'Preço',
  pagamento: 'Forma de pagamento',
  concorrencia: 'Concorrência',
  logistica: 'Logística e horário',
  cardapio: 'Cardápio',
  data: 'Data',
  confianca: 'Confiança',
  decisao: 'Decisão / aprovação',
  outro: 'Outro',
};

const lista = (itens: string[]) => (itens.length ? itens.map((i) => `- ${i}`).join('\n') : '- (nada registrado)');

/** Monta o contexto (.md) da negociação. Usuário comum só leva as conversas dele (mesma regra do Inbox). */
export async function contextoNegociacao(db: Db, user: SessionUser, eventoId: string): Promise<string> {
  const e = await carregarEvento(db, eventoId);
  const hoje = new Date();
  const diasAte = e.data_evento ? Math.round((new Date(`${e.data_evento}T12:00:00Z`).getTime() - hoje.getTime()) / 86_400_000) : null;
  const { rows: etapa } = await db.query<{ desde: Date | null }>(
    `SELECT max(created_at) AS desde FROM evento_timeline WHERE evento_id = $1 AND tipo = 'status'`,
    [eventoId]
  );
  const desdeEtapa = etapa[0]?.desde ?? e.created_at;

  const { rows: timeline } = await db.query<{ tipo: string; descricao: string; usuario: string | null; created_at: Date; retorno_em: string | null }>(
    `SELECT t.tipo, t.descricao, u.nome AS usuario, t.created_at, to_char(t.retorno_em, 'DD/MM/YYYY') AS retorno_em
       FROM evento_timeline t LEFT JOIN usuarios u ON u.id = t.usuario_id
      WHERE t.evento_id = $1 ORDER BY t.created_at DESC LIMIT 80`,
    [eventoId]
  );
  const { rows: mensagens } = await db.query<{ direcao: string; de: string; assunto: string | null; texto: string | null; created_at: Date }>(
    `SELECT m.direcao, m.de, m.assunto, m.texto, m.created_at
       FROM mensagens m JOIN conversas c ON c.id = m.conversa_id
      WHERE c.evento_id = $1 AND ($2::boolean OR c.usuario_id = $3)
      ORDER BY m.created_at DESC LIMIT 40`,
    [eventoId, isAdmin(user), user.id]
  );
  const { rows: reunioes } = await db.query<{ titulo: string; descricao: string | null; inicio: Date; status: string }>(
    'SELECT titulo, descricao, inicio, status FROM reunioes WHERE evento_id = $1 ORDER BY inicio',
    [eventoId]
  );
  const { rows: versoes } = await db.query<{ numero: number; valor_total: number; congelada: boolean; enviado_em: Date | null; created_at: Date }>(
    `SELECT v.numero, v.valor_total, v.congelada, v.enviado_em, v.created_at
       FROM orcamento_versoes v JOIN orcamentos o ON o.id = v.orcamento_id WHERE o.evento_id = $1 ORDER BY v.numero`,
    [eventoId]
  );
  const { rows: atual } = await db.query<{ conteudo: { cardapios?: { nome: string }[]; totais?: { total: number; pagantes_equivalentes: number }; pagantes?: { convidados: number } } }>(
    `SELECT v.conteudo FROM orcamento_versoes v JOIN orcamentos o ON o.id = v.orcamento_id
      WHERE o.evento_id = $1 AND v.numero = o.versao_atual`,
    [eventoId]
  );
  const { rows: formulario } = await db.query<{ dados: { rotulo: string; valor: string }[] }>(
    'SELECT dados FROM formulario_respostas WHERE evento_id = $1 ORDER BY created_at DESC LIMIT 1',
    [eventoId]
  );

  const restricoes = e.restricoes.map((r) => NOMES_RESTRICOES[r] ?? r);
  const partes = [
    `# Negociação: ${e.titulo ?? 'Evento'}`,
    `Gerado em ${dataBr(hoje)}.`,
    '',
    '## Evento e cliente',
    lista([
      `Cliente: ${e.cliente_nome ?? '—'} (${e.cliente_tipo === 'PJ' ? 'empresa' : 'pessoa física'})`,
      `Responsável: ${e.responsavel_nome ?? '—'}`,
      `Tipo: ${e.tipo_nome ?? '—'} · Ocasião: ${e.categoria_nome ?? '—'} · Formato de serviço: ${e.formato_nome ?? '—'}`,
      `Data: ${e.data_evento ? dataCurta(e.data_evento) : 'não definida'}${diasAte !== null ? ` (faltam ${diasAte} dias)` : ''} · Horário: ${faixaHorario(e.hora_inicio, e.hora_fim)}`,
      `Convidados: ${e.numero_convidados ?? '—'} · Perfil: ${e.perfil_convidados ?? '—'}`,
      `Local: ${e.espaco_nome ?? e.local_nome ?? '—'}`,
      `Verba informada: ${e.verba_total ? formatMoney(Number(e.verba_total)) : '—'} total · ${e.verba_por_pessoa ? formatMoney(Number(e.verba_por_pessoa)) : '—'} por pessoa`,
      `Forma de pagamento desejada: ${e.forma_pagamento ?? '—'}`,
      `Qualificação dada pelo comercial: ${e.qualificacao ?? '—'}`,
      `Estilo gastronômico: ${[e.estilo_principal, e.estilo_secundario].filter(Boolean).join(' / ') || '—'}`,
      `Bebidas: alcoólicas ${e.bebidas_alcoolicas ?? '—'}; sem álcool ${e.bebidas_sem_alcool ?? '—'}`,
      `Restrições alimentares: ${restricoes.join(', ') || 'nenhuma'}`,
      `Origem do pedido: ${e.origem === 'formulario' ? 'formulário do site' : 'cadastro manual'} em ${dataBr(e.created_at)}`,
      `Etapa atual do funil: ${e.status_nome} (desde ${dataBr(desdeEtapa)})${e.motivo_perda ? ` · motivo da perda: ${e.motivo_perda}` : ''}`,
    ]),
    '',
    '## Comentário do cliente no pedido',
    trecho(e.comentario_cliente, 2000) || '(sem comentário)',
    '',
    '## Propostas (versões do orçamento)',
    lista(
      versoes.map(
        (v) =>
          `Versão ${String(v.numero).padStart(2, '0')}: ${formatMoney(Number(v.valor_total))} · criada em ${dataBr(v.created_at)}${v.enviado_em ? ` · enviada ao cliente em ${dataBr(v.enviado_em)}` : ' · não enviada'}${v.congelada ? '' : ' · versão em edição'}`
      )
    ),
  ];
  const c = atual[0]?.conteudo;
  if (c) {
    partes.push(
      `Proposta atual: ${(c.cardapios ?? []).map((x) => x.nome).join(', ') || 'sem cardápio'}; total ${formatMoney(c.totais?.total ?? 0)}` +
        (c.pagantes?.convidados ? ` (${formatMoney((c.totais?.total ?? 0) / c.pagantes.convidados)} por convidado)` : '')
    );
  }
  partes.push(
    '',
    '## Reuniões, visitas e degustações agendadas',
    lista(reunioes.map((r) => `${dataBr(r.inicio)} · ${r.titulo}${r.status === 'cancelada' ? ' (cancelada)' : ''}${r.descricao ? ` — ${trecho(r.descricao, 300)}` : ''}`)),
    '',
    '## Linha do tempo (anotações do comercial e eventos do sistema, mais recentes primeiro)',
    lista(timeline.map((t) => `${dataBr(t.created_at)} · [${t.tipo}] ${trecho(t.descricao, 600)}${t.usuario ? ` (${t.usuario})` : ''}${t.retorno_em ? ` · retorno combinado para ${t.retorno_em}` : ''}`)),
    '',
    '## Mensagens trocadas por e-mail (mais recentes primeiro)'
  );
  if (!mensagens.length) partes.push('(nenhuma mensagem registrada no sistema)');
  for (const m of mensagens) {
    partes.push('', `### ${dataBr(m.created_at)} · ${m.direcao === 'entrada' ? `Cliente (${m.de}) → buffet` : 'Buffet → cliente'}${m.assunto ? ` · ${trecho(m.assunto, 150)}` : ''}`, trecho(m.texto, 1500) || '(sem texto)');
  }
  const respostas = formulario[0]?.dados ?? [];
  if (respostas.length) {
    partes.push('', '## Respostas do formulário de pedido', lista(respostas.map((r) => `${r.rotulo}: ${trecho(r.valor, 300)}`)));
  }
  return partes.join('\n').slice(0, 60_000);
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['resumo', 'temperatura', 'objecoes', 'sugestoes', 'sinais_positivos', 'proximos_passos', 'lacunas'],
  properties: {
    resumo: { type: 'string', description: 'Síntese da negociação em 2 a 4 frases.' },
    temperatura: {
      type: 'object',
      additionalProperties: false,
      required: ['nivel', 'pontuacao', 'estagio', 'urgencia', 'justificativa'],
      properties: {
        nivel: { type: 'string', enum: ['fria', 'morna', 'quente'] },
        pontuacao: { type: 'integer', description: 'Probabilidade estimada de fechamento, de 0 a 100.' },
        estagio: { type: 'string', description: 'Estágio de maturidade da decisão (ex.: comparando fornecedores, aguardando aprovação do cônjuge).' },
        urgencia: { type: 'string', enum: ['baixa', 'media', 'alta'] },
        justificativa: { type: 'string', description: 'Por que esta temperatura, citando fatos do histórico.' },
      },
    },
    objecoes: {
      type: 'array',
      description: 'Entraves reais de compra encontrados no histórico (vazio se não houver evidência).',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['titulo', 'categoria', 'evidencia', 'gravidade', 'como_tratar'],
        properties: {
          titulo: { type: 'string' },
          categoria: { type: 'string', enum: Object.keys(CATEGORIAS_OBJECAO) },
          evidencia: { type: 'string', description: 'Trecho ou fato do histórico que mostra a objeção (com data, se houver).' },
          gravidade: { type: 'string', enum: ['alta', 'media', 'baixa'] },
          como_tratar: { type: 'string' },
        },
      },
    },
    sugestoes: {
      type: 'array',
      description: 'De 2 a 4 abordagens para destravar o fechamento, da mais importante para a menos.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['titulo', 'canal', 'argumento', 'roteiro'],
        properties: {
          titulo: { type: 'string' },
          canal: { type: 'string', enum: ['whatsapp', 'email', 'ligacao', 'reuniao'] },
          argumento: { type: 'string', description: 'Argumento central e por que funciona para este cliente.' },
          roteiro: { type: 'string', description: 'Mensagem ou roteiro pronto para o comercial usar, em tom cordial e profissional.' },
        },
      },
    },
    sinais_positivos: { type: 'array', items: { type: 'string' } },
    proximos_passos: { type: 'array', items: { type: 'string' }, description: 'Ações concretas e ordenadas, com prazo quando fizer sentido.' },
    lacunas: { type: 'array', items: { type: 'string' }, description: 'Informações que faltam no histórico e que melhorariam a análise.' },
  },
} as const;

const SISTEMA = [
  'Você é um consultor comercial sênior de buffets e casas de eventos no Brasil (casamentos, aniversários, eventos corporativos).',
  'Analise o histórico da negociação e ajude o comercial a fechar o contrato com ética: sem pressão abusiva nem promessas que o buffet não registrou.',
  'Baseie cada conclusão em evidências do contexto; quando faltar informação, diga isso em "lacunas" em vez de inventar.',
  'Considere sinais como: tempo sem resposta, pedidos de desconto, comparação com concorrentes, dúvidas de pagamento, horário de término,',
  'número de convidados, proximidade da data, quem decide, e o que já foi enviado.',
  AVISO_DADOS,
].join(' ');

export async function analisarNegociacao(db: Db, user: SessionUser, eventoId: string): Promise<string> {
  conferirLimiteIa(user.tenantId);
  const contexto = await contextoNegociacao(db, user, eventoId);
  const resultado = await openAiJson<AnaliseNegociacao>({
    sistema: SISTEMA,
    usuario: `Contexto da negociação (markdown):\n\n${contexto}`,
    nomeSchema: 'analise_negociacao',
    schema: SCHEMA as unknown as Record<string, unknown>,
    timeoutMs: 55_000,
  });
  resultado.temperatura.pontuacao = Math.max(0, Math.min(100, Math.round(resultado.temperatura.pontuacao)));
  return guardarAnalise(db, user, eventoId, { tipo: 'negociacao', versao: null, contexto, resultado, modelo: modeloTexto() });
}
