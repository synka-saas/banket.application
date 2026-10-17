-- 011_busca_demo.sql
-- Banket Busca: buffets fictícios para a vitrine (São Paulo, Campinas, Santo André e ABC), misturando clientes
-- Banket (planos pagos, um em teste) e perfis gratuitos (plano Busca), com pacotes, fotos ilustrativas
-- (a imagem padrão public/thumb-buffet.webp), avaliações, métricas de 60 dias, pedidos em vários status, cardápios ligados aos pacotes dos
-- clientes e eventos aprovados (disponibilidade). Um perfil fica incompleto (não publicado).
-- Usuários: <email abaixo>, senha Banket.2026. E-mails em .test (domínio reservado: nada é enviado).
-- Idempotente pelo slug da empresa.

CREATE OR REPLACE FUNCTION pg_temp.demo_buffet(
  p_slug text, p_nome text, p_plano text, p_email text, p_doc text, p_cidade text, p_bairro text,
  p_eventos text[], p_servicos text[], p_restricoes text[], p_domicilio boolean, p_raio int, p_espaco boolean,
  p_min int, p_max int, p_descricao text, p_resposta text, p_fotos text[], p_pacotes jsonb, p_publicado boolean,
  p_avaliacoes jsonb, p_trial_dias int DEFAULT NULL
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_t uuid; v_u uuid; v_p uuid; v_cid int; v_lat float8; v_lng float8; v_plano uuid; v_cliente boolean;
  v_pac jsonb; v_i int := 0; v_foto text; v_av jsonb; v_ped uuid; v_opcao uuid; v_secao uuid; v_item uuid;
  v_status_novo uuid; v_status_neg uuid; v_status_ok uuid; v_status_perdido uuid; v_tipo uuid; v_cli uuid; v_ev uuid;
  v_d int;
BEGIN
  IF EXISTS (SELECT 1 FROM tenants WHERE slug = p_slug) THEN RETURN; END IF;
  SELECT id, gratuito IS FALSE INTO v_plano, v_cliente FROM planos WHERE slug = p_plano;
  SELECT id, lat, lng INTO v_cid, v_lat, v_lng FROM busca_cidades WHERE slug = p_cidade;

  INSERT INTO tenants (nome, slug, tipo_pessoa, documento, razao_social, email, telefone, onboarding_completo, origem_cadastro, plano_id,
                       trial_ate, trial_iniciado_em, trial_usado_em)
  VALUES (p_nome, p_slug, 'PJ', p_doc, p_nome || ' Ltda', p_email, '11990000000', true, CASE WHEN v_cliente THEN 'site' ELSE 'busca' END, v_plano,
          CASE WHEN p_trial_dias IS NULL THEN NULL ELSE current_date + p_trial_dias END,
          CASE WHEN p_trial_dias IS NULL THEN NULL ELSE now() - interval '10 days' END,
          CASE WHEN p_trial_dias IS NULL THEN NULL ELSE now() - interval '10 days' END)
  RETURNING id INTO v_t;
  PERFORM aplicar_padroes_tenant_completo(v_t);
  INSERT INTO tenant_plano_historico (tenant_id, para_plano_id, motivo, origem, dados)
  VALUES (v_t, v_plano, 'cadastro', 'migracao', '{"nota": "seed 011"}');

  INSERT INTO usuarios (nome, email, senha_hash, email_verificado_em, origem_cadastro)
  VALUES ('Responsável ' || p_nome, p_email, crypt('Banket.2026', gen_salt('bf')), now(), CASE WHEN v_cliente THEN 'site' ELSE 'busca' END)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_u FROM usuarios WHERE email = p_email;
  INSERT INTO tenant_usuarios (tenant_id, usuario_id, role) VALUES (v_t, v_u, 'owner') ON CONFLICT DO NOTHING;

  INSERT INTO busca_perfis (tenant_id, slug, nome, documento, descricao, telefone, whatsapp, email_contato, instagram,
                            tipos_evento, tipos_servico, restricoes, atende_domicilio, raio_km, espaco_proprio, bairro,
                            cidade_id, lat, lng, capacidade_min, capacidade_max, tempo_resposta_texto,
                            etapa_concluida, publicado, publicado_em, completude, nivel, taxa_resposta)
  VALUES (v_t, p_slug, p_nome, p_doc, p_descricao, '1140000000', '11990000000', p_email, '@' || replace(p_slug, '-', ''),
          p_eventos, p_servicos, p_restricoes, p_domicilio, p_raio, p_espaco, p_bairro,
          v_cid, v_lat + (random() - 0.5) * 0.04, v_lng + (random() - 0.5) * 0.04, p_min, p_max, p_resposta,
          CASE WHEN p_publicado THEN 6 ELSE 3 END, p_publicado, CASE WHEN p_publicado THEN now() - interval '40 days' END,
          CASE WHEN p_publicado THEN 70 + (random() * 30)::int ELSE 35 END,
          CASE WHEN v_cliente THEN 'cliente' ELSE 'gratuito' END, round((0.6 + random() * 0.4)::numeric, 4))
  RETURNING id INTO v_p;

  FOREACH v_foto IN ARRAY p_fotos LOOP
    INSERT INTO busca_fotos (tenant_id, perfil_id, path, legenda, ordem, capa)
    VALUES (v_t, v_p, '/thumb-buffet.webp',
            CASE split_part(v_foto, '-', 1) WHEN 'mesa' THEN 'Mesa posta' WHEN 'salao' THEN 'Salão montado' ELSE 'Mesa de doces' END,
            v_i, v_i = 0);
    v_i := v_i + 1;
  END LOOP;

  -- Clientes Banket: um cardápio no catálogo, ligado ao primeiro pacote (cardápio detalhado no perfil)
  IF v_cliente THEN
    INSERT INTO catalogo_secoes (tenant_id, nome, ordem) VALUES (v_t, 'Salgados', 1) RETURNING id INTO v_secao;
    INSERT INTO cardapio_opcoes (tenant_id, nome, descricao, preco_por_pessoa, ativo)
    VALUES (v_t, (p_pacotes -> 0 ->> 'nome'), (p_pacotes -> 0 ->> 'descricao'), (p_pacotes -> 0 ->> 'preco')::numeric, true)
    RETURNING id INTO v_opcao;
    INSERT INTO cardapio_opcao_secoes (tenant_id, opcao_id, secao_id, titulo, escolha_qtd, ordem)
    VALUES (v_t, v_opcao, v_secao, 'Salgados (escolha 6)', 6, 1) RETURNING id INTO v_secao;
    FOR v_i IN 1..8 LOOP
      INSERT INTO catalogo_itens (tenant_id, secao_id, nome, ordem, restricoes)
      VALUES (v_t, (SELECT secao_id FROM cardapio_opcao_secoes WHERE id = v_secao),
              (ARRAY['Coxinha de frango','Bolinha de queijo','Kibe','Empadinha de palmito','Esfiha de carne','Croquete de costela','Pastel de queijo','Mini quiche de alho-poró'])[v_i],
              v_i, CASE WHEN v_i IN (2, 4, 8) THEN ARRAY['vegetariana'] ELSE '{}' END)
      RETURNING id INTO v_item;
      INSERT INTO cardapio_opcao_itens (tenant_id, opcao_secao_id, item_id, ordem) VALUES (v_t, v_secao, v_item, v_i);
    END LOOP;
  END IF;

  v_i := 0;
  FOR v_pac IN SELECT * FROM jsonb_array_elements(p_pacotes) LOOP
    INSERT INTO busca_pacotes (tenant_id, perfil_id, nome, descricao, inclui, preco_pessoa, convidados_min, convidados_max, cardapio_opcao_id, ordem)
    VALUES (v_t, v_p, v_pac ->> 'nome', v_pac ->> 'descricao', ARRAY(SELECT jsonb_array_elements_text(v_pac -> 'inclui')),
            (v_pac ->> 'preco')::numeric, p_min, p_max, CASE WHEN v_i = 0 THEN v_opcao END, v_i);
    v_i := v_i + 1;
  END LOOP;

  -- Métricas dos últimos 60 dias
  IF p_publicado THEN
    INSERT INTO busca_metricas_dia (tenant_id, perfil_id, dia, aparicoes, visualizacoes, cliques_orcamento)
    SELECT v_t, v_p, current_date - g, (8 + random() * 40)::int, (2 + random() * 14)::int, (random() * 3)::int
      FROM generate_series(1, 60) g;
  END IF;

  -- Avaliações (pedidos antigos, sem evento ligado)
  FOR v_av IN SELECT * FROM jsonb_array_elements(p_avaliacoes) LOOP
    v_d := 20 + (random() * 300)::int;
    INSERT INTO busca_pedidos (tenant_id, perfil_id, grupo_id, tipo_evento, data_evento, convidados, cidade_id, nome, email,
                               aceite_contato, respondido_em, created_at)
    VALUES (v_t, v_p, gen_random_uuid(), p_eventos[1], current_date - v_d, p_min + 30, v_cid, v_av ->> 'nome',
            lower(replace(v_av ->> 'nome', ' ', '.')) || '@cliente.test', true, now() - (v_d + 30) * interval '1 day',
            now() - (v_d + 31) * interval '1 day')
    RETURNING id INTO v_ped;
    INSERT INTO busca_avaliacoes (tenant_id, perfil_id, pedido_id, token_hash, token_expira_em, nota, texto, nome_exibicao,
                                  respondida_em, resposta_buffet, resposta_em, publicada)
    VALUES (v_t, v_p, v_ped, encode(digest(gen_random_uuid()::text, 'sha256'), 'hex'), now() - interval '1 day',
            (v_av ->> 'nota')::int, v_av ->> 'texto', v_av ->> 'nome', now() - (v_d - 3) * interval '1 day',
            v_av ->> 'resposta', CASE WHEN v_av ? 'resposta' THEN now() - (v_d - 4) * interval '1 day' END, true);
  END LOOP;
  UPDATE busca_perfis SET nota_media = (SELECT round(avg(nota), 2) FROM busca_avaliacoes WHERE perfil_id = v_p AND publicada),
                          total_avaliacoes = (SELECT count(*) FROM busca_avaliacoes WHERE perfil_id = v_p AND publicada)
   WHERE id = v_p;

  -- Pedidos recentes no funil: um em cada status (novo, respondido, negociação, fechado, perdido)
  IF p_publicado THEN
    SELECT id INTO v_status_novo FROM status_orcamento WHERE tenant_id = v_t AND variante = 'novo' ORDER BY ordem LIMIT 1;
    SELECT id INTO v_status_neg FROM status_orcamento WHERE tenant_id = v_t AND variante = 'negociacao' ORDER BY ordem LIMIT 1;
    SELECT id INTO v_status_ok FROM status_orcamento WHERE tenant_id = v_t AND variante = 'aprovado' ORDER BY ordem LIMIT 1;
    SELECT id INTO v_status_perdido FROM status_orcamento WHERE tenant_id = v_t AND variante = 'recusado' ORDER BY ordem LIMIT 1;
    FOR v_i IN 1..5 LOOP
      SELECT id INTO v_tipo FROM tipos_evento WHERE tenant_id = v_t AND slug = CASE WHEN p_eventos[1] IN ('corporativo','coffee_break','confraternizacao','lancamento') THEN 'corporativo' ELSE 'social' END;
      INSERT INTO clientes (tenant_id, tipo_pessoa, nome, email, telefone)
      VALUES (v_t, 'PF', (ARRAY['Juliana Ramos','Ana Ribeiro','Marcos Teixeira','Patrícia Lima','Rodrigo Alves'])[v_i],
              lower((ARRAY['juliana.ramos','ana.ribeiro','marcos.teixeira','patricia.lima','rodrigo.alves'])[v_i]) || '.' || p_slug || '@cliente.test',
              '1198765432' || v_i)
      RETURNING id INTO v_cli;
      INSERT INTO eventos (tenant_id, cliente_id, status_id, titulo, tipo_evento_id, data_evento, numero_convidados, origem,
                           comentario_cliente, responsavel_nome, responsavel_email, fechado_em, motivo_perda)
      VALUES (v_t, v_cli, CASE v_i WHEN 1 THEN v_status_novo WHEN 2 THEN v_status_novo WHEN 3 THEN v_status_neg WHEN 4 THEN v_status_ok ELSE v_status_perdido END,
              initcap(replace(p_eventos[1], '_', ' ')) || ' – ' || (ARRAY['Juliana Ramos','Ana Ribeiro','Marcos Teixeira','Patrícia Lima','Rodrigo Alves'])[v_i],
              v_tipo, current_date + (15 + v_i * 9), p_min + 20 * v_i, 'busca',
              'Pedido de demonstração pelo Banket Busca.', (ARRAY['Juliana Ramos','Ana Ribeiro','Marcos Teixeira','Patrícia Lima','Rodrigo Alves'])[v_i],
              NULL, CASE WHEN v_i = 4 THEN current_date - 2 END, CASE WHEN v_i = 5 THEN 'Fechou com outro buffet' END)
      RETURNING id INTO v_ev;
      INSERT INTO busca_pedidos (tenant_id, perfil_id, grupo_id, evento_id, cliente_id, tipo_evento, tipo_servico, data_evento, convidados,
                                 cidade_id, nome, email, whatsapp, observacoes, aceite_contato, respondido_em, created_at)
      VALUES (v_t, v_p, gen_random_uuid(), v_ev, v_cli, p_eventos[1], p_servicos[1], current_date + (15 + v_i * 9), p_min + 20 * v_i,
              v_cid, (SELECT nome FROM clientes WHERE id = v_cli), (SELECT email FROM clientes WHERE id = v_cli), '1198765432' || v_i,
              'Gostaria de saber valores e se há opções sem glúten.', true,
              CASE WHEN v_i >= 2 THEN now() - interval '1 day' END, now() - (6 - v_i) * interval '1 day');
    END LOOP;
    -- Clientes Banket: eventos aprovados em datas próximas ocupam a agenda (disponibilidade)
    IF v_cliente THEN
      INSERT INTO eventos (tenant_id, cliente_id, status_id, titulo, tipo_evento_id, data_evento, numero_convidados, origem, fechado_em)
      SELECT v_t, v_cli, v_status_ok, 'Evento fechado ' || g, v_tipo, current_date + g * 7, p_min + 40, 'manual', current_date - 10
        FROM generate_series(1, 4) g;
    END IF;
  END IF;
END $$;

SELECT pg_temp.demo_buffet('buffet-sabor-de-festa', 'Buffet Sabor de Festa', 'prime', 'contato@sabordefesta.test', '41111111000101',
  'santo-andre-sp', 'Vila Assunção', ARRAY['infantil','aniversario','casamento','debutante'], ARRAY['buffet_completo','finger_food','doces_bolo','kids'],
  ARRAY['vegetariana','sem_gluten'], true, 25, true, 40, 250,
  'Há 18 anos fazendo festas em Santo André e no ABC. Salão próprio climatizado com espaço kids e equipe de monitores, ou buffet completo na sua casa. Comida feita no dia, servida quente do começo ao fim.',
  'Responde em até 2 horas', ARRAY['salao-1','mesa-1','doces-1','mesa-2','salao-2','doces-2','mesa-3','salao-3'],
  '[{"nome":"Festa completa","descricao":"Salgados, mini lanches, prato quente, bolo e doces.","preco":129,"inclui":["8 tipos de salgado","Prato quente","Bolo e doces","Bebidas não alcoólicas"]},
    {"nome":"Festa essencial","descricao":"Salgados, bolo e bebidas para festas de até 4 horas.","preco":89,"inclui":["6 tipos de salgado","Bolo","Bebidas não alcoólicas"]},
    {"nome":"Festa premium","descricao":"Ilha de massas, finger food e mesa de doces finos.","preco":149,"inclui":["Ilha de massas","Finger food","Doces finos","Bebidas não alcoólicas"]}]',
  true, '[{"nome":"Renata Lopes","nota":5,"texto":"A festa do Theo foi impecável. Comida quentinha o tempo todo e a equipe resolveu tudo pelo WhatsApp.","resposta":"Obrigada, Renata! Foi um prazer fazer parte do aniversário do Theo."},
          {"nome":"Carlos Menezes","nota":5,"texto":"Organização excelente, monitores atenciosos e o bolo estava maravilhoso."},
          {"nome":"Fernanda Dias","nota":4,"texto":"Muito bom no geral. Só achei que o prato quente demorou um pouco a sair."},
          {"nome":"Luciana Prado","nota":5,"texto":"Fizemos o casamento aqui e os convidados elogiam até hoje. Recomendo de olhos fechados."}]');

