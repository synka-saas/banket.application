-- Slug automático em todos os planos. O UUID continua resolvendo o perfil pelo id.
-- A unicidade inclui os endereços antigos, inclusive entre empresas (RLS).
CREATE OR REPLACE FUNCTION busca_garantir_slug_publico() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  base TEXT;
  candidato TEXT;
  sufixo TEXT;
  numero INTEGER := 1;
  automatico BOOLEAN;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('busca_slugs_publicos'));
  automatico := NEW.slug IS NULL OR NEW.slug = '' OR
    NEW.slug ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  -- Compatibilidade com versões anteriores: um downgrade não devolve a URL ao UUID.
  IF TG_OP = 'UPDATE' AND automatico AND NEW.slug <> '' AND
     OLD.slug !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    NEW.slug := OLD.slug;
    automatico := false;
  END IF;
  IF automatico THEN
    base := trim(both '-' from left(trim(both '-' from regexp_replace(
      lower(public.busca_sem_acento(NEW.nome)), '[^a-z0-9]+', '-', 'g')), 60));
    IF base IS NULL OR length(base) < 3 THEN base := 'buffet'; END IF;
    LOOP
      sufixo := CASE WHEN numero = 1 THEN '' ELSE '-' || numero END;
      candidato := rtrim(left(base, 60 - length(sufixo)), '-') || sufixo;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.busca_perfis p WHERE p.id <> NEW.id
        AND (p.slug = candidato OR candidato = ANY(p.slugs_antigos) OR p.id::text = candidato));
      numero := numero + 1;
    END LOOP;
    NEW.slug := candidato;
  END IF;
  IF EXISTS (SELECT 1 FROM public.busca_perfis p WHERE p.id <> NEW.id
      AND (p.slug = NEW.slug OR NEW.slug = ANY(p.slugs_antigos) OR p.id::text = NEW.slug)) THEN
    RAISE EXCEPTION 'Esse endereço já está em uso. Escolha outro.' USING ERRCODE = '23505';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    -- Guarda todo o histórico, mesmo que uma versão antiga da aplicação limite o array.
    SELECT COALESCE(array_agg(DISTINCT s), '{}'::text[]) INTO NEW.slugs_antigos
      FROM unnest(OLD.slugs_antigos || NEW.slugs_antigos || ARRAY[OLD.slug]) s
      WHERE s <> NEW.slug AND s <> NEW.id::text;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER busca_slug_publico
BEFORE INSERT OR UPDATE OF slug, slugs_antigos ON busca_perfis
FOR EACH ROW EXECUTE FUNCTION busca_garantir_slug_publico();

-- Preserva slugs existentes; converte todos os UUIDs, incluindo perfis ainda não publicados.
DO $$
DECLARE perfil RECORD;
BEGIN
  FOR perfil IN SELECT id FROM busca_perfis
    WHERE slug ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ORDER BY created_at, id
  LOOP
    UPDATE busca_perfis SET slug = slug WHERE id = perfil.id;
  END LOOP;
END;
$$;
