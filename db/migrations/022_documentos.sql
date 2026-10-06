-- 022_documentos.sql
-- Documentos formais (contratos etc.) gerados a partir de modelos com variáveis:
--   - documento_modelos: corpo em marcação simples com {variaveis} do evento/cliente/empresa, template visual,
--     título e bloco de assinaturas; editados por owner/admin;
--   - documentos: cada documento gerado num evento (texto final com os dados aplicados, campos extras preenchidos,
--     número sequencial por empresa e ano, PDF guardado).
-- Compatível com a versão anterior do código (só tabelas novas).

CREATE TABLE IF NOT EXISTS documento_modelos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome VARCHAR(120) NOT NULL,
  descricao VARCHAR(500),
  titulo VARCHAR(255) NOT NULL,
  template_id UUID REFERENCES orcamento_templates(id) ON DELETE SET NULL,
  corpo TEXT NOT NULL DEFAULT '',
  incluir_assinaturas BOOLEAN NOT NULL DEFAULT true,
  testemunhas BOOLEAN NOT NULL DEFAULT false,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS documento_modelos_nome_unique ON documento_modelos (tenant_id, lower(nome));
SELECT aplicar_rls('documento_modelos');

CREATE TABLE IF NOT EXISTS documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  evento_id UUID NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  modelo_id UUID REFERENCES documento_modelos(id) ON DELETE SET NULL,
  template_id UUID REFERENCES orcamento_templates(id) ON DELETE SET NULL,
  ano INTEGER NOT NULL,
  numero INTEGER NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  modelo_nome VARCHAR(120),
  corpo TEXT NOT NULL,
  campos JSONB NOT NULL DEFAULT '{}'::jsonb,
  incluir_assinaturas BOOLEAN NOT NULL DEFAULT true,
  testemunhas BOOLEAN NOT NULL DEFAULT false,
  pdf_path VARCHAR(255),
  pdf_gerado_em TIMESTAMP,
  criado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS documentos_numero_unique ON documentos (tenant_id, ano, numero);
CREATE INDEX IF NOT EXISTS idx_documentos_evento ON documentos (evento_id, created_at DESC);
SELECT aplicar_rls('documentos');

-- Modelo inicial: contrato genérico de prestação de serviços de buffet (texto de exemplo, para a empresa revisar)
CREATE OR REPLACE FUNCTION aplicar_padroes_documentos(p_tenant UUID) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM documento_modelos WHERE tenant_id = p_tenant) THEN
    INSERT INTO documento_modelos (tenant_id, nome, descricao, titulo, corpo, incluir_assinaturas, testemunhas, ordem)
    VALUES (
      p_tenant,
      'Contrato de prestação de serviços',
      'Modelo genérico de contrato de buffet. Revise as cláusulas com seu jurídico antes de usar.',
      'Contrato de prestação de serviços – {evento}',
      E'**CONTRATADA:** {empresa_razao_social}, inscrita no CNPJ/CPF sob o nº {empresa_documento}, com sede em {empresa_endereco}, '
      'neste ato representada por {assinante_nome}.\n\n'
      '**CONTRATANTE:** {cliente}, inscrito(a) no CPF/CNPJ sob o nº {cliente_documento}, residente/estabelecido(a) em {cliente_endereco}, '
      'e-mail {cliente_email}, telefone {cliente_telefone}.\n\n'
      'As partes acima identificadas têm, entre si, justo e acertado o presente contrato, que se regerá pelas cláusulas seguintes.\n\n'
      '# Cláusula 1ª – Do objeto\n'
      'O presente contrato tem por objeto a prestação de serviços de buffet pela CONTRATADA para o evento **{evento}**, '
      'a realizar-se em {data_evento_extenso}, das {hora_inicio} às {hora_fim}, em {local}, {endereco_evento}, '
      'para {convidados} convidados, conforme a proposta de orçamento (versão {versao_orcamento}) aceita pela CONTRATANTE, '
      'que integra este contrato para todos os fins.\n\n'
      '# Cláusula 2ª – Do preço e do pagamento\n'
      'Pelos serviços descritos, a CONTRATANTE pagará à CONTRATADA o valor total de **{valor_total}** ({valor_total_extenso}), '
      'na seguinte forma: {forma_pagamento}.\n'
      '1. O sinal confirma a reserva da data e não será devolvido em caso de desistência da CONTRATANTE.\n'
      '2. O saldo deverá ser quitado até {prazo_pagamento_saldo}.\n'
      '3. Alterações no número de convidados devem ser comunicadas por escrito até 7 (sete) dias antes do evento e serão '
      'cobradas conforme a proposta.\n\n'
      '# Cláusula 3ª – Das obrigações da contratada\n'
      '- Fornecer os alimentos, bebidas, equipe e equipamentos descritos na proposta, com qualidade e pontualidade.\n'
      '- Observar as normas sanitárias aplicáveis ao preparo e ao serviço dos alimentos.\n'
      '- Manter a equipe uniformizada e identificada durante o evento.\n\n'
      '# Cláusula 4ª – Das obrigações da contratante\n'
      '- Efetuar os pagamentos nas datas acordadas.\n'
      '- Garantir o acesso da CONTRATADA ao local do evento com a antecedência necessária para a montagem.\n'
      '- Informar com antecedência restrições alimentares e necessidades especiais dos convidados.\n\n'
      '# Cláusula 5ª – Do cancelamento\n'
      'Em caso de cancelamento pela CONTRATANTE, aplicam-se as seguintes condições: com 30 (trinta) dias ou mais de antecedência, '
      'multa de 30% do valor total; de 29 a 11 dias, multa de 50%; com 10 dias ou menos, multa de 80%.\n\n'
      '# Cláusula 6ª – Do foro\n'
      'As partes elegem o foro da comarca de {comarca} para dirimir quaisquer dúvidas oriundas deste contrato.\n\n'
      'E, por estarem assim justas e contratadas, as partes assinam o presente instrumento em duas vias de igual teor.',
      true,
      true,
      1
    );
  END IF;
END $$;

SELECT aplicar_padroes_documentos(id) FROM tenants;

CREATE OR REPLACE FUNCTION aplicar_padroes_tenant_completo(p_tenant UUID) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM aplicar_padroes_tenant(p_tenant);
  PERFORM aplicar_padroes_tenant_proposta(p_tenant);
  PERFORM aplicar_padroes_formulario(p_tenant);
  PERFORM aplicar_padroes_email_modelos(p_tenant);
  PERFORM aplicar_padroes_documentos(p_tenant);
END $$;
