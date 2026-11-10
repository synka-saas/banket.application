-- Cadastros iniciais de Cardápios › Seções e de Staff › Serviços (backlog de 10/11/2026): a empresa nova já começa
-- com as seções mais comuns e com quatro funções de demonstração (cachê zerado) para entender o dimensionamento.
-- Só preenche quando a empresa ainda não tem nenhum cadastro na tabela: nada é duplicado nem sobrescrito.

CREATE OR REPLACE FUNCTION aplicar_padroes_cardapio_staff(p_tenant UUID) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM catalogo_secoes WHERE tenant_id = p_tenant) THEN
    INSERT INTO catalogo_secoes (tenant_id, nome, descricao, ordem)
    VALUES
      (p_tenant, 'Entradas', 'Pratos leves servidos antes do prato principal', 1),
      (p_tenant, 'Prato Principal', 'Pratos principais do cardápio', 2),
      (p_tenant, 'Acompanhamentos', 'Guarnições que acompanham os pratos principais', 3),
      (p_tenant, 'Saladas', 'Saladas e folhas', 4),
      (p_tenant, 'Sobremesas', 'Doces e sobremesas', 5),
      (p_tenant, 'Bebidas não alcoólicas', 'Sucos, refrigerantes, águas e afins', 6),
      (p_tenant, 'Bebidas alcoólicas', 'Cervejas, vinhos, destilados e drinks', 7),
      (p_tenant, 'Coffee Break', 'Itens para coffee break e pausas', 8);
  END IF;

  -- Regras de demonstração: proporcionais ao número de convidados (ou fixa por evento), sem custo definido
  IF NOT EXISTS (SELECT 1 FROM staff_servicos WHERE tenant_id = p_tenant) THEN
    INSERT INTO staff_servicos
      (tenant_id, funcao, descricao, cache_diaria, auxilio, por_evento, quantidade_fixa, convidados_por_profissional,
       minimo, incluir_por_padrao, ordem)
    VALUES
      (p_tenant, 'Garçom', 'Serviço às mesas e circulação de bandejas. Exemplo: ajuste o cachê e a proporção.',
       0, 0, false, 1, 15, 2, true, 1),
      (p_tenant, 'Chefe de salão', 'Coordena a equipe de salão durante o evento. Exemplo: ajuste o cachê.',
       0, 0, true, 1, NULL, 0, true, 2),
      (p_tenant, 'Auxiliar de cozinha', 'Apoio na produção e na finalização dos pratos. Exemplo: ajuste o cachê e a proporção.',
       0, 0, false, 1, 30, 1, true, 3),
      (p_tenant, 'Barman', 'Preparo e serviço de bebidas no bar. Exemplo: ajuste o cachê e a proporção.',
       0, 0, false, 1, 80, 1, false, 4);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION aplicar_padroes_tenant_completo(p_tenant UUID) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM aplicar_padroes_tenant(p_tenant);
  PERFORM aplicar_padroes_tenant_proposta(p_tenant);
  PERFORM aplicar_padroes_formulario(p_tenant);
  PERFORM aplicar_padroes_email_modelos(p_tenant);
  PERFORM aplicar_padroes_documentos(p_tenant);
  PERFORM aplicar_padroes_financeiro(p_tenant);
  PERFORM aplicar_padroes_pesquisa(p_tenant);
  PERFORM aplicar_padroes_cardapio_staff(p_tenant);
END $$;

-- Empresas existentes ainda sem cadastro. As importadas para o Banket Busca que ninguém assumiu (sem usuário) ficam
-- de fora: recebem todos os padrões quando forem reivindicadas.
SELECT aplicar_padroes_cardapio_staff(t.id)
  FROM tenants t
 WHERE t.origem_cadastro IS DISTINCT FROM 'importacao'
    OR EXISTS (SELECT 1 FROM tenant_usuarios tu WHERE tu.tenant_id = t.id);
