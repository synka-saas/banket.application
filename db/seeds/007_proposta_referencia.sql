-- 007_proposta_referencia.sql
-- Template e blocos de texto do tenant de demonstração no estilo dos PDFs de referência (public/ref).

DO $$
DECLARE
    v_tenant UUID;
BEGIN
    SELECT id INTO v_tenant FROM tenants WHERE slug = 'banket';
    IF v_tenant IS NULL OR EXISTS (SELECT 1 FROM orcamento_blocos_info WHERE tenant_id = v_tenant AND chave = 'locacao_espaco') THEN
        RETURN;
    END IF;

    UPDATE orcamento_templates SET
        descricao = 'Estilo dos cardápios de referência: capa com título, páginas creme e títulos em vermelho.',
        fonte_titulo = 'Archivo Black',
        fonte_corpo = 'Open Sans',
        cor_fundo = '#FFF9F2',
        cor_texto_primaria = '#4A1A0E',
        cor_texto_secundaria = '#A61E00',
        capa_titulo = 'Proposta de orçamento',
        capa_conteudo = 'Para o sucesso do seu evento',
        miolo_titulo = 'Proposta de orçamento',
        miolo_introducao = 'Apresentamos abaixo uma proposta de orçamento para realização de evento, com os respectivos serviços. **Estamos abertos a eventuais alterações** que viabilizem melhor servi-los, e nos colocamos à sua disposição para o esclarecimento de quaisquer dúvidas que possam surgir.',
        contracapa_ativa = true,
        contracapa_titulo = 'Obrigado!',
        contracapa_conteudo = 'Será um prazer fazer parte do seu evento.',
        tags = '{Padrão, Clássico}'
     WHERE tenant_id = v_tenant AND padrao;

    DELETE FROM orcamento_blocos_info WHERE tenant_id = v_tenant;
    INSERT INTO orcamento_blocos_info (tenant_id, chave, titulo, pagina, ordem, ativo_por_padrao, texto) VALUES
    (v_tenant, 'criancas', 'Crianças', 'informacoes', 1, true,
     E'- Até 5 anos – não paga\n- De 6 a 11 anos – paga meia\n- Acima de 11 – paga inteira'),
    (v_tenant, 'locacao_espaco', 'Locação do espaço', 'informacoes', 2, true,
     E'## Valores de locação\n- Até 30 convidados – R$ 1.000,00\n- De 30 a 50 convidados – R$ 1.500,00\n- De 50 a 80 convidados – R$ 2.000,00\n- De 80 a 110 convidados (somente na modalidade coquetel) – R$ 2.500,00\n\nCaso a cerimônia seja feita no espaço, será cobrada uma taxa de **R$ 500,00** para cobrir os custos de alteração e adequação do local para receber esse evento.'),
    (v_tenant, 'hora_adicional', 'Hora adicional', 'informacoes', 3, true,
     'Caso ultrapasse o horário, terá acréscimo de 10% no valor do evento por hora adicional, com mínimo de R$ 600,00/hora.'),
    (v_tenant, 'materiais_inclusos', 'Materiais e serviços inclusos na locação', 'informacoes', 4, true,
     E'- Utilização de toda a estrutura da cozinha gourmet, salão e área externa\n- Limpeza antes, durante e após o evento\n- Louças em porcelana branca\n- Talheres linha luxo Tramontina\n- Taças em cristal para vinho e espumante\n- Copos para água, chope, suco e refrigerante\n- Mesas\n- Cadeiras estofadas\n- Jogo americano\n- Guardanapos de papel de primeira linha\n- Aparelho para som ambiente\n- Ar-condicionado'),
    (v_tenant, 'nao_inclusos', 'Materiais, serviços e impostos não inclusos na locação', 'informacoes', 5, true,
     E'- Lavagem, montagem e desmontagem de materiais de serviços contratados de terceiros. Ex.: decoração, músicos, DJ, doces finos\n- Para serviços externos não contratados por nós será cobrada uma taxa de R$ 200,00\n- Alimentação do staff não contratado por nós: caso opte por oferecer o serviço de alimentação para este staff, será cobrado 70% do valor da alimentação por membro do staff.'),
    (v_tenant, 'staff_contratado', 'Equipe do evento', 'staff', 6, true,
     'Esta equipe será contratada por nós e trabalhará durante o seu evento.'),
    (v_tenant, 'bebidas_taxas', 'Taxas de bebidas', 'bebidas', 7, true,
     E'- Caso opte por trazer seu vinho e/ou espumante, será cobrada por rolha o valor de R$ 35,00.\n- Caso opte por contratar serviço de chope, será cobrada uma taxa de R$ 150,00 para cobrir os custos com recebimento, devolução e energia elétrica.'),
    (v_tenant, 'reserva_data', 'Reserva de data', 'condicoes', 8, true,
     '**A reserva de data está diretamente relacionada à contratualização do evento, independente da validade da proposta.**'),
    (v_tenant, 'formas_pagamento', 'Formas de pagamento', 'condicoes', 9, true,
     E'- Transferência bancária\n- Pix\n- Cartão de débito – será cobrado um adicional de 0,90% sobre o valor total do evento\n- Cartão de crédito – será cobrado um adicional de 4,5% sobre o valor total do evento\n- Havendo alteração no número de convidados, os valores da proposta poderão sofrer alterações.\n- Valores sujeitos a repasse da inflação do período, caso a inflação ultrapasse 7% do período.'),
    (v_tenant, 'cancelamento', 'Regras de cancelamento', 'condicoes', 10, true,
     E'- 30 dias ou mais da data do evento, será aplicada multa de 30% sobre o valor total do evento.\n- 29 a 11 dias da data do evento, será aplicada multa de 50% do valor total do evento.\n- 10 dias ao dia do evento, será aplicada multa de 80% do valor total do evento.\n\nEstamos abertos à alteração do cardápio, se necessário.');

    UPDATE configuracoes_tenant SET assinatura_nome = COALESCE(assinatura_nome, 'Newton Oliveira'),
                                    assinatura_cargo = COALESCE(assinatura_cargo, 'Proprietário'),
                                    assinatura_telefone = COALESCE(assinatura_telefone, '+55 41 99926 2525'),
                                    local_padrao = COALESCE(local_padrao, 'Casa Club Gourmet')
     WHERE tenant_id = v_tenant;
END $$;
