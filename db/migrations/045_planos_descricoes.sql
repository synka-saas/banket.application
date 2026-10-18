-- Descrições dos planos sem o termo "Concierge" (herdado do Yosp): o Banket Busca é Simples no Essencial e Personalizado
-- no Profissional e no Prime (migration 044).
UPDATE planos SET descricao = 'Para o autônomo e o buffet a domicílio: propostas, agenda, clientes e o Banket Busca Simples.' WHERE slug = 'essencial';
UPDATE planos SET descricao = 'Para o buffet com salão e equipe comercial: Inbox, estoque, IA e o Banket Busca Personalizado.' WHERE slug = 'profissional';
UPDATE planos SET descricao = 'Para a casa de eventos grande: limites altos, vários espaços, IA com folga e o Banket Busca Personalizado.' WHERE slug = 'prime';
