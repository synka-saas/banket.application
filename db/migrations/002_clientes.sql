-- 002_clientes.sql
-- Pessoa física ou jurídica, documento (CPF/CNPJ) e dados complementares.

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS tipo_pessoa VARCHAR(2) NOT NULL DEFAULT 'PF' CHECK (tipo_pessoa IN ('PF', 'PJ')),
  ADD COLUMN IF NOT EXISTS documento VARCHAR(14),
  ADD COLUMN IF NOT EXISTS endereco TEXT,
  ADD COLUMN IF NOT EXISTS observacoes TEXT;

-- Clientes com CNPJ conhecido nos dados de demonstração
UPDATE clientes SET tipo_pessoa = 'PJ' WHERE nome ILIKE '%corp%' OR nome ILIKE '%ltda%' OR nome ILIKE '%brasil%';

-- E-mail e documento únicos por empresa (quando informados)
CREATE UNIQUE INDEX IF NOT EXISTS clientes_email_unique ON clientes (tenant_id, lower(email)) WHERE email IS NOT NULL AND email <> '';
CREATE UNIQUE INDEX IF NOT EXISTS clientes_documento_unique ON clientes (tenant_id, documento) WHERE documento IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clientes_nome ON clientes (tenant_id, lower(nome));
