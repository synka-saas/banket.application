-- 009_espacos_demo.sql
-- Espaço de terceiro de demonstração (tenant "banket"): a sede da TechCorp, usada pelo evento corporativo do seed 006.
-- O espaço próprio "Casa Club Gourmet" já nasce da migration 019 (a partir do local padrão do seed 007).

DO $$
DECLARE
    v_tenant UUID;
    v_espaco UUID;
BEGIN
    SELECT id INTO v_tenant FROM tenants WHERE slug = 'banket';
    IF v_tenant IS NULL OR EXISTS (SELECT 1 FROM espacos WHERE tenant_id = v_tenant AND tipo = 'terceiro') THEN
        RETURN;
    END IF;

    INSERT INTO espacos (tenant_id, nome, tipo, descricao, endereco, cidade, capacidade_min, capacidade_max,
                         contato_nome, contato_telefone, contato_email, valor_referencia, ordem)
    VALUES (v_tenant, 'Sede TechCorp', 'terceiro', 'Auditório e área de convivência da empresa; montagem completa por nossa conta.',
            'R. Fernão Dias, 551 - Pinheiros, São Paulo - SP, 05427-011', 'São Paulo', 100, 600,
            'Patrícia Lima', '(11) 98888-0000', 'patricia.lima@techcorp.example.com', NULL, 2)
    RETURNING id INTO v_espaco;

    UPDATE eventos SET espaco_id = v_espaco
     WHERE tenant_id = v_tenant AND espaco_id IS NULL AND local_nome = 'Sede TechCorp';
END $$;
