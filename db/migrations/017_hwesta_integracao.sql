-- 017_hwesta_integracao.sql
-- Integração com o Manager Hwesta (HCP v1, ver INTEGRACAO_HWESTA.md):
--  * tenants.status — kill-switch: empresa suspensa/cancelada pelo Manager perde o acesso (middleware)
--  * hwesta_entitlements — snapshot do plano/limites empurrado pelo Manager (sem linha = sem restrição)
--  * hwesta_events — eventos recebidos do Manager (idempotência por id da entrega)
-- O adapter usa a conexão de sistema (dono/superuser, ignora RLS); o papel da aplicação só enxerga
-- o snapshot de entitlements do próprio tenant. Datas vindas do Manager são instantes com fuso (TIMESTAMPTZ).

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS suspenso_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspenso_motivo TEXT;

DO $$ BEGIN
  ALTER TABLE tenants ADD CONSTRAINT tenants_status_check CHECK (status IN ('active', 'suspended', 'canceled'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS hwesta_entitlements (
  tenant_id    UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  plan_slug    VARCHAR(50),
  plan_name    VARCHAR(255),
  status       VARCHAR(20) NOT NULL DEFAULT 'active',
  capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at   TIMESTAMPTZ,
  source       VARCHAR(50),
  pushed_at    TIMESTAMPTZ,
  synced_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
SELECT aplicar_rls('hwesta_entitlements');

CREATE TABLE IF NOT EXISTS hwesta_events (
  id           UUID PRIMARY KEY,
  type         VARCHAR(60) NOT NULL,
  payload      JSONB NOT NULL,
  received_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  error        TEXT
);
-- Sem política: invisível para o papel da aplicação; só a conexão de sistema lê/escreve.
ALTER TABLE hwesta_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE hwesta_events FORCE ROW LEVEL SECURITY;
