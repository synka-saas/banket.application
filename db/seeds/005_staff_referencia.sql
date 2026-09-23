-- 005_staff_referencia.sql
-- Serviços de staff dos cardápios de referência e alguns profissionais de exemplo (tenant "banket").

DO $$
DECLARE
    v_tenant UUID;
BEGIN
    SELECT id INTO v_tenant FROM tenants WHERE slug = 'banket';
    IF v_tenant IS NULL OR EXISTS (SELECT 1 FROM staff_servicos WHERE tenant_id = v_tenant) THEN
        RETURN;
    END IF;

    INSERT INTO staff_servicos
        (tenant_id, funcao, descricao, cache_diaria, hora_extra, auxilio, por_evento, quantidade_fixa,
         convidados_por_profissional, minimo, incluir_por_padrao, tags, ordem)
    VALUES
        (v_tenant, 'Garçom', 'Serviço de mesa e volante', 250, NULL, 0, false, 1, 15, 0, true, '{Salão}', 1),
        (v_tenant, 'Barman', 'Somente quando houver bar contratado', 350, NULL, 0, false, 1, 50, 0, false, '{Bar}', 2),
        (v_tenant, 'Maître', 'Coordenação do salão', 450, NULL, 0, false, 1, 100, 0, true, '{Salão, Coordenação}', 3),
        (v_tenant, 'Copeira', 'Apoio na copa e reposição', 200, NULL, 0, false, 1, 50, 0, true, '{Copa}', 4),
        (v_tenant, 'Auxiliar de cozinha', 'Apoio à produção', 200, NULL, 0, false, 1, 30, 0, true, '{Cozinha}', 5),
        (v_tenant, 'Cozinheiro', 'Produção no evento', 250, NULL, 0, false, 1, 50, 0, true, '{Cozinha}', 6),
        (v_tenant, 'Chef de cozinha', 'Responsável pela cozinha do evento', 450, NULL, 0, true, 1, NULL, 0, true, '{Cozinha, Coordenação}', 7);

    INSERT INTO profissionais (tenant_id, nome, email, telefone, servico_id, ativo)
    SELECT v_tenant, p.nome, p.email, p.telefone, s.id, p.ativo
      FROM (VALUES
            ('Carlos Eduardo Santos', 'carlos.santos@email.com', '(41) 97777-6666', 'Garçom', true),
            ('Ana Beatriz Ferreira', 'ana.ferreira@email.com', '(41) 95555-4444', 'Barman', true),
            ('Roberto Alves', 'roberto.alves@email.com', '(41) 93333-2222', 'Garçom', false),
            ('Juliana Costa', 'juliana.costa@email.com', '(41) 98888-1111', 'Maître', true),
            ('Marcos Lima', 'marcos.lima@email.com', '(41) 96666-3333', 'Cozinheiro', true),
            ('Patrícia Souza', 'patricia.souza@email.com', '(41) 94444-5555', 'Copeira', true)
           ) AS p(nome, email, telefone, funcao, ativo)
      JOIN staff_servicos s ON s.tenant_id = v_tenant AND s.funcao = p.funcao;
END $$;
