-- 010_planos_demo.sql
-- Empresa de demonstração no Plano Busca (gratuito), para conferir o gating e o teste grátis:
-- usuário gratuito@buffetgratis.com.br (owner, senha Banket.2026). As demais empresas do seed ficam no plano
-- Completo (backfill da migration 031).
DO $$
DECLARE
  v_tenant UUID;
  v_user   UUID;
  v_plano  UUID;
BEGIN
  SELECT id INTO v_plano FROM planos WHERE slug = 'busca';
  IF v_plano IS NULL THEN RETURN; END IF;

  SELECT id INTO v_tenant FROM tenants WHERE slug = 'buffet-gratuito';
  IF v_tenant IS NULL THEN
    INSERT INTO tenants (nome, slug, tipo_pessoa, documento, email, telefone, onboarding_completo, origem_cadastro, plano_id)
    VALUES ('Buffet Gratuito Demo', 'buffet-gratuito', 'PJ', '33445566000172', 'gratuito@buffetgratis.com.br', '11988887777', true, 'busca', v_plano)
    RETURNING id INTO v_tenant;
    PERFORM aplicar_padroes_tenant_completo(v_tenant);
    INSERT INTO tenant_plano_historico (tenant_id, de_plano_id, para_plano_id, motivo, origem, dados)
    VALUES (v_tenant, NULL, v_plano, 'cadastro', 'migracao', '{"nota": "seed 010"}'::jsonb);
  END IF;

  SELECT id INTO v_user FROM usuarios WHERE email = 'gratuito@buffetgratis.com.br';
  IF v_user IS NULL THEN
    INSERT INTO usuarios (nome, email, senha_hash, email_verificado_em, origem_cadastro)
    VALUES ('Gabriela Gratuita', 'gratuito@buffetgratis.com.br', crypt('Banket.2026', gen_salt('bf')), now(), 'busca')
    RETURNING id INTO v_user;
  END IF;

  INSERT INTO tenant_usuarios (tenant_id, usuario_id, role, ativo)
  VALUES (v_tenant, v_user, 'owner', true)
  ON CONFLICT (tenant_id, usuario_id) DO NOTHING;
END $$;
