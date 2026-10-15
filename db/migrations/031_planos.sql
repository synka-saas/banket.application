-- 031_planos.sql
-- Sistema de planos do Banket (fase 1 do Banket Busca, ver PLANO.md):
--   * planos — catálogo no próprio app (HCP plans_catalog = true). Cada plano traz `recursos` (JSONB):
--     booleanos de módulo e limites numéricos (-1 = sem limite). Busca = gratuito; Completo = interno (backfill).
--   * tenants.plano_id + trial (trial_ate, trial_iniciado_em, trial_usado_em, trial_recusado_em), plano_rebaixado_em,
--     origem_cadastro; usuarios.origem_cadastro; tenant_usuarios.bloqueado_plano_em (excedente de usuários).
--   * tenant_plano_historico — uma linha por mudança de plano (motivo, origem, quem).
--   * plano_avisos — dedup dos e-mails do trial (as duas cores do blue-green podem rodar o agendador).
--   * fn_tenant_entitlements(uuid) — FONTE ÚNICA do que a empresa pode usar: override do Manager Hwesta
--     (hwesta_entitlements.capabilities) ?? planos.recursos. SECURITY DEFINER: o papel do app não enxerga
--     outros tenants nem o override de outros, mas só recebe o resultado da própria empresa.
-- Compatível com a cor anterior: só adiciona colunas (com default) e tabelas. Empresa sem plano continua
-- permissiva no código (sem_plano = true), mas o backfill abaixo deixa todas no plano Completo.
-- Down (manual): DROP FUNCTION fn_tenant_*; DROP TABLE plano_avisos, tenant_plano_historico;
--   ALTER TABLE tenants DROP COLUMN plano_id, plano_pendente_id, trial_*, plano_rebaixado_em, origem_cadastro;
--   ALTER TABLE usuarios DROP COLUMN origem_cadastro; ALTER TABLE tenant_usuarios DROP COLUMN bloqueado_plano_em;
--   DROP TABLE busca_upsell_eventos; DROP TABLE planos.

-- ── Catálogo ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS planos (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                   VARCHAR(40) NOT NULL UNIQUE,
  nome                   VARCHAR(80) NOT NULL,
  descricao              TEXT,
  gratuito               BOOLEAN NOT NULL DEFAULT false,
  publico                BOOLEAN NOT NULL DEFAULT true,
  ativo                  BOOLEAN NOT NULL DEFAULT true,
  ordem                  INT NOT NULL DEFAULT 0,
  preco_mensal           NUMERIC(10,2),
  preco_anual            NUMERIC(10,2),
  trial_dias             INT NOT NULL DEFAULT 30,
  recursos               JSONB NOT NULL DEFAULT '{}'::jsonb,
  stripe_product_id      TEXT,
  stripe_price_mensal_id TEXT,
  stripe_price_anual_id  TEXT,
  created_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT planos_recursos_objeto CHECK (jsonb_typeof(recursos) = 'object')
);
COMMENT ON TABLE planos IS 'Catálogo de planos (fonte: o próprio Banket). recursos = {slug: true|false|int}; -1 = sem limite.';

