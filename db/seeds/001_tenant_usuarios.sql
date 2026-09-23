-- 002_seed_initial.sql

-- Extensão para gerar Hashes (bcrypt) no Postgres nativamente
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
    v_tenant_id UUID;
    v_leandro_id UUID;
    v_pestana_id UUID;
BEGIN
    -- 1. Cria o Tenant Inicial
    INSERT INTO tenants (nome, slug, documento)
    VALUES ('Banket', 'banket', '11222333000181')
    RETURNING id INTO v_tenant_id;

    -- 2. Cria os Usuários Base (com senha padrão 'Banket.2026')
    INSERT INTO usuarios (nome, email, senha_hash)
    VALUES ('Leandro', 'leandro@banket.com.br', crypt('Banket.2026', gen_salt('bf')))
    RETURNING id INTO v_leandro_id;

    INSERT INTO usuarios (nome, email, senha_hash)
    VALUES ('Pestana', 'pestana@banket.com.br', crypt('Banket.2026', gen_salt('bf')))
    RETURNING id INTO v_pestana_id;

    -- 3. Vincula os Usuários ao Tenant
    INSERT INTO tenant_usuarios (tenant_id, usuario_id, role)
    VALUES (v_tenant_id, v_leandro_id, 'owner');

    INSERT INTO tenant_usuarios (tenant_id, usuario_id, role)
    VALUES (v_tenant_id, v_pestana_id, 'owner');

    -- Status do Kanban, formatos de serviço, categorias de item, faixas de locação etc.
    PERFORM aplicar_padroes_tenant_completo(v_tenant_id);

END $$;
