# Modelagem de Dados — Casa Club Gourmet

> Documento gerado em 22/09/2026 a partir da **inspeção direta do banco em execução** (catálogo do PostgreSQL), complementada pela leitura das migrations em `db/init/` e do código em `src/`.

---

## 1. Conexão com o banco

| Item | Valor |
|---|---|
| SGBD | PostgreSQL 16 (imagem `postgres:16-alpine`) |
| Container | `app-db` (serviço do `docker-compose.yml` / `docker-compose.dev.yml`) |
| Database / usuário | `casaclubgourmet` / `casaclubgourmet` |
| String de conexão | variável `DATABASE_URL` no `.env` → `postgresql://casaclubgourmet:***@app-db:5432/casaclubgourmet` |
| Driver | `pg` (node-postgres) — sem ORM, SQL escrito à mão |
| Ponto de conexão no código | [`src/lib/db.ts`](../src/lib/db.ts) exporta um único `pg.Pool` compartilhado |
| Schema utilizado | `public` |
| Criação/evolução do schema | Scripts SQL em [`db/init/`](../db/init/) (001 → 023), executados pelo Postgres **apenas na primeira inicialização** do volume (`/docker-entrypoint-initdb.d`) |
| Extensões | apenas `plpgsql` (o `gen_random_uuid()` é nativo do PG 13+) |
| Views / funções / triggers | nenhum |

```ts
// src/lib/db.ts
import pg from "pg";
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
```

---

## 2. Visão geral

O banco possui **14 tabelas** e **1 tipo enum**. Elas se agrupam em 5 domínios:

| Domínio | Tabelas | Função |
|---|---|---|
| **Comercial (núcleo)** | `clientes`, `eventos`, `orcamentos` | Quem pediu, qual evento, qual proposta |
| **Classificação de eventos** | `tipos_evento`, `categorias_evento`, `categoria_evento_tipos` | Tipo (Social/Corporativo) e categoria/estilo de serviço (Coquetel, Buffet…) |
| **Fluxo / status** | `pipeline_colunas`, `status_orcamento` | Colunas do Kanban de eventos e status do orçamento |
| **Cardápio e conteúdo do orçamento** | `catalogo_secoes`, `catalogo_itens`, `orcamento_opcoes`, `orcamento_blocos_info`, `orcamento_templates` | Biblioteca de itens, pacotes prontos, textos padrão e layout visual do PDF |
| **Acesso** | `usuarios` (+ enum `role_usuario_enum`) | Login no painel administrativo |

Volume atual de registros (contagem exata no momento da extração):

| Tabela | Linhas | Tabela | Linhas |
|---|---:|---|---:|
| `catalogo_itens` | 177 | `orcamento_opcoes` | 13 |
| `catalogo_secoes` | 22 | `orcamento_templates` | 1 |
| `categoria_evento_tipos` | 21 | `orcamentos` | 6 |
| `categorias_evento` | 18 | `pipeline_colunas` | 4 |
| `clientes` | 3 | `status_orcamento` | 3 |
| `eventos` | 7 | `tipos_evento` | 2 |
| `orcamento_blocos_info` | 17 | `usuarios` | 2 |

---

## 3. Diagrama Entidade-Relacionamento

Linhas contínuas = chave estrangeira real no banco. Linhas tracejadas = **relacionamento lógico** (existe só no código / dentro de JSONB, sem FK).

