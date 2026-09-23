-- 004_seed_catalogo_completo.sql
-- Limpa o catálogo de exemplo inicial e injeta o catálogo completo dos 4 menus

DO $$
DECLARE
    v_tenant_id UUID;
    v_cat_sec_0 UUID;
    v_cat_sec_1 UUID;
    v_cat_sec_2 UUID;
    v_cat_sec_3 UUID;
    v_cat_sec_4 UUID;
    v_cat_sec_5 UUID;
    v_cat_sec_6 UUID;
    v_cat_sec_7 UUID;
    v_cat_sec_8 UUID;
    v_cat_sec_9 UUID;
    v_cat_sec_10 UUID;
    v_cat_sec_11 UUID;
BEGIN
    SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'banket';
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Tenant "Banket" não encontrado.';
    END IF;

    -- Deletar catálogo antigo para evitar duplicação (caso existam)
    DELETE FROM catalogo_secoes WHERE tenant_id = v_tenant_id;
    -- Os itens serão deletados por CASCADE se o banco estiver configurado assim,
    -- mas vamos limpar explicitamente por garantia.
    DELETE FROM catalogo_itens WHERE tenant_id = v_tenant_id;

    -- Seção: Pães e Antepastos (Brunch/Recepção)
    INSERT INTO catalogo_secoes (tenant_id, nome) VALUES (v_tenant_id, 'Pães e Antepastos (Brunch/Recepção)') RETURNING id INTO v_cat_sec_0;
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_0, 'Pão de fermentação natural', '', 1);
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_0, 'Croissant', '', 2);
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_0, 'Focaccia', '', 3);
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_0, 'Burrata com Tomates', 'Burrata acompanhada de tomates frescos e pesto de manjericão', 4);
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_0, 'Brie Assado', 'Brie assado com castanhas, nozes e mel', 5);

    -- Seção: Queijos e Embutidos
    INSERT INTO catalogo_secoes (tenant_id, nome) VALUES (v_tenant_id, 'Queijos e Embutidos') RETURNING id INTO v_cat_sec_1;
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_1, 'Salame italiano', '', 1);
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_1, 'Parmesão', '', 2);
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_1, 'Gorgonzola', '', 3);

    -- Seção: Finger Foods e Coquetel
    INSERT INTO catalogo_secoes (tenant_id, nome) VALUES (v_tenant_id, 'Finger Foods e Coquetel') RETURNING id INTO v_cat_sec_2;
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_2, 'Bruschetta de Tomate', 'Bruschetta de tomate, manjericão e parmesão', 1);
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_2, 'Empanada de Cebola', 'Empanada de cebola assada, queijo asiago e servida com chimichurri', 2);
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_2, 'Dadinho de Tapioca', 'Dadinho de tapioca com geleia de maçã e pimenta', 3);
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_2, 'Polenta Cremosa', 'Polenta cremosa servida com ragú de linguiça', 4);
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_2, 'Steak Tartar', 'Mignon cortado na faca, com temperos e especiarias servido com torradas', 5);
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_2, 'Crabcake', 'Croqueta de siri servida com molho de mamão e pimenta verde', 6);

    -- Seção: Comida de Boteco
    INSERT INTO catalogo_secoes (tenant_id, nome) VALUES (v_tenant_id, 'Comida de Boteco') RETURNING id INTO v_cat_sec_3;
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_3, 'Carne de onça', '', 1);
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_3, 'Aipim frito com bacon', '', 2);
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_3, 'Calabresa acebolada', 'Servida com torradas de fermentação natural e farofa de alho', 3);
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_3, 'Pão com bolinho de carne', 'Queijo, maionese da casa e mostarda escura', 4);
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_3, 'Sanduíche de roastbeef', 'Com vinagrete e mostarda amarela', 5);

    -- Seção: Saladas
    INSERT INTO catalogo_secoes (tenant_id, nome) VALUES (v_tenant_id, 'Saladas') RETURNING id INTO v_cat_sec_4;
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_4, 'Salada Caesar', 'Salada de alface americana, rúcula e radichio roxo com molho Caesar', 1);
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_4, 'Salada Caprese', 'Tomate cereja, muçarela de búfala, pesto de manjericão e rúcula', 2);
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_4, 'Salada Mediterrânea', '', 3);
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_4, 'Salada de Couscous', '', 4);

    -- Seção: Acompanhamentos
    INSERT INTO catalogo_secoes (tenant_id, nome) VALUES (v_tenant_id, 'Acompanhamentos') RETURNING id INTO v_cat_sec_5;
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_5, 'Arroz Branco', '', 1);
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_5, 'Arroz com Amêndoas', '', 2);
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_5, 'Arroz à Grega', '', 3);
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_5, 'Batata Rústica', '', 4);
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_5, 'Risoto Funghi', '', 5);
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_5, 'Risoto Milanês', '', 6);
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_5, 'Risoto de Pêra, Nozes e Gorgonzola', 'Risoto com pêras confitadas, nozes tostadas e queijo gorgonzola', 7);

    -- Seção: Massas
    INSERT INTO catalogo_secoes (tenant_id, nome) VALUES (v_tenant_id, 'Massas') RETURNING id INTO v_cat_sec_6;
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_6, 'Penne ao Pomodoro', 'Penne com molho pomodoro e basílico', 1);
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_6, 'Tagliarini Alfredo', 'Tagliarini ao molho Alfredo', 2);
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_6, 'Lasanha Bolonhesa', 'Lasanha tradicional à bolonhesa', 3);
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_6, 'Rondelli de Ricota com Espinafre', '', 4);
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_6, 'Ravióli de Queijo de Cabra', 'Ravióli recheado com queijo de cabra servido ao molho rústico de linguiça artesanal', 5);
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_6, 'Ravióli com Camarão', 'Ravióli recheado com camarão servido com molho de limão siciliano e crocante de bacon', 6);

    -- Seção: Pratos Principais - Carnes
    INSERT INTO catalogo_secoes (tenant_id, nome) VALUES (v_tenant_id, 'Pratos Principais - Carnes') RETURNING id INTO v_cat_sec_7;
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_7, 'Alcatra Grelhada', 'Alcatra grelhada com molho de cogumelos frescos', 1);
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_7, 'Bife de Chorizo', 'Bife de chorizo com chimichurri e batatas rústicas', 2);
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_7, 'Entrecôte ao Molho Madeira', '', 3);
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_7, 'Mignon Grelhado', 'Tournedo de mignon grelhado com risoto de cogumelos', 4);
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_7, 'Paleta de Cordeiro', 'Paleta de cordeiro marinada com ervas e assada lentamente', 5);

    -- Seção: Pratos Principais - Aves e Porco
    INSERT INTO catalogo_secoes (tenant_id, nome) VALUES (v_tenant_id, 'Pratos Principais - Aves e Porco') RETURNING id INTO v_cat_sec_8;
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_8, 'Sobrecoxa de Frango Assada', '', 1);
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_8, 'Peito de Frango Recheado', 'Peito de frango recheado com queijo e bacon', 2);
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_8, 'Costelinha de Porco', 'Com molho barbecue', 3);

    -- Seção: Pratos Principais - Peixes
    INSERT INTO catalogo_secoes (tenant_id, nome) VALUES (v_tenant_id, 'Pratos Principais - Peixes') RETURNING id INTO v_cat_sec_9;
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_9, 'Tilápia Grelhada', 'Tilápia grelhada com crosta de tomate', 1);
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_9, 'Pirarucu Marinado', 'Pirarucu marinado com raspas de limão e gengibre e assado no vapor', 2);
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_9, 'Bacalhau Confitado', 'Bacalhau confitado no azeite de oliva extra virgem', 3);
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_9, 'Polvo Grelhado', 'Polvo grelhado e finalizado com manteiga de ervas, acompanhado de batatas aos murros', 4);

    -- Seção: Sobremesas
    INSERT INTO catalogo_secoes (tenant_id, nome) VALUES (v_tenant_id, 'Sobremesas') RETURNING id INTO v_cat_sec_10;
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_10, 'Cheesecake', 'Cheesecake com calda de frutas vermelhas', 1);
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_10, 'Tiramissu', 'Torta gelada de café com creme de mascarpone', 2);
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_10, 'Banoffee', '', 3);
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_10, 'Mil Folhas com Creme de Chocolate', 'Mil folhas de massa folhada recheado com creme de chocolate e morangos frescos', 4);
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_10, 'Brownie de Chocolate Belga', 'Brownie de chocolate belga e nozes com calda quente', 5);
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_10, 'Pavlova', 'Suspiro recheado com creme de baunilha e calda de frutas vermelhas', 6);
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_10, 'Pudim de leite', '', 7);
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_10, 'Brigadeiro de colher', '', 8);

    -- Seção: Estação de Drinks
    INSERT INTO catalogo_secoes (tenant_id, nome) VALUES (v_tenant_id, 'Estação de Drinks') RETURNING id INTO v_cat_sec_11;
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_11, 'Gin & Tonic', '', 1);
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_11, 'Moscow Mule', '', 2);
    INSERT INTO catalogo_itens (tenant_id, secao_id, nome, descricao, ordem) VALUES (v_tenant_id, v_cat_sec_11, 'Caipirinha / Caipirosca', 'Limão taiti, morango, abacaxi. Especiarias: anis estrelado, zimbro, pimenta rosa', 3);

END $$;
