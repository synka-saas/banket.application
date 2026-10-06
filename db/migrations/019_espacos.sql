-- 019_espacos.sql
-- Espaços de eventos: próprios (gestão de locação por faixa de convidados) e de terceiros (dados gerais).
--   - tabela espacos (RLS por empresa);
--   - faixas_locacao.espaco_id: as faixas passam a pertencer a um espaço próprio;
--   - configuracoes_tenant.espaco_padrao_id substitui o texto livre local_padrao (coluna mantida, sem uso);
--   - eventos.espaco_id: espaço escolhido no briefing (local_tipo/local_nome continuam como espelho).
-- Backfill: um espaço próprio por empresa (nome = Local padrão ou "Nosso espaço"), com as faixas existentes e os
-- eventos "no nosso espaço" ligados a ele. Compatível com a versão anterior do código (colunas novas nullable).

CREATE TABLE IF NOT EXISTS espacos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome VARCHAR(120) NOT NULL,
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('proprio', 'terceiro')),
  descricao TEXT,
  endereco VARCHAR(500),
  cidade VARCHAR(120),
  capacidade_min INTEGER CHECK (capacidade_min IS NULL OR capacidade_min >= 0),
  capacidade_max INTEGER CHECK (capacidade_max IS NULL OR capacidade_max >= COALESCE(capacidade_min, 0)),
  contato_nome VARCHAR(255),
  contato_telefone VARCHAR(20),
  contato_email VARCHAR(255),
  valor_referencia NUMERIC(10, 2) CHECK (valor_referencia IS NULL OR valor_referencia >= 0),
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS espacos_nome_unique ON espacos (tenant_id, lower(nome));
SELECT aplicar_rls('espacos');

ALTER TABLE faixas_locacao ADD COLUMN IF NOT EXISTS espaco_id UUID REFERENCES espacos(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_faixas_locacao_espaco ON faixas_locacao (espaco_id);

ALTER TABLE configuracoes_tenant ADD COLUMN IF NOT EXISTS espaco_padrao_id UUID REFERENCES espacos(id) ON DELETE SET NULL;

ALTER TABLE eventos ADD COLUMN IF NOT EXISTS espaco_id UUID REFERENCES espacos(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_eventos_espaco ON eventos (espaco_id);

-- Backfill: um espaço próprio por empresa, faixas e eventos "na casa" ligados a ele
DO $$
DECLARE
  t RECORD;
  v_espaco UUID;
BEGIN
  FOR t IN
    SELECT tn.id, COALESCE(NULLIF(trim(c.local_padrao), ''), 'Nosso espaço') AS nome
      FROM tenants tn LEFT JOIN configuracoes_tenant c ON c.tenant_id = tn.id
  LOOP
    SELECT id INTO v_espaco FROM espacos WHERE tenant_id = t.id AND tipo = 'proprio' ORDER BY ordem, created_at LIMIT 1;
    IF v_espaco IS NULL THEN
      INSERT INTO espacos (tenant_id, nome, tipo, ordem) VALUES (t.id, left(t.nome, 120), 'proprio', 1) RETURNING id INTO v_espaco;
    END IF;
    UPDATE faixas_locacao SET espaco_id = v_espaco WHERE tenant_id = t.id AND espaco_id IS NULL;
    UPDATE configuracoes_tenant SET espaco_padrao_id = v_espaco WHERE tenant_id = t.id AND espaco_padrao_id IS NULL;
    UPDATE eventos SET espaco_id = v_espaco WHERE tenant_id = t.id AND espaco_id IS NULL AND local_tipo = 'casa';
  END LOOP;
END $$;

-- Padrões de uma empresa nova: mesma função da 018, mais o espaço "Nosso espaço" com as 4 faixas ligadas a ele
CREATE OR REPLACE FUNCTION aplicar_padroes_tenant(p_tenant UUID) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE v_espaco UUID;
BEGIN
  INSERT INTO configuracoes_tenant (tenant_id) VALUES (p_tenant) ON CONFLICT DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM status_orcamento WHERE tenant_id = p_tenant) THEN
    INSERT INTO status_orcamento (tenant_id, nome, variante, ordem, cor) VALUES
      (p_tenant, 'Novo orçamento', 'novo', 1, '#B0A194'),
      (p_tenant, 'Em negociação', 'negociacao', 2, '#E35336'),
      (p_tenant, 'Aprovado', 'aprovado', 3, '#5E8B65'),
      (p_tenant, 'Recusado', 'recusado', 4, '#3A302A');
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

  SELECT id INTO v_espaco FROM espacos WHERE tenant_id = p_tenant AND tipo = 'proprio' ORDER BY ordem, created_at LIMIT 1;
  IF v_espaco IS NULL THEN
    INSERT INTO espacos (tenant_id, nome, tipo, ordem) VALUES (p_tenant, 'Nosso espaço', 'proprio', 1) RETURNING id INTO v_espaco;
  END IF;
  UPDATE configuracoes_tenant SET espaco_padrao_id = v_espaco WHERE tenant_id = p_tenant AND espaco_padrao_id IS NULL;

  IF NOT EXISTS (SELECT 1 FROM faixas_locacao WHERE tenant_id = p_tenant) THEN
    INSERT INTO faixas_locacao (tenant_id, espaco_id, min_convidados, max_convidados, valor, observacao) VALUES
      (p_tenant, v_espaco, 0, 30, 1000, NULL),
      (p_tenant, v_espaco, 31, 50, 1500, NULL),
      (p_tenant, v_espaco, 51, 80, 2000, NULL),
      (p_tenant, v_espaco, 81, 110, 2500, 'Somente na modalidade coquetel');
  END IF;
END $$;
