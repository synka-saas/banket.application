-- 004_seed_cardapios_exemplo.sql
-- Injeta 4 eventos de degustação com os cardápios completos baseados nos PDFs

DO $$
DECLARE
    v_tenant_id UUID;
    v_cliente_id UUID;
    v_tipo_id UUID;
    v_cat_id UUID;
    v_evento_id UUID;
    v_secao_id UUID;
BEGIN
    -- Pegar o tenant
    SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'banket';
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Tenant "Banket" não encontrado.';
    END IF;

    -- Usar ou criar um cliente para degustação
    SELECT id INTO v_cliente_id FROM clientes WHERE nome = 'Maria Eduarda Silva' AND tenant_id = v_tenant_id LIMIT 1;
    
    -- Pegar categoria
    SELECT id INTO v_cat_id FROM categorias_evento WHERE nome = 'Social' AND tenant_id = v_tenant_id LIMIT 1;


    -- Evento: Degustação - Brunch
    -- Garantir tipo de evento
    SELECT id INTO v_tipo_id FROM tipos_evento WHERE nome = 'Brunch' AND tenant_id = v_tenant_id;
    IF v_tipo_id IS NULL THEN
        INSERT INTO tipos_evento (tenant_id, nome) VALUES (v_tenant_id, 'Brunch') RETURNING id INTO v_tipo_id;
    END IF;

    -- Inserir Evento
    INSERT INTO eventos (tenant_id, cliente_id, tipo_evento_id, categoria_evento_id, data_evento, numero_convidados, status)
    VALUES (v_tenant_id, v_cliente_id, v_tipo_id, v_cat_id, CURRENT_TIMESTAMP + INTERVAL '30 days', 50, 'Novo') 
    RETURNING id INTO v_evento_id;

    -- Seção: Mesa de Pães
    INSERT INTO evento_cardapio_secoes (tenant_id, evento_id, nome, ordem) 
    VALUES (v_tenant_id, v_evento_id, 'Mesa de Pães', 1) 
    RETURNING id INTO v_secao_id;

    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, ordem) 
    VALUES (v_tenant_id, v_secao_id, 'Pão de fermentação natural', '', 1);
    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, ordem) 
    VALUES (v_tenant_id, v_secao_id, 'Croissant', '', 2);
    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, ordem) 
    VALUES (v_tenant_id, v_secao_id, 'Focaccia', '', 3);

    -- Seção: Queijos e Embutidos
    INSERT INTO evento_cardapio_secoes (tenant_id, evento_id, nome, ordem) 
    VALUES (v_tenant_id, v_evento_id, 'Queijos e Embutidos', 2) 
    RETURNING id INTO v_secao_id;

    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, ordem) 
    VALUES (v_tenant_id, v_secao_id, 'Salame italiano', '', 1);
    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, ordem) 
    VALUES (v_tenant_id, v_secao_id, 'Parmesão', '', 2);

    -- Seção: Sanduíches
    INSERT INTO evento_cardapio_secoes (tenant_id, evento_id, nome, ordem) 
    VALUES (v_tenant_id, v_evento_id, 'Sanduíches', 3) 
    RETURNING id INTO v_secao_id;

    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, ordem) 
    VALUES (v_tenant_id, v_secao_id, 'Croissant com Copa', 'Croissant, copa, parmesão, alface, tomate, molho rosé', 1);
    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, ordem) 
    VALUES (v_tenant_id, v_secao_id, 'Focaccia Caprese', 'Focaccia, muçarela de búfala, tomate, rúcula, pesto', 2);

    -- Seção: Mesa de Pastas e Saladas
    INSERT INTO evento_cardapio_secoes (tenant_id, evento_id, nome, ordem) 
    VALUES (v_tenant_id, v_evento_id, 'Mesa de Pastas e Saladas', 4) 
    RETURNING id INTO v_secao_id;

    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, ordem) 
    VALUES (v_tenant_id, v_secao_id, 'Burrata', 'Burrata acompanhada de tomates frescos e pesto de manjericão', 1);
    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, ordem) 
    VALUES (v_tenant_id, v_secao_id, 'Brie Assado', 'Brie assado com castanhas, nozes e mel', 2);
    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, ordem) 
    VALUES (v_tenant_id, v_secao_id, 'Salada Caesar', 'Salada de alface americana, rúcula e radichio roxo com molho Caesar', 3);
    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, ordem) 
    VALUES (v_tenant_id, v_secao_id, 'Abobrinha Grelhada', 'Abobrinha grelhada com alho e azeite de oliva', 4);
    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, ordem) 
    VALUES (v_tenant_id, v_secao_id, 'Roast beef', 'Roast beef servido com molho de mostarda e alcaparras', 5);

    -- Seção: Pratos Quentes
    INSERT INTO evento_cardapio_secoes (tenant_id, evento_id, nome, ordem) 
    VALUES (v_tenant_id, v_evento_id, 'Pratos Quentes', 5) 
    RETURNING id INTO v_secao_id;

    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, ordem) 
    VALUES (v_tenant_id, v_secao_id, 'Quiche de cogumelos', 'Quiche de cogumelos frescos', 1);
    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, ordem) 
    VALUES (v_tenant_id, v_secao_id, 'Torta de camarão', 'Torta de camarão, palmito e queijo cremoso', 2);
    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, ordem) 
    VALUES (v_tenant_id, v_secao_id, 'Talharim', 'Talharim grano duro fresco – Molho Alfredo', 3);

    -- Seção: Sobremesas
    INSERT INTO evento_cardapio_secoes (tenant_id, evento_id, nome, ordem) 
    VALUES (v_tenant_id, v_evento_id, 'Sobremesas', 6) 
    RETURNING id INTO v_secao_id;

    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, ordem) 
    VALUES (v_tenant_id, v_secao_id, 'Bolo de cenoura', 'Com cobertura de chocolate', 1);
    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, ordem) 
    VALUES (v_tenant_id, v_secao_id, 'Cheesecake', 'Com calda de frutas vermelhas', 2);
    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, ordem) 
    VALUES (v_tenant_id, v_secao_id, 'Pain Perdu', 'Brioche curtido no creme de baunilha e grelhado na manteiga', 3);

    -- Evento: Degustação - Buffet Completo
    -- Garantir tipo de evento
    SELECT id INTO v_tipo_id FROM tipos_evento WHERE nome = 'Buffet' AND tenant_id = v_tenant_id;
    IF v_tipo_id IS NULL THEN
        INSERT INTO tipos_evento (tenant_id, nome) VALUES (v_tenant_id, 'Buffet') RETURNING id INTO v_tipo_id;
    END IF;

    -- Inserir Evento
    INSERT INTO eventos (tenant_id, cliente_id, tipo_evento_id, categoria_evento_id, data_evento, numero_convidados, status)
    VALUES (v_tenant_id, v_cliente_id, v_tipo_id, v_cat_id, CURRENT_TIMESTAMP + INTERVAL '30 days', 50, 'Novo') 
    RETURNING id INTO v_evento_id;

    -- Seção: Coquetel Recepção
    INSERT INTO evento_cardapio_secoes (tenant_id, evento_id, nome, ordem) 
    VALUES (v_tenant_id, v_evento_id, 'Coquetel Recepção', 1) 
    RETURNING id INTO v_secao_id;

    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, ordem) 
    VALUES (v_tenant_id, v_secao_id, 'Bruschetta de Tomate', 'Tomate, manjericão e parmesão', 1);
    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, ordem) 
    VALUES (v_tenant_id, v_secao_id, 'Empanada de Cebola', 'Cebola assada, queijo asiago e chimichurri', 2);
    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, ordem) 
    VALUES (v_tenant_id, v_secao_id, 'Dadinho de Tapioca', 'Com geleia de maçã e pimenta', 3);
    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, ordem) 
    VALUES (v_tenant_id, v_secao_id, 'Polenta Cremosa', 'Servida com ragú de linguiça', 4);

    -- Seção: Saladas e Acompanhamentos
    INSERT INTO evento_cardapio_secoes (tenant_id, evento_id, nome, ordem) 
    VALUES (v_tenant_id, v_evento_id, 'Saladas e Acompanhamentos', 2) 
    RETURNING id INTO v_secao_id;

    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, ordem) 
    VALUES (v_tenant_id, v_secao_id, 'Salada Caesar', '', 1);
    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, ordem) 
    VALUES (v_tenant_id, v_secao_id, 'Salada Caprese', '', 2);
    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, ordem) 
    VALUES (v_tenant_id, v_secao_id, 'Arroz com Amêndoas', '', 3);
    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, ordem) 
    VALUES (v_tenant_id, v_secao_id, 'Risoto Funghi', '', 4);

    -- Seção: Pratos Principais - Massas
    INSERT INTO evento_cardapio_secoes (tenant_id, evento_id, nome, ordem) 
    VALUES (v_tenant_id, v_evento_id, 'Pratos Principais - Massas', 3) 
    RETURNING id INTO v_secao_id;

    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, ordem) 
    VALUES (v_tenant_id, v_secao_id, 'Penne ao Pomodoro', '', 1);
    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, ordem) 
    VALUES (v_tenant_id, v_secao_id, 'Lasanha Bolonhesa', '', 2);
    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, ordem) 
    VALUES (v_tenant_id, v_secao_id, 'Rondelli de Ricota', 'Com espinafre', 3);

    -- Seção: Pratos Principais - Carnes
    INSERT INTO evento_cardapio_secoes (tenant_id, evento_id, nome, ordem) 
    VALUES (v_tenant_id, v_evento_id, 'Pratos Principais - Carnes', 4) 
    RETURNING id INTO v_secao_id;

    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, ordem) 
    VALUES (v_tenant_id, v_secao_id, 'Alcatra Grelhada', 'Com molho de cogumelos frescos', 1);
    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, ordem) 
    VALUES (v_tenant_id, v_secao_id, 'Sobrecoxa Assada', '', 2);
    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, ordem) 
    VALUES (v_tenant_id, v_secao_id, 'Tilápia Grelhada', 'Com crosta de tomate', 3);

    -- Seção: Sobremesas
    INSERT INTO evento_cardapio_secoes (tenant_id, evento_id, nome, ordem) 
    VALUES (v_tenant_id, v_evento_id, 'Sobremesas', 5) 
    RETURNING id INTO v_secao_id;

    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, ordem) 
    VALUES (v_tenant_id, v_secao_id, 'Cheesecake', '', 1);
    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, ordem) 
    VALUES (v_tenant_id, v_secao_id, 'Banoffee', '', 2);
    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, ordem) 
    VALUES (v_tenant_id, v_secao_id, 'Mousse de Limão', 'Com merengue italiano', 3);

    -- Evento: Degustação - Empratado
    -- Garantir tipo de evento
    SELECT id INTO v_tipo_id FROM tipos_evento WHERE nome = 'Empratado' AND tenant_id = v_tenant_id;
    IF v_tipo_id IS NULL THEN
        INSERT INTO tipos_evento (tenant_id, nome) VALUES (v_tenant_id, 'Empratado') RETURNING id INTO v_tipo_id;
    END IF;

    -- Inserir Evento
    INSERT INTO eventos (tenant_id, cliente_id, tipo_evento_id, categoria_evento_id, data_evento, numero_convidados, status)
    VALUES (v_tenant_id, v_cliente_id, v_tipo_id, v_cat_id, CURRENT_TIMESTAMP + INTERVAL '30 days', 50, 'Novo') 
    RETURNING id INTO v_evento_id;

    -- Seção: Entradas
    INSERT INTO evento_cardapio_secoes (tenant_id, evento_id, nome, ordem) 
    VALUES (v_tenant_id, v_evento_id, 'Entradas', 1) 
    RETURNING id INTO v_secao_id;

    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, ordem) 
    VALUES (v_tenant_id, v_secao_id, 'Salada Caprese Casa Club', 'Tomate italiano assado com azeite de oliva, ervas frescas, recheado com mozzarella', 1);
    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, ordem) 
    VALUES (v_tenant_id, v_secao_id, 'Steak tartar', 'Mignon cortado na faca, temperos e torradas de pão italiano', 2);
    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, ordem) 
    VALUES (v_tenant_id, v_secao_id, 'Crabcake', 'Croqueta de siri servida com molho de mamão e pimenta verde', 3);

    -- Seção: Primeiro Prato
    INSERT INTO evento_cardapio_secoes (tenant_id, evento_id, nome, ordem) 
    VALUES (v_tenant_id, v_evento_id, 'Primeiro Prato', 2) 
    RETURNING id INTO v_secao_id;

    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, ordem) 
    VALUES (v_tenant_id, v_secao_id, 'Risoto de Pêra, Nozes e Gorgonzola', 'Pêras confitadas, nozes tostadas e queijo gorgonzola', 1);
    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, ordem) 
    VALUES (v_tenant_id, v_secao_id, 'Ravióli com Camarão', 'Recheado com camarão e servido com molho de limão e crocante de bacon', 2);

    -- Seção: Segundo Prato
    INSERT INTO evento_cardapio_secoes (tenant_id, evento_id, nome, ordem) 
    VALUES (v_tenant_id, v_evento_id, 'Segundo Prato', 3) 
    RETURNING id INTO v_secao_id;

    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, ordem) 
    VALUES (v_tenant_id, v_secao_id, 'Bife de Chorizo', 'Bife de chorizo Angus grelhado ao molho chimichurri e batatas rústicas', 1);
    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, ordem) 
    VALUES (v_tenant_id, v_secao_id, 'Paleta de Cordeiro Assada', 'Marinada com ervas, assada lentamente, com talharim artesanal', 2);

    -- Seção: Sobremesas
    INSERT INTO evento_cardapio_secoes (tenant_id, evento_id, nome, ordem) 
    VALUES (v_tenant_id, v_evento_id, 'Sobremesas', 4) 
    RETURNING id INTO v_secao_id;

    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, ordem) 
    VALUES (v_tenant_id, v_secao_id, 'Mil Folhas', 'Com creme de chocolate e morangos frescos', 1);
    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, ordem) 
    VALUES (v_tenant_id, v_secao_id, 'Duo de crème brûlée', 'Crème brûlée de chocolate belga e creme brûlée de tangerina', 2);

    -- Evento: Degustação - Comida de Boteco
    -- Garantir tipo de evento
    SELECT id INTO v_tipo_id FROM tipos_evento WHERE nome = 'Comida de Boteco' AND tenant_id = v_tenant_id;
    IF v_tipo_id IS NULL THEN
        INSERT INTO tipos_evento (tenant_id, nome) VALUES (v_tenant_id, 'Comida de Boteco') RETURNING id INTO v_tipo_id;
    END IF;

    -- Inserir Evento
    INSERT INTO eventos (tenant_id, cliente_id, tipo_evento_id, categoria_evento_id, data_evento, numero_convidados, status)
    VALUES (v_tenant_id, v_cliente_id, v_tipo_id, v_cat_id, CURRENT_TIMESTAMP + INTERVAL '30 days', 50, 'Novo') 
    RETURNING id INTO v_evento_id;

    -- Seção: Aperitivos (Comida de Boteco)
    INSERT INTO evento_cardapio_secoes (tenant_id, evento_id, nome, ordem) 
    VALUES (v_tenant_id, v_evento_id, 'Aperitivos (Comida de Boteco)', 1) 
    RETURNING id INTO v_secao_id;

    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, ordem) 
    VALUES (v_tenant_id, v_secao_id, 'Carne de onça', '', 1);
    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, ordem) 
    VALUES (v_tenant_id, v_secao_id, 'Aipim frito com bacon', '', 2);
    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, ordem) 
    VALUES (v_tenant_id, v_secao_id, 'Calabresa acebolada', 'Servida com torradas de fermentação natural e farofa de alho', 3);
    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, ordem) 
    VALUES (v_tenant_id, v_secao_id, 'Empanada de cebola assada', 'Com queijo asiago', 4);
    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, ordem) 
    VALUES (v_tenant_id, v_secao_id, 'Dadinho de tapioca', 'Com geleia de pimenta', 5);
    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, ordem) 
    VALUES (v_tenant_id, v_secao_id, 'Pão com bolinho de carne', 'Queijo, maionese da casa e mostarda escura', 6);
    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, ordem) 
    VALUES (v_tenant_id, v_secao_id, 'Sanduíche de roastbeef', 'Com vinagrete e mostarda amarela', 7);

    -- Seção: Sobremesas
    INSERT INTO evento_cardapio_secoes (tenant_id, evento_id, nome, ordem) 
    VALUES (v_tenant_id, v_evento_id, 'Sobremesas', 2) 
    RETURNING id INTO v_secao_id;

    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, ordem) 
    VALUES (v_tenant_id, v_secao_id, 'Pudim de leite', '', 1);
    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, ordem) 
    VALUES (v_tenant_id, v_secao_id, 'Brigadeiro de colher', '', 2);
END $$;
