-- 018_cores_etapas_design_system.sql
-- Cores padrão das etapas do funil no novo design system (tokens --stage-*):
-- novo = argila-400, negociação = terracota-500 (igual), aprovado = sálvia-500, recusado = argila-800.
-- Só troca etapas que ainda estão com a cor padrão antiga; cores escolhidas pela empresa ficam como estão.
-- Compatível com a versão anterior do código (a cor é só um dado exibido).

UPDATE status_orcamento SET cor = '#B0A194' WHERE variante = 'novo' AND upper(cor) = '#888888';
UPDATE status_orcamento SET cor = '#5E8B65' WHERE variante = 'aprovado' AND upper(cor) = '#4E8658';
UPDATE status_orcamento SET cor = '#3A302A' WHERE variante = 'recusado' AND upper(cor) = '#444444';

-- Padrões de uma empresa nova: mesma função da 004, com as cores novas
CREATE OR REPLACE FUNCTION aplicar_padroes_tenant(p_tenant UUID) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO configuracoes_tenant (tenant_id) VALUES (p_tenant) ON CONFLICT DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM status_orcamento WHERE tenant_id = p_tenant) THEN
    INSERT INTO status_orcamento (tenant_id, nome, variante, ordem, cor) VALUES
      (p_tenant, 'Novo orçamento', 'novo', 1, '#B0A194'),
      (p_tenant, 'Em negociação', 'negociacao', 2, '#E35336'),
      (p_tenant, 'Aprovado', 'aprovado', 3, '#5E8B65'),
      (p_tenant, 'Recusado', 'recusado', 4, '#3A302A');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM tipos_evento WHERE tenant_id = p_tenant) THEN
    INSERT INTO tipos_evento (tenant_id, nome, descricao) VALUES
      (p_tenant, 'Social', 'Casamentos, aniversários, formaturas e celebrações em geral'),
      (p_tenant, 'Corporativo', 'Confraternizações, lançamentos, convenções e eventos de empresas');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM formatos_servico WHERE tenant_id = p_tenant) THEN
    INSERT INTO formatos_servico (tenant_id, nome, descricao, ordem) VALUES
      (p_tenant, 'Serviço volante', 'Garçons servindo os convidados, ideal para pessoas em pé', 1),
      (p_tenant, 'Buffet', 'Mesa de buffet em que o convidado se serve', 2),
      (p_tenant, 'Ilhas gastronômicas', 'Estações temáticas distribuídas pelo espaço', 3),
      (p_tenant, 'Empratado', 'Pratos montados e servidos à mesa', 4),
      (p_tenant, 'Coquetel', 'Finger foods e bebidas em formato de recepção', 5);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM categorias_item WHERE tenant_id = p_tenant) THEN
    INSERT INTO categorias_item (tenant_id, nome, tipo, ordem) VALUES
      (p_tenant, 'Salgado', 'principal', 1),
      (p_tenant, 'Doce', 'principal', 2),
      (p_tenant, 'Bebida', 'principal', 3),
      (p_tenant, 'Recepção', 'secundaria', 1),
      (p_tenant, 'Entrada', 'secundaria', 2),
      (p_tenant, 'Prato principal', 'secundaria', 3),
      (p_tenant, 'Sobremesa', 'secundaria', 4);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM faixas_locacao WHERE tenant_id = p_tenant) THEN
    INSERT INTO faixas_locacao (tenant_id, min_convidados, max_convidados, valor, observacao) VALUES
      (p_tenant, 0, 30, 1000, NULL),
      (p_tenant, 31, 50, 1500, NULL),
      (p_tenant, 51, 80, 2000, NULL),
      (p_tenant, 81, 110, 2500, 'Somente na modalidade coquetel');
  END IF;
END $$;