SELECT pg_temp.demo_buffet('casa-jardim-eventos', 'Casa Jardim Eventos', 'profissional', 'contato@casajardim.test', '41111111000102',
  'campinas-sp', 'Gramado', ARRAY['casamento','debutante','formatura','corporativo'], ARRAY['buffet_completo','empratado','coquetel','bar_bebidas'],
  ARRAY['vegetariana','vegana','sem_lactose'], false, NULL, true, 80, 400,
  'Espaço com jardim, capela ao ar livre e salão para até 400 convidados em Campinas. Cerimonial próprio, cardápio assinado por chef e bar de drinks.',
  'Responde no mesmo dia', ARRAY['salao-4','mesa-4','salao-5','mesa-5','doces-4','salao-6'],
  '[{"nome":"Casamento clássico","descricao":"Coquetel de recepção, jantar empratado em três tempos e mesa de doces.","preco":198,"inclui":["Coquetel de recepção","Jantar em 3 tempos","Mesa de doces","Bar sem álcool"]},
    {"nome":"Celebração jardim","descricao":"Buffet completo com ilhas gastronômicas.","preco":165,"inclui":["Ilhas gastronômicas","Sobremesas","Bebidas não alcoólicas"]},
    {"nome":"Corporativo","descricao":"Coquetel volante para lançamentos e confraternizações.","preco":145,"inclui":["Coquetel volante","Bebidas"]}]',
  true, '[{"nome":"Mariana e Pedro","nota":5,"texto":"O jardim é lindo e a equipe cuidou de cada detalhe. O jantar estava perfeito."},
          {"nome":"Beatriz Souza","nota":5,"texto":"Festa de 15 anos da minha filha superou as expectativas."},
          {"nome":"Grupo Avance","nota":4,"texto":"Ótimo para o nosso evento corporativo. Estacionamento poderia ser maior."}]');

