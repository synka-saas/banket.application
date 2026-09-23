-- 007_eventos.sql
-- Briefing completo do evento (dados captados pelo formulário ou cadastrados manualmente),
-- checklist operacional e linha do tempo. Remove as tabelas antigas de cardápio/equipe por evento,
-- substituídas pelo orçamento versionado.

-- data_evento passa a ser só a data; horários ficam em colunas próprias
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS hora_inicio TIME;
UPDATE eventos SET hora_inicio = data_evento::time WHERE data_evento IS NOT NULL AND data_evento::time <> '00:00';
ALTER TABLE eventos ALTER COLUMN data_evento TYPE DATE USING data_evento::date;

ALTER TABLE eventos
  ADD COLUMN IF NOT EXISTS titulo VARCHAR(200),
  ADD COLUMN IF NOT EXISTS formato_servico_id UUID REFERENCES formatos_servico(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hora_fim TIME,
  ADD COLUMN IF NOT EXISTS duracao_evento_horas NUMERIC(4, 1) CHECK (duracao_evento_horas IS NULL OR duracao_evento_horas > 0),
  ADD COLUMN IF NOT EXISTS duracao_alimentacao_horas NUMERIC(4, 1) CHECK (duracao_alimentacao_horas IS NULL OR duracao_alimentacao_horas > 0),
  ADD COLUMN IF NOT EXISTS perfil_convidados VARCHAR(120),
  ADD COLUMN IF NOT EXISTS local_tipo VARCHAR(10) NOT NULL DEFAULT 'casa' CHECK (local_tipo IN ('casa', 'externo')),
  ADD COLUMN IF NOT EXISTS local_nome VARCHAR(255),
  ADD COLUMN IF NOT EXISTS endereco TEXT,
  ADD COLUMN IF NOT EXISTS infraestrutura TEXT,
  ADD COLUMN IF NOT EXISTS verba_total NUMERIC(12, 2) CHECK (verba_total IS NULL OR verba_total >= 0),
  ADD COLUMN IF NOT EXISTS verba_por_pessoa NUMERIC(10, 2) CHECK (verba_por_pessoa IS NULL OR verba_por_pessoa >= 0),
  ADD COLUMN IF NOT EXISTS forma_pagamento VARCHAR(255),
  ADD COLUMN IF NOT EXISTS qualificacao VARCHAR(10) CHECK (qualificacao IS NULL OR qualificacao IN ('alta', 'media', 'baixa')),
  ADD COLUMN IF NOT EXISTS responsavel_nome VARCHAR(255),
  ADD COLUMN IF NOT EXISTS responsavel_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS responsavel_whatsapp VARCHAR(20),
  ADD COLUMN IF NOT EXISTS convite_experiencia VARCHAR(255),
  ADD COLUMN IF NOT EXISTS estilo_principal TEXT,
  ADD COLUMN IF NOT EXISTS estilo_secundario TEXT,
  ADD COLUMN IF NOT EXISTS bebidas_alcoolicas TEXT,
  ADD COLUMN IF NOT EXISTS bebidas_sem_alcool TEXT,
  ADD COLUMN IF NOT EXISTS restricoes TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS compliance TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS staff_terceiros VARCHAR(255),
  ADD COLUMN IF NOT EXISTS comentario_cliente TEXT,
  ADD COLUMN IF NOT EXISTS origem VARCHAR(12) NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual', 'formulario')),
  ADD COLUMN IF NOT EXISTS criado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL;

UPDATE eventos SET local_nome = configuracoes->>'espaco' WHERE local_nome IS NULL AND configuracoes ? 'espaco';
ALTER TABLE eventos DROP COLUMN IF EXISTS configuracoes;
CREATE INDEX IF NOT EXISTS idx_eventos_tenant_data ON eventos (tenant_id, data_evento);

-- Checklist operacional (degustação, laudos, documentos…)
CREATE TABLE IF NOT EXISTS evento_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  evento_id UUID NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  item VARCHAR(255) NOT NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'agendado', 'enviado', 'concluido')),
  prazo DATE,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_evento_checklist_evento ON evento_checklist (evento_id, ordem);
SELECT aplicar_rls('evento_checklist');

-- Linha do tempo: histórico de tudo o que acontece com o evento
CREATE TABLE IF NOT EXISTS evento_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  evento_id UUID NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  tipo VARCHAR(40) NOT NULL,
  descricao TEXT NOT NULL,
  dados JSONB NOT NULL DEFAULT '{}',
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_evento_timeline_evento ON evento_timeline (evento_id, created_at DESC);
SELECT aplicar_rls('evento_timeline');

-- Registro inicial para eventos existentes
INSERT INTO evento_timeline (tenant_id, evento_id, tipo, descricao, created_at)
SELECT tenant_id, id, 'criado', 'Evento cadastrado', created_at FROM eventos e
 WHERE NOT EXISTS (SELECT 1 FROM evento_timeline t WHERE t.evento_id = e.id);

-- Cardápio e equipe por evento agora vivem no orçamento versionado
DROP TABLE IF EXISTS evento_cardapio_itens;
DROP TABLE IF EXISTS evento_cardapio_secoes;
DROP TABLE IF EXISTS evento_equipe;