-- Valores dos planos. ON CONFLICT atualiza os recursos: o catálogo é versionado por migration.
INSERT INTO planos (slug, nome, descricao, gratuito, publico, ordem, preco_mensal, preco_anual, recursos) VALUES
  ('busca', 'Plano Busca', 'Perfil no Banket Busca e pedidos de orçamento. Gratuito.', true, false, 0, 0, 0,
   '{"propostas":false,"inbox":false,"cardapios":false,"clientes":false,"agenda":false,"formularios":false,
     "financeiro":false,"estoque":false,"staff":false,"espacos":false,"templates":false,"documentos":false,
     "pesquisas":false,"reunioes":false,"ia":false,"configuracoes":false,
     "usuarios":1,"espacos_qtd":0,"templates_qtd":0,"cardapios_opcoes":0,"formularios_qtd":0,"documento_modelos":0,
     "email_modelos":0,"estoque_itens":0,"ia_analises_mes":0,"ia_fundos_mes":0,
     "busca":true,"busca_selo":false,"busca_prioridade":false,"busca_cardapios":false,"busca_disponibilidade":false,
     "busca_fotos_tags":false,"busca_aviso_email":false,"busca_aviso_whatsapp":false,
     "busca_fotos":5,"busca_tipos_evento":3,"busca_tipos_servico":3,"historico_meses":3}'),
  ('essencial', 'Essencial', 'Para o autônomo e o buffet a domicílio: propostas, agenda e clientes.', false, true, 1, 97, 970,
   '{"propostas":true,"inbox":false,"cardapios":true,"clientes":true,"agenda":true,"formularios":true,
     "financeiro":false,"estoque":false,"staff":true,"espacos":true,"templates":true,"documentos":true,
     "pesquisas":false,"reunioes":false,"ia":false,"configuracoes":true,
     "usuarios":2,"espacos_qtd":1,"templates_qtd":1,"cardapios_opcoes":3,"formularios_qtd":1,"documento_modelos":1,
     "email_modelos":0,"estoque_itens":0,"ia_analises_mes":0,"ia_fundos_mes":0,
     "busca":true,"busca_selo":true,"busca_prioridade":true,"busca_cardapios":true,"busca_disponibilidade":true,
     "busca_fotos_tags":true,"busca_aviso_email":true,"busca_aviso_whatsapp":false,
     "busca_fotos":-1,"busca_tipos_evento":-1,"busca_tipos_servico":-1,"historico_meses":-1}'),
  ('profissional', 'Profissional', 'Para o buffet com salão e equipe comercial: Inbox, reuniões e o Concierge.', false, true, 2, 197, 1970,
   '{"propostas":true,"inbox":true,"cardapios":true,"clientes":true,"agenda":true,"formularios":true,
     "financeiro":true,"estoque":true,"staff":true,"espacos":true,"templates":true,"documentos":true,
     "pesquisas":true,"reunioes":true,"ia":true,"configuracoes":true,
     "usuarios":5,"espacos_qtd":3,"templates_qtd":5,"cardapios_opcoes":10,"formularios_qtd":5,"documento_modelos":5,
     "email_modelos":10,"estoque_itens":300,"ia_analises_mes":40,"ia_fundos_mes":0,
     "busca":true,"busca_selo":true,"busca_prioridade":true,"busca_cardapios":true,"busca_disponibilidade":true,
     "busca_fotos_tags":true,"busca_aviso_email":true,"busca_aviso_whatsapp":true,
     "busca_fotos":-1,"busca_tipos_evento":-1,"busca_tipos_servico":-1,"historico_meses":-1}'),
  ('prime', 'Prime', 'Para a casa de eventos grande: limites altos, Concierge completo e IA com folga.', false, true, 3, 297, 2970,
   '{"propostas":true,"inbox":true,"cardapios":true,"clientes":true,"agenda":true,"formularios":true,
     "financeiro":true,"estoque":true,"staff":true,"espacos":true,"templates":true,"documentos":true,
     "pesquisas":true,"reunioes":true,"ia":true,"configuracoes":true,
     "usuarios":15,"espacos_qtd":10,"templates_qtd":20,"cardapios_opcoes":20,"formularios_qtd":20,"documento_modelos":20,
     "email_modelos":20,"estoque_itens":2000,"ia_analises_mes":150,"ia_fundos_mes":20,
     "busca":true,"busca_selo":true,"busca_prioridade":true,"busca_cardapios":true,"busca_disponibilidade":true,
     "busca_fotos_tags":true,"busca_aviso_email":true,"busca_aviso_whatsapp":true,
     "busca_fotos":-1,"busca_tipos_evento":-1,"busca_tipos_servico":-1,"historico_meses":-1}'),
  ('completo', 'Completo', 'Plano interno sem restrições (empresas anteriores ao sistema de planos e parceiros).', false, false, 9, NULL, NULL,
   '{"propostas":true,"inbox":true,"cardapios":true,"clientes":true,"agenda":true,"formularios":true,
     "financeiro":true,"estoque":true,"staff":true,"espacos":true,"templates":true,"documentos":true,
     "pesquisas":true,"reunioes":true,"ia":true,"configuracoes":true,
     "usuarios":-1,"espacos_qtd":-1,"templates_qtd":-1,"cardapios_opcoes":-1,"formularios_qtd":-1,"documento_modelos":-1,
     "email_modelos":-1,"estoque_itens":-1,"ia_analises_mes":-1,"ia_fundos_mes":-1,
     "busca":true,"busca_selo":true,"busca_prioridade":true,"busca_cardapios":true,"busca_disponibilidade":true,
     "busca_fotos_tags":true,"busca_aviso_email":true,"busca_aviso_whatsapp":true,
     "busca_fotos":-1,"busca_tipos_evento":-1,"busca_tipos_servico":-1,"historico_meses":-1}')
ON CONFLICT (slug) DO UPDATE SET
  nome = EXCLUDED.nome, descricao = EXCLUDED.descricao, gratuito = EXCLUDED.gratuito, publico = EXCLUDED.publico,
  ordem = EXCLUDED.ordem, preco_mensal = EXCLUDED.preco_mensal, preco_anual = EXCLUDED.preco_anual,
  recursos = EXCLUDED.recursos, updated_at = CURRENT_TIMESTAMP;

