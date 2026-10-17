-- 040_empresa_endereco.sql
-- Endereço da empresa desmembrado (Configurações › Empresa: CEP com a ViaCEP, logradouro, número, complemento, bairro,
-- cidade, UF). tenants.endereco continua como o texto montado a partir das partes (propostas, documentos, Stripe) e é
-- regravado a cada salvamento. O cadastro inicial não pede mais endereço.
-- Backfill: o texto livre que já existia vai para o logradouro, para não se perder (a empresa ajusta as partes).
--
-- Down (o runner não aplica): ALTER TABLE tenants DROP COLUMN cep, logradouro, numero, complemento, bairro, cidade, uf;

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS cep         VARCHAR(8),
  ADD COLUMN IF NOT EXISTS logradouro  VARCHAR(255),
  ADD COLUMN IF NOT EXISTS numero      VARCHAR(20),
  ADD COLUMN IF NOT EXISTS complemento VARCHAR(120),
  ADD COLUMN IF NOT EXISTS bairro      VARCHAR(120),
  ADD COLUMN IF NOT EXISTS cidade      VARCHAR(120),
  ADD COLUMN IF NOT EXISTS uf          CHAR(2);

UPDATE tenants SET logradouro = left(trim(endereco), 255)
 WHERE logradouro IS NULL AND numero IS NULL AND cidade IS NULL AND nullif(trim(endereco), '') IS NOT NULL;