```mermaid
erDiagram
    clientes ||--o{ eventos : "cliente_id"
    tipos_evento ||--o{ eventos : "tipo_evento_id"
    categorias_evento ||--o{ eventos : "categoria_evento_id"
    eventos ||--o| orcamentos : "evento_id (UNIQUE)"
    status_orcamento ||--o{ orcamentos : "status_id"
    categorias_evento ||--o{ orcamentos : "tipo_servico_id"
    categorias_evento ||--o{ categoria_evento_tipos : "categoria_id"
    tipos_evento ||--o{ categoria_evento_tipos : "tipo_evento_id"
    catalogo_secoes ||--o{ catalogo_itens : "secao_id (CASCADE)"

    pipeline_colunas ||..o{ eventos : "nome = eventos.status (lógico)"
    orcamento_templates ||..o{ orcamentos : "conteudo.template_id (JSONB)"
    orcamento_blocos_info ||..o{ orcamentos : "conteudo.blocos_info[].bloco_id (JSONB)"
    catalogo_secoes ||..o{ orcamento_opcoes : "conteudo[].secao_id (JSONB)"
    catalogo_itens ||..o{ orcamento_opcoes : "conteudo[].itens[].item_id (JSONB)"
    catalogo_itens ||..o{ orcamentos : "conteudo.pacotes[].secoes[].itens[].item_id (JSONB)"

    clientes {
        int id PK
        varchar nome
        varchar email
        varchar telefone
        timestamp data_criacao
    }
    eventos {
        uuid id PK
        int cliente_id FK
        int tipo_evento_id FK
        int categoria_evento_id FK
        timestamp data_evento
        int numero_convidados
        varchar status
        jsonb configuracoes
        timestamp created_at
    }
    orcamentos {
        uuid id PK
        uuid evento_id FK,UK
        int status_id FK
        int tipo_servico_id FK
        numeric valor_total
        boolean mostrar_valor_total
        jsonb conteudo
        text pdf_url
        boolean enviado_email
        timestamp data_envio
        date data_vencimento
        timestamp criado_em
    }
    tipos_evento {
        int id PK
        varchar nome UK
        timestamp created_at
    }
    categorias_evento {
        int id PK
        varchar nome
        timestamp created_at
    }
    categoria_evento_tipos {
        int categoria_id PK,FK
        int tipo_evento_id PK,FK
    }
    pipeline_colunas {
        int id PK
        varchar nome
        int ordem
        timestamp created_at
    }
    status_orcamento {
        int id PK
        varchar nome
        varchar variante
        int ordem
        timestamp created_at
    }
    catalogo_secoes {
        int id PK
        varchar nome
        timestamp created_at
    }
    catalogo_itens {
        int id PK
        int secao_id FK
        varchar nome
        text descricao
        int ordem
        timestamp created_at
    }
    orcamento_opcoes {
        int id PK
        varchar nome
        numeric preco_por_pessoa
        jsonb conteudo
        timestamp created_at
    }
    orcamento_blocos_info {
        int id PK
        varchar chave UK
        varchar titulo
        jsonb conteudo
        boolean ativo_por_padrao
        int ordem
        timestamp created_at
    }
    orcamento_templates {
        int id PK
        varchar nome UK
        boolean padrao
        varchar fonte_titulo
        varchar fonte_corpo
        varchar cor_texto_primaria
        varchar cor_texto_secundaria
        text capa_imagem_url
        text miolo_imagem_url
        text contracapa_imagem_url
        text contracapa_posterior_imagem_url
    }
    usuarios {
        int id PK
        varchar nome
        varchar email UK
        text senha_hash
        role_usuario_enum role
        boolean senha_padrao
        timestamp created_at
    }
```

> O diagrama de `orcamento_templates` foi resumido; a lista completa de colunas (incluindo as 8 de margem) está na seção 4.

---

## 4. Dicionário de dados — estrutura de cada tabela

Legenda: **PK** chave primária · **FK** chave estrangeira · **UK** único · **NN** NOT NULL

### 4.1 `clientes`
Pessoa/empresa que solicitou o evento. Criado manualmente no painel ou automaticamente pelo webhook do Typebot (que localiza o cliente por e-mail, sem diferenciar maiúsculas).

