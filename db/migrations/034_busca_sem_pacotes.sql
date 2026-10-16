-- Banket Busca sem pacotes nem preço (decisão de 16/10/2026): o cadastro do perfil passa de 7 para 6 etapas
-- (empresa, eventos e serviços, região, capacidade, fotos, revisão). Recalcula etapa_concluida (5 = etapas de dados
-- concluídas, 6 = publicado) e a completude com os pesos novos de lib/busca/onboarding.ts (fotos valem 25, pacotes
-- saem). A tabela busca_pacotes e a coluna busca_perfis.valor_minimo ficam sem uso (remover num deploy futuro).

WITH base AS (
  SELECT p.id, p.publicado,
         length(trim(coalesce(p.descricao, ''))) AS desc_len,
         (SELECT count(*) FROM busca_fotos f WHERE f.perfil_id = p.id AND f.bloqueado_plano_em IS NULL) AS fotos,
         (trim(coalesce(p.nome, '')) <> '' AND trim(coalesce(p.documento, '')) <> ''
          AND (trim(coalesce(p.whatsapp, '')) <> '' OR trim(coalesce(p.telefone, '')) <> '')
          AND trim(coalesce(p.email_contato, '')) <> '' AND length(trim(coalesce(p.descricao, ''))) >= 80) AS e1,
         (cardinality(p.tipos_evento) > 0 AND cardinality(p.tipos_servico) > 0) AS e2,
         (p.cidade_id IS NOT NULL AND ((p.espaco_proprio AND trim(coalesce(p.logradouro, '')) <> '')
                                       OR (p.atende_domicilio AND coalesce(p.raio_km, 0) > 0))) AS e3,
         (p.capacidade_min IS NOT NULL AND p.capacidade_max IS NOT NULL AND p.capacidade_min <= p.capacidade_max) AS e4,
         trim(coalesce(p.logo_path, '')) <> '' AS logo,
         trim(coalesce(p.email_contato, '')) <> '' AS email,
         trim(coalesce(p.whatsapp, '')) <> '' AS whats,
         (trim(coalesce(p.instagram, '')) <> '' OR trim(coalesce(p.site, '')) <> '') AS redes,
         trim(coalesce(p.tempo_resposta_texto, '')) <> '' AS tempo
    FROM busca_perfis p
),
calc AS (
  SELECT b.*, b.fotos >= 3 AS e5,
         least(100,
           (CASE WHEN b.desc_len >= 300 THEN 15 WHEN b.desc_len >= 80 THEN 8 ELSE 0 END)
           + (CASE WHEN b.e2 THEN 10 ELSE 0 END)
           + (CASE WHEN b.logo THEN 10 ELSE 0 END)
           + round(least(b.fotos, 5) / 5.0 * 25)::int
           + (CASE WHEN b.e3 THEN 10 ELSE 0 END)
           + (CASE WHEN b.e4 THEN 10 ELSE 0 END)
           + (CASE WHEN b.email THEN 5 ELSE 0 END) + (CASE WHEN b.whats THEN 5 ELSE 0 END)
           + (CASE WHEN b.redes THEN 5 ELSE 0 END)
           + (CASE WHEN b.tempo THEN 5 ELSE 0 END)
         ) AS completude
    FROM base b
)
UPDATE busca_perfis p
   SET completude = c.completude,
       etapa_concluida = CASE
         WHEN c.publicado THEN 6
         WHEN NOT c.e1 THEN 0 WHEN NOT c.e2 THEN 1 WHEN NOT c.e3 THEN 2 WHEN NOT c.e4 THEN 3 WHEN NOT c.e5 THEN 4
         ELSE 5 END
  FROM calc c
 WHERE c.id = p.id;
