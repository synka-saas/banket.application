-- Formulário usado no Banket Busca: o pedido de orçamento do perfil público (buffet em plano pago ou em teste) abre o
-- formulário marcado aqui. No máximo um por empresa; sem marca, vale o formulário ativo mais antigo.
ALTER TABLE formularios ADD COLUMN IF NOT EXISTS usar_no_busca BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS formularios_um_no_busca ON formularios (tenant_id) WHERE usar_no_busca;
