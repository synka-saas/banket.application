-- 008_orcamento_versoes.sql
-- Orçamento versionado: um orçamento por evento, com versões numeradas. Só a versão atual é editável;
-- criar uma nova versão congela a anterior (snapshot). O status comercial vive no evento (eventos.status_id).

CREATE TABLE IF NOT EXISTS orcamento_versoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  orcamento_id UUID NOT NULL REFERENCES orcamentos(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL CHECK (numero > 0),
  conteudo JSONB NOT NULL DEFAULT '{}',
  valor_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  congelada BOOLEAN NOT NULL DEFAULT false,
  criado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  pdf_path TEXT,
  pdf_gerado_em TIMESTAMP,
  enviado_em TIMESTAMP,
  enviado_para VARCHAR(255),
  UNIQUE (orcamento_id, numero)
);
CREATE INDEX IF NOT EXISTS idx_orcamento_versoes_orcamento ON orcamento_versoes (orcamento_id, numero DESC);
SELECT aplicar_rls('orcamento_versoes');

-- Só uma versão editável por orçamento
CREATE UNIQUE INDEX IF NOT EXISTS orcamento_versoes_uma_aberta ON orcamento_versoes (orcamento_id) WHERE NOT congelada;

ALTER TABLE orcamentos
  ADD COLUMN IF NOT EXISTS versao_atual INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES orcamento_templates(id) ON DELETE SET NULL;

-- Status passou para o evento; tipo de serviço passou para o formato de serviço do evento
ALTER TABLE orcamentos DROP COLUMN IF EXISTS status_id;
ALTER TABLE orcamentos DROP COLUMN IF EXISTS tipo_servico_id;
ALTER TABLE orcamentos DROP COLUMN IF EXISTS pdf_url;
ALTER TABLE orcamentos DROP COLUMN IF EXISTS enviado_email;
ALTER TABLE orcamentos DROP COLUMN IF EXISTS data_envio;
ALTER TABLE orcamentos ALTER COLUMN evento_id SET NOT NULL;
ALTER TABLE orcamentos ALTER COLUMN valor_total SET DEFAULT 0;
UPDATE orcamentos SET valor_total = 0 WHERE valor_total IS NULL;
ALTER TABLE orcamentos ALTER COLUMN valor_total SET NOT NULL;
ALTER TABLE orcamentos ALTER COLUMN valor_total TYPE NUMERIC(12, 2);

-- Orçamentos antigos viram a versão 1 (conteúdo vazio é normalizado pela aplicação; o total é preservado)
INSERT INTO orcamento_versoes (tenant_id, orcamento_id, numero, conteudo, valor_total, created_at)
SELECT o.tenant_id, o.id, 1,
       jsonb_build_object('total_manual', CASE WHEN o.valor_total > 0 THEN o.valor_total END),
       o.valor_total, o.created_at
  FROM orcamentos o
 WHERE NOT EXISTS (SELECT 1 FROM orcamento_versoes v WHERE v.orcamento_id = o.id);
ALTER TABLE orcamentos DROP COLUMN IF EXISTS conteudo;
