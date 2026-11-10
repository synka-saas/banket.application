-- Leitura direta pelo Manager Hwesta (decisão de 23/10/2026): o Manager lê métricas do Banket direto no Postgres,
-- por uma rede Docker interna, com um papel só de leitura que enxerga APENAS o schema manager_ro.
--
--   acessos_dia        uma linha por usuário × empresa × dia com acesso ao app (server/acessos.ts, no middleware)
--   manager_ro.*       views de contrato. Os nomes de coluna são os mesmos no Yosp (db/migrations/072 de lá):
--                      o Manager trata as duas plataformas com o mesmo código. Mudou uma tabela usada aqui?
--                      Mantenha a view com as mesmas colunas (o Postgres recusa DROP de coluna usada por view).
--   manager_reader     papel NOLOGIN aqui; o LOGIN e a senha são definidos fora do git (INTEGRACAO_HWESTA.md).
--
-- LGPD: dados de clientes finais do buffet (famílias, pedidos do Busca) só saem agregados. As views são do dono das
-- tabelas, então enxergam todas as empresas sem dar BYPASSRLS ao Manager.
-- Datas: TIMESTAMP sem fuso do Banket é UTC (AT TIME ZONE 'UTC' vira timestamptz); semanas começam na segunda, em SP.

CREATE TABLE IF NOT EXISTS acessos_dia (
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  usuario_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  dia         DATE NOT NULL,
  primeiro_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  ultimo_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, usuario_id, dia)
);
CREATE INDEX IF NOT EXISTS idx_acessos_dia_dia ON acessos_dia (dia);
-- Só a conexão de sistema grava e lê (como resend_events): RLS forçado e nenhuma política
ALTER TABLE acessos_dia ENABLE ROW LEVEL SECURITY;
ALTER TABLE acessos_dia FORCE ROW LEVEL SECURITY;

CREATE SCHEMA IF NOT EXISTS manager_ro;

