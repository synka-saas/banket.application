-- 009_templates_blocos.sql
-- Templates visuais da proposta (fontes, cores, capa, páginas de conteúdo e contracapa)
-- e blocos de texto reutilizáveis inseridos em partes específicas da proposta.

-- ---------- Templates ----------
ALTER TABLE orcamento_templates
  DROP COLUMN IF EXISTS capa_margem_superior_mm,
  DROP COLUMN IF EXISTS capa_margem_inferior_mm,
  DROP COLUMN IF EXISTS contracapa_margem_superior_mm,
  DROP COLUMN IF EXISTS contracapa_margem_inferior_mm,
  DROP COLUMN IF EXISTS miolo_margem_superior_mm,
  DROP COLUMN IF EXISTS miolo_margem_inferior_mm,
  DROP COLUMN IF EXISTS miolo_ativa,
  DROP COLUMN IF EXISTS contracapa_posterior_ativa,
  DROP COLUMN IF EXISTS contracapa_posterior_imagem_url,
  DROP COLUMN IF EXISTS contracapa_posterior_margem_superior_mm,
  DROP COLUMN IF EXISTS contracapa_posterior_margem_inferior_mm;

ALTER TABLE orcamento_templates RENAME COLUMN capa_imagem_url TO capa_imagem_path;
ALTER TABLE orcamento_templates RENAME COLUMN contracapa_imagem_url TO contracapa_imagem_path;
ALTER TABLE orcamento_templates RENAME COLUMN miolo_imagem_url TO miolo_imagem_path;

ALTER TABLE orcamento_templates
  ADD COLUMN IF NOT EXISTS descricao TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cor_fundo VARCHAR(20) NOT NULL DEFAULT '#FFFFFF',
  ADD COLUMN IF NOT EXISTS logo_path TEXT,
  ADD COLUMN IF NOT EXISTS capa_titulo VARCHAR(120) NOT NULL DEFAULT 'Proposta de orçamento',
  ADD COLUMN IF NOT EXISTS capa_conteudo TEXT DEFAULT 'Para o sucesso do seu evento',
  ADD COLUMN IF NOT EXISTS miolo_titulo VARCHAR(120) NOT NULL DEFAULT 'Proposta de orçamento',
  ADD COLUMN IF NOT EXISTS miolo_introducao TEXT DEFAULT 'Apresentamos abaixo uma proposta de orçamento para realização do seu evento, com os respectivos serviços. Estamos abertos a eventuais alterações que viabilizem melhor servi-los e à disposição para esclarecer quaisquer dúvidas.',
  ADD COLUMN IF NOT EXISTS rodape_logo_path TEXT,
  ADD COLUMN IF NOT EXISTS rodape_titulo VARCHAR(120),
  ADD COLUMN IF NOT EXISTS rodape_conteudo TEXT,
  ADD COLUMN IF NOT EXISTS contracapa_titulo VARCHAR(120),
  ADD COLUMN IF NOT EXISTS contracapa_conteudo TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT now();

ALTER TABLE orcamento_templates ALTER COLUMN contracapa_ativa SET DEFAULT false;
ALTER TABLE orcamento_templates ALTER COLUMN fonte_titulo SET DEFAULT 'Archivo Black';
ALTER TABLE orcamento_templates ALTER COLUMN fonte_corpo SET DEFAULT 'Open Sans';
ALTER TABLE orcamento_templates ALTER COLUMN cor_texto_primaria SET DEFAULT '#4A1A0E';
ALTER TABLE orcamento_templates ALTER COLUMN cor_texto_secundaria SET DEFAULT '#A61E00';

-- ---------- Blocos de texto da proposta ----------
-- "pagina" indica onde o bloco entra na proposta; "texto" usa marcação simples:
--   "## Subtítulo", "- item de lista", "**negrito**" e parágrafos separados por linha em branco.
ALTER TABLE orcamento_blocos_info DROP COLUMN IF EXISTS conteudo;
ALTER TABLE orcamento_blocos_info
  ADD COLUMN IF NOT EXISTS pagina VARCHAR(20) NOT NULL DEFAULT 'informacoes'
    CHECK (pagina IN ('cardapio', 'bebidas', 'staff', 'informacoes', 'condicoes')),
  ADD COLUMN IF NOT EXISTS texto TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT now();
ALTER TABLE orcamento_blocos_info ALTER COLUMN chave SET DEFAULT gen_random_uuid()::text;

-- Orçamento: template escolhido (padrão da empresa quando vazio)
-- (orcamentos.template_id já existe desde a migration 008)

-- ---------- Padrões de empresa nova: agora também template e blocos ----------
CREATE OR REPLACE FUNCTION aplicar_padroes_tenant_proposta(p_tenant UUID) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM orcamento_templates WHERE tenant_id = p_tenant) THEN
    INSERT INTO orcamento_templates (tenant_id, nome, descricao, padrao, cor_fundo, tags)
    VALUES (p_tenant, 'Template padrão', 'Capa com título, páginas em fundo claro e títulos em destaque.', true, '#FFF9F2', '{Padrão}');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM orcamento_blocos_info WHERE tenant_id = p_tenant) THEN
    INSERT INTO orcamento_blocos_info (tenant_id, chave, titulo, pagina, ordem, ativo_por_padrao, texto) VALUES
      (p_tenant, 'criancas', 'Crianças', 'informacoes', 1, true,
       E'- Até 5 anos – não paga\n- De 6 a 11 anos – paga meia\n- Acima de 11 anos – paga inteira'),
      (p_tenant, 'hora_adicional', 'Hora adicional', 'informacoes', 2, true,
       'Caso o evento ultrapasse o horário contratado, será cobrado um acréscimo por hora adicional.'),
      (p_tenant, 'formas_pagamento', 'Formas de pagamento', 'condicoes', 3, true,
       E'- Transferência bancária\n- Pix\n- Cartão de débito ou crédito (sujeito a acréscimo)\n\nHavendo alteração no número de convidados, os valores da proposta poderão sofrer alterações.');
  END IF;
END $$;

SELECT aplicar_padroes_tenant_proposta(id) FROM tenants;

-- aplicar_padroes_tenant passa a chamar também os padrões da proposta
CREATE OR REPLACE FUNCTION aplicar_padroes_tenant_completo(p_tenant UUID) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM aplicar_padroes_tenant(p_tenant);
  PERFORM aplicar_padroes_tenant_proposta(p_tenant);
END $$;
