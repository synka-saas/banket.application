-- 003_saas_auth.sql
-- Dados da empresa (tenant), papéis de usuário, status do vínculo e tokens de autenticação
-- (verificação de e-mail, redefinição de senha, convites).

-- Helper para as próximas migrations: habilita RLS forçado + política padrão por tenant_id.
CREATE OR REPLACE FUNCTION aplicar_rls(tabela text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tabela);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tabela);
  EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', tabela);
  EXECUTE format(
    'CREATE POLICY tenant_isolation ON %I USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id())',
    tabela
  );
  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (tenant_id)', 'idx_' || tabela || '_tenant', tabela);
END $$;

-- Empresa
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS tipo_pessoa VARCHAR(2) NOT NULL DEFAULT 'PJ' CHECK (tipo_pessoa IN ('PF', 'PJ')),
  ADD COLUMN IF NOT EXISTS razao_social VARCHAR(255),
  ADD COLUMN IF NOT EXISTS email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS telefone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS endereco TEXT,
  ADD COLUMN IF NOT EXISTS logo_path TEXT,
  ADD COLUMN IF NOT EXISTS segmento VARCHAR(100),
  ADD COLUMN IF NOT EXISTS porte VARCHAR(50),
  ADD COLUMN IF NOT EXISTS onboarding_completo BOOLEAN NOT NULL DEFAULT false;

UPDATE tenants SET onboarding_completo = true;

-- Papéis: owner (proprietário), admin, usuario
UPDATE tenant_usuarios SET role = 'usuario' WHERE role NOT IN ('owner', 'admin', 'usuario') OR role IS NULL;
ALTER TABLE tenant_usuarios
  ALTER COLUMN role SET DEFAULT 'usuario',
  ALTER COLUMN role SET NOT NULL,
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE tenant_usuarios DROP CONSTRAINT IF EXISTS tenant_usuarios_role_check;
ALTER TABLE tenant_usuarios ADD CONSTRAINT tenant_usuarios_role_check CHECK (role IN ('owner', 'admin', 'usuario'));

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email_verificado_em TIMESTAMP;
UPDATE usuarios SET email_verificado_em = created_at WHERE email_verificado_em IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_email_lower_unique ON usuarios (lower(email));

-- Tokens de uso único. A conexão de sistema acessa tudo; o app só enxerga os convites do próprio tenant.
CREATE TABLE IF NOT EXISTS auth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('verificacao_email', 'reset_senha', 'convite')),
  token_hash TEXT NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  payload JSONB NOT NULL DEFAULT '{}',
  expira_em TIMESTAMP NOT NULL,
  usado_em TIMESTAMP,
  criado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_tenant ON auth_tokens (tenant_id, tipo);
ALTER TABLE auth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_tokens FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS convites_do_tenant ON auth_tokens;
CREATE POLICY convites_do_tenant ON auth_tokens
  USING (tipo = 'convite' AND tenant_id = app_tenant_id())
  WITH CHECK (tipo = 'convite' AND tenant_id = app_tenant_id());