-- ---------------------------------------------------------------------------------------------------------------
-- v_contas: uma linha por empresa. etapa = importado | gratuito | trial | pagante | inadimplente | manual |
--           trial_expirado | cancelado | suspenso. mrr = receita mensal cobrada; mrr_plano = preço de tabela do plano.
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE VIEW manager_ro.v_contas AS
WITH usuarios_conta AS (
  SELECT tenant_id, count(*) AS usuarios_total, count(*) FILTER (WHERE ativo) AS usuarios_ativos
    FROM tenant_usuarios GROUP BY tenant_id
), dono AS (
  SELECT DISTINCT ON (tu.tenant_id) tu.tenant_id, u.nome, u.email, u.telefone
    FROM tenant_usuarios tu JOIN usuarios u ON u.id = tu.usuario_id
   WHERE tu.role = 'owner'
   ORDER BY tu.tenant_id, tu.created_at
), acessos AS (
  SELECT tenant_id,
         max(ultimo_em) AS ultimo_acesso_em,
         count(DISTINCT dia) FILTER (WHERE dia > current_date - 28) AS dias_ativos_28d,
         count(DISTINCT usuario_id) FILTER (WHERE dia > current_date - 28) AS usuarios_ativos_28d
    FROM acessos_dia GROUP BY tenant_id
), faturas AS (
  SELECT tenant_id,
         bool_or(status = 'paid' AND valor > 0) AS teve_fatura_paga,
         min(vencimento) FILTER (WHERE status = 'open') AS aberta_desde
    FROM assinatura_faturas GROUP BY tenant_id
), base AS (
  SELECT t.*, p.slug AS plano_slug, p.nome AS plano_nome, p.gratuito AS plano_gratuito, p.preco_mensal, p.preco_anual,
         coalesce(uc.usuarios_total, 0) AS usuarios_total, coalesce(uc.usuarios_ativos, 0) AS usuarios_ativos,
         coalesce(f.teve_fatura_paga, false) AS teve_fatura_paga, f.aberta_desde,
         CASE
           WHEN t.origem_cadastro = 'importacao' AND coalesce(uc.usuarios_total, 0) = 0 THEN 'importado'
           WHEN t.status <> 'active' THEN 'suspenso'
           WHEN p.id IS NULL THEN 'manual'
           WHEN t.stripe_assinatura_id IS NOT NULL AND t.stripe_assinatura_status IN ('past_due', 'unpaid') THEN 'inadimplente'
           WHEN t.stripe_assinatura_id IS NOT NULL AND t.stripe_assinatura_status = 'trialing' THEN 'trial'
           WHEN t.stripe_assinatura_id IS NOT NULL AND t.stripe_assinatura_status = 'active'
                AND coalesce(f.teve_fatura_paga, false) AND NOT p.gratuito THEN 'pagante'
           WHEN NOT p.gratuito AND t.trial_ate IS NOT NULL THEN 'trial'
           WHEN NOT p.gratuito THEN 'manual'
           WHEN coalesce(f.teve_fatura_paga, false) THEN 'cancelado'
           WHEN t.trial_usado_em IS NOT NULL THEN 'trial_expirado'
           ELSE 'gratuito'
         END AS etapa
    FROM tenants t
    LEFT JOIN planos p ON p.id = t.plano_id
    LEFT JOIN usuarios_conta uc ON uc.tenant_id = t.id
    LEFT JOIN faturas f ON f.tenant_id = t.id
)
SELECT b.id AS conta_id,
       b.nome,
       b.created_at AT TIME ZONE 'UTC' AS criado_em,
       b.origem_cadastro AS origem,
       NULL::text AS utm_source,
       b.segmento,
       b.porte,
       b.cidade,
       b.uf,
       b.etapa,
       b.plano_slug,
       b.plano_nome,
       coalesce(b.plano_gratuito, false) AS plano_gratuito,
       b.cobranca_intervalo::text AS intervalo,
       b.forma_pagamento::text AS forma_pagamento,
       CASE WHEN b.etapa IN ('pagante', 'inadimplente')
            THEN CASE WHEN b.cobranca_intervalo = 'ano' THEN round(b.preco_anual / 12, 2) ELSE b.preco_mensal END
            ELSE 0 END::numeric(12, 2) AS mrr,
       coalesce(b.preco_mensal, 0)::numeric(12, 2) AS mrr_plano,
       b.trial_iniciado_em AS trial_inicio_em,
       b.trial_ate AS trial_fim,
       b.stripe_assinatura_status AS assinatura_status,
       b.cancelar_em,
       b.cancelamento_motivo,
       CASE WHEN b.aberta_desde < current_date THEN b.aberta_desde::timestamptz END AS inadimplente_desde,
       b.suspenso_em,
       b.plano_rebaixado_em AS rebaixado_em,
       b.usuarios_ativos::int AS usuarios_ativos,
       a.ultimo_acesso_em,
       coalesce(a.dias_ativos_28d, 0)::int AS dias_ativos_28d,
       coalesce(a.usuarios_ativos_28d, 0)::int AS usuarios_ativos_28d,
       d.nome AS contato_nome,
       coalesce(b.email, d.email) AS contato_email,
       coalesce(b.telefone, d.telefone) AS contato_telefone
  FROM base b
  LEFT JOIN acessos a ON a.tenant_id = b.id
  LEFT JOIN dono d ON d.tenant_id = b.id;

-- ---------------------------------------------------------------------------------------------------------------
-- v_plano_historico: cada troca de plano, com o preço mensal de tabela de cada lado (base do MRR bridge).
-- Os 3.289 "cadastro/migracao" das empresas importadas do Busca ficam de fora.
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE VIEW manager_ro.v_plano_historico AS
SELECT h.id AS mudanca_id,
       h.tenant_id AS conta_id,
       h.created_at AT TIME ZONE 'UTC' AS em,
       pd.slug AS de_plano_slug,
       pp.slug AS para_plano_slug,
       coalesce(pd.preco_mensal, 0)::numeric(12, 2) AS de_preco_mensal,
       coalesce(pp.preco_mensal, 0)::numeric(12, 2) AS para_preco_mensal,
       h.motivo::text AS motivo,
       h.origem::text AS origem
  FROM tenant_plano_historico h
  JOIN tenants t ON t.id = h.tenant_id
  LEFT JOIN planos pd ON pd.id = h.de_plano_id
  LEFT JOIN planos pp ON pp.id = h.para_plano_id
 WHERE NOT (h.origem = 'migracao' AND t.origem_cadastro = 'importacao');

