-- 024_porcoes_lista_compras.sql
-- Porção por pessoa nos itens do cardápio (quantidade + unidade), usada para calcular a quantidade total
-- de cada item por evento e montar a lista de compras do orçamento (guardada em orcamento_versoes.conteudo).
-- Compatível com a versão anterior do código (só colunas novas e nullable).

ALTER TABLE catalogo_itens
  ADD COLUMN IF NOT EXISTS porcao_qtd NUMERIC(10, 3) CHECK (porcao_qtd IS NULL OR porcao_qtd > 0),
  ADD COLUMN IF NOT EXISTS porcao_unidade VARCHAR(5) CHECK (porcao_unidade IS NULL OR porcao_unidade IN ('g', 'kg', 'ml', 'l', 'un'));
