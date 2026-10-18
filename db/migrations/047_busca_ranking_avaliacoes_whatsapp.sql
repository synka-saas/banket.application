-- 047: ranking do Busca (atividade, cliques em contato), tempo de resposta da empresa, avaliações vindas da pesquisa de
-- satisfação e avisos pelo WhatsApp (Cloud API da Meta). Só adiciona colunas, tabelas e funções (compatível com a
-- versão anterior do código).

-- ── Métricas e atividade ─────────────────────────────────────────────────────
ALTER TABLE busca_metricas_dia ADD COLUMN IF NOT EXISTS cliques_contato INT NOT NULL DEFAULT 0;
-- Último pedido respondido pela empresa (atividade recente no ranking; atualizado pelo agendador)
ALTER TABLE busca_perfis ADD COLUMN IF NOT EXISTS ultima_resposta_em TIMESTAMP;

-- ── Tempo de resposta (Configurações › Empresa › Parâmetros comerciais) ─────
ALTER TABLE configuracoes_tenant ADD COLUMN IF NOT EXISTS tempo_resposta_horas SMALLINT NOT NULL DEFAULT 48;
ALTER TABLE configuracoes_tenant DROP CONSTRAINT IF EXISTS configuracoes_tenant_tempo_resposta_check;
ALTER TABLE configuracoes_tenant ADD CONSTRAINT configuracoes_tenant_tempo_resposta_check
  CHECK (tempo_resposta_horas IN (2, 4, 6, 12, 24, 48, 72));

-- O texto do perfil passa a vir da configuração (o campo da etapa 1 saiu). Empresas importadas (sem usuário) ficam sem.
UPDATE busca_perfis p
   SET completude = LEAST(100, p.completude + CASE WHEN trim(coalesce(p.tempo_resposta_texto, '')) = '' THEN 5 ELSE 0 END),
       tempo_resposta_texto = 'Responde em até 48 horas'
  FROM tenants t
 WHERE t.id = p.tenant_id AND t.origem_cadastro IS DISTINCT FROM 'importacao';

-- ── Avaliações pela pesquisa de satisfação ──────────────────────────────────
-- nota_busca: média das notas CSAT (1–5) da resposta; sem CSAT, NPS convertido (1 + NPS × 0,4).
-- depoimento: 1ª resposta aberta (≥ 20 caracteres), só com "sim" na pergunta de autorização de depoimento.
ALTER TABLE pesquisa_envios ADD COLUMN IF NOT EXISTS nota_busca NUMERIC(3,2);
ALTER TABLE pesquisa_envios ADD COLUMN IF NOT EXISTS depoimento TEXT;
ALTER TABLE pesquisa_envios ADD COLUMN IF NOT EXISTS depoimento_nome VARCHAR(80);
ALTER TABLE pesquisa_envios ADD COLUMN IF NOT EXISTS busca_oculta BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE pesquisa_envios ADD COLUMN IF NOT EXISTS busca_resposta TEXT;
ALTER TABLE pesquisa_envios ADD COLUMN IF NOT EXISTS busca_resposta_em TIMESTAMP;

UPDATE pesquisa_envios pe
   SET nota_busca = COALESCE(
         (SELECT round(avg(r.nota)::numeric, 2) FROM pesquisa_respostas r WHERE r.envio_id = pe.id AND r.tipo = 'nota' AND r.nota IS NOT NULL),
         CASE WHEN pe.nps IS NOT NULL THEN round(1 + pe.nps * 0.4, 2) END),
       depoimento = CASE WHEN EXISTS (
           SELECT 1 FROM pesquisa_respostas r WHERE r.envio_id = pe.id AND r.tipo = 'escolha'
              AND r.pergunta_texto ILIKE '%depoimento%' AND 'Sim' = ANY(r.opcoes))
         THEN (SELECT left(trim(r.texto), 1000) FROM pesquisa_respostas r WHERE r.envio_id = pe.id AND r.tipo = 'texto'
                 AND length(trim(coalesce(r.texto, ''))) >= 20 ORDER BY r.ordem LIMIT 1) END
 WHERE pe.respondida_em IS NOT NULL AND pe.nota_busca IS NULL;

