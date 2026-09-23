-- 001_seguranca_rls.sql
-- Isolamento real entre tenants:
--   * função app_tenant_id() lê o tenant da transação (definido via set_config pelo app);
--   * RLS forçado em todas as tabelas de domínio, com USING + WITH CHECK;
--   * tabelas SaaS (tenants, usuarios, tenant_usuarios) também passam a ter RLS,
--     restringindo o papel da aplicação ao próprio tenant.
-- O papel da aplicação (sem superuser/bypassrls) e seus GRANTs são criados pelo scripts/migrate.mjs.

CREATE OR REPLACE FUNCTION app_tenant_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
$$;

-- categoria_evento_tipos não tinha tenant_id
ALTER TABLE categoria_evento_tipos ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
UPDATE categoria_evento_tipos cet
   SET tenant_id = c.tenant_id
  FROM categorias_evento c
 WHERE c.id = cet.categoria_id AND cet.tenant_id IS NULL;
ALTER TABLE categoria_evento_tipos ALTER COLUMN tenant_id SET NOT NULL;

-- Políticas padrão por tenant_id
DO $$
DECLARE
  t text;
  tabelas text[] := ARRAY[
    'clientes', 'tipos_evento', 'categorias_evento', 'categoria_evento_tipos', 'pipeline_colunas',
    'eventos', 'status_orcamento', 'orcamentos', 'catalogo_secoes', 'catalogo_itens',
    'orcamento_opcoes', 'orcamento_blocos_info', 'orcamento_templates',
    'evento_cardapio_secoes', 'evento_cardapio_itens', 'evento_equipe'
  ];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'isolation_' || t, t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id())',
      t
    );
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (tenant_id)', 'idx_' || t || '_tenant', t);
  END LOOP;
END $$;

-- Tabelas SaaS: o app só enxerga o próprio tenant e seus usuários.
-- Login, cadastro e convites usam a conexão de sistema (dona das tabelas).
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON tenants;
CREATE POLICY tenant_isolation ON tenants
  USING (id = app_tenant_id()) WITH CHECK (id = app_tenant_id());

ALTER TABLE tenant_usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_usuarios FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON tenant_usuarios;
CREATE POLICY tenant_isolation ON tenant_usuarios
  USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id());

ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON usuarios;
CREATE POLICY tenant_isolation ON usuarios
  USING (EXISTS (SELECT 1 FROM tenant_usuarios tu WHERE tu.usuario_id = usuarios.id))
  WITH CHECK (EXISTS (SELECT 1 FROM tenant_usuarios tu WHERE tu.usuario_id = usuarios.id));

-- Índices de FK usados nas listagens
CREATE INDEX IF NOT EXISTS idx_eventos_cliente ON eventos (cliente_id);
CREATE INDEX IF NOT EXISTS idx_eventos_data ON eventos (data_evento);
CREATE INDEX IF NOT EXISTS idx_catalogo_itens_secao ON catalogo_itens (secao_id);
CREATE INDEX IF NOT EXISTS idx_tenant_usuarios_usuario ON tenant_usuarios (usuario_id);
