-- 004_configuracoes.sql
-- Cadastros configuráveis por empresa:
--   * status_orcamento passa a ser a ÚNICA fonte das colunas do Kanban (variantes novo/negociacao/aprovado/recusado);
--     eventos.status (texto) vira eventos.status_id e pipeline_colunas deixa de existir;
--   * tipos de evento ganham descrição; formatos de serviço, categorias de item e faixas de locação;
--   * parâmetros comerciais da empresa (validade da proposta, faixas de crianças, e-mail de envio, assinatura).

-- ---------- Tipos e categorias de evento ----------
ALTER TABLE tipos_evento ADD COLUMN IF NOT EXISTS descricao TEXT;
ALTER TABLE categorias_evento ADD COLUMN IF NOT EXISTS descricao TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS tipos_evento_nome_unique ON tipos_evento (tenant_id, lower(nome));
CREATE UNIQUE INDEX IF NOT EXISTS categorias_evento_nome_unique ON categorias_evento (tenant_id, lower(nome));

-- ---------- Status do orçamento = colunas do Kanban ----------
ALTER TABLE status_orcamento DROP CONSTRAINT IF EXISTS status_orcamento_variante_check;
UPDATE status_orcamento SET variante = CASE variante
    WHEN 'pendente' THEN 'negociacao'
    WHEN 'confirmado' THEN 'aprovado'
    WHEN 'cancelado' THEN 'recusado'
    ELSE variante END;
UPDATE status_orcamento SET nome = CASE nome
    WHEN 'Pendente' THEN 'Em negociação'
    WHEN 'Confirmado' THEN 'Aprovado'
    WHEN 'Cancelado' THEN 'Recusado'
    ELSE nome END;
ALTER TABLE status_orcamento
  ADD CONSTRAINT status_orcamento_variante_check CHECK (variante IN ('novo', 'negociacao', 'aprovado', 'recusado')),
  ADD COLUMN IF NOT EXISTS cor VARCHAR(20);
ALTER TABLE status_orcamento ALTER COLUMN variante SET DEFAULT 'negociacao';

-- Todo tenant com status precisa de uma coluna de entrada (variante novo)
INSERT INTO status_orcamento (tenant_id, nome, variante, ordem)
SELECT DISTINCT s.tenant_id, 'Novo orçamento', 'novo', 0
  FROM status_orcamento s
 WHERE NOT EXISTS (SELECT 1 FROM status_orcamento n WHERE n.tenant_id = s.tenant_id AND n.variante = 'novo');

-- Reordena 1..n seguindo o funil
WITH ordenado AS (
  SELECT id, row_number() OVER (
           PARTITION BY tenant_id
           ORDER BY array_position(ARRAY['novo', 'negociacao', 'aprovado', 'recusado']::text[], variante), ordem
         ) AS nova_ordem
    FROM status_orcamento
)
UPDATE status_orcamento s SET ordem = o.nova_ordem FROM ordenado o WHERE o.id = s.id;

UPDATE status_orcamento SET cor = CASE variante
    WHEN 'novo' THEN '#888888'
    WHEN 'negociacao' THEN '#E35336'
    WHEN 'aprovado' THEN '#4E8658'
    ELSE '#444444' END
 WHERE cor IS NULL;

-- eventos.status (texto livre) → eventos.status_id
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS status_id UUID REFERENCES status_orcamento(id) ON DELETE RESTRICT;
UPDATE eventos e SET status_id = (
  SELECT s.id FROM status_orcamento s
   WHERE s.tenant_id = e.tenant_id
     AND s.variante = CASE
           WHEN lower(e.status) IN ('confirmado', 'aprovado', 'eventos fechados', 'orçamento aprovado') THEN 'aprovado'
           WHEN lower(e.status) IN ('pendente', 'negociação em andamento', 'propostas enviadas', 'em negociação') THEN 'negociacao'
           WHEN lower(e.status) IN ('cancelado', 'recusado', 'orçamento recusado') THEN 'recusado'
           ELSE 'novo' END
   ORDER BY s.ordem LIMIT 1)
 WHERE e.status_id IS NULL;
ALTER TABLE eventos DROP COLUMN IF EXISTS status;
CREATE INDEX IF NOT EXISTS idx_eventos_status ON eventos (status_id);

DROP TABLE IF EXISTS pipeline_colunas;

-- ---------- Formatos de serviço (volante, buffet, ilhas, empratado…) ----------
CREATE TABLE IF NOT EXISTS formatos_servico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome VARCHAR(80) NOT NULL,
  descricao TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS formatos_servico_nome_unique ON formatos_servico (tenant_id, lower(nome));
SELECT aplicar_rls('formatos_servico');

