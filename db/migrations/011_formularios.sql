-- 011_formularios.sql
-- Formulários públicos de captação. A estrutura (sessões e perguntas padrão) vem do modelo em
-- src/lib/formularios/modelo.ts; aqui fica só a configuração de cada formulário e as respostas recebidas.

CREATE TABLE IF NOT EXISTS formularios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome VARCHAR(120) NOT NULL,
  descricao TEXT,
  -- Único entre todos os tenants: a página pública /f/<slug> descobre o tenant pelo slug
  slug VARCHAR(80) NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  ativo BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}',
  mensagem_sucesso TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
SELECT aplicar_rls('formularios');

CREATE TABLE IF NOT EXISTS formulario_respostas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  formulario_id UUID REFERENCES formularios(id) ON DELETE SET NULL,
  evento_id UUID REFERENCES eventos(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  -- Snapshot legível: [{secao, chave, rotulo, valor}]
  dados JSONB NOT NULL DEFAULT '[]',
  ip VARCHAR(64),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_formulario_respostas_formulario ON formulario_respostas (formulario_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_formulario_respostas_evento ON formulario_respostas (evento_id);
SELECT aplicar_rls('formulario_respostas');

-- Formulário de contato padrão de uma empresa (config vazia = modelo completo)
CREATE OR REPLACE FUNCTION aplicar_padroes_formulario(p_tenant UUID) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM formularios WHERE tenant_id = p_tenant) THEN
    INSERT INTO formularios (tenant_id, nome, descricao, slug)
    VALUES (p_tenant, 'Formulário de contato', 'Triagem inicial de pedidos de orçamento (corporativo e social).',
            'contato-' || substr(md5(random()::text || p_tenant::text), 1, 6));
  END IF;
END $$;

SELECT aplicar_padroes_formulario(id) FROM tenants;

CREATE OR REPLACE FUNCTION aplicar_padroes_tenant_completo(p_tenant UUID) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM aplicar_padroes_tenant(p_tenant);
  PERFORM aplicar_padroes_tenant_proposta(p_tenant);
  PERFORM aplicar_padroes_formulario(p_tenant);
END $$;
