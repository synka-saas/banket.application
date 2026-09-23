-- 013_auth_autoatendimento.sql
-- Cadastro self-service: verificação de e-mail, recuperação de senha, link de acesso por e-mail
-- e criação da empresa (tenant) pelo próprio cliente.

-- Novo tipo de token: link de acesso (login sem senha)
ALTER TABLE auth_tokens DROP CONSTRAINT IF EXISTS auth_tokens_tipo_check;
ALTER TABLE auth_tokens ADD CONSTRAINT auth_tokens_tipo_check
  CHECK (tipo IN ('verificacao_email', 'reset_senha', 'convite', 'link_acesso'));
CREATE INDEX IF NOT EXISTS idx_auth_tokens_email ON auth_tokens (lower(email), tipo, created_at DESC);

-- Celular de quem se cadastra (contato do responsável pela conta)
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefone VARCHAR(20);

-- Uma empresa por CPF/CNPJ: quem já tem empresa cadastrada entra por convite do administrador
CREATE UNIQUE INDEX IF NOT EXISTS tenants_documento_unique ON tenants (documento) WHERE documento IS NOT NULL;
