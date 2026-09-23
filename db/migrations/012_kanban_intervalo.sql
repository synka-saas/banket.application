-- 012_kanban_intervalo.sql
-- Intervalo de trabalho do Quadro de vendas (Kanban): mostra eventos de hoje até +N meses (e os ainda sem data).
-- NULL = sem limite. Definido pela empresa em Configurações › Status de orçamento.
ALTER TABLE configuracoes_tenant
  ADD COLUMN IF NOT EXISTS kanban_intervalo_meses SMALLINT
    CHECK (kanban_intervalo_meses IS NULL OR kanban_intervalo_meses IN (1, 3, 6));
