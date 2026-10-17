-- 039_assinatura_stripe.sql
-- Cobrança da assinatura pelo Stripe, no mesmo modelo do Yosp (/var/www/yosp, migrations 057 e 066–068):
--   * o plano escolhido inicia o teste de 30 dias (sem cartão); dá para trocar de plano durante o teste;
--   * contratar = cartão (Checkout hospedado do Stripe, cobrança automática) ou Pix (fatura com 7 dias para pagar);
--     no teste, a cobrança pode ser agora ou no fim do teste;
--   * o plano pago só entra DEPOIS da confirmação do Stripe (tenants.plano_pendente_id até lá);
--   * fim do teste sem assinatura, fatura vencida não paga (12h de D+1) e assinatura encerrada REBAIXAM para o
--     plano Busca (server/planos.ts → rebaixarParaBusca). Nada é apagado.
-- Espelho local do Stripe: tenants.stripe_* (assinatura) + assinatura_faturas. stripe_events: idempotência do webhook.
--
-- Down (o runner não aplica):
--   DROP TABLE stripe_events, assinatura_faturas;
--   ALTER TABLE tenants DROP COLUMN stripe_customer_id, stripe_assinatura_id, stripe_assinatura_status,
--     cobranca_intervalo, forma_pagamento, cartao_bandeira, cartao_final, cartao_validade, periodo_fim,
--     cancelar_no_fim, cancelar_em, cancelamento_motivo;

