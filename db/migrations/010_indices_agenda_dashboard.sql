-- 010_indices_agenda_dashboard.sql
-- Índices usados pela agenda (eventos por data) e pelos indicadores do dashboard.
CREATE INDEX IF NOT EXISTS idx_eventos_data ON eventos(tenant_id, data_evento);
CREATE INDEX IF NOT EXISTS idx_eventos_created ON eventos(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orcamento_versoes_enviado ON orcamento_versoes(tenant_id, enviado_em) WHERE enviado_em IS NOT NULL;
