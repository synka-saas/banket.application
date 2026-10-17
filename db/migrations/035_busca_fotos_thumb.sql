-- Banket Busca: as fotos de demonstração (ilustrações /busca-demo/*.svg do seed 011) passam a ser a imagem padrão
-- public/thumb-buffet.webp, a mesma usada por quem não tem foto (decisão de 17/10/2026). Fotos enviadas pelas
-- empresas (storage busca/…) não são tocadas. Idempotente.
UPDATE busca_fotos SET path = '/thumb-buffet.webp' WHERE path LIKE '/busca-demo/%';