-- ── Vínculo da empresa com o plano ───────────────────────────────────────────
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS plano_id           UUID REFERENCES planos(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS plano_pendente_id  UUID REFERENCES planos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS trial_ate          DATE,
  ADD COLUMN IF NOT EXISTS trial_iniciado_em  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_usado_em     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_recusado_em  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS plano_rebaixado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS origem_cadastro    VARCHAR(10) NOT NULL DEFAULT 'site';
DO $$ BEGIN
  ALTER TABLE tenants ADD CONSTRAINT tenants_origem_cadastro_check CHECK (origem_cadastro IN ('site', 'busca'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_tenants_trial_ate ON tenants (trial_ate) WHERE trial_ate IS NOT NULL;

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS origem_cadastro VARCHAR(10) NOT NULL DEFAULT 'site';
ALTER TABLE tenant_usuarios ADD COLUMN IF NOT EXISTS bloqueado_plano_em TIMESTAMPTZ;
COMMENT ON COLUMN tenant_usuarios.bloqueado_plano_em IS 'Vínculo desativado por excedente do plano (rebaixamento); o upgrade reativa.';

-- ── Histórico e avisos ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_plano_historico (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  de_plano_id   UUID REFERENCES planos(id) ON DELETE SET NULL,
  para_plano_id UUID REFERENCES planos(id) ON DELETE SET NULL,
  motivo        VARCHAR(30) NOT NULL CHECK (motivo IN ('cadastro', 'migracao', 'trial_iniciado', 'trial_encerrado',
                                                      'upgrade', 'downgrade', 'hwesta', 'backoffice', 'assinatura', 'cancelamento')),
  origem        VARCHAR(20) NOT NULL CHECK (origem IN ('app', 'hwesta', 'agendador', 'migracao', 'stripe')),
  usuario_id    UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  dados         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
SELECT aplicar_rls('tenant_plano_historico');
CREATE INDEX IF NOT EXISTS idx_tenant_plano_historico_data ON tenant_plano_historico (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS plano_avisos (
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  chave      VARCHAR(60) NOT NULL,
  enviado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, chave)
);
SELECT aplicar_rls('plano_avisos');

-- Eventos do funil de upsell (cadeado visto, CTA, planos visitados, teste iniciado/recusado, rebaixamento)
CREATE TABLE IF NOT EXISTS busca_upsell_eventos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  tipo       VARCHAR(30) NOT NULL CHECK (tipo IN ('cadeado_visto', 'cta_clicado', 'planos_visitado', 'trial_iniciado',
                                                  'trial_recusado', 'assinatura_concluida', 'rebaixado')),
  recurso    VARCHAR(60),
  dados      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
SELECT aplicar_rls('busca_upsell_eventos');
CREATE INDEX IF NOT EXISTS idx_busca_upsell_eventos_tipo ON busca_upsell_eventos (tipo, created_at DESC);

-- ── Backfill: todas as empresas existentes no plano Completo ─────────────────
UPDATE tenants SET plano_id = (SELECT id FROM planos WHERE slug = 'completo') WHERE plano_id IS NULL;
INSERT INTO tenant_plano_historico (tenant_id, de_plano_id, para_plano_id, motivo, origem, dados)
SELECT t.id, NULL, t.plano_id, 'migracao', 'migracao', '{"nota": "backfill 031_planos"}'::jsonb
  FROM tenants t
 WHERE NOT EXISTS (SELECT 1 FROM tenant_plano_historico h WHERE h.tenant_id = t.id);

-- ── Fonte única: o que a empresa pode usar ───────────────────────────────────
-- { tenant_id, sem_plano, plano_id, plano_slug, plano_nome, gratuito, publico,
--   trial: {ate, dias_restantes} | null, trial_vencido, trial_usado, trial_recusado_em,
--   recursos: {slug: valor efetivo}, override: {...} }
-- Datas no fuso de São Paulo. Empresa inexistente → NULL. Sem plano → recursos vazio (o código trata como permissivo).
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
    'recursos',          COALESCE(p.recursos, '{}'::jsonb) || v_ov,
    'override',          v_ov
  );
END;
$fn$;

-- Booleano para SQL. Sem plano → true (permissivo); recurso ausente → false.
CREATE OR REPLACE FUNCTION fn_tenant_pode(p_tenant uuid, p_recurso text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT CASE
           WHEN e IS NULL THEN false
           WHEN (e ->> 'sem_plano')::boolean THEN true
           ELSE COALESCE(
             CASE jsonb_typeof(e -> 'recursos' -> p_recurso)
               WHEN 'boolean' THEN (e -> 'recursos' ->> p_recurso)::boolean
               WHEN 'number'  THEN (e -> 'recursos' ->> p_recurso)::numeric <> 0
               ELSE NULL END, false)
         END
    FROM fn_tenant_entitlements(p_tenant) AS e;
$fn$;

-- Limite para SQL: NULL = sem limite (sem plano ou recurso ausente); -1 também = sem limite.
CREATE OR REPLACE FUNCTION fn_tenant_limite(p_tenant uuid, p_recurso text)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT CASE
           WHEN e IS NULL OR (e ->> 'sem_plano')::boolean THEN NULL
           WHEN jsonb_typeof(e -> 'recursos' -> p_recurso) = 'number' THEN NULLIF((e -> 'recursos' ->> p_recurso)::int, -1)
           ELSE NULL END
    FROM fn_tenant_entitlements(p_tenant) AS e;
$fn$;
