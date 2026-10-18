// Tempo de resposta: cumprimento do prazo escolhido pela empresa (configuracoes_tenant.tempo_resposta_horas) nos pedidos
// do Banket Busca e dos formulários de captação. Pedido respondido = primeiro e-mail enviado ao cliente numa conversa do
// evento ou primeira ação de um usuário no evento (mudança de etapa, orçamento, envio da proposta, reunião, anotação,
// checklist). Taxa = pedidos dos últimos 90 dias respondidos no prazo / pedidos cujo prazo já terminou ou que já foram
// respondidos. Vira busca_perfis.taxa_resposta (ranking) pelo agendador, que também avisa no WhatsApp o prazo vencendo.
import type { Db } from '../../lib/db';
import { withSystem } from '../../lib/db';
import { horasAteAvisoDePrazo, rotuloTempo } from '../../lib/tempoResposta';
import { avisarWhatsapp } from '../whatsapp';

/** Primeira resposta do evento `e` (expressão SQL; LEAST ignora nulos). */
export const SQL_PRIMEIRA_RESPOSTA = `LEAST(
  (SELECT min(m.created_at) FROM conversas cv JOIN mensagens m ON m.conversa_id = cv.id WHERE cv.evento_id = e.id AND m.direcao = 'saida'),
  (SELECT min(t.created_at) FROM evento_timeline t WHERE t.evento_id = e.id AND t.usuario_id IS NOT NULL
      AND t.tipo IN ('status', 'orcamento_criado', 'email_enviado', 'reuniao', 'anotacao', 'checklist')))`;

// Pedidos de cada empresa nos últimos 90 dias, com a primeira resposta e o prazo
const SQL_PEDIDOS = `
  SELECT e.id, e.tenant_id, e.origem, e.created_at, ${SQL_PRIMEIRA_RESPOSTA} AS respondido_em,
         make_interval(hours => coalesce(c.tempo_resposta_horas, 48)) AS prazo
    FROM eventos e LEFT JOIN configuracoes_tenant c ON c.tenant_id = e.tenant_id
   WHERE e.origem IN ('busca', 'formulario') AND e.created_at >= now() - interval '90 days'`;

export interface Cumprimento {
  /** Pedidos que já contam (prazo encerrado ou respondidos) */
  pedidos: number;
  noPrazo: number;
  /** 0..1, null sem pedidos */
  taxa: number | null;
  /** Mediana do tempo até a primeira resposta, em horas */
  medianaHoras: number | null;
  prazoHoras: number;
}

/** Cumprimento da empresa atual (dentro de withTenant). */
export async function cumprimentoDaEmpresa(db: Db): Promise<Cumprimento> {
  const { rows: [r] } = await db.query<{ pedidos: number; no_prazo: number; mediana: number | null; prazo: number }>(
    `WITH p AS (${SQL_PEDIDOS})
     SELECT count(*) FILTER (WHERE respondido_em IS NOT NULL OR created_at + prazo < now()) AS pedidos,
            count(*) FILTER (WHERE respondido_em IS NOT NULL AND respondido_em - created_at <= prazo) AS no_prazo,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM respondido_em - created_at) / 3600)
              FILTER (WHERE respondido_em IS NOT NULL) AS mediana,
            (SELECT coalesce(max(tempo_resposta_horas), 48) FROM configuracoes_tenant) AS prazo
       FROM p`
  );
  return {
    pedidos: r.pedidos, noPrazo: r.no_prazo, taxa: r.pedidos ? r.no_prazo / r.pedidos : null,
    medianaHoras: r.mediana == null ? null : Math.round(Number(r.mediana) * 10) / 10, prazoHoras: Number(r.prazo),
  };
}

/**
 * Atualiza taxa de resposta e última resposta de todos os perfis do Busca, e a data de resposta dos pedidos do Busca
 * (conexão de sistema, agendador). Empresa sem pedido contável fica sem taxa (fator neutro no ranking).
 */
