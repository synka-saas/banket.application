-- Fase 4 de UX:
--  * eventos.motivo_perda / eventos.fechado_em — preenchidos ao mover para uma etapa recusada/aprovada (UX-104)
--  * evento_timeline.retorno_em — data de retorno de uma anotação manual (UX-090)
--  * tenant_usuarios.ocultar_primeiros_passos — preferência por usuário no dashboard (UX-051)
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS motivo_perda TEXT;
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS fechado_em DATE;
ALTER TABLE evento_timeline ADD COLUMN IF NOT EXISTS retorno_em DATE;
ALTER TABLE tenant_usuarios ADD COLUMN IF NOT EXISTS ocultar_primeiros_passos BOOLEAN NOT NULL DEFAULT false;
