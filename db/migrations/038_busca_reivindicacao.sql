-- Banket Busca: reivindicação dos perfis importados (decisão de 17/10/2026). O dono de um buffet importado
-- (tenants.origem_cadastro = 'importacao', sem usuário) pede para assumir o perfil ou para removê-lo. A conferência é
-- SEMPRE manual: a equipe confirma a posse pelos canais reais do perfil (e-mail, WhatsApp) em /equipe/reivindicacoes e
-- aprova; só então o sistema envia o link de criação do acesso (auth_tokens tipo 'reivindicacao') ou remove o perfil.
-- Tabelas só da conexão de sistema (RLS forçado sem política, como resend_events): cruzam empresas e sobrevivem à
-- remoção da empresa. Compatível com a versão anterior: só um CHECK mais permissivo e tabelas novas.
-- Down (manual): DROP TABLE busca_reivindicacoes, busca_exclusoes; recriar auth_tokens_tipo_check sem 'reivindicacao'.

ALTER TABLE auth_tokens DROP CONSTRAINT IF EXISTS auth_tokens_tipo_check;
ALTER TABLE auth_tokens ADD CONSTRAINT auth_tokens_tipo_check
  CHECK (tipo IN ('verificacao_email', 'reset_senha', 'convite', 'link_acesso', 'reivindicacao'));

-- Pedidos de reivindicação: fila da análise da equipe e histórico
CREATE TABLE IF NOT EXISTS busca_reivindicacoes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id      UUID REFERENCES busca_perfis(id) ON DELETE SET NULL,
  tenant_id      UUID REFERENCES tenants(id) ON DELETE SET NULL,
  buffet_nome    VARCHAR(120) NOT NULL,                 -- cópia: o perfil pode ser removido
  acao           VARCHAR(10) NOT NULL CHECK (acao IN ('assumir', 'remover')),
  nome           VARCHAR(160) NOT NULL,                 -- quem pediu
  cargo          VARCHAR(80),
  email          VARCHAR(255) NOT NULL,
  telefone       VARCHAR(20),
  mensagem       TEXT,
  -- pendente → aprovada (link de acesso enviado) → concluida (acesso criado) | recusada; remoção vai direto a concluida
  status         VARCHAR(12) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovada', 'concluida', 'recusada')),
  email_destino  VARCHAR(255),                          -- e-mail conferido pela equipe que recebe o link
  observacao     TEXT,                                  -- nota da equipe (como conferiu, motivo da recusa)
  analisado_por  UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  analisado_em   TIMESTAMPTZ,
  usuario_id     UUID REFERENCES usuarios(id) ON DELETE SET NULL,   -- quem criou o acesso
  ip             VARCHAR(64),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  concluida_em   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_busca_reivindicacoes_status ON busca_reivindicacoes (status, created_at);
ALTER TABLE busca_reivindicacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE busca_reivindicacoes FORCE ROW LEVEL SECURITY;

-- Buffets que pediram para sair: a importação não os traz de volta
CREATE TABLE IF NOT EXISTS busca_exclusoes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id   VARCHAR(120) UNIQUE,                     -- Google Maps (base importada)
  nome       VARCHAR(120) NOT NULL,
  documento  VARCHAR(20),
  emails     TEXT[] NOT NULL DEFAULT '{}',
  telefones  TEXT[] NOT NULL DEFAULT '{}',
  reivindicacao_id UUID REFERENCES busca_reivindicacoes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE busca_exclusoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE busca_exclusoes FORCE ROW LEVEL SECURITY;
