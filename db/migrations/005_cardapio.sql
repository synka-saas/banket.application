-- 005_cardapio.sql
-- Catálogo do cardápio (sessões e itens com preço, categorias, restrições e dados operacionais)
-- e opções prontas de cardápio ("pacotes") normalizadas em sessões e itens.

-- ---------- Sessões ----------
ALTER TABLE catalogo_secoes
  ADD COLUMN IF NOT EXISTS descricao TEXT,
  ADD COLUMN IF NOT EXISTS ordem INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS preco NUMERIC(10, 2) CHECK (preco IS NULL OR preco >= 0),
  ADD COLUMN IF NOT EXISTS unidade_cobranca VARCHAR(10) NOT NULL DEFAULT 'pessoa' CHECK (unidade_cobranca IN ('pessoa', 'unidade')),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS catalogo_secoes_nome_unique ON catalogo_secoes (tenant_id, lower(nome));

-- ---------- Itens ----------
DELETE FROM catalogo_itens WHERE secao_id IS NULL;
ALTER TABLE catalogo_itens
  ALTER COLUMN secao_id SET NOT NULL,
  ADD COLUMN IF NOT EXISTS categoria_principal_id UUID REFERENCES categorias_item(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS categoria_secundaria_id UUID REFERENCES categorias_item(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS formato_servico_id UUID REFERENCES formatos_servico(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS custo_unitario NUMERIC(10, 2) CHECK (custo_unitario IS NULL OR custo_unitario >= 0),
  ADD COLUMN IF NOT EXISTS preco NUMERIC(10, 2) CHECK (preco IS NULL OR preco >= 0),
  ADD COLUMN IF NOT EXISTS unidade_cobranca VARCHAR(10) NOT NULL DEFAULT 'pessoa' CHECK (unidade_cobranca IN ('pessoa', 'unidade')),
  ADD COLUMN IF NOT EXISTS composicao TEXT,
  ADD COLUMN IF NOT EXISTS restricoes TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dados_operacionais TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS catalogo_itens_nome_unique ON catalogo_itens (secao_id, lower(nome));
CREATE INDEX IF NOT EXISTS idx_catalogo_itens_categoria ON catalogo_itens (categoria_principal_id);

-- ---------- Opções prontas de cardápio ----------
ALTER TABLE orcamento_opcoes RENAME TO cardapio_opcoes;
ALTER TABLE cardapio_opcoes
  DROP COLUMN IF EXISTS conteudo,
  ADD COLUMN IF NOT EXISTS descricao TEXT,
  ADD COLUMN IF NOT EXISTS duracao_horas NUMERIC(4, 1) CHECK (duracao_horas IS NULL OR duracao_horas > 0),
  ADD COLUMN IF NOT EXISTS formato_servico_id UUID REFERENCES formatos_servico(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT now();
ALTER INDEX IF EXISTS idx_orcamento_opcoes_tenant RENAME TO idx_cardapio_opcoes_tenant;
SELECT aplicar_rls('cardapio_opcoes');

-- Sessões de uma opção. "titulo" permite exibir outro nome (ex.: "Primeiro prato" a partir da sessão
-- "Pratos principais"); "escolha_qtd" = quantos itens o cliente escolhe ("escolha 2 opções").
CREATE TABLE IF NOT EXISTS cardapio_opcao_secoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  opcao_id UUID NOT NULL REFERENCES cardapio_opcoes(id) ON DELETE CASCADE,
  secao_id UUID NOT NULL REFERENCES catalogo_secoes(id) ON DELETE CASCADE,
  titulo VARCHAR(120),
  escolha_qtd INTEGER CHECK (escolha_qtd IS NULL OR escolha_qtd > 0),
  preco NUMERIC(10, 2) CHECK (preco IS NULL OR preco >= 0),
  ordem INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_cardapio_opcao_secoes_opcao ON cardapio_opcao_secoes (opcao_id, ordem);
SELECT aplicar_rls('cardapio_opcao_secoes');

CREATE TABLE IF NOT EXISTS cardapio_opcao_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  opcao_secao_id UUID NOT NULL REFERENCES cardapio_opcao_secoes(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES catalogo_itens(id) ON DELETE CASCADE,
  preco NUMERIC(10, 2) CHECK (preco IS NULL OR preco >= 0),
  ordem INTEGER NOT NULL DEFAULT 0,
  UNIQUE (opcao_secao_id, item_id)
);
CREATE INDEX IF NOT EXISTS idx_cardapio_opcao_itens_item ON cardapio_opcao_itens (item_id);
SELECT aplicar_rls('cardapio_opcao_itens');
