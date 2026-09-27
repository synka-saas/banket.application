-- 015_template_fundos_ia.sql
-- Galeria de imagens de fundo geradas por IA (por empresa e por página da proposta). A geração leva 1–2 min e roda
-- em segundo plano; o status fica aqui para a tela retomar o acompanhamento mesmo depois de trocar de página.
-- O arquivo pode ser compartilhado com templates (mesmo arquivo_path): só é apagado quando ninguém mais o usa.

CREATE TABLE IF NOT EXISTS template_fundos_ia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pagina VARCHAR(12) NOT NULL CHECK (pagina IN ('capa', 'miolo', 'contracapa')),
  status VARCHAR(10) NOT NULL DEFAULT 'gerando' CHECK (status IN ('gerando', 'pronto', 'erro')),
  arquivo_path TEXT,
  erro TEXT,
  cores JSONB NOT NULL DEFAULT '{}',
  criado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
SELECT aplicar_rls('template_fundos_ia');

CREATE INDEX IF NOT EXISTS idx_template_fundos_ia_lista ON template_fundos_ia (tenant_id, pagina, created_at DESC);