| Coluna | Tipo | Nulo | Default | Restrições |
|---|---|---|---|---|
| `id` | `integer` (serial) | NN | `nextval('clientes_id_seq')` | **PK** |
| `nome` | `varchar(255)` | NN | | |
| `email` | `varchar(255)` | NN | | *(sem UNIQUE — ver observações)* |
| `telefone` | `varchar(20)` | sim | | |
| `data_criacao` | `timestamp` | sim | `CURRENT_TIMESTAMP` | |

### 4.2 `eventos`
Pedido de evento. É o **card do Kanban** (pipeline).

| Coluna | Tipo | Nulo | Default | Restrições |
|---|---|---|---|---|
| `id` | `uuid` | NN | `gen_random_uuid()` | **PK** |
| `cliente_id` | `integer` | sim | | **FK** → `clientes.id` |
| `tipo_evento_id` | `integer` | sim | | **FK** → `tipos_evento.id` |
| `categoria_evento_id` | `integer` | sim | | **FK** → `categorias_evento.id` |
| `data_evento` | `timestamp` | sim | | |
| `numero_convidados` | `integer` | sim | | |
| `status` | `varchar(80)` | sim | `'novo'` | Guarda o **nome** de uma `pipeline_colunas` (relação lógica) |
| `configuracoes` | `jsonb` | sim | | Ex.: `{"espaco": "Casa Club Gourmet"}` |
| `created_at` | `timestamp` | sim | `CURRENT_TIMESTAMP` | |

### 4.3 `orcamentos`
Proposta comercial de um evento. **No máximo um orçamento por evento** (`UNIQUE (evento_id)`).

| Coluna | Tipo | Nulo | Default | Restrições |
|---|---|---|---|---|
| `id` | `uuid` | NN | `gen_random_uuid()` | **PK** |
| `evento_id` | `uuid` | sim | | **FK** → `eventos.id` · **UK** |
| `status_id` | `integer` | sim | `2` (Pendente) | **FK** → `status_orcamento.id` |
| `tipo_servico_id` | `integer` | sim | | **FK** → `categorias_evento.id` |
| `valor_total` | `numeric(10,2)` | sim | | |
| `mostrar_valor_total` | `boolean` | NN | `true` | Exibir ou não o total no PDF |
| `conteudo` | `jsonb` | sim | | Snapshot completo da proposta (ver 6.1) |
| `pdf_url` | `text` | sim | | |
| `enviado_email` | `boolean` | sim | `false` | |
| `data_envio` | `timestamp` | sim | | |
| `data_vencimento` | `date` | sim | | Validade da proposta |
| `criado_em` | `timestamp` | NN | `now()` | |

### 4.4 `tipos_evento`
Tipo macro do evento. Dados atuais: **Corporativo**, **Social**.

| Coluna | Tipo | Nulo | Default | Restrições |
|---|---|---|---|---|
| `id` | `integer` (serial) | NN | `nextval(...)` | **PK** |
| `nome` | `varchar(50)` | NN | | **UK** |
| `created_at` | `timestamp` | sim | `CURRENT_TIMESTAMP` | |

### 4.5 `categorias_evento`
Categoria do evento **e** estilo de serviço do orçamento (Aniversário, Coquetel, Brunch, Buffet, Empratado, Comida de Boteco…). A migration 014 unificou aqui a antiga tabela `tipos_servico_orcamento`.

| Coluna | Tipo | Nulo | Default | Restrições |
|---|---|---|---|---|
| `id` | `integer` (serial) | NN | `nextval(...)` | **PK** |
| `nome` | `varchar(80)` | NN | | *(sem UNIQUE: o mesmo nome pode existir mais de uma vez)* |
| `created_at` | `timestamp` | sim | `CURRENT_TIMESTAMP` | |

### 4.6 `categoria_evento_tipos` (tabela associativa N:N)
Define em quais tipos de evento cada categoria é válida (ex.: "Coquetel" vale para Social **e** Corporativo).

