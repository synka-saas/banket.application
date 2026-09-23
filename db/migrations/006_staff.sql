-- 006_staff.sql
-- Serviços de staff (funções com custo e regra de dimensionamento) e base de profissionais.

-- Regra de quantidade:
--   * proporcional: max(minimo, ceil(convidados / convidados_por_profissional))
--   * por_evento: quantidade_fixa, independentemente do número de convidados
CREATE TABLE IF NOT EXISTS staff_servicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  funcao VARCHAR(80) NOT NULL,
  descricao TEXT,
  cache_diaria NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (cache_diaria >= 0),
  hora_extra NUMERIC(10, 2) CHECK (hora_extra IS NULL OR hora_extra >= 0),
  auxilio NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (auxilio >= 0),
  por_evento BOOLEAN NOT NULL DEFAULT false,
  quantidade_fixa INTEGER NOT NULL DEFAULT 1 CHECK (quantidade_fixa > 0),
  convidados_por_profissional INTEGER CHECK (convidados_por_profissional IS NULL OR convidados_por_profissional > 0),
  minimo INTEGER NOT NULL DEFAULT 0 CHECK (minimo >= 0),
  incluir_por_padrao BOOLEAN NOT NULL DEFAULT true,
  tags TEXT[] NOT NULL DEFAULT '{}',
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  CHECK (por_evento OR convidados_por_profissional IS NOT NULL OR minimo > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS staff_servicos_funcao_unique ON staff_servicos (tenant_id, lower(funcao));
SELECT aplicar_rls('staff_servicos');

CREATE TABLE IF NOT EXISTS profissionais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  telefone VARCHAR(20),
  documento VARCHAR(14),
  servico_id UUID REFERENCES staff_servicos(id) ON DELETE SET NULL,
  chave_pix VARCHAR(140),
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profissionais_servico ON profissionais (servico_id);
CREATE UNIQUE INDEX IF NOT EXISTS profissionais_documento_unique ON profissionais (tenant_id, documento) WHERE documento IS NOT NULL;
SELECT aplicar_rls('profissionais');
