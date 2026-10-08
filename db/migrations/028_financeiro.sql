-- 028_financeiro.sql
-- Gestão financeira: contas a receber e a pagar (owner/admin).
--   - fin_categorias: plano de contas simples, por tipo (receber/pagar), com padrões editáveis;
--   - fin_contas: cada conta/parcela, ligada opcionalmente a um evento, a um cliente e a uma movimentação de estoque.
--     origem = 'plano' nasce do plano de pagamento do evento (condições acertadas no fechamento: entrada, parcelas);
--     origem = 'estoque' nasce de uma movimentação (compra com nota → a pagar; devolução ao fornecedor → a receber).
--   Situação: aberta / paga / cancelada; "vencida" é calculada (aberta com vencimento antes de hoje).
-- Compatível com a versão anterior do código (só tabelas e funções novas).

CREATE TABLE IF NOT EXISTS fin_categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tipo VARCHAR(8) NOT NULL CHECK (tipo IN ('receber', 'pagar')),
  nome VARCHAR(80) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS fin_categorias_nome_unique ON fin_categorias (tenant_id, tipo, lower(nome));
SELECT aplicar_rls('fin_categorias');

CREATE TABLE IF NOT EXISTS fin_contas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tipo VARCHAR(8) NOT NULL CHECK (tipo IN ('receber', 'pagar')),
  descricao VARCHAR(255) NOT NULL,
  categoria_id UUID REFERENCES fin_categorias(id) ON DELETE SET NULL,
  evento_id UUID REFERENCES eventos(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  -- Fornecedor (a pagar) ou pagador avulso (a receber sem cliente cadastrado)
  fornecedor VARCHAR(200),
  valor NUMERIC(12, 2) NOT NULL CHECK (valor > 0),
  vencimento DATE NOT NULL,
  forma_pagamento VARCHAR(20) CHECK (forma_pagamento IS NULL OR forma_pagamento IN
    ('pix', 'boleto', 'cartao_credito', 'cartao_debito', 'transferencia', 'dinheiro', 'cheque', 'outro')),
  documento VARCHAR(60),
  observacoes VARCHAR(1000),
  origem VARCHAR(10) NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual', 'plano', 'estoque')),
  -- Plano de pagamento: parcela 0 = entrada/sinal; 1..parcelas
  parcela INTEGER CHECK (parcela IS NULL OR parcela >= 0),
  parcelas INTEGER CHECK (parcelas IS NULL OR parcelas >= 1),
  estoque_movimento_id UUID REFERENCES estoque_movimentos(id) ON DELETE SET NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'paga', 'cancelada')),
  pago_em DATE,
  valor_pago NUMERIC(12, 2) CHECK (valor_pago IS NULL OR valor_pago >= 0),
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  baixa_usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT fin_contas_baixa_completa CHECK (status <> 'paga' OR (pago_em IS NOT NULL AND valor_pago IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_fin_contas_vencimento ON fin_contas (tenant_id, tipo, vencimento);
CREATE INDEX IF NOT EXISTS idx_fin_contas_evento ON fin_contas (evento_id) WHERE evento_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fin_contas_movimento ON fin_contas (estoque_movimento_id) WHERE estoque_movimento_id IS NOT NULL;
SELECT aplicar_rls('fin_contas');

-- Categorias iniciais (a empresa edita em Financeiro › Categorias)
CREATE OR REPLACE FUNCTION aplicar_padroes_financeiro(p_tenant UUID) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM fin_categorias WHERE tenant_id = p_tenant) THEN
    INSERT INTO fin_categorias (tenant_id, tipo, nome, ordem) VALUES
      (p_tenant, 'receber', 'Venda de evento', 1),
      (p_tenant, 'receber', 'Hora adicional e extras', 2),
      (p_tenant, 'receber', 'Devolução de fornecedor', 3),
      (p_tenant, 'receber', 'Outras receitas', 4),
      (p_tenant, 'pagar', 'Insumos e alimentos', 1),
      (p_tenant, 'pagar', 'Bebidas', 2),
      (p_tenant, 'pagar', 'Equipe e staff', 3),
      (p_tenant, 'pagar', 'Locação de espaço e equipamentos', 4),
      (p_tenant, 'pagar', 'Fornecedores e terceiros', 5),
      (p_tenant, 'pagar', 'Impostos e taxas', 6),
      (p_tenant, 'pagar', 'Despesas administrativas', 7),
      (p_tenant, 'pagar', 'Outras despesas', 8);
  END IF;
END $$;

SELECT aplicar_padroes_financeiro(id) FROM tenants;

CREATE OR REPLACE FUNCTION aplicar_padroes_tenant_completo(p_tenant UUID) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM aplicar_padroes_tenant(p_tenant);
  PERFORM aplicar_padroes_tenant_proposta(p_tenant);
  PERFORM aplicar_padroes_formulario(p_tenant);
  PERFORM aplicar_padroes_email_modelos(p_tenant);
  PERFORM aplicar_padroes_documentos(p_tenant);
  PERFORM aplicar_padroes_financeiro(p_tenant);
END $$;