-- ---------------------------------------------------------------------------------------------------------------
-- v_faturas: faturas da assinatura (espelho do Stripe).
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE VIEW manager_ro.v_faturas AS
SELECT f.id AS fatura_id,
       f.tenant_id AS conta_id,
       f.numero,
       f.status,
       f.valor::numeric(12, 2) AS valor,
       f.valor_restante::numeric(12, 2) AS valor_restante,
       f.vencimento,
       f.pago_em,
       coalesce(f.tentativas, 0)::int AS tentativas,
       f.forma::text AS forma,
       f.motivo,
       f.created_at AS criado_em
  FROM assinatura_faturas f;

-- ---------------------------------------------------------------------------------------------------------------
-- v_uso_semanal: (conta, semana, metrica, valor). Métricas novas entram aqui sem mudar o contrato.
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE VIEW manager_ro.v_uso_semanal AS
WITH sem AS (SELECT 'America/Sao_Paulo'::text AS tz)
SELECT tenant_id AS conta_id, date_trunc('week', (created_at AT TIME ZONE 'UTC') AT TIME ZONE (SELECT tz FROM sem))::date AS semana,
       'eventos_criados' AS metrica, count(*)::numeric AS valor
  FROM eventos GROUP BY 1, 2
UNION ALL
SELECT tenant_id, date_trunc('week', (created_at AT TIME ZONE 'UTC') AT TIME ZONE (SELECT tz FROM sem))::date,
       'eventos_busca', count(*)
  FROM eventos WHERE origem = 'busca' GROUP BY 1, 2
UNION ALL
SELECT tenant_id, date_trunc('week', (created_at AT TIME ZONE 'UTC') AT TIME ZONE (SELECT tz FROM sem))::date,
       'orcamentos_criados', count(*)
  FROM orcamentos GROUP BY 1, 2
UNION ALL
SELECT tenant_id, date_trunc('week', (enviado_em AT TIME ZONE 'UTC') AT TIME ZONE (SELECT tz FROM sem))::date,
       'propostas_enviadas', count(*)
  FROM orcamento_versoes WHERE enviado_em IS NOT NULL GROUP BY 1, 2
UNION ALL
SELECT tenant_id, date_trunc('week', fechado_em)::date, 'eventos_fechados', count(*)
  FROM eventos WHERE fechado_em IS NOT NULL GROUP BY 1, 2
UNION ALL
SELECT tenant_id, date_trunc('week', (created_at AT TIME ZONE 'UTC') AT TIME ZONE (SELECT tz FROM sem))::date,
       'cards_movimentados', count(*)
  FROM evento_timeline WHERE tipo = 'status' GROUP BY 1, 2
UNION ALL
SELECT tenant_id, date_trunc('week', pago_em)::date, 'parcelas_recebidas', count(*)
  FROM fin_contas WHERE tipo = 'receber' AND status = 'paga' AND pago_em IS NOT NULL GROUP BY 1, 2
UNION ALL
SELECT tenant_id, date_trunc('week', pago_em)::date, 'valor_recebido', sum(coalesce(valor_pago, valor))
  FROM fin_contas WHERE tipo = 'receber' AND status = 'paga' AND pago_em IS NOT NULL GROUP BY 1, 2
UNION ALL
SELECT tenant_id, date_trunc('week', (created_at AT TIME ZONE 'UTC') AT TIME ZONE (SELECT tz FROM sem))::date,
       'documentos_gerados', count(*)
  FROM documentos GROUP BY 1, 2
UNION ALL
SELECT tenant_id, date_trunc('week', (respondida_em AT TIME ZONE 'UTC') AT TIME ZONE (SELECT tz FROM sem))::date,
       'pesquisas_respondidas', count(*)
  FROM pesquisa_envios WHERE respondida_em IS NOT NULL GROUP BY 1, 2
UNION ALL
SELECT tenant_id, date_trunc('week', (created_at AT TIME ZONE 'UTC') AT TIME ZONE (SELECT tz FROM sem))::date,
       'pedidos_busca', count(*)
  FROM busca_pedidos GROUP BY 1, 2