| Coluna | Tipo | Nulo | Restrições |
|---|---|---|---|
| `categoria_id` | `integer` | NN | **PK** (composta) · **FK** → `categorias_evento.id` `ON DELETE CASCADE` |
| `tipo_evento_id` | `integer` | NN | **PK** (composta) · **FK** → `tipos_evento.id` `ON DELETE CASCADE` |

### 4.7 `pipeline_colunas`
Colunas do Kanban de eventos. Dados atuais (por `ordem`): **Novo** → **Negociação em andamento** → **Orçamento aprovado** → **Orçamento recusado**.

| Coluna | Tipo | Nulo | Default | Restrições |
|---|---|---|---|---|
| `id` | `integer` (serial) | NN | `nextval(...)` | **PK** |
| `nome` | `varchar(80)` | NN | | |
| `ordem` | `integer` | NN | `0` | |
| `created_at` | `timestamp` | sim | `CURRENT_TIMESTAMP` | |

### 4.8 `status_orcamento`
Status editável do orçamento. `variante` é o valor "semântico" usado pelo código para cor e para métricas.

| Coluna | Tipo | Nulo | Default | Restrições |
|---|---|---|---|---|
| `id` | `integer` (serial) | NN | `nextval(...)` | **PK** |
| `nome` | `varchar(50)` | NN | | |
| `variante` | `varchar(20)` | NN | `'pendente'` | **CHECK** `IN ('confirmado','pendente','cancelado')` |
| `ordem` | `integer` | NN | `0` | |
| `created_at` | `timestamp` | sim | `CURRENT_TIMESTAMP` | |

Dados atuais: `1 Confirmado/confirmado`, `2 Pendente/pendente`, `3 Cancelado/cancelado`.

### 4.9 `catalogo_secoes`
Seções do cardápio (ex.: "Mesa de Pães", "Queijos e Embutidos", "Coquetel").

| Coluna | Tipo | Nulo | Default | Restrições |
|---|---|---|---|---|
| `id` | `integer` (serial) | NN | `nextval(...)` | **PK** |
| `nome` | `varchar(120)` | NN | | |
| `created_at` | `timestamp` | sim | `CURRENT_TIMESTAMP` | |

### 4.10 `catalogo_itens`
Itens/pratos do cardápio, cada um dentro de uma seção.

| Coluna | Tipo | Nulo | Default | Restrições |
|---|---|---|---|---|
| `id` | `integer` (serial) | NN | `nextval(...)` | **PK** |
| `secao_id` | `integer` | NN | | **FK** → `catalogo_secoes.id` `ON DELETE CASCADE` |
| `nome` | `varchar(200)` | NN | | |
| `descricao` | `text` | sim | | |
| `ordem` | `integer` | NN | `0` | |
| `created_at` | `timestamp` | sim | `CURRENT_TIMESTAMP` | |

### 4.11 `orcamento_opcoes`
"Pacotes" pré-montados de cardápio (ex.: BRUNCH), com preço por pessoa, que podem ser aplicados a um orçamento.

| Coluna | Tipo | Nulo | Default | Restrições |
|---|---|---|---|---|
| `id` | `integer` (serial) | NN | `nextval(...)` | **PK** |
| `nome` | `varchar(150)` | NN | | |
| `preco_por_pessoa` | `numeric(10,2)` | sim | | |
| `conteudo` | `jsonb` | NN | `'[]'` | Lista de seções e itens (ver 6.2) |
| `created_at` | `timestamp` | sim | `CURRENT_TIMESTAMP` | |

### 4.12 `orcamento_blocos_info`
Blocos de texto padrão do orçamento ("Crianças", "Hora Adicional", "Locação do Espaço"…).

