-- 029_pesquisas.sql
-- Pesquisa de satisfação pós-evento, enviada ao cliente por e-mail com link público (/p/<token>).
-- Metodologia: NPS (0–10, "recomendaria?") como indicador principal, CSAT (notas de 1 a 5) por aspecto do serviço,
-- perguntas de escolha e perguntas abertas para os insights.
--   - pesquisa_config: textos da página pública e do e-mail, dias para o lembrete de envio;
--   - pesquisa_perguntas: o questionário da empresa (editável; no máximo uma pergunta NPS);
--   - pesquisa_envios: um link por evento (token), quem recebeu, quando respondeu e a nota NPS (agregação rápida);
--   - pesquisa_respostas: cada resposta, com o enunciado e o tipo da pergunta copiados no momento da resposta.
-- Compatível com a versão anterior do código (só tabelas e funções novas).

CREATE TABLE IF NOT EXISTS pesquisa_config (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  titulo VARCHAR(120) NOT NULL DEFAULT 'Pesquisa de satisfação',
  introducao TEXT,
  agradecimento TEXT,
  email_assunto VARCHAR(255) NOT NULL DEFAULT 'Como foi o seu evento?',
  email_corpo TEXT NOT NULL DEFAULT '',
  lembrete_dias INTEGER NOT NULL DEFAULT 1 CHECK (lembrete_dias BETWEEN 0 AND 90),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
SELECT aplicar_rls('pesquisa_config');

CREATE TABLE IF NOT EXISTS pesquisa_perguntas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- nps: 0 a 10 · nota: 1 a 5 (CSAT) · escolha: uma opção · multipla: várias opções · texto: resposta livre
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('nps', 'nota', 'escolha', 'multipla', 'texto')),
  texto VARCHAR(300) NOT NULL,
  ajuda VARCHAR(300),
  opcoes TEXT[] NOT NULL DEFAULT '{}',
  obrigatoria BOOLEAN NOT NULL DEFAULT false,
  ativa BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS pesquisa_perguntas_nps_unica ON pesquisa_perguntas (tenant_id) WHERE tipo = 'nps';
SELECT aplicar_rls('pesquisa_perguntas');

CREATE TABLE IF NOT EXISTS pesquisa_envios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  evento_id UUID NOT NULL UNIQUE REFERENCES eventos(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  token VARCHAR(64) NOT NULL UNIQUE,
  enviado_para TEXT[] NOT NULL DEFAULT '{}',
  enviado_em TIMESTAMP,
  envios INTEGER NOT NULL DEFAULT 0,
  enviado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  respondida_em TIMESTAMP,
  nps SMALLINT CHECK (nps IS NULL OR nps BETWEEN 0 AND 10),
  ip VARCHAR(64),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pesquisa_envios_respondida ON pesquisa_envios (tenant_id, respondida_em DESC);
SELECT aplicar_rls('pesquisa_envios');

CREATE TABLE IF NOT EXISTS pesquisa_respostas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  envio_id UUID NOT NULL REFERENCES pesquisa_envios(id) ON DELETE CASCADE,
  pergunta_id UUID REFERENCES pesquisa_perguntas(id) ON DELETE SET NULL,
  tipo VARCHAR(10) NOT NULL,
  pergunta_texto VARCHAR(300) NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  nota SMALLINT,
  opcoes TEXT[],
  texto TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pesquisa_respostas_envio ON pesquisa_respostas (envio_id, ordem);
CREATE INDEX IF NOT EXISTS idx_pesquisa_respostas_pergunta ON pesquisa_respostas (pergunta_id);
SELECT aplicar_rls('pesquisa_respostas');

-- Questionário inicial: NPS + CSAT por aspecto do serviço + expectativa + perguntas abertas
CREATE OR REPLACE FUNCTION aplicar_padroes_pesquisa(p_tenant UUID) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO pesquisa_config (tenant_id, introducao, agradecimento, email_corpo)
  VALUES (
    p_tenant,
    'Queremos saber como foi a sua experiência. São poucas perguntas e leva menos de 2 minutos.',
    'Obrigado pela sua avaliação! Sua opinião nos ajuda a melhorar a cada evento.',
    E'Olá, {nome_cliente}!\n\nFoi um prazer fazer parte do {evento}. Para continuarmos melhorando, gostaríamos de saber como foi a sua experiência.\n\nA pesquisa leva menos de 2 minutos:\n{link_pesquisa}\n\nObrigado!\nEquipe {empresa}'
  )
  ON CONFLICT (tenant_id) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM pesquisa_perguntas WHERE tenant_id = p_tenant) THEN
    INSERT INTO pesquisa_perguntas (tenant_id, tipo, texto, ajuda, opcoes, obrigatoria, ordem) VALUES
      (p_tenant, 'nps', 'Em uma escala de 0 a 10, o quanto você recomendaria a {empresa} a um amigo ou familiar?', '0 = nada provável · 10 = extremamente provável', '{}', true, 1),
      (p_tenant, 'nota', 'Qualidade da comida', NULL, '{}', true, 2),
      (p_tenant, 'nota', 'Bebidas', NULL, '{}', false, 3),
      (p_tenant, 'nota', 'Atendimento da equipe durante o evento', NULL, '{}', true, 4),
      (p_tenant, 'nota', 'Atendimento comercial e organização antes do evento', NULL, '{}', false, 5),
      (p_tenant, 'nota', 'Pontualidade, montagem e apresentação', NULL, '{}', false, 6),
      (p_tenant, 'escolha', 'O evento atendeu às suas expectativas?', NULL, ARRAY['Superou as expectativas', 'Atendeu às expectativas', 'Ficou abaixo das expectativas'], false, 7),
      (p_tenant, 'texto', 'Do que você mais gostou?', NULL, '{}', false, 8),
      (p_tenant, 'texto', 'O que poderíamos melhorar?', NULL, '{}', false, 9),
      (p_tenant, 'escolha', 'Podemos usar a sua avaliação como depoimento na nossa divulgação?', NULL, ARRAY['Sim', 'Não'], false, 10);
  END IF;
END $$;

SELECT aplicar_padroes_pesquisa(id) FROM tenants;

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
END $$;
