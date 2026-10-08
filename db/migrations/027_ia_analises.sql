-- 027_ia_analises.sql
-- Análises de IA por evento (OpenAI):
--   - negociacao: Assistente de Negociação IA (objeções, temperatura do fechamento, sugestões de abordagem);
--   - cardapio: Assistente de Orçamentos IA (giro de estoque e substituições de maior margem) de uma versão do orçamento.
-- Cada análise guarda o contexto enviado (markdown) e o resultado (JSON), para histórico e auditoria.
-- estoque_itens.validade: base dos alertas de validade próxima usados pelo otimizador.
-- Compatível com a versão anterior do código (tabela e coluna novas).

CREATE TABLE IF NOT EXISTS ia_analises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  evento_id UUID NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  tipo VARCHAR(12) NOT NULL CHECK (tipo IN ('negociacao', 'cardapio')),
  versao_numero INTEGER,
  contexto_md TEXT NOT NULL,
  resultado JSONB NOT NULL,
  modelo VARCHAR(60),
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ia_analises_evento ON ia_analises (evento_id, tipo, created_at DESC);
SELECT aplicar_rls('ia_analises');

ALTER TABLE estoque_itens ADD COLUMN IF NOT EXISTS validade DATE;
