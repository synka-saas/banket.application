-- 023_documentos_visual.sql
-- Identidade visual própria dos modelos de documento (em vez de apontar para os templates da proposta):
-- logotipo com posição (cabeçalho ou rodapé; esquerda/centro/direita), rodapé opcional com texto, fontes e três
-- cores (primária = títulos, secundária = detalhes, texto). Página sempre A4, fundo branco, sem imagem de fundo.
-- documentos.visual guarda o snapshot usado na impressão (reimpressões saem iguais). template_id fica sem uso.

ALTER TABLE documento_modelos
  ADD COLUMN IF NOT EXISTS logo_path VARCHAR(255),
  ADD COLUMN IF NOT EXISTS logo_local VARCHAR(10) NOT NULL DEFAULT 'cabecalho',
  ADD COLUMN IF NOT EXISTS logo_alinhamento VARCHAR(10) NOT NULL DEFAULT 'centro',
  ADD COLUMN IF NOT EXISTS rodape_ativo BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS rodape_texto VARCHAR(500),
  ADD COLUMN IF NOT EXISTS fonte_titulo VARCHAR(80) NOT NULL DEFAULT 'Montserrat',
  ADD COLUMN IF NOT EXISTS fonte_corpo VARCHAR(80) NOT NULL DEFAULT 'Open Sans',
  ADD COLUMN IF NOT EXISTS cor_primaria VARCHAR(7) NOT NULL DEFAULT '#3A302A',
  ADD COLUMN IF NOT EXISTS cor_secundaria VARCHAR(7) NOT NULL DEFAULT '#807265',
  ADD COLUMN IF NOT EXISTS cor_texto VARCHAR(7) NOT NULL DEFAULT '#333333';

DO $$ BEGIN
  ALTER TABLE documento_modelos ADD CONSTRAINT documento_modelos_logo_local_check CHECK (logo_local IN ('nenhum', 'cabecalho', 'rodape'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE documento_modelos ADD CONSTRAINT documento_modelos_logo_alinhamento_check CHECK (logo_alinhamento IN ('esquerda', 'centro', 'direita'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE documentos ADD COLUMN IF NOT EXISTS visual JSONB;