SELECT pg_temp.demo_buffet('mesa-posta-catering', 'Mesa Posta Catering', 'essencial', 'contato@mesaposta.test', '41111111000103',
  'sao-paulo-sp', 'Moema', ARRAY['corporativo','coffee_break','confraternizacao','lancamento'], ARRAY['coffee_break','finger_food','coquetel'],
  ARRAY['vegetariana','sem_gluten','sem_lactose'], true, 30, false, 20, 300,
  'Catering para empresas em São Paulo: coffee break, almoço executivo e coquetel de confraternização, com montagem e equipe no seu escritório ou espaço.',
  'Responde em até 4 horas', ARRAY['mesa-6','doces-6','mesa-1','salao-1'],
  '[{"nome":"Coffee break","descricao":"Café, sucos, salgados assados e frutas.","preco":45,"inclui":["Café e chás","Sucos","Salgados assados","Frutas"]},
    {"nome":"Coquetel de confraternização","descricao":"Finger food quente e frio por 3 horas.","preco":110,"inclui":["Finger food","Bebidas não alcoólicas","Equipe de serviço"]}]',
  true, '[{"nome":"Tech Paulista","nota":5,"texto":"Pontuais e muito organizados. O coffee break agradou todo mundo."},
          {"nome":"Ana Beatriz","nota":4,"texto":"Comida boa e bonita. Faltou um pouco de opção sem lactose."}]');

