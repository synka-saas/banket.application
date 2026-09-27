-- Rodapé das páginas de conteúdo passa a usar o logotipo principal do template: só liga/desliga e posição.
-- rodape_logo_path continua existindo (compatibilidade com a versão anterior no deploy blue-green); deixa de ser usado.
ALTER TABLE orcamento_templates
  ADD COLUMN IF NOT EXISTS rodape_logo_ativo BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rodape_logo_posicao VARCHAR(10) NOT NULL DEFAULT 'direita';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orcamento_templates_rodape_logo_posicao_check') THEN
    ALTER TABLE orcamento_templates ADD CONSTRAINT orcamento_templates_rodape_logo_posicao_check
      CHECK (rodape_logo_posicao IN ('esquerda', 'centro', 'direita'));
  END IF;
END $$;

-- Quem já tinha um logo no rodapé continua vendo logo no rodapé
UPDATE orcamento_templates SET rodape_logo_ativo = true WHERE rodape_logo_path IS NOT NULL;
