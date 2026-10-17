-- Banket Busca: endereço do perfil (decisão de 17/10/2026). O endereço público é /buffet/<id do perfil> (UUID); só
-- planos pagos (recurso busca_slug) escolhem um endereço próprio (/buffet/meu-buffet). Endereços anteriores ficam em
-- slugs_antigos e redirecionam (301) para o atual, para não quebrar links nem a indexação.

ALTER TABLE busca_perfis ADD COLUMN IF NOT EXISTS slugs_antigos TEXT[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_busca_perfis_slugs_antigos ON busca_perfis USING GIN (slugs_antigos);

-- Recurso novo: endereço personalizado do perfil (gratuito não; pagos e Completo sim)
UPDATE planos SET recursos = recursos || jsonb_build_object('busca_slug', NOT gratuito);

-- Perfis sem o recurso passam a usar o UUID; o endereço antigo continua redirecionando
UPDATE busca_perfis
   SET slugs_antigos = CASE WHEN slug = ANY(slugs_antigos) THEN slugs_antigos ELSE array_append(slugs_antigos, slug) END,
       slug = id::text
 WHERE slug <> id::text AND NOT fn_tenant_pode(tenant_id, 'busca_slug');