export async function atualizarRespostasBusca(): Promise<number> {
  return withSystem(async (db) => {
    await db.query(
      `UPDATE busca_pedidos d SET respondido_em = x.respondido_em
         FROM (SELECT e.id, ${SQL_PRIMEIRA_RESPOSTA} AS respondido_em FROM eventos e
                WHERE e.origem = 'busca' AND e.created_at >= now() - interval '90 days') x
        WHERE d.evento_id = x.id AND d.respondido_em IS NULL AND x.respondido_em IS NOT NULL`
    );
    const { rowCount } = await db.query(
      `WITH p AS (${SQL_PEDIDOS}),
            t AS (SELECT tenant_id,
                         count(*) FILTER (WHERE respondido_em IS NOT NULL OR created_at + prazo < now()) AS pedidos,
                         count(*) FILTER (WHERE respondido_em IS NOT NULL AND respondido_em - created_at <= prazo) AS no_prazo,
                         max(respondido_em) AS ultima
                    FROM p GROUP BY tenant_id)
       UPDATE busca_perfis b SET taxa_resposta = x.taxa, ultima_resposta_em = GREATEST(b.ultima_resposta_em, x.ultima)
         FROM (SELECT b2.id, CASE WHEN t.pedidos > 0 THEN round(t.no_prazo::numeric / t.pedidos, 4) END AS taxa, t.ultima
                 FROM busca_perfis b2 LEFT JOIN t ON t.tenant_id = b2.tenant_id) x
        WHERE b.id = x.id AND (b.taxa_resposta IS DISTINCT FROM x.taxa OR x.ultima > coalesce(b.ultima_resposta_em, '-infinity'))`
    );
    return rowCount ?? 0;
  });
}

/**
 * Aviso "prazo vencendo" no WhatsApp: pedido ainda sem resposta quando restam 25% do prazo (prazos acima de 12 h), só
 * para empresas com o recurso e o aviso ligado. Dedup por evento (whatsapp_mensagens.chave).
 */
export async function avisarPrazosVencendo(): Promise<number> {
  const pendentes = await withSystem(async (db) => {
    const { rows } = await db.query<{ id: string; tenant_id: string; titulo: string; cliente: string | null; horas: number; created_at: Date }>(
      `SELECT e.id, e.tenant_id, e.titulo, cl.nome AS cliente, c.tempo_resposta_horas AS horas, e.created_at
         FROM eventos e
         JOIN configuracoes_tenant c ON c.tenant_id = e.tenant_id
         LEFT JOIN clientes cl ON cl.id = e.cliente_id
        WHERE e.origem IN ('busca', 'formulario') AND c.tempo_resposta_horas > 12
          AND c.whatsapp_avisos_ativo AND 'prazo_resposta' = ANY(c.whatsapp_avisos_tipos)
          AND now() >= e.created_at + make_interval(hours => c.tempo_resposta_horas) * 0.75
          AND now() < e.created_at + make_interval(hours => c.tempo_resposta_horas)
          AND ${SQL_PRIMEIRA_RESPOSTA} IS NULL
          AND NOT EXISTS (SELECT 1 FROM whatsapp_mensagens w WHERE w.tenant_id = e.tenant_id AND w.chave = 'prazo:' || e.id)`
    );
    return rows;
  });
  let enviados = 0;
  for (const p of pendentes) {
    if (horasAteAvisoDePrazo(p.horas) == null) continue;
    const restanteH = Math.max(1, Math.round((new Date(p.created_at).getTime() + p.horas * 3_600_000 - Date.now()) / 3_600_000));
    const r = await avisarWhatsapp(p.tenant_id, 'prazo_resposta', {
      variaveis: [p.cliente ?? 'Cliente', p.titulo, restanteH === 1 ? '1 hora' : rotuloTempo(restanteH)],
      link: `eventos/${p.id}`, eventoId: p.id, chave: `prazo:${p.id}`,
    });
    if (r === 'enviado') enviados++;
  }
  return enviados;
}