-- ---------- Categorias de item: principal (tipo do alimento) e secundária (momento do serviço) ----------
CREATE TABLE IF NOT EXISTS categorias_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome VARCHAR(80) NOT NULL,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('principal', 'secundaria')),
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS categorias_item_nome_unique ON categorias_item (tenant_id, tipo, lower(nome));
SELECT aplicar_rls('categorias_item');

-- ---------- Locação do espaço por faixa de convidados ----------
CREATE TABLE IF NOT EXISTS faixas_locacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  min_convidados INTEGER NOT NULL CHECK (min_convidados >= 0),
  max_convidados INTEGER CHECK (max_convidados IS NULL OR max_convidados >= min_convidados),
  valor NUMERIC(10, 2) NOT NULL CHECK (valor >= 0),
  observacao TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
SELECT aplicar_rls('faixas_locacao');

-- ---------- Parâmetros comerciais da empresa ----------
CREATE TABLE IF NOT EXISTS configuracoes_tenant (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  validade_proposta_dias INTEGER NOT NULL DEFAULT 5 CHECK (validade_proposta_dias > 0),
  criancas_isentas_ate INTEGER NOT NULL DEFAULT 5 CHECK (criancas_isentas_ate >= 0),
  criancas_meia_ate INTEGER NOT NULL DEFAULT 11 CHECK (criancas_meia_ate >= 0),
  local_padrao VARCHAR(255),
  assinatura_nome VARCHAR(255),
  assinatura_cargo VARCHAR(255),
  assinatura_telefone VARCHAR(30),
  email_assunto VARCHAR(255) NOT NULL DEFAULT 'Proposta de orçamento - {evento}',
  email_corpo TEXT NOT NULL DEFAULT E'Olá {nome_cliente},\n\nAgradecemos o interesse em realizar o seu evento conosco! Segue em anexo a proposta de orçamento para {evento}, no dia {data_evento}.\n\nQualquer dúvida, estamos à disposição.\n\n{empresa}',
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
SELECT aplicar_rls('configuracoes_tenant');

-- ---------- Padrões de uma empresa nova (reutilizado no cadastro self-service) ----------
CREATE OR REPLACE FUNCTION aplicar_padroes_tenant(p_tenant UUID) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO configuracoes_tenant (tenant_id) VALUES (p_tenant) ON CONFLICT DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM status_orcamento WHERE tenant_id = p_tenant) THEN
    INSERT INTO status_orcamento (tenant_id, nome, variante, ordem, cor) VALUES
      (p_tenant, 'Novo orçamento', 'novo', 1, '#888888'),
      (p_tenant, 'Em negociação', 'negociacao', 2, '#E35336'),
      (p_tenant, 'Aprovado', 'aprovado', 3, '#4E8658'),
      (p_tenant, 'Recusado', 'recusado', 4, '#444444');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM tipos_evento WHERE tenant_id = p_tenant) THEN
    INSERT INTO tipos_evento (tenant_id, nome, descricao) VALUES
      (p_tenant, 'Social', 'Casamentos, aniversários, formaturas e celebrações em geral'),
      (p_tenant, 'Corporativo', 'Confraternizações, lançamentos, convenções e eventos de empresas');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM formatos_servico WHERE tenant_id = p_tenant) THEN
    INSERT INTO formatos_servico (tenant_id, nome, descricao, ordem) VALUES
      (p_tenant, 'Serviço volante', 'Garçons servindo os convidados, ideal para pessoas em pé', 1),
      (p_tenant, 'Buffet', 'Mesa de buffet em que o convidado se serve', 2),
      (p_tenant, 'Ilhas gastronômicas', 'Estações temáticas distribuídas pelo espaço', 3),
      (p_tenant, 'Empratado', 'Pratos montados e servidos à mesa', 4),
      (p_tenant, 'Coquetel', 'Finger foods e bebidas em formato de recepção', 5);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM categorias_item WHERE tenant_id = p_tenant) THEN
    INSERT INTO categorias_item (tenant_id, nome, tipo, ordem) VALUES
      (p_tenant, 'Salgado', 'principal', 1),
      (p_tenant, 'Doce', 'principal', 2),
      (p_tenant, 'Bebida', 'principal', 3),
      (p_tenant, 'Recepção', 'secundaria', 1),
      (p_tenant, 'Entrada', 'secundaria', 2),
      (p_tenant, 'Prato principal', 'secundaria', 3),
      (p_tenant, 'Sobremesa', 'secundaria', 4);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM faixas_locacao WHERE tenant_id = p_tenant) THEN
    INSERT INTO faixas_locacao (tenant_id, min_convidados, max_convidados, valor, observacao) VALUES
      (p_tenant, 0, 30, 1000, NULL),
      (p_tenant, 31, 50, 1500, NULL),
      (p_tenant, 51, 80, 2000, NULL),
      (p_tenant, 81, 110, 2500, 'Somente na modalidade coquetel');
  END IF;
END $$;

SELECT aplicar_padroes_tenant(id) FROM tenants;