| Coluna | Tipo | Nulo | Default | Restrições |
|---|---|---|---|---|
| `id` | `integer` (serial) | NN | `nextval(...)` | **PK** |
| `chave` | `varchar(60)` | NN | | **UK** (identificador técnico, ex.: `informacoes_complementares_criancas`) |
| `titulo` | `varchar(150)` | NN | | |
| `conteudo` | `jsonb` | NN | `'[]'` | Lista de elementos de texto (ver 6.3) |
| `ativo_por_padrao` | `boolean` | NN | `true` | Já vem marcado em novos orçamentos |
| `ordem` | `integer` | NN | `0` | |
| `created_at` | `timestamp` | sim | `CURRENT_TIMESTAMP` | |

### 4.13 `orcamento_templates`
Modelo visual do PDF do orçamento: imagens de fundo por tipo de página, fontes, cores e margens.

| Coluna | Tipo | Nulo | Default | Restrições |
|---|---|---|---|---|
| `id` | `integer` (serial) | NN | `nextval(...)` | **PK** |
| `nome` | `varchar(100)` | NN | | **UK** |
| `padrao` | `boolean` | NN | `false` | Índice único parcial: **só um template pode ter `padrao = true`** |
| `capa_ativa` | `boolean` | NN | `true` | |
| `capa_imagem_url` | `text` | sim | | |
| `capa_margem_superior_mm` | `numeric(6,2)` | NN | `0` | |
| `capa_margem_inferior_mm` | `numeric(6,2)` | NN | `0` | |
| `contracapa_ativa` | `boolean` | NN | `true` | |
| `contracapa_imagem_url` | `text` | sim | | |
| `contracapa_margem_superior_mm` | `numeric(6,2)` | NN | `0` | |
| `contracapa_margem_inferior_mm` | `numeric(6,2)` | NN | `0` | |
| `miolo_ativa` | `boolean` | NN | `true` | |
| `miolo_imagem_url` | `text` | sim | | |
| `miolo_margem_superior_mm` | `numeric(6,2)` | NN | `0` | |
| `miolo_margem_inferior_mm` | `numeric(6,2)` | NN | `0` | |
| `contracapa_posterior_ativa` | `boolean` | NN | `false` | |
| `contracapa_posterior_imagem_url` | `text` | sim | | |
| `contracapa_posterior_margem_superior_mm` | `numeric(6,2)` | NN | `0` | |
| `contracapa_posterior_margem_inferior_mm` | `numeric(6,2)` | NN | `0` | |
| `fonte_titulo` | `varchar(60)` | NN | `'Playfair Display'` | |
| `fonte_corpo` | `varchar(60)` | NN | `'Montserrat'` | |
| `cor_texto_primaria` | `varchar(20)` | NN | `'#2d2926'` | |
| `cor_texto_secundaria` | `varchar(20)` | NN | `'#d4af37'` | |
| `created_at` | `timestamp` | sim | `CURRENT_TIMESTAMP` | |

### 4.14 `usuarios`
Usuários do painel administrativo. Senha armazenada com bcrypt (`bcryptjs`).

| Coluna | Tipo | Nulo | Default | Restrições |
|---|---|---|---|---|
| `id` | `integer` (serial) | NN | `nextval(...)` | **PK** |
| `nome` | `varchar(255)` | NN | | |
| `email` | `varchar(255)` | NN | | **UK** |
| `senha_hash` | `text` | NN | | |
| `role` | `role_usuario_enum` | NN | `'usuario'` | |
| `senha_padrao` | `boolean` | NN | `true` | Força a troca de senha no primeiro login |
| `created_at` | `timestamp` | sim | `CURRENT_TIMESTAMP` | |

### 4.15 Tipos personalizados

| Tipo | Valores |
|---|---|
| `role_usuario_enum` | `administrador`, `usuario` |

---

## 5. Relacionamentos

### 5.1 Chaves estrangeiras reais (garantidas pelo banco)

