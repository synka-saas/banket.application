-- 030_tipos_evento_fixos.sql
-- Tipos de evento passam a ser fixos e iguais para o sistema inteiro: Corporativo e Social.
--   - slug ('corporativo' | 'social') identifica o tipo no código (formulário público, filtros);
--   - toda empresa tem exatamente os dois (as que faltarem são criadas; os demais tipos são removidos);
--   - eventos ligados a um tipo removido passam para Social; os vínculos de ocasião somem com o tipo (CASCADE);
--   - trigger impede criar, renomear ou trocar o slug: não há mais tela de cadastro de tipos.
-- Compatível com a versão anterior do código: ela continua lendo tipos_evento (id, nome) normalmente;
-- só o cadastro manual de tipos, que saiu da interface, passa a ser recusado.

ALTER TABLE tipos_evento ADD COLUMN IF NOT EXISTS slug VARCHAR(20);

UPDATE tipos_evento SET slug = 'corporativo', nome = 'Corporativo' WHERE slug IS NULL AND lower(nome) = 'corporativo';
UPDATE tipos_evento SET slug = 'social', nome = 'Social' WHERE slug IS NULL AND lower(nome) = 'social';

-- Empresas sem algum dos dois tipos
INSERT INTO tipos_evento (tenant_id, nome, descricao, slug)
SELECT t.id, v.nome, v.descricao, v.slug
  FROM tenants t
 CROSS JOIN (VALUES
   ('Social', 'Casamentos, aniversários, formaturas e celebrações em geral', 'social'),
   ('Corporativo', 'Confraternizações, lançamentos, convenções e eventos de empresas', 'corporativo')
 ) AS v(nome, descricao, slug)
 WHERE NOT EXISTS (SELECT 1 FROM tipos_evento x WHERE x.tenant_id = t.id AND x.slug = v.slug);

-- Eventos em tipos que deixam de existir vão para Social da mesma empresa
UPDATE eventos e
   SET tipo_evento_id = s.id
  FROM tipos_evento antigo, tipos_evento s
 WHERE e.tipo_evento_id = antigo.id
   AND antigo.slug IS NULL
   AND s.tenant_id = antigo.tenant_id
   AND s.slug = 'social';

DELETE FROM tipos_evento WHERE slug IS NULL;

ALTER TABLE tipos_evento ALTER COLUMN slug SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tipos_evento_slug_check') THEN
    ALTER TABLE tipos_evento ADD CONSTRAINT tipos_evento_slug_check CHECK (slug IN ('corporativo', 'social'));
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS tipos_evento_slug_unique ON tipos_evento (tenant_id, slug);

-- O slug vem do nome (o aplicar_padroes_tenant insere só nome/descrição); nome e slug não mudam depois.
CREATE OR REPLACE FUNCTION tipos_evento_fixos() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.slug := COALESCE(NEW.slug, CASE lower(NEW.nome) WHEN 'corporativo' THEN 'corporativo' WHEN 'social' THEN 'social' END);
    IF NEW.slug IS NULL THEN
      RAISE EXCEPTION 'Os tipos de evento são fixos: Corporativo e Social.' USING ERRCODE = 'check_violation';
    END IF;
    NEW.nome := CASE NEW.slug WHEN 'corporativo' THEN 'Corporativo' ELSE 'Social' END;
  ELSIF NEW.slug IS DISTINCT FROM OLD.slug OR NEW.nome IS DISTINCT FROM OLD.nome THEN
    RAISE EXCEPTION 'Os tipos de evento são fixos: Corporativo e Social.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tipos_evento_fixos ON tipos_evento;
CREATE TRIGGER tipos_evento_fixos BEFORE INSERT OR UPDATE ON tipos_evento
  FOR EACH ROW EXECUTE FUNCTION tipos_evento_fixos();