SELECT pg_temp.demo_buffet('villa-toscana-recepcoes', 'Villa Toscana Recepções', 'profissional', 'contato@villatoscana.test', '41111111000104',
  'sao-bernardo-do-campo-sp', 'Rudge Ramos', ARRAY['casamento','aniversario','batizado'], ARRAY['buffet_completo','empratado','doces_bolo'],
  ARRAY['vegetariana'], false, NULL, true, 60, 350,
  'Recepções com cozinha italiana em São Bernardo do Campo: massas artesanais, carnes e sobremesas da casa.',
  'Responde em até 6 horas', ARRAY['salao-2','mesa-2','doces-3','salao-3','mesa-3'],
  '[{"nome":"Cardápio Toscana","descricao":"Antepastos, duas massas, carne e sobremesas.","preco":168,"inclui":["Antepastos","2 massas","Carne","Sobremesas"]},
    {"nome":"Cardápio Florença","descricao":"Jantar completo com estação de risotos.","preco":190,"inclui":["Estação de risotos","Carnes","Sobremesas","Bebidas não alcoólicas"]}]',
  true, '[{"nome":"Gabriel Martins","nota":5,"texto":"Massas maravilhosas, todos repetiram. Atendimento muito cordial."}]', 20);

SELECT pg_temp.demo_buffet('brasa-e-cia-churrasco', 'Brasa & Cia Churrasco', 'busca', 'contato@brasaecia.test', '41111111000105',
  'diadema-sp', 'Centro', ARRAY['aniversario','confraternizacao','casamento'], ARRAY['churrasco','bar_bebidas','buffet_completo'],
  '{}', true, 40, false, 30, 200,
  'Churrasco no local do seu evento, com churrasqueiros, acompanhamentos e bar. Atendemos Diadema, ABC e zona sul de São Paulo.',
  'Responde em até 1 dia', ARRAY['mesa-4','salao-4','mesa-5'],
  '[{"nome":"Churrasco tradicional","descricao":"Picanha, linguiça, frango, acompanhamentos e pão de alho.","preco":79,"inclui":["5 tipos de carne","Acompanhamentos","Churrasqueiros"]},
    {"nome":"Churrasco premium","descricao":"Cortes nobres e bar de caipirinhas.","preco":95,"inclui":["Cortes nobres","Bar de caipirinhas","Acompanhamentos"]}]',
  true, '[{"nome":"Eduardo Rocha","nota":5,"texto":"Carne no ponto certo e equipe muito educada."},
          {"nome":"Sandra Melo","nota":4,"texto":"Bom custo-benefício para a confraternização da empresa."}]');