UNION ALL
SELECT tenant_id, date_trunc('week', dia)::date, 'aparicoes_busca', sum(aparicoes)
  FROM busca_metricas_dia GROUP BY 1, 2
UNION ALL
SELECT tenant_id, date_trunc('week', dia)::date, 'visualizacoes_busca', sum(visualizacoes)
  FROM busca_metricas_dia GROUP BY 1, 2
UNION ALL
SELECT tenant_id, date_trunc('week', dia)::date, 'cliques_busca', sum(cliques_orcamento + cliques_contato)
  FROM busca_metricas_dia GROUP BY 1, 2
UNION ALL
SELECT tenant_id, date_trunc('week', created_at AT TIME ZONE (SELECT tz FROM sem))::date, 'sinais_upsell', count(*)
  FROM busca_upsell_eventos WHERE tipo IN ('cadeado_visto', 'cta_clicado', 'planos_visitado', 'checkout_iniciado') GROUP BY 1, 2
UNION ALL
SELECT tenant_id, date_trunc('week', dia)::date, 'dias_ativos', count(DISTINCT dia)
  FROM acessos_dia GROUP BY 1, 2
UNION ALL
SELECT tenant_id, date_trunc('week', dia)::date, 'usuarios_ativos', count(DISTINCT usuario_id)
  FROM acessos_dia GROUP BY 1, 2;

-- ---------------------------------------------------------------------------------------------------------------
-- v_uso_atual: (conta, metrica, valor) do momento, só de empresas com usuário (as importadas ficam de fora).
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE VIEW manager_ro.v_uso_atual AS
WITH contas AS (
  SELECT t.id FROM tenants t WHERE EXISTS (SELECT 1 FROM tenant_usuarios tu WHERE tu.tenant_id = t.id)
), abertos AS (
  SELECT e.tenant_id, e.id, e.updated_at, o.valor_total
    FROM eventos e
    JOIN status_orcamento s ON s.id = e.status_id
    LEFT JOIN orcamentos o ON o.evento_id = e.id
   WHERE s.variante IN ('novo', 'negociacao')
)
SELECT c.id AS conta_id, m.metrica, m.valor
  FROM contas c
 CROSS JOIN LATERAL (VALUES
   ('eventos_futuros_6m', (SELECT count(*) FROM eventos e WHERE e.tenant_id = c.id
                              AND e.data_evento BETWEEN current_date AND current_date + 183)::numeric),
   ('eventos_futuros_aprovados_6m', (SELECT count(*) FROM eventos e JOIN status_orcamento s ON s.id = e.status_id
                              WHERE e.tenant_id = c.id AND s.variante = 'aprovado'
                                AND e.data_evento BETWEEN current_date AND current_date + 183)::numeric),
   ('propostas_em_aberto', (SELECT count(*) FROM abertos a WHERE a.tenant_id = c.id)::numeric),
   ('valor_propostas_em_aberto', (SELECT coalesce(sum(a.valor_total), 0) FROM abertos a WHERE a.tenant_id = c.id)::numeric),
   ('cards_parados_14d', (SELECT count(*) FROM abertos a WHERE a.tenant_id = c.id
                              AND a.updated_at < (now() AT TIME ZONE 'UTC') - interval '14 days')::numeric),
   ('valor_a_receber', (SELECT coalesce(sum(f.valor), 0) FROM fin_contas f
                              WHERE f.tenant_id = c.id AND f.tipo = 'receber' AND f.status = 'aberta')::numeric),
   ('parcelas_vencidas', (SELECT count(*) FROM fin_contas f WHERE f.tenant_id = c.id AND f.tipo = 'receber'
                              AND f.status = 'aberta' AND f.vencimento < current_date)::numeric),
   ('perfis_busca', (SELECT count(*) FROM busca_perfis p WHERE p.tenant_id = c.id)::numeric),
   ('perfis_busca_publicados', (SELECT count(*) FROM busca_perfis p WHERE p.tenant_id = c.id AND p.publicado)::numeric),
   ('usuarios_em_uso', (SELECT count(*) FROM tenant_usuarios tu WHERE tu.tenant_id = c.id AND tu.ativo)::numeric),
   ('usuarios_limite', fn_tenant_limite(c.id, 'usuarios')::numeric)
 ) AS m(metrica, valor);

