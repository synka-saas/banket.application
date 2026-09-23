-- 003_seed_mock_data.sql
-- Adiciona dados de teste robustos vinculados à conta Banket

DO $$
DECLARE
    v_tenant_id UUID;
    v_cliente_maria UUID;
    v_cliente_joao UUID;
    v_cliente_empresa UUID;
    v_tipo_casamento UUID;
    v_tipo_corporativo UUID;
    v_tipo_15anos UUID;
    v_cat_social UUID;
    v_cat_corporativo UUID;
    v_coluna_novo UUID;
    v_coluna_proposta UUID;
    v_coluna_fechado UUID;
    v_status_pendente UUID;
    v_status_confirmado UUID;
    v_status_cancelado UUID;
    v_evento_1 UUID;
    v_evento_2 UUID;
    v_evento_3 UUID;
    v_evento_4 UUID;
    v_secao_entradas UUID;
    v_secao_principal UUID;
BEGIN
    -- 0. Pegar o tenant criado na seed 002
    SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'banket';

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Tenant "Banket" não encontrado. Rode o script 002 primeiro.';
    END IF;

    -- 1. Clientes
    INSERT INTO clientes (tenant_id, nome, email, telefone) VALUES 
    (v_tenant_id, 'Maria Eduarda Silva', 'maria.eduarda@email.com', '(11) 98765-4321') RETURNING id INTO v_cliente_maria;
    
    INSERT INTO clientes (tenant_id, nome, email, telefone) VALUES 
    (v_tenant_id, 'João Pedro Oliveira', 'joao.pedro@email.com', '(11) 91234-5678') RETURNING id INTO v_cliente_joao;

    INSERT INTO clientes (tenant_id, nome, email, telefone) VALUES 
    (v_tenant_id, 'TechCorp Brasil', 'contato@techcorp.com.br', '(11) 4002-8922') RETURNING id INTO v_cliente_empresa;

    -- 2. Tipos de Evento
    INSERT INTO tipos_evento (tenant_id, nome) VALUES (v_tenant_id, 'Casamento') RETURNING id INTO v_tipo_casamento;
    INSERT INTO tipos_evento (tenant_id, nome) VALUES (v_tenant_id, 'Festa de 15 Anos') RETURNING id INTO v_tipo_15anos;
    INSERT INTO tipos_evento (tenant_id, nome) VALUES (v_tenant_id, 'Confraternização Corporativa') RETURNING id INTO v_tipo_corporativo;

    -- 3. Categorias de Evento
    INSERT INTO categorias_evento (tenant_id, nome) VALUES (v_tenant_id, 'Social') RETURNING id INTO v_cat_social;
    INSERT INTO categorias_evento (tenant_id, nome) VALUES (v_tenant_id, 'Corporativo') RETURNING id INTO v_cat_corporativo;

    -- 4. Status de Orçamento
    INSERT INTO status_orcamento (tenant_id, nome, variante, ordem) VALUES (v_tenant_id, 'Pendente', 'pendente', 1) RETURNING id INTO v_status_pendente;
    INSERT INTO status_orcamento (tenant_id, nome, variante, ordem) VALUES (v_tenant_id, 'Confirmado', 'confirmado', 2) RETURNING id INTO v_status_confirmado;
    INSERT INTO status_orcamento (tenant_id, nome, variante, ordem) VALUES (v_tenant_id, 'Cancelado', 'cancelado', 3) RETURNING id INTO v_status_cancelado;

    -- 5. Colunas do Pipeline
    INSERT INTO pipeline_colunas (tenant_id, nome, ordem) VALUES (v_tenant_id, 'Novos Contatos', 1) RETURNING id INTO v_coluna_novo;
    INSERT INTO pipeline_colunas (tenant_id, nome, ordem) VALUES (v_tenant_id, 'Propostas Enviadas', 2) RETURNING id INTO v_coluna_proposta;
    INSERT INTO pipeline_colunas (tenant_id, nome, ordem) VALUES (v_tenant_id, 'Eventos Fechados', 3) RETURNING id INTO v_coluna_fechado;

    -- 6. Eventos
    INSERT INTO eventos (tenant_id, cliente_id, tipo_evento_id, categoria_evento_id, data_evento, numero_convidados, status) 
    VALUES (v_tenant_id, v_cliente_maria, v_tipo_casamento, v_cat_social, '2026-11-15 19:00:00', 150, 'Confirmado') RETURNING id INTO v_evento_1;

    INSERT INTO eventos (tenant_id, cliente_id, tipo_evento_id, categoria_evento_id, data_evento, numero_convidados, status) 
    VALUES (v_tenant_id, v_cliente_empresa, v_tipo_corporativo, v_cat_corporativo, '2026-12-10 20:00:00', 300, 'Pendente') RETURNING id INTO v_evento_2;
    
    INSERT INTO eventos (tenant_id, cliente_id, tipo_evento_id, categoria_evento_id, data_evento, numero_convidados, status) 
    VALUES (v_tenant_id, v_cliente_joao, v_tipo_15anos, v_cat_social, '2027-02-20 21:00:00', 200, 'Pendente') RETURNING id INTO v_evento_3;

    INSERT INTO eventos (tenant_id, cliente_id, tipo_evento_id, categoria_evento_id, data_evento, numero_convidados, status) 
    VALUES (v_tenant_id, v_cliente_empresa, v_tipo_corporativo, v_cat_corporativo, '2027-01-10 12:00:00', 50, 'Confirmado') RETURNING id INTO v_evento_4;

    -- 7. Orçamentos
    INSERT INTO orcamentos (tenant_id, evento_id, status_id, valor_total, conteudo) 
    VALUES (v_tenant_id, v_evento_1, v_status_confirmado, 25500.00, '[]');

    INSERT INTO orcamentos (tenant_id, evento_id, status_id, valor_total, conteudo) 
    VALUES (v_tenant_id, v_evento_2, v_status_pendente, 42000.00, '[]');
    
    INSERT INTO orcamentos (tenant_id, evento_id, status_id, valor_total, conteudo) 
    VALUES (v_tenant_id, v_evento_3, v_status_pendente, 18000.00, '[]');

    INSERT INTO orcamentos (tenant_id, evento_id, status_id, valor_total, conteudo) 
    VALUES (v_tenant_id, v_evento_4, v_status_confirmado, 8500.00, '[]');

    -- 8. Cardápio (Apenas para o Evento 1 como exemplo)
    INSERT INTO evento_cardapio_secoes (tenant_id, evento_id, nome, ordem) 
    VALUES (v_tenant_id, v_evento_1, 'Welcome Drink & Entradas', 1) RETURNING id INTO v_secao_entradas;
    
    INSERT INTO evento_cardapio_secoes (tenant_id, evento_id, nome, ordem) 
    VALUES (v_tenant_id, v_evento_1, 'Prato Principal', 2) RETURNING id INTO v_secao_principal;

    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, restricao_alimentar, ordem)
    VALUES (v_tenant_id, v_secao_entradas, 'Bruschetta de Tomate', 'Tomate cereja, manjericão, azeite trufado', 'vegano', 1);

    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, restricao_alimentar, ordem)
    VALUES (v_tenant_id, v_secao_entradas, 'Mini Quiche Lorraine', 'Bacon, alho poró e queijo gruyère', NULL, 2);

    INSERT INTO evento_cardapio_itens (tenant_id, secao_id, nome, descricao, restricao_alimentar, ordem)
    VALUES (v_tenant_id, v_secao_principal, 'Filé Mignon ao Molho Madeira', 'Acompanha risoto de parmesão', NULL, 1);

    -- 9. Equipe (Apenas para o Evento 1 como exemplo)
    INSERT INTO evento_equipe (tenant_id, evento_id, cargo, quantidade, observacoes)
    VALUES (v_tenant_id, v_evento_1, 'Garçom', 8, 'Uniforme preto padrão');

    INSERT INTO evento_equipe (tenant_id, evento_id, cargo, quantidade, observacoes)
    VALUES (v_tenant_id, v_evento_1, 'Recepcionista', 2, 'Com tablet para check-in');

    INSERT INTO evento_equipe (tenant_id, evento_id, cargo, quantidade, observacoes)
    VALUES (v_tenant_id, v_evento_1, 'Bartender', 3, 'Para a ilha de drinks');

END $$;
