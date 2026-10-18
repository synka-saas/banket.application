-- Banket Busca: o Perfil Simples fica só no plano Busca (gratuito); todos os planos pagos têm o Perfil Personalizado
-- (decisão de 18/10/2026). O Essencial passa a ter os mesmos recursos do Busca do Profissional (selo, prioridade,
-- cardápios, disponibilidade, endereço com o nome, grupos de fotos, avisos por e-mail e WhatsApp, 30 fotos, 6 tipos
-- de evento e 6 de serviço). Revoga a parte do Essencial da migration 044.
UPDATE planos e
   SET recursos = e.recursos || (
         SELECT jsonb_object_agg(k, v) FROM jsonb_each(p.recursos) AS x(k, v) WHERE k LIKE 'busca\_%'
       )
  FROM planos p
 WHERE p.slug = 'profissional' AND e.slug = 'essencial';

UPDATE planos
   SET descricao = 'Para o autônomo e o buffet a domicílio: propostas, agenda, clientes e o Banket Busca Personalizado.'
 WHERE slug = 'essencial';

-- Perfis de empresas no Essencial (nenhuma em 18/10/2026) passam a Personalizado; fotos e tipos guardados no
-- rebaixamento voltam pelo trocarPlano/restaurarBusca na próxima troca de plano
UPDATE busca_perfis
   SET nivel = CASE WHEN fn_tenant_pode(tenant_id, 'busca_personalizado') THEN 'cliente' ELSE 'gratuito' END
 WHERE nivel IS DISTINCT FROM CASE WHEN fn_tenant_pode(tenant_id, 'busca_personalizado') THEN 'cliente' ELSE 'gratuito' END;
