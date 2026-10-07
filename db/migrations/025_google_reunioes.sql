-- 025_google_reunioes.sql
-- Login com o Google e reuniões com Google Meet:
--   - usuario_google: conta Google vinculada a cada usuário (sub, e-mail e tokens OAuth cifrados). A conta é global,
--     como `usuarios`; RLS forçado sem política: só a conexão de sistema lê/grava (mesmo padrão de resend_events);
--   - reunioes: reuniões agendadas pelo sistema (por empresa, RLS), criadas na agenda Google do organizador
--     com a sala do Meet; opcionalmente ligadas a um evento e ao cliente dele.
-- Compatível com a versão anterior do código (só tabelas novas). Contas criadas pelo Google recebem um
-- senha_hash aleatório (a senha pode ser definida por "Esqueceu a senha").

CREATE TABLE IF NOT EXISTS usuario_google (
  usuario_id UUID PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  google_sub VARCHAR(64) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL,
  nome VARCHAR(255),
  -- Tokens cifrados com AES-256-GCM (chave derivada do JWT_SECRET, lib/cripto.ts)
  refresh_token TEXT,
  access_token TEXT,
  access_expira_em TIMESTAMPTZ,
  escopos TEXT NOT NULL DEFAULT '',
  -- Escopo do Calendar concedido e refresh token guardado: o usuário pode agendar reuniões
  agenda_ativa BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
ALTER TABLE usuario_google ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuario_google FORCE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS reunioes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  evento_id UUID REFERENCES eventos(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  -- Organizador: dono da agenda Google onde o evento e a sala do Meet foram criados
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  titulo VARCHAR(200) NOT NULL,
  descricao TEXT,
  inicio TIMESTAMPTZ NOT NULL,
  fim TIMESTAMPTZ NOT NULL,
  participantes TEXT[] NOT NULL DEFAULT '{}',
  local VARCHAR(255),
  google_event_id VARCHAR(255),
  meet_link VARCHAR(500),
  google_link VARCHAR(500),
  status VARCHAR(12) NOT NULL DEFAULT 'agendada' CHECK (status IN ('agendada', 'cancelada')),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  CHECK (fim > inicio)
);
CREATE INDEX IF NOT EXISTS idx_reunioes_inicio ON reunioes (tenant_id, inicio);
CREATE INDEX IF NOT EXISTS idx_reunioes_evento ON reunioes (evento_id, inicio);
SELECT aplicar_rls('reunioes');
