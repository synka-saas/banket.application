-- Banket Busca é uma funcionalidade do Banket, não uma plataforma de mídia (decisão de 18/10/2026). Dois níveis:
--   Perfil Simples — planos Busca (gratuito) e Essencial: os mesmos recursos do Busca do plano gratuito;
--   Perfil Personalizado — Profissional, Prime e Completo (recurso busca_personalizado).
-- O nível do perfil (busca_perfis.nivel: gratuito = simples, cliente = personalizado) passa a seguir o recurso.

-- Essencial recebe os valores do Busca do plano gratuito (exceto o próprio acesso "busca")
UPDATE planos e
   SET recursos = e.recursos || (
         SELECT jsonb_object_agg(k, v) FROM jsonb_each(b.recursos) AS x(k, v) WHERE k LIKE 'busca\_%'
       )
  FROM planos b
 WHERE b.slug = 'busca' AND e.slug = 'essencial';

UPDATE planos SET recursos = recursos || jsonb_build_object('busca_personalizado', slug IN ('profissional', 'prime', 'completo'));

UPDATE busca_perfis
   SET nivel = CASE WHEN fn_tenant_pode(tenant_id, 'busca_personalizado') THEN 'cliente' ELSE 'gratuito' END
 WHERE nivel IS DISTINCT FROM CASE WHEN fn_tenant_pode(tenant_id, 'busca_personalizado') THEN 'cliente' ELSE 'gratuito' END;