| Tabela filha | Coluna | → Tabela pai | Cardinalidade | ON DELETE |
|---|---|---|---|---|
| `eventos` | `cliente_id` | `clientes.id` | N:1 (cliente tem vários eventos) | `NO ACTION` |
| `eventos` | `tipo_evento_id` | `tipos_evento.id` | N:1 | `NO ACTION` |
| `eventos` | `categoria_evento_id` | `categorias_evento.id` | N:1 | `NO ACTION` |
| `orcamentos` | `evento_id` | `eventos.id` | **1:0..1** (UNIQUE) | `NO ACTION` |
| `orcamentos` | `status_id` | `status_orcamento.id` | N:1 | `NO ACTION` |
| `orcamentos` | `tipo_servico_id` | `categorias_evento.id` | N:1 | `NO ACTION` |
| `categoria_evento_tipos` | `categoria_id` | `categorias_evento.id` | N:N (associativa) | `CASCADE` |
| `categoria_evento_tipos` | `tipo_evento_id` | `tipos_evento.id` | N:N (associativa) | `CASCADE` |
| `catalogo_itens` | `secao_id` | `catalogo_secoes.id` | N:1 | `CASCADE` |

`NO ACTION` significa que o banco **impede** excluir o registro pai enquanto houver filhos apontando para ele (ex.: não é possível excluir um cliente que tem eventos).

### 5.2 Relacionamentos lógicos (sem FK — mantidos só pelo código)

| Origem | Destino | Como funciona |
|---|---|---|
| `eventos.status` | `pipeline_colunas.nome` | O evento guarda o **texto** do nome da coluna. O dashboard faz `JOIN eventos e ON e.status = pc.nome`. Renomear uma coluna do pipeline "desliga" os eventos que estavam nela. |
| `eventos.status` → `orcamentos.status_id` | `status_orcamento.variante` | Ao mover um card ([`api/admin/eventos/[id]/status.ts`](../src/pages/api/admin/eventos/[id]/status.ts)), o código sincroniza o status do orçamento por nome fixo: "Negociação em andamento" → `pendente`, "Orçamento aprovado" → `confirmado`, "Orçamento recusado" → `cancelado`. |
| `orcamentos.conteudo.template_id` | `orcamento_templates.id` | Template usado para gerar o PDF. |
| `orcamentos.conteudo.blocos_info[].bloco_id` | `orcamento_blocos_info.id` | Blocos de texto incluídos (título e conteúdo são **copiados**). |
| `orcamentos.conteudo.pacotes[].secoes[].secao_id` / `.itens[].item_id` | `catalogo_secoes.id` / `catalogo_itens.id` | Itens escolhidos (nome e descrição são **copiados**; `custom: true` indica item digitado à mão, sem vínculo com o catálogo). |
| `orcamentos.conteudo.cabecalho.tipo_servico_id` | `categorias_evento.id` | Duplica a coluna `orcamentos.tipo_servico_id`. |
| `orcamento_opcoes.conteudo[].secao_id` / `.itens[].item_id` | `catalogo_secoes.id` / `catalogo_itens.id` | Mesmo formato de seção/itens usado nos orçamentos. |

### 5.3 Leitura do modelo em uma frase

Um **cliente** faz vários **eventos**; cada evento tem um **tipo** (Social/Corporativo), uma **categoria** (válida para aquele tipo via `categoria_evento_tipos`), está em uma **coluna do pipeline** e pode ter **um orçamento**. O orçamento tem um **status**, um **estilo de serviço** (também uma categoria) e um **snapshot JSONB** montado a partir do **catálogo**, das **opções/pacotes**, dos **blocos de informação** e de um **template visual**.

---

## 6. Estrutura dos campos JSONB

Os campos JSONB guardam **cópias** (snapshots) dos dados no momento em que o orçamento foi montado. Assim, editar o catálogo depois não altera propostas já emitidas.

### 6.1 `orcamentos.conteudo`

