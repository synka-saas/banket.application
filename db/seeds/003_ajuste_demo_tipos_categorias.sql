-- 003_ajuste_demo_tipos_categorias.sql
-- Os dados de demonstração antigos tinham a semântica invertida:
--   tipos_evento continha formatos/eventos (Brunch, Buffet, Casamento…) e categorias_evento continha Social/Corporativo.
-- Modelo correto: tipo = natureza do evento (Social/Corporativo); categoria = formato do evento
-- (Casamento, Confraternização…), válida para um ou mais tipos.

DO $$
DECLARE
    v_tenant UUID;
    v_social UUID;
    v_corp UUID;
    v_cat UUID;
    r RECORD;
BEGIN
    SELECT id INTO v_tenant FROM tenants WHERE slug = 'banket';
    IF v_tenant IS NULL OR EXISTS (SELECT 1 FROM tipos_evento WHERE tenant_id = v_tenant AND nome = 'Social') THEN
        RETURN;
    END IF;

    INSERT INTO tipos_evento (tenant_id, nome, descricao) VALUES
      (v_tenant, 'Social', 'Casamentos, aniversários, formaturas e celebrações em geral') RETURNING id INTO v_social;
    INSERT INTO tipos_evento (tenant_id, nome, descricao) VALUES
      (v_tenant, 'Corporativo', 'Confraternizações, lançamentos, convenções e eventos de empresas') RETURNING id INTO v_corp;

    -- Novas categorias (formato do evento) e em quais tipos valem
    FOR r IN SELECT * FROM (VALUES
        ('Casamento', true, false),
        ('Festa de 15 Anos', true, false),
        ('Aniversário', true, false),
        ('Confraternização de fim de ano', false, true),
        ('Degustação', true, true)
      ) AS c(nome, social, corp)
    LOOP
        INSERT INTO categorias_evento (tenant_id, nome) VALUES (v_tenant, r.nome) RETURNING id INTO v_cat;
        IF r.social THEN
            INSERT INTO categoria_evento_tipos (tenant_id, categoria_id, tipo_evento_id) VALUES (v_tenant, v_cat, v_social);
        END IF;
        IF r.corp THEN
            INSERT INTO categoria_evento_tipos (tenant_id, categoria_id, tipo_evento_id) VALUES (v_tenant, v_cat, v_corp);
        END IF;
    END LOOP;

    -- Remapeia os eventos: tipo ← antiga categoria (Social/Corporativo); categoria ← antigo tipo
    UPDATE eventos e SET
        tipo_evento_id = CASE WHEN old_cat.nome = 'Corporativo' THEN v_corp ELSE v_social END,
        categoria_evento_id = (
            SELECT c.id FROM categorias_evento c
             WHERE c.tenant_id = v_tenant
               AND c.nome = CASE old_tipo.nome
                     WHEN 'Casamento' THEN 'Casamento'
                     WHEN 'Festa de 15 Anos' THEN 'Festa de 15 Anos'
                     WHEN 'Confraternização Corporativa' THEN 'Confraternização de fim de ano'
                     ELSE 'Degustação' END)
      FROM tipos_evento old_tipo, categorias_evento old_cat
     WHERE e.tenant_id = v_tenant
       AND old_tipo.id = e.tipo_evento_id
       AND old_cat.id = e.categoria_evento_id;

    UPDATE orcamentos SET tipo_servico_id = NULL WHERE tenant_id = v_tenant;
    DELETE FROM tipos_evento WHERE tenant_id = v_tenant AND id NOT IN (v_social, v_corp);
    DELETE FROM categorias_evento WHERE tenant_id = v_tenant AND nome IN ('Social', 'Corporativo');
END $$;