-- ---------------------------------------------------------------------------------------------------------------
-- v_ativacao: os 6 "primeiros passos" do dashboard (server/dashboard.ts) e a ativação dos guias de CRM:
--   A) pacote (opção de cardápio) + 3 orçamentos + 1 proposta enviada, ou B) evento fechado com plano de pagamento.
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE VIEW manager_ro.v_ativacao AS
WITH marcos AS (
  SELECT t.id AS conta_id,
         t.created_at AT TIME ZONE 'UTC' AS criado_em,
         (t.logo_path IS NOT NULL AND t.telefone IS NOT NULL) AS passo_empresa,
         EXISTS (SELECT 1 FROM catalogo_itens x WHERE x.tenant_id = t.id) AS passo_itens,
         EXISTS (SELECT 1 FROM cardapio_opcoes x WHERE x.tenant_id = t.id) AS passo_opcoes,
         EXISTS (SELECT 1 FROM staff_servicos x WHERE x.tenant_id = t.id) AS passo_staff,
         EXISTS (SELECT 1 FROM espacos es WHERE es.tenant_id = t.id
                   AND (es.tipo = 'terceiro' OR EXISTS (SELECT 1 FROM faixas_locacao f WHERE f.espaco_id = es.id))) AS passo_espacos,
         EXISTS (SELECT 1 FROM eventos x WHERE x.tenant_id = t.id) AS passo_evento,
         (SELECT min(x.created_at) FROM cardapio_opcoes x WHERE x.tenant_id = t.id) AT TIME ZONE 'UTC' AS primeiro_pacote_em,
         (SELECT x.created_at FROM orcamentos x WHERE x.tenant_id = t.id ORDER BY x.created_at OFFSET 2 LIMIT 1)
           AT TIME ZONE 'UTC' AS terceiro_orcamento_em,
         (SELECT min(x.enviado_em) FROM orcamento_versoes x WHERE x.tenant_id = t.id) AT TIME ZONE 'UTC' AS primeira_proposta_em,
         (SELECT min(x.created_at) FROM fin_contas x WHERE x.tenant_id = t.id AND x.origem = 'plano' AND x.evento_id IS NOT NULL)
           AT TIME ZONE 'UTC' AS primeiro_plano_pagamento_em
    FROM tenants t
   WHERE EXISTS (SELECT 1 FROM tenant_usuarios tu WHERE tu.tenant_id = t.id)
), ativ AS (
  SELECT m.*,
         CASE WHEN m.primeiro_pacote_em IS NOT NULL AND m.terceiro_orcamento_em IS NOT NULL AND m.primeira_proposta_em IS NOT NULL
              THEN greatest(m.primeiro_pacote_em, m.terceiro_orcamento_em, m.primeira_proposta_em) END AS caminho_a_em
    FROM marcos m
)
SELECT conta_id, criado_em,
       passo_empresa, passo_itens, passo_opcoes, passo_staff, passo_espacos, passo_evento,
       (passo_empresa::int + passo_itens::int + passo_opcoes::int + passo_staff::int + passo_espacos::int + passo_evento::int) AS passos_concluidos,
       6 AS passos_total,
       primeiro_pacote_em, terceiro_orcamento_em, primeira_proposta_em, primeiro_plano_pagamento_em,
       least(caminho_a_em, primeiro_plano_pagamento_em) AS ativado_em,
       7 AS prazo_ativacao_dias,
       coalesce(least(caminho_a_em, primeiro_plano_pagamento_em) <= criado_em + interval '7 days', false) AS ativado_no_prazo
  FROM ativ;

