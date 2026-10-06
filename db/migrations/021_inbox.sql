-- 021_inbox.sql
-- Inbox: conversas por e-mail entre o usuário e o cliente, ligadas a um evento.
--   - conversas: uma por (evento, usuário dono); o token identifica o endereço de resposta r-<token>@<domínio>;
--   - mensagens: cada e-mail enviado (saida) ou recebido (entrada), com status de entrega e anexos;
--   - resend_events: eventos recebidos do webhook do Resend (idempotência por svix-id); só a conexão de sistema.
-- Compatível com a versão anterior do código (tabelas novas, nada removido).

CREATE TABLE IF NOT EXISTS conversas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  evento_id UUID NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  assunto VARCHAR(255) NOT NULL,
  token VARCHAR(40) NOT NULL UNIQUE,
  participantes TEXT[] NOT NULL DEFAULT '{}',
  ultima_mensagem_em TIMESTAMP,
  ultima_direcao VARCHAR(10) CHECK (ultima_direcao IS NULL OR ultima_direcao IN ('entrada', 'saida')),
  ultimo_trecho VARCHAR(200),
  nao_lidas INTEGER NOT NULL DEFAULT 0,
  arquivada BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_conversas_evento ON conversas (evento_id);
CREATE INDEX IF NOT EXISTS idx_conversas_usuario ON conversas (usuario_id);
CREATE INDEX IF NOT EXISTS idx_conversas_lista ON conversas (tenant_id, arquivada, ultima_mensagem_em DESC);
SELECT aplicar_rls('conversas');

CREATE TABLE IF NOT EXISTS mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversa_id UUID NOT NULL REFERENCES conversas(id) ON DELETE CASCADE,
  direcao VARCHAR(10) NOT NULL CHECK (direcao IN ('entrada', 'saida')),
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  de VARCHAR(320) NOT NULL,
  para TEXT[] NOT NULL DEFAULT '{}',
  cc TEXT[] NOT NULL DEFAULT '{}',
  assunto VARCHAR(255),
  texto TEXT,
  html TEXT,
  message_id VARCHAR(998),
  in_reply_to VARCHAR(998),
  referencias TEXT[] NOT NULL DEFAULT '{}',
  resend_id VARCHAR(64),
  status VARCHAR(12) NOT NULL CHECK (status IN ('enviada', 'entregue', 'devolvida', 'falhou', 'recebida')),
  status_em TIMESTAMP,
  status_detalhe TEXT,
  anexos JSONB NOT NULL DEFAULT '[]'::jsonb,
  lida_em TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mensagens_conversa ON mensagens (conversa_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS mensagens_resend_id_unique ON mensagens (resend_id) WHERE resend_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mensagens_message_id ON mensagens (message_id) WHERE message_id IS NOT NULL;
SELECT aplicar_rls('mensagens');

-- Eventos do webhook do Resend: idempotência por svix-id e reprocessamento dos que falharam
CREATE TABLE IF NOT EXISTS resend_events (
  id VARCHAR(64) PRIMARY KEY,
  type VARCHAR(60) NOT NULL,
  payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  error TEXT
);
-- RLS forçado sem política: o papel da aplicação (sujeito ao RLS) não enxerga nada; só a conexão de sistema
ALTER TABLE resend_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE resend_events FORCE ROW LEVEL SECURITY;