SELECT pg_temp.demo_buffet('doce-encanto-festas', 'Doce Encanto Festas', 'busca', 'contato@doceencanto.test', '41111111000106',
  'sao-caetano-do-sul-sp', 'Santa Paula', ARRAY['infantil','aniversario','cha'], ARRAY['doces_bolo','finger_food','kids'],
  ARRAY['sem_gluten'], false, NULL, true, 20, 120,
  'Espaço kids em São Caetano do Sul com brinquedos, monitores e mesa de doces temática.',
  'Responde em até 1 dia', ARRAY['doces-1','doces-2','salao-5','mesa-6','doces-5'],
  '[{"nome":"Festa kids","descricao":"Salgados, mini lanches, bolo temático e doces.","preco":89,"inclui":["Salgados","Mini lanches","Bolo temático","Doces"]}]',
  true, '[{"nome":"Priscila Nunes","nota":5,"texto":"As crianças amaram os brinquedos e a decoração estava linda."},
          {"nome":"Tiago Barros","nota":4,"texto":"Gostamos muito, só o som estava um pouco alto."}]');

SELECT pg_temp.demo_buffet('food-truck-ponto-certo', 'Food Truck Ponto Certo', 'busca', 'contato@pontocerto.test', '41111111000107',
  'sao-paulo-sp', 'Tatuapé', ARRAY['corporativo','aniversario','formatura'], ARRAY['food_truck','finger_food'],
  ARRAY['vegetariana'], true, 20, false, 50, 500,
  'Hambúrguer artesanal e porções direto do food truck no seu evento, na zona leste e no centro de São Paulo.',
  NULL, ARRAY['mesa-3','salao-6','mesa-2'],
  '[{"nome":"Burger party","descricao":"Hambúrgueres artesanais e batata à vontade por 3 horas.","preco":52,"inclui":["Hambúrgueres","Batata","Refrigerantes"]}]',
  true, '[]');

