-- Preços e limites dos planos (decisão de 18/10/2026).
--   Essencial R$ 89 · Profissional R$ 197 · Prime R$ 297 por mês; anual = 10 mensalidades (2 meses grátis).
--   Master R$ 449/mês: para grandes buffets e redes, sem oferta pública (publico = false; contratado pela equipe).
--   Recursos ilimitados (-1) ficam só no Master (e no Completo interno). Profissional e Prime passam a ter limites.
-- Depois desta migration, rode `node scripts/stripe-bootstrap.mjs` (preço mudou → novo Price no Stripe).

UPDATE planos SET preco_mensal = 89, preco_anual = 890 WHERE slug = 'essencial';
UPDATE planos SET preco_mensal = 197, preco_anual = 1970 WHERE slug = 'profissional';
UPDATE planos SET preco_mensal = 297, preco_anual = 2970 WHERE slug = 'prime';

UPDATE planos SET recursos = recursos || '{
  "usuarios": 5, "espacos_qtd": 3, "templates_qtd": 3, "cardapios_opcoes": 7, "formularios_qtd": 3,
  "documento_modelos": 3, "email_modelos": 10, "estoque_itens": 200, "ia_analises_mes": 30, "ia_fundos_mes": 0,
  "busca_fotos": 30, "busca_tipos_evento": 6, "busca_tipos_servico": 6
}'::jsonb WHERE slug = 'profissional';

UPDATE planos SET recursos = recursos || '{
  "usuarios": 15, "espacos_qtd": 10, "templates_qtd": 10, "cardapios_opcoes": 20, "formularios_qtd": 10,
  "documento_modelos": 10, "email_modelos": 20, "estoque_itens": 1000, "ia_analises_mes": 100, "ia_fundos_mes": 20,
  "busca_fotos": 60, "busca_tipos_evento": 10, "busca_tipos_servico": 10
}'::jsonb WHERE slug = 'prime';

-- Master: os mesmos recursos do Completo (tudo liberado e sem limite), com preço e fora da oferta pública
INSERT INTO planos (slug, nome, descricao, gratuito, publico, ativo, ordem, preco_mensal, preco_anual, trial_dias, recursos)
SELECT 'master', 'Master',
       'Para grandes buffets e redes: tudo do Banket sem limites, com acompanhamento dedicado.',
       false, false, true, 4, 449, 4490, 30, c.recursos
  FROM planos c
 WHERE c.slug = 'completo'
ON CONFLICT (slug) DO NOTHING;
