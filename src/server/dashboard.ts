// Indicadores do dashboard. O valor de cada evento é o total da versão atual do orçamento.
import type { Db } from '../lib/db';
import type { VarianteStatus } from './configuracoes';

export const PERIODOS = {
  '30': 'Últimos 30 dias',
  '90': 'Últimos 90 dias',
  '365': 'Últimos 12 meses',
  tudo: 'Todo o período',
} as const;
export type Periodo = keyof typeof PERIODOS;

/** Dias sem retorno para um orçamento enviado ser considerado "parado" */
export const DIAS_SEM_RESPOSTA = 7;

export interface StatusResumo {
  id: string;
  nome: string;
  cor: string;
  variante: VarianteStatus;
  eventos: number;
  valor: number;
}

export interface ProximoEvento {
  id: string;
  titulo: string | null;
  cliente_nome: string | null;
  data_evento: string;
  hora_inicio: string | null;
  numero_convidados: number | null;
  status_nome: string;
  cor: string;
}

export interface OrcamentoParado {
  id: string;
  titulo: string | null;
  cliente_nome: string | null;
  valor: number;
  enviado_em: Date;
  enviado_para: string | null;
  dias: number;
}

export interface Indicadores {
  porStatus: StatusResumo[];
  pedidos: number;
  pipeline: { eventos: number; valor: number };
  aprovados: { eventos: number; valor: number };
  recusados: number;
  conversao: number | null;
  ticketMedio: number | null;
  proximos: ProximoEvento[];
  parados: OrcamentoParado[];
}

// Valor do evento = total da versão atual do orçamento (0 quando ainda não há orçamento)
const VALOR = `COALESCE((SELECT v.valor_total FROM orcamentos o
                          JOIN orcamento_versoes v ON v.orcamento_id = o.id AND v.numero = o.versao_atual
                         WHERE o.evento_id = e.id), 0)`;

export async function carregarIndicadores(db: Db, periodo: Periodo): Promise<Indicadores> {
  // Recorte por data de entrada do pedido
  const dias = periodo === 'tudo' ? null : Number(periodo);
  const filtro = `($1::int IS NULL OR e.created_at >= now() - make_interval(days => $1::int))`;

  const { rows: porStatus } = await db.query<StatusResumo>(
    `SELECT s.id, s.nome, s.cor, s.variante,
            count(e.id)::int AS eventos, COALESCE(sum(${VALOR}), 0) AS valor
       FROM status_orcamento s
       LEFT JOIN eventos e ON e.status_id = s.id AND ${filtro}
      GROUP BY s.id ORDER BY s.ordem`,
    [dias]
  );

  const { rows: entrada } = await db.query<{ total: number }>(
    `SELECT count(*)::int AS total FROM eventos e WHERE ${filtro}`,
    [dias]
  );

  const soma = (vs: VarianteStatus[]) =>
    porStatus
      .filter((s) => vs.includes(s.variante))
      .reduce((acc, s) => ({ eventos: acc.eventos + s.eventos, valor: acc.valor + s.valor }), { eventos: 0, valor: 0 });
  const pipeline = soma(['novo', 'negociacao']);
  const aprovados = soma(['aprovado']);
  const recusados = soma(['recusado']).eventos;
  const decididos = aprovados.eventos + recusados;

  const { rows: proximos } = await db.query<ProximoEvento>(
    `SELECT e.id, e.titulo, c.nome AS cliente_nome, e.data_evento::text, to_char(e.hora_inicio, 'HH24:MI') AS hora_inicio,
            e.numero_convidados, s.nome AS status_nome, s.cor
       FROM eventos e
       JOIN status_orcamento s ON s.id = e.status_id
       LEFT JOIN clientes c ON c.id = e.cliente_id
      WHERE s.variante <> 'recusado'
        AND e.data_evento BETWEEN (now() AT TIME ZONE 'America/Sao_Paulo')::date
                              AND (now() AT TIME ZONE 'America/Sao_Paulo')::date + 30
      ORDER BY e.data_evento, e.hora_inicio NULLS LAST
      LIMIT 8`
  );

  // Proposta enviada, evento ainda em aberto e sem mudança de status depois do envio
  const { rows: parados } = await db.query<OrcamentoParado>(
    `SELECT e.id, e.titulo, c.nome AS cliente_nome, v.valor_total AS valor, v.enviado_em, v.enviado_para,
            (now()::date - v.enviado_em::date) AS dias
       FROM eventos e
       JOIN status_orcamento s ON s.id = e.status_id
       JOIN orcamentos o ON o.evento_id = e.id
       JOIN orcamento_versoes v ON v.orcamento_id = o.id AND v.numero = o.versao_atual
       LEFT JOIN clientes c ON c.id = e.cliente_id
      WHERE s.variante IN ('novo', 'negociacao')
        AND v.enviado_em < now() - make_interval(days => $1::int)
        AND NOT EXISTS (SELECT 1 FROM evento_timeline t
                         WHERE t.evento_id = e.id AND t.tipo = 'status' AND t.created_at > v.enviado_em)
      ORDER BY v.enviado_em
      LIMIT 8`,
    [DIAS_SEM_RESPOSTA]
  );

  return {
    porStatus,
    pedidos: entrada[0]?.total ?? 0,
    pipeline,
    aprovados,
    recusados,
    conversao: decididos ? aprovados.eventos / decididos : null,
    ticketMedio: aprovados.eventos ? aprovados.valor / aprovados.eventos : null,
    proximos,
    parados,
  };
}