SELECT pg_temp.demo_buffet('atelie-gastronomico-vila-mariana', 'Ateliê Gastronômico Vila Mariana', 'busca', 'contato@ateliegastronomico.test', '41111111000108',
  'sao-paulo-sp', 'Vila Mariana', ARRAY['casamento','corporativo','aniversario'], ARRAY['empratado','finger_food','coquetel'],
  ARRAY['vegetariana','vegana','sem_gluten','sem_lactose'], true, 15, false, 15, 120,
  'Jantares empratados e finger food autoral para eventos intimistas, com menu degustação criado para cada celebração.',
  'Responde em até 3 horas', ARRAY['mesa-5','mesa-6','doces-6','mesa-1'],
  '[{"nome":"Jantar degustação","descricao":"Menu de cinco tempos harmonizado.","preco":220,"inclui":["5 tempos","Equipe de sala"]},
    {"nome":"Finger food autoral","descricao":"Doze criações quentes e frias.","preco":160,"inclui":["12 criações","Equipe de serviço"]}]',
  true, '[{"nome":"Helena Castro","nota":5,"texto":"Uma experiência gastronômica. Cada prato mais bonito que o outro."}]');

SELECT pg_temp.demo_buffet('recanto-das-flores-buffet', 'Recanto das Flores Buffet', 'busca', 'contato@recantodasflores.test', '41111111000109',
  'campinas-sp', 'Barão Geraldo', ARRAY['casamento','debutante','infantil'], ARRAY['buffet_completo','doces_bolo','kids'],
  ARRAY['vegetariana'], false, NULL, true, 50, 300,
  'Salão com jardim de inverno em Barão Geraldo, ideal para casamentos e festas de 15 anos.',
  'Responde em até 1 dia', ARRAY['salao-1','salao-4','doces-4'],
  '[{"nome":"Festa completa","descricao":"Buffet completo com salgados, prato quente, bolo e doces.","preco":118,"inclui":["Salgados","Prato quente","Bolo e doces"]}]',
  true, '[{"nome":"Vanessa Reis","nota":3,"texto":"Espaço bonito, mas a comida poderia ter mais variedade."},
          {"nome":"Otávio Freitas","nota":4,"texto":"Gostamos do salão e do atendimento."}]');

SELECT pg_temp.demo_buffet('sabores-do-abc', 'Sabores do ABC', 'busca', 'contato@saboresdoabc.test', '41111111000110',
  'santo-andre-sp', 'Jardim', ARRAY['aniversario'], ARRAY['buffet_completo'], '{}', true, 15, false, 30, 100,
  NULL, NULL, '{}', '[]', false, '[]');
