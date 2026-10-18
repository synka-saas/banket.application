-- Revogação de sessões: troca ou redefinição de senha grava o instante, e o middleware recusa sessão (JWT) emitida
-- antes dele. Coluna nova e nula: a versão anterior do código simplesmente a ignora (blue-green).
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS sessoes_revogadas_em TIMESTAMPTZ;
