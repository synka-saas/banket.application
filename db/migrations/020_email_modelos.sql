-- 020_email_modelos.sql
-- Modelos de e-mail (Configurações › Modelos de e-mail): vários modelos por empresa, um deles padrão.
-- Substitui configuracoes_tenant.email_assunto/email_corpo, que ficam na tabela sem uso (remover num deploy futuro).
-- Backfill: cada empresa ganha o modelo "Proposta padrão" com o assunto/corpo que já usava.

CREATE TABLE IF NOT EXISTS email_modelos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome VARCHAR(120) NOT NULL,
  assunto VARCHAR(255) NOT NULL,
  corpo TEXT NOT NULL,
  padrao BOOLEAN NOT NULL DEFAULT false,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS email_modelos_nome_unique ON email_modelos (tenant_id, lower(nome));
CREATE UNIQUE INDEX IF NOT EXISTS email_modelos_padrao_unique ON email_modelos (tenant_id) WHERE padrao;
SELECT aplicar_rls('email_modelos');

-- Modelo inicial a partir do texto que a empresa já usava (os DEFAULT da 004 valem para empresa nova)
CREATE OR REPLACE FUNCTION aplicar_padroes_email_modelos(p_tenant UUID) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO configuracoes_tenant (tenant_id) VALUES (p_tenant) ON CONFLICT DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM email_modelos WHERE tenant_id = p_tenant) THEN
    INSERT INTO email_modelos (tenant_id, nome, assunto, corpo, padrao, ordem)
    SELECT p_tenant, 'Proposta padrão', c.email_assunto, c.email_corpo, true, 1
      FROM configuracoes_tenant c WHERE c.tenant_id = p_tenant;
  END IF;
END $$;

SELECT aplicar_padroes_email_modelos(id) FROM tenants;

CREATE OR REPLACE FUNCTION aplicar_padroes_tenant_completo(p_tenant UUID) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM aplicar_padroes_tenant(p_tenant);
  PERFORM aplicar_padroes_tenant_proposta(p_tenant);
  PERFORM aplicar_padroes_formulario(p_tenant);
  PERFORM aplicar_padroes_email_modelos(p_tenant);
END $$;
