-- 002_tenant_isolamento.sql
-- Segundo tenant de desenvolvimento, usado para validar o isolamento (RLS) entre empresas.
-- Login: demo@outrobuffet.com.br / Banket.2026

DO $$
DECLARE
    v_tenant_id UUID;
    v_usuario_id UUID;
BEGIN
    IF EXISTS (SELECT 1 FROM tenants WHERE slug = 'outro-buffet') THEN
        RETURN;
    END IF;

    INSERT INTO tenants (nome, slug, documento)
    VALUES ('Outro Buffet', 'outro-buffet', NULL)
    RETURNING id INTO v_tenant_id;

    INSERT INTO usuarios (nome, email, senha_hash)
    VALUES ('Demo Outro Buffet', 'demo@outrobuffet.com.br', crypt('Banket.2026', gen_salt('bf')))
    RETURNING id INTO v_usuario_id;

    INSERT INTO tenant_usuarios (tenant_id, usuario_id, role)
    VALUES (v_tenant_id, v_usuario_id, 'owner');

    PERFORM aplicar_padroes_tenant_completo(v_tenant_id);

    INSERT INTO clientes (tenant_id, nome, email, telefone)
    VALUES (v_tenant_id, 'Cliente Exclusivo do Outro Buffet', 'exclusivo@outrobuffet.com.br', '(41) 90000-0000');
END $$;
