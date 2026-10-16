-- 032_busca.sql
-- Banket Busca (fase 2, PLANO.md §2.2): tabelas do marketplace. Todas com tenant_id + aplicar_rls, exceto
-- busca_cidades (catálogo global, leitura liberada). As leituras públicas que cruzam empresas (vitrine) usam a
-- conexão de sistema em server/busca/publico.ts; o resto roda em withTenant.
-- Geolocalização: earthdistance + cube (contrib da imagem postgres:15-alpine; PostGIS não existe nela).
-- Compatível com a cor anterior: só tabelas novas e um CHECK mais permissivo em eventos.origem.
-- Down (manual): DROP TABLE busca_metricas_dia, busca_avaliacoes, busca_pedidos, busca_bloqueios, busca_fotos,
--   busca_pacotes, busca_perfil_cidades, busca_perfis, busca_cidades; recriar eventos_origem_check sem 'busca'.

CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- unaccent() não é IMMUTABLE (depende do dicionário): este invólucro fixo permite índice de expressão
CREATE OR REPLACE FUNCTION busca_sem_acento(texto text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS $$ SELECT lower(public.unaccent('public.unaccent'::regdictionary, texto)) $$;

-- ── Cidades (IBGE, centroide) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS busca_cidades (
  id       SERIAL PRIMARY KEY,
  ibge     INT NOT NULL UNIQUE,
  nome     VARCHAR(120) NOT NULL,
  uf       CHAR(2) NOT NULL,
  slug     VARCHAR(140) NOT NULL UNIQUE,          -- campinas-sp
  lat      DOUBLE PRECISION NOT NULL,
  lng      DOUBLE PRECISION NOT NULL,
  capital  BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_busca_cidades_geo ON busca_cidades USING gist (ll_to_earth(lat, lng));
CREATE INDEX IF NOT EXISTS idx_busca_cidades_nome ON busca_cidades USING gin (busca_sem_acento(nome) gin_trgm_ops);
ALTER TABLE busca_cidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE busca_cidades FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS leitura_publica ON busca_cidades;
CREATE POLICY leitura_publica ON busca_cidades FOR SELECT USING (true);

-- ── Perfil do buffet (1 por empresa) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS busca_perfis (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  slug                 VARCHAR(80) NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  nome                 VARCHAR(120) NOT NULL,
  documento            VARCHAR(20),
  descricao            TEXT,
  logo_path            TEXT,
  telefone             VARCHAR(20),
  whatsapp             VARCHAR(20),
  email_contato        VARCHAR(255),
  instagram            VARCHAR(120),
  site                 VARCHAR(255),
  tipos_evento         TEXT[] NOT NULL DEFAULT '{}',
  tipos_servico        TEXT[] NOT NULL DEFAULT '{}',
  restricoes           TEXT[] NOT NULL DEFAULT '{}',
  atende_domicilio     BOOLEAN NOT NULL DEFAULT false,
  raio_km              INT CHECK (raio_km IS NULL OR raio_km BETWEEN 1 AND 500),
  espaco_proprio       BOOLEAN NOT NULL DEFAULT false,
  cep                  VARCHAR(9),
  logradouro           VARCHAR(255),
  numero               VARCHAR(20),
  bairro               VARCHAR(120),
  cidade_id            INT REFERENCES busca_cidades(id) ON DELETE SET NULL,
  lat                  DOUBLE PRECISION,
  lng                  DOUBLE PRECISION,
  capacidade_min       INT CHECK (capacidade_min IS NULL OR capacidade_min >= 1),
  capacidade_max       INT CHECK (capacidade_max IS NULL OR capacidade_max >= 1),
  aceita_menor         BOOLEAN NOT NULL DEFAULT false,
  valor_minimo         NUMERIC(12,2),
  tempo_resposta_texto VARCHAR(60),
  etapa_concluida      INT NOT NULL DEFAULT 0 CHECK (etapa_concluida BETWEEN 0 AND 7),
  publicado            BOOLEAN NOT NULL DEFAULT false,
  publicado_em         TIMESTAMPTZ,
  completude           INT NOT NULL DEFAULT 0 CHECK (completude BETWEEN 0 AND 100),
  nivel                VARCHAR(10) NOT NULL DEFAULT 'gratuito' CHECK (nivel IN ('gratuito', 'cliente')),
  nota_media           NUMERIC(3,2),
  total_avaliacoes     INT NOT NULL DEFAULT 0,
  taxa_resposta        NUMERIC(5,4),
  sincronizar_agenda   BOOLEAN NOT NULL DEFAULT true,
  excedentes           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT busca_perfis_capacidade CHECK (capacidade_min IS NULL OR capacidade_max IS NULL OR capacidade_min <= capacidade_max)
);
SELECT aplicar_rls('busca_perfis');
CREATE INDEX IF NOT EXISTS idx_busca_perfis_publicados ON busca_perfis (cidade_id) WHERE publicado;
CREATE INDEX IF NOT EXISTS idx_busca_perfis_geo ON busca_perfis USING gist (ll_to_earth(lat, lng)) WHERE publicado AND lat IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_busca_perfis_tipos ON busca_perfis USING gin (tipos_evento) WHERE publicado;

CREATE TABLE IF NOT EXISTS busca_perfil_cidades (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  perfil_id UUID NOT NULL REFERENCES busca_perfis(id) ON DELETE CASCADE,
  cidade_id INT NOT NULL REFERENCES busca_cidades(id) ON DELETE CASCADE,
  PRIMARY KEY (perfil_id, cidade_id)
);
SELECT aplicar_rls('busca_perfil_cidades');
CREATE INDEX IF NOT EXISTS idx_busca_perfil_cidades_cidade ON busca_perfil_cidades (cidade_id);

-- ── Pacotes, fotos e bloqueios de agenda ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS busca_pacotes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  perfil_id         UUID NOT NULL REFERENCES busca_perfis(id) ON DELETE CASCADE,
  nome              VARCHAR(120) NOT NULL,
  descricao         TEXT,
  inclui            TEXT[] NOT NULL DEFAULT '{}',
  preco_pessoa      NUMERIC(10,2) CHECK (preco_pessoa IS NULL OR preco_pessoa >= 0),
  convidados_min    INT CHECK (convidados_min IS NULL OR convidados_min >= 1),
  convidados_max    INT CHECK (convidados_max IS NULL OR convidados_max >= 1),
  cardapio_opcao_id UUID REFERENCES cardapio_opcoes(id) ON DELETE SET NULL,
  ativo             BOOLEAN NOT NULL DEFAULT true,
  ordem             INT NOT NULL DEFAULT 0,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
SELECT aplicar_rls('busca_pacotes');
CREATE INDEX IF NOT EXISTS idx_busca_pacotes_perfil ON busca_pacotes (perfil_id, ordem);

CREATE TABLE IF NOT EXISTS busca_fotos (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  perfil_id          UUID NOT NULL REFERENCES busca_perfis(id) ON DELETE CASCADE,
  path               TEXT NOT NULL,          -- chave do storage (busca/…) ou caminho estático (/busca-demo/…)
  legenda            VARCHAR(160),
  tags               TEXT[] NOT NULL DEFAULT '{}',
  ordem              INT NOT NULL DEFAULT 0,
  capa               BOOLEAN NOT NULL DEFAULT false,
  bloqueado_plano_em TIMESTAMPTZ,
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
SELECT aplicar_rls('busca_fotos');
CREATE INDEX IF NOT EXISTS idx_busca_fotos_perfil ON busca_fotos (perfil_id, ordem);

CREATE TABLE IF NOT EXISTS busca_bloqueios (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  perfil_id   UUID NOT NULL REFERENCES busca_perfis(id) ON DELETE CASCADE,
  data_inicio DATE NOT NULL,
  data_fim    DATE NOT NULL,
  motivo      VARCHAR(160),
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (data_fim >= data_inicio)
);
SELECT aplicar_rls('busca_bloqueios');

-- ── Pedidos, avaliações e métricas ───────────────────────────────────────────
ALTER TABLE eventos DROP CONSTRAINT IF EXISTS eventos_origem_check;
ALTER TABLE eventos ADD CONSTRAINT eventos_origem_check CHECK (origem IN ('manual', 'formulario', 'busca'));

CREATE TABLE IF NOT EXISTS busca_pedidos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  perfil_id      UUID NOT NULL REFERENCES busca_perfis(id) ON DELETE CASCADE,
  grupo_id       UUID NOT NULL,                  -- mesmo pedido enviado a vários buffets
  evento_id      UUID REFERENCES eventos(id) ON DELETE SET NULL,
  cliente_id     UUID REFERENCES clientes(id) ON DELETE SET NULL,
  conversa_id    UUID REFERENCES conversas(id) ON DELETE SET NULL,
  tipo_evento    VARCHAR(40) NOT NULL,
  tipo_servico   VARCHAR(40),
  data_evento    DATE,
  convidados     INT CHECK (convidados IS NULL OR convidados >= 1),
  cidade_id      INT REFERENCES busca_cidades(id) ON DELETE SET NULL,
  local_texto    VARCHAR(255),
  nome           VARCHAR(255) NOT NULL,
  email          VARCHAR(255) NOT NULL,
  whatsapp       VARCHAR(20),
  observacoes    TEXT,
  aceite_contato BOOLEAN NOT NULL DEFAULT false,
  respondido_em  TIMESTAMPTZ,
  filtros        JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip             VARCHAR(64),
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
SELECT aplicar_rls('busca_pedidos');
CREATE INDEX IF NOT EXISTS idx_busca_pedidos_perfil ON busca_pedidos (perfil_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_busca_pedidos_grupo ON busca_pedidos (grupo_id);

CREATE TABLE IF NOT EXISTS busca_avaliacoes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  perfil_id       UUID NOT NULL REFERENCES busca_perfis(id) ON DELETE CASCADE,
  pedido_id       UUID NOT NULL UNIQUE REFERENCES busca_pedidos(id) ON DELETE CASCADE,
  token_hash      CHAR(64) NOT NULL UNIQUE,
  token_expira_em TIMESTAMPTZ NOT NULL,
  nota            SMALLINT CHECK (nota IS NULL OR nota BETWEEN 1 AND 5),
  texto           TEXT,
  nome_exibicao   VARCHAR(80),
  respondida_em   TIMESTAMPTZ,
  resposta_buffet TEXT,
  resposta_em     TIMESTAMPTZ,
  publicada       BOOLEAN NOT NULL DEFAULT false,
  ip              VARCHAR(64),
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
SELECT aplicar_rls('busca_avaliacoes');
CREATE INDEX IF NOT EXISTS idx_busca_avaliacoes_perfil ON busca_avaliacoes (perfil_id, respondida_em DESC) WHERE publicada;

CREATE TABLE IF NOT EXISTS busca_metricas_dia (
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  perfil_id         UUID NOT NULL REFERENCES busca_perfis(id) ON DELETE CASCADE,
  dia               DATE NOT NULL,
  aparicoes         INT NOT NULL DEFAULT 0,
  visualizacoes     INT NOT NULL DEFAULT 0,
  cliques_orcamento INT NOT NULL DEFAULT 0,
  PRIMARY KEY (perfil_id, dia)
);
SELECT aplicar_rls('busca_metricas_dia');
