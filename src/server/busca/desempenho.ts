// Desempenho do buffet no Banket Busca (/busca/desempenho): aparições, visualizações, cliques em contato e no formulário,
// pedidos e conversão nos últimos 30 dias. Perfil Simples vê os totais e o que deixou de ganhar (média de pedidos dos
// perfis personalizados da região); Personalizado vê o detalhe por dia, a origem dos pedidos e a comparação com a região.
// A média regional usa a conexão de sistema, mas só devolve agregados (nunca dados de outra empresa) e só com 3+ perfis.
import { withSystem, type Db } from '../../lib/db';
import { cumprimentoDaEmpresa, type Cumprimento } from './respostas';

export const DIAS_DESEMPENHO = 30;

export interface Totais {
  aparicoes: number;
  visualizacoes: number;
  contatos: number;
  orcamentos: number;
}

export interface Desempenho {
  totais: Totais;
  porDia: ({ dia: string } & Totais)[];
  pedidos: { busca: number; formulario: number; aprovados: number };
  cumprimento: Cumprimento;
  /** Médias por perfil personalizado publicado na região (null com menos de 3) */
  regiao: { nome: string; perfis: number; visualizacoes: number; pedidos: number } | null;
}

export async function desempenhoDoBuffet(db: Db, tenantId: string): Promise<Desempenho> {
  const { rows: dias } = await db.query<{ dia: string } & Totais>(
    `SELECT to_char(d::date, 'YYYY-MM-DD') AS dia,
            coalesce(sum(m.aparicoes), 0)::int AS aparicoes, coalesce(sum(m.visualizacoes), 0)::int AS visualizacoes,
            coalesce(sum(m.cliques_contato), 0)::int AS contatos, coalesce(sum(m.cliques_orcamento), 0)::int AS orcamentos
       FROM generate_series((now() AT TIME ZONE 'America/Sao_Paulo')::date - ${DIAS_DESEMPENHO - 1},
                            (now() AT TIME ZONE 'America/Sao_Paulo')::date, interval '1 day') d
       LEFT JOIN busca_metricas_dia m ON m.dia = d::date
      GROUP BY d ORDER BY d`
  );
  const totais = dias.reduce<Totais>(
    (t, d) => ({ aparicoes: t.aparicoes + d.aparicoes, visualizacoes: t.visualizacoes + d.visualizacoes, contatos: t.contatos + d.contatos, orcamentos: t.orcamentos + d.orcamentos }),
    { aparicoes: 0, visualizacoes: 0, contatos: 0, orcamentos: 0 }
  );
  const { rows: [ped] } = await db.query<{ busca: number; formulario: number; aprovados: number }>(
    `SELECT count(*) FILTER (WHERE e.origem = 'busca')::int AS busca, count(*) FILTER (WHERE e.origem = 'formulario')::int AS formulario,
            count(*) FILTER (WHERE e.origem = 'busca' AND s.variante = 'aprovado')::int AS aprovados
       FROM eventos e JOIN status_orcamento s ON s.id = e.status_id
      WHERE e.origem IN ('busca', 'formulario') AND e.created_at >= now() - interval '${DIAS_DESEMPENHO} days'`
  );
  const cumprimento = await cumprimentoDaEmpresa(db);
  const { rows: [base] } = await db.query<{ cidade_id: number | null; uf: string | null; cidade: string | null }>(
    `SELECT p.cidade_id, c.uf, c.nome AS cidade FROM busca_perfis p LEFT JOIN busca_cidades c ON c.id = p.cidade_id
      ORDER BY p.publicado DESC, p.created_at LIMIT 1`
  );
  const regiao = base?.cidade_id ? await mediaDaRegiao(tenantId, base.cidade_id, base.uf, base.cidade) : null;
  return { totais, porDia: dias, pedidos: ped, cumprimento, regiao };
}

/** Média por perfil personalizado publicado (outras empresas) na cidade; com menos de 3, no estado. */
async function mediaDaRegiao(tenantId: string, cidadeId: number, uf: string | null, cidade: string | null): Promise<Desempenho['regiao']> {
  return withSystem(async (db) => {
    for (const [filtro, valor, nome] of [['p.cidade_id = $2::int', cidadeId, cidade], ['c.uf = $2::text', uf, uf]] as const) {
      if (!nome || valor == null) continue;
      const { rows: [r] } = await db.query<{ perfis: number; visualizacoes: number; pedidos: number }>(
        `SELECT count(*)::int AS perfis,
                coalesce(avg((SELECT coalesce(sum(m.visualizacoes), 0) FROM busca_metricas_dia m
                               WHERE m.perfil_id = p.id AND m.dia > current_date - ${DIAS_DESEMPENHO})), 0)::float8 AS visualizacoes,
                coalesce(avg((SELECT count(*) FROM busca_pedidos d
                               WHERE d.perfil_id = p.id AND d.created_at >= now() - interval '${DIAS_DESEMPENHO} days')), 0)::float8 AS pedidos
           FROM busca_perfis p LEFT JOIN busca_cidades c ON c.id = p.cidade_id
          WHERE p.publicado AND p.nivel = 'cliente' AND p.tenant_id <> $1 AND ${filtro}`,
        [tenantId, valor]
      );
      if (r.perfis >= 3) return { nome: nome!, perfis: r.perfis, visualizacoes: Math.round(r.visualizacoes), pedidos: Math.round(r.pedidos * 10) / 10 };
    }
    return null;
  });
}
