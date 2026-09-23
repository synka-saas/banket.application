-- 006_eventos_demo.sql
-- Completa os eventos de demonstração (tenant "banket") com o briefing usado nos frames.

DO $$
DECLARE
    v_tenant UUID;
    v_evento UUID;
    v_cliente UUID;
BEGIN
    SELECT id INTO v_tenant FROM tenants WHERE slug = 'banket';
    IF v_tenant IS NULL OR EXISTS (SELECT 1 FROM eventos WHERE tenant_id = v_tenant AND titulo IS NOT NULL) THEN
        RETURN;
    END IF;

    -- Títulos a partir de categoria + cliente
    UPDATE eventos e SET titulo = c.nome || ' – ' || cl.nome
      FROM categorias_evento c, clientes cl
     WHERE e.tenant_id = v_tenant AND c.id = e.categoria_evento_id AND cl.id = e.cliente_id;

    UPDATE eventos SET local_nome = 'Casa Club Gourmet', duracao_evento_horas = 5, duracao_alimentacao_horas = 2
     WHERE tenant_id = v_tenant AND local_nome IS NULL;

    -- Evento do frame "Detalhes do Evento": confraternização da TechCorp
    SELECT id INTO v_cliente FROM clientes WHERE tenant_id = v_tenant AND nome = 'TechCorp Brasil';
    SELECT id INTO v_evento FROM eventos WHERE tenant_id = v_tenant AND cliente_id = v_cliente ORDER BY data_evento DESC LIMIT 1;
    IF v_evento IS NULL THEN
        RETURN;
    END IF;

    UPDATE clientes SET tipo_pessoa = 'PJ', documento = '11222333000181' WHERE id = v_cliente AND documento IS NULL;

    UPDATE eventos SET
        titulo = 'Confraternização de Final de Ano – TechCorp Brasil',
        numero_convidados = 540,
        perfil_convidados = 'Clientes VIPs',
        hora_inicio = '12:00', hora_fim = '20:00',
        duracao_evento_horas = 8, duracao_alimentacao_horas = 3,
        local_tipo = 'externo',
        local_nome = 'Sede TechCorp',
        endereco = 'R. Fernão Dias, 551 - Pinheiros, São Paulo - SP, 05427-011',
        infraestrutura = 'Não possui estrutura, precisaremos de montagem completa.',
        verba_total = 450000, verba_por_pessoa = 800,
        forma_pagamento = 'Boleto 30/60 dias',
        qualificacao = 'alta',
        responsavel_nome = 'Leandro de França Alves Pestana',
        responsavel_email = 'leandrofap@gmail.com',
        responsavel_whatsapp = '(11) 99321-3836',
        convite_experiencia = 'No momento não, quero apenas receber a estimativa inicial.',
        estilo_principal = 'Coquetel / Finger Food (ágil, ideal para pessoas em pé)',
        estilo_secundario = 'Ilhas gastronômicas & antepastos',
        bebidas_alcoolicas = 'Open bar completo (alcoólicos)',
        bebidas_sem_alcool = 'Pacote não alcoólico padrão',
        restricoes = '{sem_lactose,vegana}',
        compliance = '{faturamento_prazo,laudos_vigilancia}',
        staff_terceiros = 'Entre 50 e 75 profissionais',
        comentario_cliente = 'Teremos uma janela de apenas 45 minutos para o serviço principal, pois haverá uma premiação para os destaques do ano logo na sequência. É fundamental que a equipe de garçons seja ágil e muito discreta durante os discursos. Temos cerca de 5 diretores internacionais confirmados, então precisamos de opções que agradem paladares mais clássicos. Reforço que a aprovação final depende do envio das certidões negativas da empresa e que o faturamento precisa ser feito via boleto para 30 dias após o evento.',
        formato_servico_id = (SELECT id FROM formatos_servico WHERE tenant_id = v_tenant AND nome = 'Serviço volante')
     WHERE id = v_evento;

    INSERT INTO evento_checklist (tenant_id, evento_id, item, status, ordem) VALUES
        (v_tenant, v_evento, 'Degustação presencial', 'agendado', 1),
        (v_tenant, v_evento, 'Laudos da Vigilância Sanitária', 'enviado', 2),
        (v_tenant, v_evento, 'CNPJ e razão social válidos e coletados', 'agendado', 3);
END $$;