```jsonc
{
  "template_id": 2,                       // → orcamento_templates.id
  "cabecalho": {
    "local": "Casa Club Gourmet",
    "evento": "Jantar Empratado",
    "contato": "Nome do cliente",
    "telefone": "(41) 99999-0000",
    "data_evento": "2026-09-20",
    "data_proposta": "2026-07-26",
    "horario_evento": "20:00",
    "duracao_evento": "5 horas",
    "duracao_alimentacao": "2 horas",
    "numero_convidados": 80,
    "tipo_servico_id": 16,                // → categorias_evento.id
    "tipo_servico_nome": "Empratado"
  },
  "pacotes": [
    {
      "nome": "BRUNCH",
      "preco_por_pessoa": 150.00,
      "secoes": [
        {
          "secao_id": 2,                  // → catalogo_secoes.id
          "nome": "Mesa de Pães",
          "itens": [
            { "item_id": 2, "nome": "Croissant", "descricao": null, "custom": false } // → catalogo_itens.id
          ]
        }
      ]
    }
  ],
  "blocos_info": [
    {
      "bloco_id": 5,                      // → orcamento_blocos_info.id
      "titulo": "Crianças",
      "conteudo": [ /* mesmo formato de 6.3 */ ]
    }
  ]
}
```

### 6.2 `orcamento_opcoes.conteudo`

Array de seções — mesmo formato de `pacotes[].secoes` acima:

```json
[
  { "secao_id": 6, "nome": "Coquetel",
    "itens": [ { "item_id": 28, "nome": "Bruschetta de tomate", "descricao": null, "custom": false } ] }
]
```

### 6.3 `orcamento_blocos_info.conteudo`

Array de elementos de texto, discriminados por `tipo`:

```json
[
  { "tipo": "paragrafo",    "texto": "Valores de locação:" },
  { "tipo": "lista",        "itens": ["Até 5 anos – não paga", "De 6 a 11 anos – paga meia"] },
  { "tipo": "lista_precos", "itens": [ { "label": "Até 30 convidados", "valor": "R$ 1.000,00" } ] }
]
```

### 6.4 `eventos.configuracoes`

```json
{ "espaco": "Casa Club Gourmet" }
```

---

## 7. Índices

Além dos índices criados automaticamente pelas PKs:

| Tabela | Índice | Definição |
|---|---|---|
| `usuarios` | `usuarios_email_key` | `UNIQUE (email)` |
| `tipos_evento` | `tipos_evento_nome_key` | `UNIQUE (nome)` |
| `orcamentos` | `orcamentos_evento_id_unique` | `UNIQUE (evento_id)` |
| `orcamento_templates` | `orcamento_templates_nome_key` | `UNIQUE (nome)` |
| `orcamento_templates` | `orcamento_templates_padrao_unique` | `UNIQUE (padrao) WHERE padrao = true` — índice parcial que garante um único template padrão |
| `orcamento_blocos_info` | `orcamento_blocos_info_chave_key` | `UNIQUE (chave)` |

Não existem índices nas colunas de FK (`eventos.cliente_id`, `eventos.status`, `catalogo_itens.secao_id`, etc.). Com o volume atual isso não faz diferença.

---

## 8. Histórico da modelagem (migrations em `db/init/`)

