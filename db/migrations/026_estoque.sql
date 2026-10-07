-- 026_estoque.sql
-- Estoque da empresa: itens consumíveis (ingredientes, produtos prontos) e não consumíveis (pratos, talheres…),
-- com saldo atual, mínimo e custo, e o histórico de movimentações (entrada, saída e ajuste por contagem).
-- Um item do cardápio pode ser "gerenciado no estoque": fica ligado a um item de estoque (catalogo_item_id) e a
-- lista de compras do orçamento compara a quantidade necessária com o saldo.
-- Compatível com a versão anterior do código (só tabelas novas).

CREATE TABLE IF NOT EXISTS estoque_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome VARCHAR(200) NOT NULL,
  tipo VARCHAR(16) NOT NULL DEFAULT 'consumivel' CHECK (tipo IN ('consumivel', 'nao_consumivel')),
  categoria VARCHAR(80),
  unidade VARCHAR(5) NOT NULL DEFAULT 'un' CHECK (unidade IN ('g', 'kg', 'ml', 'l', 'un')),
  quantidade NUMERIC(14, 3) NOT NULL DEFAULT 0,
  estoque_minimo NUMERIC(14, 3) CHECK (estoque_minimo IS NULL OR estoque_minimo >= 0),
  custo_unitario NUMERIC(12, 2) CHECK (custo_unitario IS NULL OR custo_unitario >= 0),
  local VARCHAR(120),
  observacoes TEXT,
  -- Item do cardápio gerenciado no estoque (um item de estoque por item do cardápio)
  catalogo_item_id UUID UNIQUE REFERENCES catalogo_itens(id) ON DELETE SET NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS estoque_itens_nome_unique ON estoque_itens (tenant_id, lower(nome));
SELECT aplicar_rls('estoque_itens');

CREATE TABLE IF NOT EXISTS estoque_movimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  estoque_item_id UUID NOT NULL REFERENCES estoque_itens(id) ON DELETE CASCADE,
  -- entrada / saída, ou ajuste = contagem física (o saldo passa a ser a quantidade contada)
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('entrada', 'saida', 'ajuste')),
  -- Motivo (lista em src/lib/estoqueRazoes.ts): compra, devolucao_evento, consumo_evento, perda, quebra…
  razao VARCHAR(30) NOT NULL,
  -- Variação no saldo (positiva na entrada, negativa na saída; no ajuste, contagem − saldo anterior)
  quantidade NUMERIC(14, 3) NOT NULL,
  saldo_apos NUMERIC(14, 3) NOT NULL,
  -- Entrada: custo pago (compra/produção); saída: custo médio do item no momento (base do CMV por evento)
  custo_unitario NUMERIC(12, 2),
  fornecedor VARCHAR(200),
  documento VARCHAR(60),
  evento_id UUID REFERENCES eventos(id) ON DELETE SET NULL,
  espaco_id UUID REFERENCES espacos(id) ON DELETE SET NULL,
  observacao VARCHAR(500),
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_estoque_movimentos_item ON estoque_movimentos (estoque_item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_estoque_movimentos_data ON estoque_movimentos (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_estoque_movimentos_evento ON estoque_movimentos (evento_id) WHERE evento_id IS NOT NULL;
SELECT aplicar_rls('estoque_movimentos');