UPDATE pesquisa_envios pe
   SET depoimento_nome = left(split_part(trim(c.nome), ' ', 1)
         || CASE WHEN position(' ' IN trim(c.nome)) > 0 THEN ' ' || upper(left(regexp_replace(trim(c.nome), '^.* ', ''), 1)) || '.' ELSE '' END, 80)
  FROM eventos e JOIN clientes c ON c.id = e.cliente_id
 WHERE e.id = pe.evento_id AND pe.depoimento IS NOT NULL AND pe.depoimento_nome IS NULL;

-- Nota e total de avaliações de cada perfil da empresa: avaliações do Busca publicadas + pesquisas respondidas.
-- Pesquisa de evento num espaço que é a unidade de um perfil conta só para esse perfil; as demais, para todos.
CREATE OR REPLACE FUNCTION busca_recalcular_avaliacoes(p_tenant UUID) RETURNS void
LANGUAGE sql AS $$
  UPDATE busca_perfis p SET nota_media = x.media, total_avaliacoes = x.total
    FROM (
      SELECT bp.id, round(avg(n.nota), 2) AS media, count(n.nota)::int AS total
        FROM busca_perfis bp
        LEFT JOIN LATERAL (
          SELECT a.nota::numeric AS nota FROM busca_avaliacoes a WHERE a.perfil_id = bp.id AND a.publicada AND a.nota IS NOT NULL
          UNION ALL
          SELECT pe.nota_busca FROM pesquisa_envios pe JOIN eventos e ON e.id = pe.evento_id
           WHERE pe.tenant_id = bp.tenant_id AND pe.nota_busca IS NOT NULL
             AND (e.espaco_id = bp.espaco_id OR NOT EXISTS (
                   SELECT 1 FROM busca_perfis o WHERE o.tenant_id = bp.tenant_id AND o.espaco_id IS NOT NULL AND o.espaco_id = e.espaco_id))
        ) n ON true
       WHERE bp.tenant_id = p_tenant
       GROUP BY bp.id
    ) x
   WHERE p.id = x.id;
$$;

SELECT busca_recalcular_avaliacoes(t.tenant_id)
  FROM (SELECT DISTINCT tenant_id FROM pesquisa_envios WHERE nota_busca IS NOT NULL) t;

-- ── WhatsApp (avisos à empresa) ──────────────────────────────────────────────
-- Número da empresa que recebe os avisos (DDI + DDD + número, só dígitos), aceite e tipos de aviso escolhidos.
ALTER TABLE configuracoes_tenant ADD COLUMN IF NOT EXISTS whatsapp_avisos VARCHAR(20);
ALTER TABLE configuracoes_tenant ADD COLUMN IF NOT EXISTS whatsapp_avisos_ativo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE configuracoes_tenant ADD COLUMN IF NOT EXISTS whatsapp_avisos_tipos TEXT[] NOT NULL
  DEFAULT ARRAY['novo_pedido', 'prazo_resposta', 'inbox', 'pesquisa'];

CREATE TABLE IF NOT EXISTS whatsapp_mensagens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tipo        VARCHAR(30) NOT NULL,           -- novo_pedido | prazo_resposta | inbox | pesquisa | teste
  chave       VARCHAR(120),                   -- dedup (ex.: prazo:<evento_id>)
  para        VARCHAR(20) NOT NULL,
  template    VARCHAR(80) NOT NULL,
  evento_id   UUID REFERENCES eventos(id) ON DELETE SET NULL,
  wamid       VARCHAR(160),                   -- id da mensagem na Meta
  status      VARCHAR(20) NOT NULL DEFAULT 'pendente'
              CHECK (status IN ('pendente', 'enviada', 'entregue', 'lida', 'falhou', 'registrada')),
  erro        TEXT,
  status_em   TIMESTAMP,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
SELECT aplicar_rls('whatsapp_mensagens');
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_mensagens_chave_uk ON whatsapp_mensagens (tenant_id, chave) WHERE chave IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_mensagens_wamid_uk ON whatsapp_mensagens (wamid) WHERE wamid IS NOT NULL;
CREATE INDEX IF NOT EXISTS whatsapp_mensagens_recentes ON whatsapp_mensagens (tenant_id, created_at DESC);

-- Eventos do webhook da Meta (status de entrega): idempotência; RLS forçado sem política = só a conexão de sistema
CREATE TABLE IF NOT EXISTS whatsapp_events (
  id           VARCHAR(200) PRIMARY KEY,
  payload      JSONB NOT NULL,
  received_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE whatsapp_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_events FORCE ROW LEVEL SECURITY;
