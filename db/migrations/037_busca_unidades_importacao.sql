-- Banket Busca: um perfil por unidade, com a conta por empresa (decisão de 17/10/2026), e importação da base de
-- buffets de São Paulo (scripts/importar-busca.mjs).
--  · busca_perfis deixa de ser único por empresa: uma rede tem um perfil por unidade, cada um ligado ao espaço da
--    unidade (busca_perfis.espaco_id, opcional: quem só atende em domicílio não tem espaço).
--  · tenants.origem_cadastro aceita 'importacao': empresa criada pela importação, ainda sem usuário (o fluxo de
--    reivindicação vincula o dono depois).
--  · busca_importacao guarda a linha original da planilha de cada perfil (rastreio e nova importação sem duplicar).
-- Compatibilidade: a versão anterior do código cria o perfil com ON CONFLICT (tenant_id), que deixa de ter índice
-- único. Na troca blue-green (ou num rollback) a cor antiga falha só ao criar o primeiro perfil de uma empresa.
-- Down (manual): DROP TABLE busca_importacao; ALTER TABLE busca_perfis DROP COLUMN espaco_id; recriar
--   busca_perfis_tenant_id_key (exige um perfil por empresa) e tenants_origem_cadastro_check sem 'importacao'.

ALTER TABLE busca_perfis DROP CONSTRAINT IF EXISTS busca_perfis_tenant_id_key;
ALTER TABLE busca_perfis ADD COLUMN IF NOT EXISTS espaco_id UUID REFERENCES espacos(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_busca_perfis_espaco ON busca_perfis (espaco_id) WHERE espaco_id IS NOT NULL;

ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_origem_cadastro_check;
ALTER TABLE tenants ADD CONSTRAINT tenants_origem_cadastro_check CHECK (origem_cadastro IN ('site', 'busca', 'importacao'));

CREATE TABLE IF NOT EXISTS busca_importacao (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  perfil_id    UUID NOT NULL UNIQUE REFERENCES busca_perfis(id) ON DELETE CASCADE,
  place_id     VARCHAR(120) NOT NULL UNIQUE,          -- id do Google Maps da linha
  lote         VARCHAR(80) NOT NULL,                  -- nome do arquivo importado
  dados        JSONB NOT NULL,                        -- linha original (sem nota e avaliações do Google)
  importado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
SELECT aplicar_rls('busca_importacao');
