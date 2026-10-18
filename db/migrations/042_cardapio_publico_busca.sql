-- Opções de cardápio públicas no Banket Busca: só as marcadas aparecem no perfil público (seção Cardápios, recurso
-- busca_cardapios). Nasce desmarcado: a empresa escolhe o que divulga.
ALTER TABLE cardapio_opcoes ADD COLUMN IF NOT EXISTS publico_busca BOOLEAN NOT NULL DEFAULT false;