-- ── empresa ──────────────────────────────────────────────────────────────────
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS stripe_customer_id       TEXT,
  ADD COLUMN IF NOT EXISTS stripe_assinatura_id     TEXT,
  ADD COLUMN IF NOT EXISTS stripe_assinatura_status TEXT,
  ADD COLUMN IF NOT EXISTS cobranca_intervalo       VARCHAR(5),
  ADD COLUMN IF NOT EXISTS forma_pagamento          VARCHAR(10),
  ADD COLUMN IF NOT EXISTS cartao_bandeira          TEXT,
  ADD COLUMN IF NOT EXISTS cartao_final             VARCHAR(4),
  ADD COLUMN IF NOT EXISTS cartao_validade          VARCHAR(5),
  ADD COLUMN IF NOT EXISTS periodo_fim              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelar_no_fim          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancelar_em              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelamento_motivo      TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tenants_stripe_customer ON tenants (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_tenants_stripe_assinatura ON tenants (stripe_assinatura_id) WHERE stripe_assinatura_id IS NOT NULL;

DO $$ BEGIN
  ALTER TABLE tenants ADD CONSTRAINT tenants_cobranca_intervalo_check CHECK (cobranca_intervalo IS NULL OR cobranca_intervalo IN ('mes', 'ano'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE tenants ADD CONSTRAINT tenants_forma_pagamento_check CHECK (forma_pagamento IS NULL OR forma_pagamento IN ('cartao', 'pix'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── faturas: espelho das invoices do Stripe ───────────────────────────────────
CREATE TABLE IF NOT EXISTS assinatura_faturas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stripe_id       TEXT NOT NULL UNIQUE,
  assinatura_id   TEXT,
  numero          TEXT,
  status          TEXT NOT NULL,                 -- draft | open | paid | void | uncollectible
  valor           NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_restante  NUMERIC(12,2) NOT NULL DEFAULT 0,
  moeda           VARCHAR(3) NOT NULL DEFAULT 'BRL',
  vencimento      DATE,                          -- Pix: due_date; cartão: data da cobrança
  pago_em         TIMESTAMPTZ,
  forma           VARCHAR(10),                   -- cartao | pix
  motivo          TEXT,                          -- billing_reason (subscription_create, subscription_cycle…)
  cobranca        TEXT,                          -- collection_method
  tentativas      INT,
  periodo_inicio  TIMESTAMPTZ,
  periodo_fim     TIMESTAMPTZ,
  url_fatura      TEXT,                          -- hosted_invoice_url
  pdf_url         TEXT,
  plano_id        UUID REFERENCES planos(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
SELECT aplicar_rls('assinatura_faturas');
CREATE INDEX IF NOT EXISTS idx_assinatura_faturas_abertas ON assinatura_faturas (tenant_id, vencimento) WHERE status = 'open';

-- ── idempotência do webhook (só a conexão de sistema: RLS forçado sem política) ─
CREATE TABLE IF NOT EXISTS stripe_events (
  id            TEXT PRIMARY KEY,
  type          TEXT NOT NULL,
  livemode      BOOLEAN NOT NULL,
  tenant_id     UUID REFERENCES tenants(id) ON DELETE SET NULL,
  payload       JSONB NOT NULL,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at  TIMESTAMPTZ,
  error         TEXT
);
CREATE INDEX IF NOT EXISTS idx_stripe_events_received ON stripe_events (received_at DESC);
ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_events FORCE ROW LEVEL SECURITY;

-- ── histórico e funil: novos motivos ──────────────────────────────────────────
ALTER TABLE tenant_plano_historico DROP CONSTRAINT IF EXISTS tenant_plano_historico_motivo_check;
ALTER TABLE tenant_plano_historico ADD CONSTRAINT tenant_plano_historico_motivo_check
  CHECK (motivo IN ('cadastro', 'migracao', 'trial_iniciado', 'trial_encerrado', 'upgrade', 'downgrade', 'hwesta',
                    'backoffice', 'assinatura', 'cancelamento', 'plano_escolhido', 'inadimplencia'));

ALTER TABLE busca_upsell_eventos DROP CONSTRAINT IF EXISTS busca_upsell_eventos_tipo_check;
ALTER TABLE busca_upsell_eventos ADD CONSTRAINT busca_upsell_eventos_tipo_check
  CHECK (tipo IN ('cadeado_visto', 'cta_clicado', 'planos_visitado', 'trial_iniciado', 'trial_recusado',
                  'assinatura_concluida', 'rebaixado', 'checkout_iniciado'));

-- Chaves de dedup dos e-mails de cobrança levam ids do Stripe
ALTER TABLE plano_avisos ALTER COLUMN chave TYPE VARCHAR(80);

-- ── fonte única: + origem do cadastro e assinatura viva ───────────────────────
CREATE OR REPLACE FUNCTION fn_tenant_entitlements(p_tenant uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  t        tenants%ROWTYPE;
  p        planos%ROWTYPE;
  v_ov     jsonb := '{}'::jsonb;
  v_hoje   date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_trial  jsonb := NULL;
  v_venc   boolean := false;
BEGIN
  SELECT * INTO t FROM tenants WHERE id = p_tenant;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF t.plano_id IS NOT NULL THEN SELECT * INTO p FROM planos WHERE id = t.plano_id; END IF;
  SELECT COALESCE(e.capabilities, '{}'::jsonb) INTO v_ov FROM hwesta_entitlements e WHERE e.tenant_id = p_tenant;
  v_ov := COALESCE(v_ov, '{}'::jsonb);

  IF p.id IS NOT NULL AND NOT p.gratuito AND t.trial_ate IS NOT NULL THEN
    IF t.trial_ate >= v_hoje THEN
      v_trial := jsonb_build_object('ate', t.trial_ate, 'dias_restantes', (t.trial_ate - v_hoje));
    ELSE
      v_venc := true;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'tenant_id',         p_tenant,
    'sem_plano',         p.id IS NULL,
    'plano_id',          p.id,
    'plano_slug',        p.slug,
    'plano_nome',        p.nome,
    'gratuito',          COALESCE(p.gratuito, false),
    'publico',           COALESCE(p.publico, false),
    'trial',             v_trial,
    'trial_vencido',     v_venc,
    'trial_ate',         t.trial_ate,
    'trial_usado',       t.trial_usado_em IS NOT NULL,
    'trial_recusado_em', t.trial_recusado_em,
    'origem_cadastro',   t.origem_cadastro,
    'assinatura_viva',   t.stripe_assinatura_id IS NOT NULL
                         AND COALESCE(t.stripe_assinatura_status, '') IN ('active', 'trialing', 'past_due', 'unpaid'),
    'plano_pendente_id', t.plano_pendente_id,
    'recursos',          COALESCE(p.recursos, '{}'::jsonb) || v_ov,
    'override',          v_ov
  );
END;
$fn$;
