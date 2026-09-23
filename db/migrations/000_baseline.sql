-- 000_baseline.sql — schema original (antes do sistema de migrations)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- Enable uuid-ossp for gen_random_uuid() just in case (PG 13+ has it built-in but good practice)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. SAAS CORE: Tenants e Usuários
-- ==========================================
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    documento VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    senha_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tenant_usuarios (
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'user', -- 'owner', 'admin', 'user'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tenant_id, usuario_id)
);

-- ==========================================
-- 2. DOMÍNIO ISOLADO (RLS Habilitado)
-- ==========================================

-- Clientes
CREATE TABLE clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    telefone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tipos de Evento
CREATE TABLE tipos_evento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nome VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Categorias de Evento
CREATE TABLE categorias_evento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nome VARCHAR(80) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Associação Categoria x Tipo
CREATE TABLE categoria_evento_tipos (
    categoria_id UUID REFERENCES categorias_evento(id) ON DELETE CASCADE,
    tipo_evento_id UUID REFERENCES tipos_evento(id) ON DELETE CASCADE,
    PRIMARY KEY (categoria_id, tipo_evento_id)
);

-- Pipeline Colunas
CREATE TABLE pipeline_colunas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nome VARCHAR(80) NOT NULL,
    ordem INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Eventos
CREATE TABLE eventos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    cliente_id UUID REFERENCES clientes(id),
    tipo_evento_id UUID REFERENCES tipos_evento(id),
    categoria_evento_id UUID REFERENCES categorias_evento(id),
    data_evento TIMESTAMP,
    numero_convidados INTEGER,
    status VARCHAR(80) DEFAULT 'novo',
    configuracoes JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Status Orçamento
CREATE TABLE status_orcamento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nome VARCHAR(50) NOT NULL,
    variante VARCHAR(20) NOT NULL CHECK (variante IN ('confirmado', 'pendente', 'cancelado')),
    ordem INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orçamentos
CREATE TABLE orcamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    evento_id UUID UNIQUE REFERENCES eventos(id),
    status_id UUID REFERENCES status_orcamento(id),
    tipo_servico_id UUID REFERENCES categorias_evento(id),
    valor_total NUMERIC(10,2),
    mostrar_valor_total BOOLEAN NOT NULL DEFAULT true,
    conteudo JSONB,
    pdf_url TEXT,
    enviado_email BOOLEAN DEFAULT false,
    data_envio TIMESTAMP,
    data_vencimento DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Catálogo Seções
CREATE TABLE catalogo_secoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nome VARCHAR(120) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Catálogo Itens
CREATE TABLE catalogo_itens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    secao_id UUID REFERENCES catalogo_secoes(id) ON DELETE CASCADE,
    nome VARCHAR(200) NOT NULL,
    descricao TEXT,
    ordem INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orçamento Opções (Pacotes)
CREATE TABLE orcamento_opcoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nome VARCHAR(150) NOT NULL,
    preco_por_pessoa NUMERIC(10,2),
    conteudo JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Blocos de Informação
CREATE TABLE orcamento_blocos_info (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    chave VARCHAR(60) NOT NULL,
    titulo VARCHAR(150) NOT NULL,
    conteudo JSONB NOT NULL DEFAULT '[]',
    ativo_por_padrao BOOLEAN NOT NULL DEFAULT true,
    ordem INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (tenant_id, chave)
);

-- Templates Visuais
CREATE TABLE orcamento_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    padrao BOOLEAN NOT NULL DEFAULT false,
    capa_ativa BOOLEAN NOT NULL DEFAULT true,
    capa_imagem_url TEXT,
    capa_margem_superior_mm NUMERIC(6,2) NOT NULL DEFAULT 0,
    capa_margem_inferior_mm NUMERIC(6,2) NOT NULL DEFAULT 0,
    contracapa_ativa BOOLEAN NOT NULL DEFAULT true,
    contracapa_imagem_url TEXT,
    contracapa_margem_superior_mm NUMERIC(6,2) NOT NULL DEFAULT 0,
    contracapa_margem_inferior_mm NUMERIC(6,2) NOT NULL DEFAULT 0,
    miolo_ativa BOOLEAN NOT NULL DEFAULT true,
    miolo_imagem_url TEXT,
    miolo_margem_superior_mm NUMERIC(6,2) NOT NULL DEFAULT 0,
    miolo_margem_inferior_mm NUMERIC(6,2) NOT NULL DEFAULT 0,
    contracapa_posterior_ativa BOOLEAN NOT NULL DEFAULT false,
    contracapa_posterior_imagem_url TEXT,
    contracapa_posterior_margem_superior_mm NUMERIC(6,2) NOT NULL DEFAULT 0,
    contracapa_posterior_margem_inferior_mm NUMERIC(6,2) NOT NULL DEFAULT 0,
    fonte_titulo VARCHAR(60) NOT NULL DEFAULT 'Playfair Display',
    fonte_corpo VARCHAR(60) NOT NULL DEFAULT 'Montserrat',
    cor_texto_primaria VARCHAR(20) NOT NULL DEFAULT '#2d2926',
    cor_texto_secundaria VARCHAR(20) NOT NULL DEFAULT '#d4af37',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (tenant_id, nome)
);

-- Evento: Cardápio Seções
CREATE TABLE evento_cardapio_secoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    evento_id UUID REFERENCES eventos(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    ordem INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Evento: Cardápio Itens
CREATE TABLE evento_cardapio_itens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    secao_id UUID REFERENCES evento_cardapio_secoes(id) ON DELETE CASCADE,
    nome VARCHAR(200) NOT NULL,
    descricao TEXT,
    restricao_alimentar VARCHAR(100), -- 'vegano', 'vegetariano', 'sem_gluten', 'sem_lactose'
    ordem INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Evento: Equipe (Staff)
CREATE TABLE evento_equipe (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    evento_id UUID REFERENCES eventos(id) ON DELETE CASCADE,
    cargo VARCHAR(100) NOT NULL,
    quantidade INTEGER NOT NULL DEFAULT 1,
    observacoes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cria um índice parcial único para garantir que só há UM template padrão por tenant
CREATE UNIQUE INDEX orcamento_templates_padrao_unique ON orcamento_templates(tenant_id) WHERE padrao = true;

-- ==========================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ==========================================

-- Habilita RLS em todas as tabelas dependentes do tenant
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipos_evento ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias_evento ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_colunas ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_orcamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE orcamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogo_secoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogo_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE orcamento_opcoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE orcamento_blocos_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE orcamento_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE evento_cardapio_secoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE evento_cardapio_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE evento_equipe ENABLE ROW LEVEL SECURITY;

-- Políticas Genéricas
CREATE POLICY isolation_clientes ON clientes USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY isolation_tipos_evento ON tipos_evento USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY isolation_categorias_evento ON categorias_evento USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY isolation_pipeline_colunas ON pipeline_colunas USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY isolation_eventos ON eventos USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY isolation_status_orcamento ON status_orcamento USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY isolation_orcamentos ON orcamentos USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY isolation_catalogo_secoes ON catalogo_secoes USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY isolation_catalogo_itens ON catalogo_itens USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY isolation_orcamento_opcoes ON orcamento_opcoes USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY isolation_orcamento_blocos_info ON orcamento_blocos_info USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY isolation_orcamento_templates ON orcamento_templates USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY isolation_evento_cardapio_secoes ON evento_cardapio_secoes USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY isolation_evento_cardapio_itens ON evento_cardapio_itens USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY isolation_evento_equipe ON evento_equipe USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