| Arquivo | O que mudou |
|---|---|
| `001_create_core_tables.sql` | Tabelas `clientes`, `eventos`, `orcamentos` (inicialmente com enums de tipo/categoria) |
| `002_create_usuarios.sql` | `usuarios` + `role_usuario_enum` |
| `003_configuracoes_sistema.sql` | Troca os enums por tabelas editáveis: `tipos_evento`, `categorias_evento`, `pipeline_colunas`, `status_orcamento`; `orcamentos.status_id` |
| `004_atualizar_colunas_pipeline.sql` | Renomeia as colunas do Kanban para o conjunto atual |
| `005_ajustar_tamanho_status_evento.sql` | `eventos.status` passa a `varchar(80)` (para caber o nome da coluna) |
| `006_eventos_uuid.sql` / `007_orcamentos_uuid.sql` | PKs de `eventos` e `orcamentos` migram de serial para UUID |
| `008_orcamento_templates.sql` | Templates visuais do PDF |
| `009_orcamento_blocos_info.sql` | Blocos de informação complementar |
| `010_catalogo_alimentos.sql` | `catalogo_secoes` e `catalogo_itens` |
| `011_tipos_servico_orcamento.sql` | Tabela de tipos de serviço (removida depois na 014) |
| `012_orcamentos_conteudo.sql` | Coluna JSONB `orcamentos.conteudo` |
| `013_categorias_evento_muitos_tipos.sql` | Categoria passa a valer para vários tipos → cria `categoria_evento_tipos` e remove `categorias_evento.tipo_evento_id` |
| `014_unificar_tipos_servico_em_categorias.sql` | Tipos de serviço fundidos em `categorias_evento`; `orcamentos.tipo_servico_id` passa a apontar para lá |
| `015` / `020` `catalogo_secoes_*preco*` | A 015 remove `catalogo_secoes.ordem` (seções passam a ser ordenadas por nome) e adiciona um preço padrão, que a 020 remove |
| `016_orcamento_opcoes.sql` | Pacotes prontos de cardápio |
| `017_orcamentos_data_vencimento.sql` | Validade da proposta |
| `018` / `019` `orcamento_templates_*` | Margens por página e cores de texto |
| `021_orcamentos_mostrar_valor_total.sql` | Flag de exibição do total |
| `022_usuarios_senha_padrao.sql` | Flag de troca de senha obrigatória |
| `023_orcamentos_criado_em.sql` | Data de criação do orçamento |

> **Atenção:** o Postgres só executa `db/init/` quando o volume de dados está vazio. Em um banco já existente, novas migrations precisam ser aplicadas manualmente.

Os "buracos" na numeração das colunas (`ordinal_position`), como `eventos` começando em 2 e `categorias_evento` sem a posição 3, são restos dessas alterações (colunas removidas).

---

## 9. Observações para estudo

Pontos que chamam a atenção e ajudam a entender as escolhas do modelo:

1. **`eventos.status` é texto, não FK.** A ligação com `pipeline_colunas` é pelo nome. Renomear ou excluir uma coluna do pipeline deixa eventos órfãos, e a sincronização com `status_orcamento` depende de três nomes fixos no código.
2. **`clientes.email` não é único.** O webhook do Typebot deduplica por `lower(email)`, mas o banco não impede duplicatas criadas pelo painel.
3. **`categorias_evento.nome` não é único.** Já existiram duas categorias "Outros" (uma por tipo) antes da migration 013.
4. **Dois significados para `categorias_evento`.** A mesma tabela é "categoria do evento" (`eventos.categoria_evento_id`) e "estilo de serviço do orçamento" (`orcamentos.tipo_servico_id`).
5. **Os JSONB são snapshots.** Não há integridade referencial para `item_id`, `bloco_id` e `template_id`; um item excluído do catálogo continua aparecendo nos orçamentos antigos, o que aqui é intencional.
6. **Inconsistência de nomes nas colunas de data:** `created_at`, `data_criacao` (clientes) e `criado_em` (orcamentos).
7. **Default de `orcamentos.status_id = 2`** depende de "Pendente" ter o id 2. Se os status forem recriados, o default aponta para outro registro.
8. **`eventos.status` tem default `'novo'` (minúsculo)**, mas a coluna do pipeline se chama `'Novo'`. O webhook usa o nome correto (lê a primeira coluna por `ordem`), mas um `INSERT` sem `status` geraria um evento fora de qualquer coluna.
9. **Transação em [`status.ts`](../src/pages/api/admin/eventos/[id]/status.ts):** o `BEGIN`/`COMMIT` é executado via `pool.query`, e cada chamada pode usar uma conexão diferente do pool. Por isso as duas atualizações **não** são realmente atômicas. O correto seria `const client = await pool.connect()` e rodar tudo nesse `client`.