-- ---------------------------------------------------------------------------------------------------------------
-- v_comunicacao_semanal: o que o Banket mandou para a empresa (avisos no WhatsApp e e-mails do teste).
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE VIEW manager_ro.v_comunicacao_semanal AS
SELECT tenant_id AS conta_id,
       date_trunc('week', (created_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo')::date AS semana,
       'whatsapp' AS canal,
       count(*)::int AS enviados,
       count(*) FILTER (WHERE status IN ('falhou', 'erro', 'failed'))::int AS falhas
  FROM whatsapp_mensagens GROUP BY 1, 2
UNION ALL
SELECT tenant_id, date_trunc('week', enviado_em AT TIME ZONE 'America/Sao_Paulo')::date, 'email', count(*)::int, 0
  FROM plano_avisos GROUP BY 1, 2;

-- ---------------------------------------------------------------------------------------------------------------
-- v_busca_funil: um perfil do Banket Busca por linha (importado → reivindicado → completo → recebendo pedidos).
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE VIEW manager_ro.v_busca_funil AS
SELECT p.id AS perfil_id,
       p.tenant_id AS conta_id,
       p.created_at AT TIME ZONE 'UTC' AS criado_em,
       (t.origem_cadastro = 'importacao') AS importado,
       EXISTS (SELECT 1 FROM tenant_usuarios tu WHERE tu.tenant_id = p.tenant_id) AS tem_usuario,
       (SELECT min(r.concluida_em) FROM busca_reivindicacoes r
         WHERE r.perfil_id = p.id AND r.acao = 'assumir' AND r.status = 'concluida') AS reivindicado_em,
       p.publicado,
       p.publicado_em,
       coalesce(p.completude, 0)::int AS completude,
       p.nivel::text AS nivel,
       c.nome AS cidade,
       c.uf::text AS uf,
       p.nota_media::numeric(4, 2) AS nota_media,
       coalesce(p.total_avaliacoes, 0)::int AS total_avaliacoes,
       p.taxa_resposta::numeric(5, 2) AS taxa_resposta,
       coalesce(m.aparicoes, 0)::int AS aparicoes_30d,
       coalesce(m.visualizacoes, 0)::int AS visualizacoes_30d,
       coalesce(m.cliques, 0)::int AS cliques_30d,
       coalesce(pd.pedidos_30d, 0)::int AS pedidos_30d,
       coalesce(pd.pedidos_total, 0)::int AS pedidos_total,
       pd.ultimo_pedido_em
  FROM busca_perfis p
  JOIN tenants t ON t.id = p.tenant_id
  LEFT JOIN busca_cidades c ON c.ibge = p.cidade_id
  LEFT JOIN LATERAL (
    SELECT sum(x.aparicoes) AS aparicoes, sum(x.visualizacoes) AS visualizacoes,
           sum(x.cliques_orcamento + x.cliques_contato) AS cliques
      FROM busca_metricas_dia x WHERE x.perfil_id = p.id AND x.dia > current_date - 30
  ) m ON true
  LEFT JOIN LATERAL (
    SELECT count(*) FILTER (WHERE x.created_at > (now() AT TIME ZONE 'UTC') - interval '30 days') AS pedidos_30d,
           count(*) AS pedidos_total,
           max(x.created_at) AT TIME ZONE 'UTC' AS ultimo_pedido_em
      FROM busca_pedidos x WHERE x.perfil_id = p.id
  ) pd ON true;

-- ---------------------------------------------------------------------------------------------------------------
-- Papel de leitura do Manager: vê só manager_ro (as views leem as tabelas com os direitos do dono).
-- ---------------------------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'manager_reader') THEN
    CREATE ROLE manager_reader NOLOGIN;
  END IF;
END $$;
ALTER ROLE manager_reader NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE CONNECTION LIMIT 5;
ALTER ROLE manager_reader SET default_transaction_read_only = on;
ALTER ROLE manager_reader SET statement_timeout = '5s';
ALTER ROLE manager_reader SET idle_in_transaction_session_timeout = '10s';
-- Nenhum GRANT em public: as tabelas não são acessíveis. As funções executáveis por PUBLIC que são SECURITY DEFINER
-- só leem (fn_tenant_*); as que gravam (aplicar_padroes_*) rodam com os direitos de quem chama e falham aqui.
GRANT USAGE ON SCHEMA manager_ro TO manager_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA manager_ro TO manager_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA manager_ro GRANT SELECT ON TABLES TO manager_reader;
