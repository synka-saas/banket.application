# Banket — Sistema de gestão para buffets

SaaS multi-empresa (multi-tenant) para buffets e casas de eventos. Cobre a captação do pedido (formulário público ou
cadastro manual), o quadro de vendas (Kanban), o orçamento versionado montado a partir do catálogo (cardápios,
bebidas, staff, locação), a geração do PDF da proposta, o envio por e-mail, a agenda, o dashboard e a gestão da equipe.

- Produção: <https://app.banket.com.br> (VPS `synka-main`, código em `/var/www/banket`)
- Repositório: `git@github.com:synka-saas/banket.application.git` (branch `main`)
- Idioma do código, das mensagens, dos commits e da UI: **português**
- Leitura complementar: [README.md](README.md) (setup local) e [DEPLOY.md](DEPLOY.md) (VPS, Nginx, blue-green)
- `CLAUDE.md` é a fonte principal desta documentação; `AGENTS.md` é uma cópia idêntica. Ao alterar um, copie para o outro.

> `modelagem-banco-de-dados.md` descreve o schema **antigo** do projeto de origem (Casa Club Gourmet: ids serial,
> `pipeline_colunas`, `db/init/`). Não reflete o Banket atual. A fonte de verdade do schema é `db/migrations/`
> e a seção [Modelo de dados](#modelo-de-dados) abaixo.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | **Astro 7 SSR** (`output: 'server'`, adapter `@astrojs/node` standalone) |
| Ilhas interativas | **Preact** (Kanban, construtor de orçamento, editores de opção de cardápio e de formulário) |
| Banco | **PostgreSQL 15** (`postgres:15-alpine`) com **Row Level Security** por empresa |
| Acesso a dados | `pg` (node-postgres), **sem ORM**, SQL escrito à mão |
| Validação | **zod 4** |
| Sessão | JWT HS256 com `jose`, em cookie httpOnly |
| Senhas | `pgcrypto`: `crypt(senha, gen_salt('bf'))` (bcrypt no próprio Postgres) |
| PDF | **Chromium** via `playwright-core` + **pdf-lib** para juntar capa/miolo/contracapa |
| E-mail | API HTTP do **Resend** (sem chave, o e-mail vai para o log) |
| Testes | **Vitest** (unitários em `src/**/*.test.ts`) e **Playwright** (e2e em `tests/e2e`) |
| Infra | Docker Compose; Nginx no host; deploy blue-green |
| Node | >= 22.12 |

Ícones: somente **Google Material Symbols** (`components/ui/Icon.astro` e `Icon.tsx`).

---

## Comandos

```bash
cp .env.example .env                    # preencha JWT_SECRET: openssl rand -base64 48
npm install                             # dependências no host (testes, astro check)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build   # dev (ou: make dev no Mac)

npm test                 # unitários (Vitest)
npx astro check          # checagem de tipos
npm run test:e2e         # e2e (Playwright) contra o ambiente de dev no ar; SHOTS=/pasta salva screenshots
npm run build            # build de produção
npm run db:migrate       # aplica migrations (fora do Docker: exporte DATABASE_URL_SYSTEM)
npm run db:seed          # migrations + seeds de demonstração
node scripts/screenshots.mjs <saida> <rota>...   # capturas autenticadas para revisão visual
```

Dev em <http://localhost:4321>. O contêiner de dev aplica migrations **e seeds** ao subir. Usuários de demonstração
(senha `Banket.2026`): `leandro@banket.com.br` (owner, empresa Banket), `operacao@banket.com.br` (usuario, Banket),
`demo@outrobuffet.com.br` (owner, "Outro Buffet", usado para testar isolamento).

Sem `RESEND_API_KEY`, links de confirmação/convite/recuperação aparecem no log: `docker logs application-webapp-1`.

**Dev no Mac (iCloud/bind mount):** o Vite não percebe todas as mudanças pelo volume. Depois de alterar `src/server`,
`src/lib`, `src/middleware.ts` ou criar rotas, rode `docker restart application-webapp-1`.

O `Makefile` **não é versionado**: cada ambiente tem o seu (dev no Mac, produção na VPS). Ver DEPLOY.md.

---

## Estrutura

```
src/
  middleware.ts        sessão (JWT) + vínculo ativo, rotas públicas, restrição de Configurações, cabeçalhos de segurança
  env.d.ts             App.Locals: user (SessionUser) e flash
  lib/                 infraestrutura e funções puras (sem regra de domínio acoplada a página)
    db.ts              pools, withTenant / withSystem / tenantQuery / systemQuery
    auth.ts            JWT de sessão e de onboarding, papéis, cookies
    membership.ts      confere vínculo usuário↔empresa a cada request (cache 30 s)
    printToken.ts      JWT de 5 min para o Chromium abrir /print/*
    tokens.ts          tokens aleatórios de uso único (só o SHA-256 vai ao banco)
    rateLimit.ts       limite por janela fixa em memória + IP real atrás do Nginx
    senha.ts           política de senha
    storage.ts         arquivos em disco particionados por tenant
    mail.ts            envio via Resend / log em dev; appUrl()
    openai.ts          chamada à OpenAI (Chat Completions) com imagem e resposta JSON estruturada
    forms.ts           FormData → objeto, preprocessadores zod, UserError, tradução de erros do Postgres
    actions.ts         handleFormPost (POST → redirect → GET com flash)
    api.ts             jsonEndpoint / readJson para endpoints JSON
    flash.ts           mensagens que sobrevivem ao redirect (cookie banket_flash)
    html.ts            escapeHtml + template tag html`` para montar células de tabela com segurança
    texto.ts           marcação simples dos blocos da proposta → HTML seguro
    money.ts datas.ts documento.ts pagination.ts nav.ts
    calculo/           cálculo PURO do orçamento e do staff (roda no navegador e no servidor)
    formularios/       modelo do formulário de captação (compartilhado servidor/ilha/página pública)
  server/              regras de negócio por domínio; recebem `db` já dentro de withTenant
  pages/               rotas Astro (SSR); POST de formulário na própria página
  pages/api/           endpoints JSON usados pelas ilhas Preact
  pages/print/         páginas de impressão da proposta (só com print token)
  components/          ui/ (Button, Table, Drawer, Toast…), ilhas Preact (orcamento/, cardapio/, formularios/),
                       proposta/Proposta.astro (layout impresso), eventos/, templates/
  layouts/             Layout, AppLayout (sidebar+topbar), AuthLayout, EventoLayout (abas do evento), FormularioLayout
  styles/              global.css, orcamento.css, editor.css, formularios.css
db/migrations/         NNN_nome.sql, aplicadas em ordem
db/seeds/              dados de demonstração (só com --seed); arquivos com "_" no início são ignorados
scripts/               migrate.mjs, deploy.sh (Mac), deploy-remoto.sh (VPS), screenshots.mjs
tests/e2e/             Playwright (helpers.ts: login, leitura de links de e-mail no log do contêiner)
public/ref/            PDFs de cardápios de referência (Brunch, Buffet, Boteco, Empratado) que originaram os seeds
```

---

## Conexão com o banco de dados

### Dois papéis, duas conexões

| Variável | Papel Postgres | Uso |
|---|---|---|
| `DATABASE_URL` | `APP_DB_USER` (padrão `banket_app`): **NOSUPERUSER NOBYPASSRLS**, sujeito ao RLS | Toda consulta de dados da empresa, via `withTenant` |
| `DATABASE_URL_SYSTEM` | `POSTGRES_USER` (padrão `banket_user`): dono das tabelas, ignora RLS | Migrations e fluxos **sem empresa**: login, cadastro, verificação, convites, recuperação de senha, resolução do slug do formulário público, `membership`, health check |

O papel da aplicação é criado/atualizado por `scripts/migrate.mjs` (`ensureAppRole`) a cada subida: GRANT de
SELECT/INSERT/UPDATE/DELETE em todas as tabelas, sequences e EXECUTE em funções; `REVOKE` em `schema_migrations`
/`schema_seeds`. Em Docker o host do banco é `postgres:5432`; banco padrão `banket_db`.

### `src/lib/db.ts`

- `appPool` (max 10) usa `DATABASE_URL`; `systemPool` (max 3) usa `DATABASE_URL_SYSTEM`.
- Type parsers: `NUMERIC` e `INT8` viram `number` (valores monetários e `count(*)`).
- `withTenant(tenantId, db => …)`: abre transação, executa `set_config('app.current_tenant_id', tenantId, true)`
  (local à transação), roda `fn`, faz COMMIT/ROLLBACK e libera o client. **É assim que toda query de negócio é feita.**
- `tenantQuery(tenantId, sql, params)`: atalho para uma única query isolada.
- `withSystem(fn)` / `systemQuery(sql, params)`: conexão de sistema, sem tenant. Uso restrito aos fluxos acima.
- Tipo `Db = pg.PoolClient`: as funções de `server/` recebem `db` e nunca abrem conexão própria.

### Row Level Security

- Função `app_tenant_id()` lê `current_setting('app.current_tenant_id', true)`.
- Toda tabela de negócio tem `tenant_id` e passa por `aplicar_rls('tabela')`: `ENABLE` + `FORCE ROW LEVEL SECURITY`,
  política `tenant_isolation` com `USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id())`
  e índice em `tenant_id`.
- `tenants`: só a própria linha (`id = app_tenant_id()`). `tenant_usuarios`: só vínculos do tenant.
  `usuarios`: só usuários vinculados ao tenant atual. `auth_tokens`: o app enxerga apenas `tipo = 'convite'` do tenant.
- **FKs não passam pelo RLS.** Ao gravar um id vindo do usuário, confirme que ele é visível no tenant antes
  (padrão: `validarReferencias` em `server/eventos.ts`; `definirTemplate` em `server/orcamento.ts`).

### Migrations (`scripts/migrate.mjs`)

- Aplica `db/migrations/*.sql` em ordem alfabética, **uma transação por arquivo**, registrando em `schema_migrations`.
  Com `--seed`, faz o mesmo com `db/seeds/*.sql` em `schema_seeds`.
- Roda automaticamente no `CMD` do contêiner antes do servidor (`node scripts/migrate.mjs && node ./dist/server/entry.mjs`).
- Banco criado antes do sistema de migrations (já tem `tenants`): marca `000_baseline` como aplicada.
- **Nunca edite uma migration já aplicada**; crie a próxima (`014_…`).
- **Compatibilidade com a versão anterior é obrigatória** (blue-green + rollback não desfaz migration): adicionar
  tabela/coluna nullable ou com default é ok; remover/renomear exige dois deploys (código para de usar → migration remove).
- Nova tabela de negócio: `tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE` + `SELECT aplicar_rls('tabela');`.
- Novo padrão de empresa: adicione em `aplicar_padroes_tenant*` (ver abaixo), idempotente (`IF NOT EXISTS`).

---

## Modelo de dados

Todas as PKs são `UUID DEFAULT gen_random_uuid()` (extensões `pgcrypto` e `uuid-ossp`). Datas: `created_at`/`updated_at`
`TIMESTAMP`; `eventos.data_evento` é `DATE` e horários são `TIME`. Unicidade de nomes é por empresa e sem diferenciar
maiúsculas (`UNIQUE (tenant_id, lower(nome))`).

### Visão geral dos relacionamentos

```
tenants 1─N tenant_usuarios N─1 usuarios            (papel + ativo por empresa)
tenants 1─1 configuracoes_tenant                    (parâmetros comerciais)
auth_tokens → usuarios / tenants                    (verificação, reset, link de acesso, convite)

clientes 1─N eventos N─1 status_orcamento           (status = coluna do Kanban)
eventos N─1 tipos_evento / categorias_evento / formatos_servico
categorias_evento N─N tipos_evento                  (categoria_evento_tipos)
eventos 1─N evento_checklist, evento_timeline, formulario_respostas
eventos 1─1 orcamentos 1─N orcamento_versoes        (conteúdo JSONB por versão)
orcamentos N─1 orcamento_templates                  (null = template padrão)

catalogo_secoes 1─N catalogo_itens N─1 categorias_item (principal/secundária), formatos_servico
cardapio_opcoes 1─N cardapio_opcao_secoes N─1 catalogo_secoes
cardapio_opcao_secoes 1─N cardapio_opcao_itens N─1 catalogo_itens
staff_servicos 1─N profissionais
formularios 1─N formulario_respostas → eventos, clientes
```

### SaaS e acesso

**`tenants`** — empresa cliente do SaaS. `nome`, `slug` (UNIQUE), `tipo_pessoa` (PF/PJ), `documento` (CPF/CNPJ,
UNIQUE quando informado: uma empresa por documento), `razao_social`, `email`, `telefone`, `endereco`, `logo_path`,
`segmento`, `porte`, `onboarding_completo`.

**`usuarios`** — conta global (pode pertencer a várias empresas). `nome`, `email` (UNIQUE, também `lower(email)`),
`senha_hash` (bcrypt via pgcrypto), `telefone`, `email_verificado_em`.

**`tenant_usuarios`** — vínculo. PK (`tenant_id`, `usuario_id`), `role` CHECK `owner | admin | usuario`, `ativo`.

**`auth_tokens`** — tokens de uso único. `tipo` CHECK `verificacao_email | reset_senha | convite | link_acesso`,
`token_hash` (SHA-256, UNIQUE), `email`, `usuario_id`, `tenant_id` (convites), `payload` JSONB (convite: `{nome, role}`),
`expira_em`, `usado_em`, `criado_por`. Validades: verificação 24 h, reset 1 h, link de acesso 15 min, convite 7 dias.

**`configuracoes_tenant`** — PK `tenant_id`. `validade_proposta_dias` (5), `criancas_isentas_ate` (5),
`criancas_meia_ate` (11), `local_padrao`, `assinatura_nome/cargo/telefone`, `email_assunto` e `email_corpo` (modelos com
variáveis `{nome_cliente} {evento} {data_evento} {empresa} {valor_total} {versao}`), `kanban_intervalo_meses`
(NULL, 1, 3 ou 6).

### Configurações da empresa

**`status_orcamento`** — **as colunas do Kanban**. `nome`, `variante` CHECK `novo | negociacao | aprovado | recusado`,
`ordem`, `cor`. A variante dá a semântica usada pelo código: `novo` = entrada de pedidos; ao criar o orçamento o evento
vai para o primeiro `negociacao`; dashboard usa `aprovado`/`recusado` para conversão.

**`tipos_evento`** (`nome`, `descricao`) — ex.: Social, Corporativo.
**`categorias_evento`** (`nome`, `descricao`) — ex.: Casamento, Aniversário; ligada a tipos via **`categoria_evento_tipos`**
(`categoria_id`, `tipo_evento_id`, `tenant_id`).
**`formatos_servico`** (`nome`, `descricao`, `ordem`) — Serviço volante, Buffet, Ilhas gastronômicas, Empratado, Coquetel.
**`categorias_item`** (`nome`, `tipo` CHECK `principal | secundaria`, `ordem`) — principal = tipo do alimento
(Salgado, Doce, **Bebida**); secundária = momento (Recepção, Entrada, Prato principal, Sobremesa). Seções cujos itens têm
categoria principal "Bebida" aparecem na aba Bebidas do orçamento.
**`faixas_locacao`** (`min_convidados`, `max_convidados` NULL = sem teto, `valor`, `observacao`) — locação do espaço.

### Cardápio

**`catalogo_secoes`** — `nome`, `descricao`, `ordem`, `preco` (opcional), `unidade_cobranca` (`pessoa | unidade`).
**`catalogo_itens`** — `secao_id` (NOT NULL, CASCADE), `nome` (UNIQUE por seção), `descricao`, `categoria_principal_id`,
`categoria_secundaria_id`, `formato_servico_id`, `custo_unitario`, `preco`, `unidade_cobranca`, `composicao`,
`restricoes TEXT[]` (`vegetariana, vegana, sem_gluten, sem_lactose, alergenicos`), `dados_operacionais TEXT[]`, `ativo`, `ordem`.
**`cardapio_opcoes`** — "opções prontas"/pacotes: `nome`, `descricao`, `preco_por_pessoa`, `duracao_horas`,
`formato_servico_id`, `tags TEXT[]`, `ativo`.
**`cardapio_opcao_secoes`** — seções da opção: `opcao_id`, `secao_id`, `titulo` (nome alternativo), `escolha_qtd`
("escolha N opções"), `preco`, `ordem`.
**`cardapio_opcao_itens`** — `opcao_secao_id`, `item_id`, `preco`, `ordem`; UNIQUE (`opcao_secao_id`, `item_id`).

### Staff

**`staff_servicos`** — função e regra de dimensionamento: `funcao`, `descricao`, `cache_diaria`, `hora_extra`, `auxilio`,
`por_evento`, `quantidade_fixa`, `convidados_por_profissional`, `minimo`, `incluir_por_padrao`, `tags`, `ativo`, `ordem`.
CHECK: precisa ser por evento, proporcional ou ter mínimo.
**`profissionais`** — base de profissionais: `nome`, `email`, `telefone`, `documento` (UNIQUE por empresa), `servico_id`
(especialidade), `chave_pix`, `observacoes`, `ativo`.

### Clientes e eventos

**`clientes`** — `tipo_pessoa` (PF/PJ), `nome`, `email` (UNIQUE por empresa em `lower`), `documento` (UNIQUE por empresa),
`telefone`, `endereco`, `observacoes`.

**`eventos`** — briefing completo e card do Kanban. `cliente_id`, `status_id` (→ `status_orcamento`, RESTRICT), `titulo`
(gerado se vazio: "Categoria – Cliente"), `tipo_evento_id`, `categoria_evento_id`, `formato_servico_id`,
`data_evento DATE`, `hora_inicio`, `hora_fim`, `duracao_evento_horas`, `duracao_alimentacao_horas`, `numero_convidados`,
`perfil_convidados`, `local_tipo` (`casa | externo`), `local_nome`, `endereco`, `infraestrutura`, `verba_total`,
`verba_por_pessoa`, `forma_pagamento`, `qualificacao` (`alta | media | baixa`), `responsavel_nome/email/whatsapp`,
`convite_experiencia`, `estilo_principal`, `estilo_secundario`, `bebidas_alcoolicas`, `bebidas_sem_alcool`,
`restricoes TEXT[]`, `compliance TEXT[]`, `staff_terceiros`, `comentario_cliente`, `origem` (`manual | formulario`),
`criado_por`.

**`evento_checklist`** — `item`, `status` (`pendente | agendado | enviado | concluido`), `prazo`, `ordem`.
**`evento_timeline`** — histórico: `tipo` (`criado, editado, status, checklist, orcamento_criado, orcamento_versao,
pdf_gerado, email_enviado, formulario`), `descricao`, `dados JSONB`, `usuario_id`. Sempre gravar via
`registrarTimeline()` (`server/timeline.ts`).

### Orçamento e proposta

**`orcamentos`** — um por evento (`evento_id` UNIQUE NOT NULL, **sem CASCADE**: `excluirEvento` apaga o orçamento antes).
`versao_atual`, `valor_total` (espelho do total da versão atual), `template_id` (NULL = template padrão),
`mostrar_valor_total`, `data_vencimento`.

**`orcamento_versoes`** — `orcamento_id`, `numero` (UNIQUE por orçamento), `conteudo JSONB` (ver abaixo), `valor_total`,
`congelada`, `criado_por`, `pdf_path`, `pdf_gerado_em`, `enviado_em`, `enviado_para`. Índice parcial garante **uma única
versão não congelada** por orçamento.

**`orcamento_templates`** — visual do PDF: `nome`, `descricao`, `tags`, `padrao` (índice parcial: um padrão por empresa),
`fonte_titulo`, `fonte_corpo`, `cor_texto_primaria`, `cor_texto_secundaria`, `cor_fundo`, `logo_path`,
`capa_ativa`, `capa_imagem_path`, `capa_titulo`, `capa_conteudo`, `miolo_imagem_path`, `miolo_titulo`,
`miolo_introducao`, `rodape_logo_path`, `rodape_titulo`, `rodape_conteudo`, `contracapa_ativa`,
`contracapa_imagem_path`, `contracapa_titulo`, `contracapa_conteudo`.

**`orcamento_blocos_info`** — blocos de texto reutilizáveis: `chave` (UNIQUE por empresa), `titulo`, `pagina`
(`cardapio | bebidas | staff | informacoes | condicoes`), `texto` (marcação: `## Subtítulo`, `- item`, `**negrito**`,
linha em branco separa parágrafos → `lib/texto.ts`), `ativo_por_padrao`, `ordem`.

#### `orcamento_versoes.conteudo` (tipo `ConteudoOrcamento` em `lib/calculo/orcamento.ts`)

```jsonc
{
  "cabecalho": { "evento", "cliente", "contato", "telefone", "data_evento", "horario", "local",
                 "formato_servico", "duracao_evento", "duracao_alimentacao" },   // derivado do evento
  "pagantes": { "convidados", "criancas_meia", "criancas_isentas" },
  "cardapios": [{ "key", "opcao_id", "nome", "preco_base", "preco_pp_manual", "subtotal_manual",
                  "secoes": [{ "key", "secao_id", "nome", "escolha_qtd", "preco_catalogo", "preco_manual",
                               "itens": [{ "key", "item_id", "nome", "descricao", "selecionado",
                                           "preco_catalogo", "preco_manual", "restricoes": [] }] }] }],
  "bebidas": [{ "key", "ref_id", "nome", "descricao", "unidade": "pessoa|unidade", "quantidade",
                "preco_catalogo", "preco_manual", "subtotal_manual" }],
  "staff": [{ "key", "servico_id", "funcao", "regra": { RegraStaff }, "quantidade_manual", "valor_unit_manual" }],
  "locacao": { "incluir", "faixa_id", "descricao", "valor_manual" },
  "extras": [{ "key", "descricao", "quantidade", "valor_unit" }],
  "informacoes_complementares": [BlocoInfo], "condicoes_gerais": [BlocoInfo],   // linhas label/valor, algumas "auto"
  "blocos_texto": [{ "key", "bloco_id", "titulo", "texto", "pagina" }],          // cópia do cadastro de blocos
  "total_manual": null, "mostrar_valor_total": true, "observacoes": null,
  "totais": { "alimentos", "bebidas", "staff", "locacao", "extras", "total_calc", "total", "pagantes_equivalentes" }
}
```

Campos `*_calc` e `totais` são recalculados; `*_catalogo` são snapshots do preço no momento da inclusão; `*_manual`
são sobrescritas do usuário. O conteúdo é validado/normalizado por `conteudoSchema` (`server/orcamento.ts`), que aceita
conteúdo antigo ou parcial preenchendo padrões.

### Formulários de captação

**`formularios`** — `nome`, `descricao`, `slug` (**UNIQUE global**, regex `^[a-z0-9]+(-[a-z0-9]+)*$`; a página pública
`/f/<slug>` descobre o tenant pelo slug), `ativo`, `config JSONB` (só os ajustes sobre o modelo), `mensagem_sucesso`.
**`formulario_respostas`** — `formulario_id`, `evento_id`, `cliente_id`, `dados JSONB` (snapshot legível
`[{secao, chave, rotulo, valor}]`), `ip`.

### Funções SQL

| Função | O que faz |
|---|---|
| `app_tenant_id()` | tenant da transação (base de todas as políticas) |
| `aplicar_rls(tabela)` | RLS forçado + política `tenant_isolation` + índice em `tenant_id` |
| `aplicar_padroes_tenant(id)` | `configuracoes_tenant`, 4 status do Kanban, tipos Social/Corporativo, 5 formatos, categorias de item, 4 faixas de locação |
| `aplicar_padroes_tenant_proposta(id)` | template padrão + blocos Crianças, Hora adicional, Formas de pagamento |
| `aplicar_padroes_formulario(id)` | formulário "Formulário de contato" com slug `contato-xxxxxx` |
| `aplicar_padroes_tenant_completo(id)` | chama as três acima; usado no cadastro de empresa nova |

### Histórico das migrations

| Arquivo | Mudança |
|---|---|
| `000_baseline` | schema original multi-tenant (UUID), RLS inicial |
| `001_seguranca_rls` | `app_tenant_id()`, RLS forçado com WITH CHECK em tudo, RLS nas tabelas SaaS |
| `002_clientes` | PF/PJ, documento, endereço, unicidades por empresa |
| `003_saas_auth` | `aplicar_rls()`, dados da empresa, papéis owner/admin/usuario, `ativo`, `auth_tokens` |
| `004_configuracoes` | status do orçamento vira coluna do Kanban (`eventos.status_id`), remove `pipeline_colunas`; formatos, categorias de item, faixas de locação, `configuracoes_tenant`, `aplicar_padroes_tenant` |
| `005_cardapio` | seções/itens com preço, categorias e restrições; `orcamento_opcoes` → `cardapio_opcoes` normalizado |
| `006_staff` | `staff_servicos`, `profissionais` |
| `007_eventos` | briefing completo, `data_evento` DATE + horas, checklist, timeline; remove cardápio/equipe por evento |
| `008_orcamento_versoes` | versões numeradas com snapshot JSONB; status sai do orçamento |
| `009_templates_blocos` | template redesenhado (imagens como path, textos de capa/miolo/rodapé/contracapa), blocos com `pagina` e `texto` |
| `010_indices_agenda_dashboard` | índices por data, criação e envio |
| `011_formularios` | formulários públicos e respostas |
| `012_kanban_intervalo` | `kanban_intervalo_meses` |
| `013_auth_autoatendimento` | token `link_acesso`, `usuarios.telefone`, documento de tenant único |

### Seeds (somente dev, `--seed`)

`001` tenant Banket + usuários · `002` tenant "Outro Buffet" (isolamento) · `003` ajuste de tipos/categorias demo ·
`004` catálogo e opções a partir de `public/ref` · `005` staff e profissionais · `006` eventos demo · `007` template e
blocos no estilo dos PDFs de referência · `008` usuário `operacao@` (papel usuario). `_legacy_*` são ignorados.

---

## Autenticação, sessão e autorização

### Sessão
- Cookie `banket_session` (httpOnly, `sameSite=lax`, `secure` em produção), JWT HS256 de **7 dias** com
  `sub`, `nome`, `email`, `tenant_id`, `role`. `JWT_SECRET` obrigatório, mínimo 32 caracteres.
- A cada requisição o middleware chama `getMembership(usuario, tenant)` (conexão de sistema, cache de 30 s): se o vínculo
  foi desativado/removido, a sessão cai na hora; o papel e o nome vêm do banco, não do JWT. Após mudar papel/ativo,
  chame `invalidateMembership()`.
- Usuário com várias empresas troca a ativa por `POST /api/sessao/empresa` (reemite o JWT); lista em `empresasDoUsuario`.

### Middleware (`src/middleware.ts`)
- Públicas: `/auth/*`, `/f/*`, `/api/public/*`, `/print/*` (exige print token), `/_astro/*`, `/_image`, `/api/health` e
  estáticos de `/public`. **`/uploads/*` é sempre protegido** e só serve arquivos do tenant da sessão.
- Sem sessão: páginas redirecionam para `/auth/login?next=…`; `/api/*` responde 401 JSON.
- `/configuracoes*` e `/api/configuracoes*`: só `owner` e `admin` (403 / redirect para o dashboard).
- Cabeçalhos: `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options: SAMEORIGIN`
  (exceto `/f/*`, que pode ser incorporado no site do buffet), HSTS em produção.
- CSRF: `security.checkOrigin` do Astro; `allowedDomains` confia no `X-Forwarded-*` só para `app.banket.com.br` e localhost.

### Papéis
| Papel | Rótulo | Pode |
|---|---|---|
| `owner` | Proprietário | tudo, inclusive gerenciar/convidar proprietários |
| `admin` | Administrador | Configurações, usuários (exceto proprietários) |
| `usuario` | Usuário | operação do dia a dia, sem Configurações |

Regras em `server/usuarios.ts`: ninguém altera o próprio papel nem se desativa/remove; a empresa sempre mantém pelo menos
um owner ativo; remover um membro apaga só o vínculo (a conta pode pertencer a outras empresas).

### Autoatendimento (`server/autoatendimento.ts`, conexão de sistema)
1. **Cadastro** (`/auth/cadastro`): nome+sobrenome, e-mail, senha (política: 8–128 caracteres, letras, números e símbolo),
   aceite de termos. Cadastro não confirmado anterior é sobrescrito. Envia e-mail de verificação (24 h).
2. **Verificação** (`/auth/verificar?token=`): marca `email_verificado_em`; se já tem empresa, entra; senão emite o cookie
   `banket_onboarding` (JWT 2 h, `path=/auth`) e leva a `/auth/cadastro-complemento`.
3. **Empresa nova**: PF (CPF) ou PJ (CNPJ + razão social), celular, endereço. CPF/CNPJ validados e únicos entre empresas
   (quem já tem empresa entra por convite). Cria o tenant com slug único, aplica `aplicar_padroes_tenant_completo`,
   preenche a assinatura e vincula como `owner`.
4. **Login** (`/auth/login`): senha checada no Postgres (`crypt`). Resultados: sessão, onboarding, e-mail não verificado
   (`/auth/validacao` reenvia) ou inválido.
5. **Recuperação de senha** (`/auth/recuperacao` → `/auth/redefinir`, 1 h) e **link de acesso sem senha**
   (`/auth/link-acesso` → `/auth/entrar`, 15 min). Nenhum desses fluxos revela se o e-mail existe.
6. **Convite** (Configurações › Usuários): token de 7 dias; aceite em `/auth/cadastro-convidado` (`server/convites.ts`).

Tokens: 32 bytes aleatórios em base64url; só o SHA-256 é gravado; emitir um token invalida os anteriores do mesmo tipo.

### Limites de tentativas (`lib/rateLimit.ts`, memória, por instância)
| Fluxo | Limite |
|---|---|
| Login | 10 senhas erradas / 15 min por IP+e-mail; 30 / 15 min por IP (acertos não contam e zeram) |
| Cadastro | 20 / hora por IP |
| Recuperação e link de acesso | 10 / hora por IP e 3 / 15 min por e-mail |
| Reenvio de verificação | 3 / 15 min por IP+e-mail |
| Formulário público | 5 envios / 10 min por slug+IP, mais honeypot `_website` |

O IP vem de `X-Real-IP` ou do **último** item de `X-Forwarded-For` (os primeiros podem ser forjados).

---

## Funcionalidades (módulos e rotas)

Navegação lateral (`components/Sidebar.astro`): Dashboard, Quadro de vendas, Cardápios, Clientes, Agenda, Formulários,
Staff, Templates, Configurações (só admin).

### Dashboard — `/dashboard` (`server/dashboard.ts`)
Indicadores por período de entrada do pedido (30, 90, 365 dias ou tudo): eventos e valor por status, pedidos recebidos,
pipeline em negociação, aprovados, recusados, taxa de conversão, ticket médio, próximos eventos e **orçamentos parados**
(enviados há mais de 7 dias sem mudança). Valor do evento = total da versão atual do orçamento. Também mostra
"primeiros passos" para empresas novas.

### Quadro de vendas (eventos) — `/eventos` (`server/eventos.ts`)
- Kanban com colunas = `status_orcamento` (arrastar e soltar → `PATCH /api/eventos/:id/status`, registra na timeline)
  e visão em lista paginada. Filtros: busca (título, cliente, responsável, local), período, tipo, formato, status.
- Intervalo de trabalho do Kanban (`kanban_intervalo_meses`): hoje até +N meses, eventos sem data sempre aparecem;
  datas escolhidas no filtro substituem o intervalo. Datas relativas usam `America/Sao_Paulo`.
- Exportação CSV (`/eventos/exportar`, separador `;` para o Excel em português).
- Evento (`/eventos/novo`, `/eventos/:id`, `/editar`): briefing completo, cliente existente ou novo no mesmo formulário.
  Abas do `EventoLayout`: resumo, **Orçamento**, Informações complementares, Condições gerais, Linha do tempo.
- Checklist operacional por evento (degustação, laudos, documentos) com status e prazo.
- Mudanças relevantes (data, convidados, cliente, status) vão para a linha do tempo.

### Orçamento — `/eventos/:id/orcamento` (`server/orcamento.ts`, `lib/calculo/orcamento.ts`, `components/orcamento/*`)
- Criar o orçamento gera a **versão 01** com conteúdo inicial (staff marcado como padrão, blocos ativos por padrão,
  locação pela faixa) e move o evento de `novo` para o primeiro status `negociacao`.
- Construtor Preact (`OrcamentoBuilder`) com seções: Cardápios (a partir de opções prontas ou do catálogo, itens
  selecionáveis, preços manuais), Bebidas, Staff, Locação e extras, Textos da proposta (blocos). Salvamento automático
  parcial via `PUT /api/orcamentos/:eventoId/versoes/:numero`; o servidor mescla só as partes editáveis, **recalcula** e
  devolve o conteúdo.
- **Versionamento**: só a versão não congelada é editável; "Criar nova versão" congela a atual e abre `n+1`
  (também serve para restaurar uma versão antiga como nova). A versão em edição acompanha os dados atuais do evento
  (cabeçalho, convidados); versões congeladas preservam o que foi proposto e reaproveitam o PDF já gerado.
- Template da proposta por orçamento (`definirTemplate`; vazio = padrão da empresa).

**Regras de cálculo (função pura, mesmo código no navegador e no servidor):**
- Valor efetivo em todos os níveis = `manual ?? calculado`.
- Pagantes equivalentes = convidados − isentas − meia + meia × 0,5.
- Preço de uma seção = preço manual, senão preço do catálogo da seção, senão soma dos itens selecionados.
- Cardápio: preço por pessoa = `preco_base` da opção + soma das seções; subtotal = pp × pagantes equivalentes.
- Bebida: unitário × pagantes equivalentes (`pessoa`) ou × quantidade (`unidade`).
- Staff: quantidade = `quantidade_fixa` se por evento, senão `max(minimo, ceil(convidados / convidados_por_profissional))`;
  unitário = cachê/diária + auxílio.
- Locação: faixa que contém o nº de convidados (se `incluir`).
- Total = alimentos + bebidas + staff + locação + extras (ou `total_manual`). Arredondamento a centavos.
- Blocos automáticos em Informações complementares: equipe (linhas por função) e contagem de opções por restrição
  alimentar; viram manuais quando o usuário edita.

### PDF da proposta (`server/pdf.ts`, `server/proposta.ts`, `components/proposta/Proposta.astro`)
- `GET /eventos/:id/orcamento/pdf[?versao=n][&ver=1]` baixa (ou abre) o PDF.
- Um Chromium compartilhado (lançado sob demanda, `--no-sandbox`) abre `http://127.0.0.1:$PORT/print/orcamento/:versaoId`
  com `?parte=capa|miolo|contracapa&token=<print token 5 min>`; cada parte vira um PDF A4 e o **pdf-lib** junta.
  Capa e contracapa só entram se ativas no template.
- As imagens do template/empresa são embutidas como data URI (a página de impressão não tem sessão).
- PDF salvo em `{UPLOAD_DIR}/{tenant}/orcamentos/{eventoId}/v{n}.pdf`; registra `pdf_gerado` na timeline.
- `/templates/:id/exemplo` gera um PDF com conteúdo fictício para conferir o visual.
- O Dockerfile instala `chromium` e fontes Noto (acentuação/emoji); `CHROMIUM_PATH=/usr/bin/chromium-browser`.

### Envio da proposta (`server/envio.ts`)
Rascunho com destinatário (responsável do evento ou e-mail do cliente), assunto e corpo do modelo da empresa com
variáveis substituídas. Até 5 destinatários, PDF anexado, `reply-to` = e-mail do usuário. Grava `enviado_em`/
`enviado_para` na versão e `email_enviado` na timeline.

### Cardápios — `/cardapio/itens`, `/cardapio/sessoes`, `/cardapio/opcoes` (`server/cardapio.ts`)
Catálogo de seções e itens (preço, unidade de cobrança, custo, categorias principal/secundária, formato, composição,
restrições, dados operacionais, ativo). Opções prontas (pacotes) editadas numa ilha Preact (`OpcaoEditor`) via
`/api/cardapio/opcoes[/:id]` (GET, POST cria/duplica, PUT, DELETE).

### Clientes — `/clientes`, `/clientes/:id` (`server/clientes.ts`)
Cadastro PF/PJ com CPF/CNPJ validado, e-mail e documento únicos por empresa, histórico de eventos do cliente.

### Agenda — `/agenda` (`server/agenda.ts`)
Eventos com data, por mês ou semana, coloridos pela cor do status; filtro por variante de status.

### Formulários — `/formularios`, `/formularios/:id`, `/formularios/:id/respostas`, público `/f/:slug`
- Modelo fixo em `lib/formularios/modelo.ts` (seções de boas-vindas, local, dimensionamento B2B/B2C, gastronomia &
  experiência, detalhes finais; fluxos `todos | B2B | B2C`; perguntas condicionais `mostrarSe`; perguntas "travadas").
  No banco só ficam os ajustes (`config`): seções/perguntas ativas, obrigatoriedade, ordem e perguntas personalizadas.
- Editor Preact (`FormularioEditor`) via `/api/formularios/:id` (GET, PUT, DELETE, POST duplica — a cópia nasce inativa).
- Envio público (`POST /api/public/formularios/:slug`): resolve o tenant pelo slug (sistema), valida contra a
  configuração atual e, dentro de `withTenant`: reaproveita o cliente pelo e-mail (ou cria, PJ se B2B), converte as
  respostas no briefing (tipo, categoria, formato por nome), cria o evento com `origem = 'formulario'` no status de
  entrada e grava o snapshot em `formulario_respostas`.

### Staff — `/staff/profissionais`, `/staff/servicos` (`server/staff.ts`)
Serviços/funções com custo e regra de dimensionamento (usados no orçamento) e base de profissionais com especialidade,
documento, Pix.

### Templates — `/templates`, `/templates/novo`, `/templates/:id`, `/templates/blocos` (`server/templates.ts`)
Templates visuais (fontes da lista `FONTES`, cores, imagens de capa/miolo/contracapa/logos, textos), duplicar, definir
padrão, PDF de exemplo. O card "Identidade visual" reúne logo, fontes e cores; cada linha tem um botão de IA e as cores
têm "Capturar cores do logo" (`POST /api/templates/sugestao` → `server/identidadeVisual.ts`, OpenAI com o logo
convertido em PNG no navegador; 40 pedidos / 10 min por empresa). Blocos de informação por página da proposta, com marcação simples.

### Configurações (owner/admin) — `/configuracoes/*` (`server/configuracoes.ts`, `server/empresa.ts`, `server/usuarios.ts`)
Usuários e convites · Tipos de evento · Categorias (com toggles de tipo via `/api/configuracoes/categorias/tipos`) ·
Status de orçamento (colunas do Kanban: nome, variante, cor, ordem, intervalo do Kanban) · Formatos de serviço ·
Locação (faixas) · Empresa (dados cadastrais, logo, validade da proposta, faixas de crianças, local padrão, assinatura,
modelo de e-mail).

### Uploads (`lib/storage.ts`, `pages/uploads/[...path].ts`)
Disco em `{UPLOAD_DIR}/{tenantId}/{pasta}/{uuid}.{ext}` (volume Docker `/data/uploads`). Imagens PNG/JPEG/WebP/SVG até
5 MB por padrão. `resolveKey` impede sair da pasta do tenant. Servidos em `/uploads/{tenantId}/…` apenas para a sessão
do mesmo tenant (`Cache-Control: private`). Interface pensada para trocar por S3.

### E-mail (`lib/mail.ts`, `server/emails.ts`)
`sendMail` usa `https://api.resend.com/emails` com `RESEND_API_KEY`/`MAIL_FROM`; sem chave, registra no log e retorna
`delivered: false`. E-mails transacionais usam `emailLayout` (título, parágrafos, botão, rodapé). Links usam `APP_URL`.

### Health check
`GET /api/health` → `{status:'ok'}` ou 503 se o banco não responde (usado no deploy).

---

## Padrões de código

- **Toda consulta de dados de empresa passa por `withTenant(tenantId, db => …)`**; `tenantId` vem de
  `Astro.locals.user.tenantId`. Nunca filtre por `tenant_id` "na mão" como substituto do RLS; em INSERT, grave
  `tenant_id` explicitamente (o `WITH CHECK` confere).
- Regras de negócio em `src/server/<dominio>.ts`, recebendo `db: Db` (e `user`/`tenantId` quando precisa gravar).
  Páginas só orquestram: validam com o schema zod do módulo, chamam o servidor e redirecionam.
- Formulários HTML: POST na própria página → `setFlash` → `Astro.redirect` para a mesma URL (ou `handleFormPost`
  de `lib/actions.ts`). Campo `_action` diferencia ações (ex.: `delete`); `id` vazio = criação.
- Endpoints JSON para ilhas: `jsonEndpoint` (erros viram 400 `{error}`) e `readJson`.
- Erros para o usuário: lance `UserError('mensagem')`; `userMessage()` traduz zod e códigos do Postgres
  (`23505` duplicado, `23503` em uso, `22P02` id inválido) e loga o resto.
- Validação com zod usando os preprocessadores de `lib/forms.ts` (`optionalText`, `optionalMoney`, `checkbox`,
  `stringArray`, `tagList`…). Dinheiro no formato brasileiro via `lib/money.ts`.
- HTML fora de template Astro: use `html``…`` / `escapeHtml` de `lib/html.ts`; textos de blocos via `renderTexto`.
- Listagens: `pageParams`/`pageInfo`/`searchTerm` (`?q=&page=`, 20 por página).
- Funções puras que rodam no navegador (cálculo, modelo de formulário, money) não podem importar `db` nem Node.
- Toda ação relevante sobre um evento registra na timeline (`registrarTimeline`).
- Unitários ficam ao lado do código (`*.test.ts`); fluxos de ponta a ponta em `tests/e2e/*.spec.ts`
  (agenda-dashboard, autoatendimento, cardápio, eventos, formulários, orçamento, segurança, staff, templates).
  Os e2e usam os seeds, rodam em série (`workers: 1`) e limpam o que criam.

---

## Variáveis de ambiente

| Variável | Uso |
|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | dono das tabelas (`banket_user` / `banket_db`) |
| `APP_DB_USER` / `APP_DB_PASSWORD` | papel da aplicação sujeito ao RLS (`banket_app`) |
| `DATABASE_URL` / `DATABASE_URL_SYSTEM` | montadas pelo compose; defina à mão só fora do Docker |
| `JWT_SECRET` | sessão, onboarding e print token (≥ 32 caracteres, obrigatório) |
| `APP_URL` | URL pública nos links de e-mail |
| `RESEND_API_KEY` / `MAIL_FROM` | e-mail; **obrigatório em produção** |
| `OPENAI_TOKEN` / `OPENAI_MODEL` | sugestões de fontes/cores do template por IA (`lib/openai.ts`; modelo padrão `gpt-4.1-mini`) |
| `UPLOAD_DIR` | uploads e PDFs (`/data/uploads` no contêiner) |
| `APP_PORT_BLUE` / `APP_PORT_GREEN` | portas do host em produção (5168 / 5169) |
| `CHROMIUM_PATH`, `PORT`, `HOST` | definidos no Dockerfile |

---

## Infraestrutura e deploy

- **Dev** (`docker-compose.yml` + `docker-compose.dev.yml`): `webapp` no estágio `builder`, bind mount do código,
  `migrate --seed` + `astro dev` com polling; Postgres exposto em `5432`.
- **Produção** (`docker-compose.prod.yml`, projeto `name: banket`): `webapp_blue` (`127.0.0.1:5168`) e `webapp_green`
  (`127.0.0.1:5169`) com a mesma imagem, mesmo Postgres (sem porta publicada) e mesmo volume de uploads
  (`banket_postgres_data`, `banket_uploads_data`). Contêineres: `banket-webapp_blue-1`, `banket-webapp_green-1`,
  `banket-postgres-1`.
- **Nginx no host**: `/etc/nginx/sites-enabled/app.banket.com.br.conf` faz proxy para o upstream `banket_app`, definido em
  `/etc/nginx/conf.d/banket-upstream.conf` (reescrito a cada deploy). HTTPS via Certbot. `client_max_body_size 20m`.
- **Blue-green** (`scripts/deploy-remoto.sh`): constrói e sobe a cor inativa, espera responder, troca o upstream,
  `nginx -t` + reload, drena 15 s e **para** (não remove) a cor antiga. Se a nova não subir, nada muda. A cor ativa fica em
  `.deploy-ativo` (fora do git). `--rollback` religa a cor anterior.
- **Fluxo**: no Mac, `git push` + `make deploy` (`scripts/deploy.sh`: recusa commits não enviados, valida build e testes
  numa cópia limpa, roda o blue-green na VPS por SSH em `synka-main:/var/www/banket` e confere a URL). Na VPS,
  `make deploy` faz `git pull --ff-only` + blue-green; também `make rollback | status | logs | psql`.
- Até setembro/2026 o código de produção ficava em `/opt/banket.application`; foi padronizado para `/var/www/banket`
  (commit `7630ceb`). Os volumes não mudaram porque o compose fixa `name: banket`.
- `psql` em produção: `docker compose -f docker-compose.prod.yml exec postgres psql -U banket_user banket_db`.

---

## Armadilhas conhecidas

- Esquecer `withTenant` (ou usar `systemQuery` em fluxo com empresa) quebra o isolamento: o papel de sistema ignora RLS.
- IDs vindos do cliente em FKs precisam ser validados no tenant (FK não respeita RLS).
- `orcamentos.evento_id` não tem `ON DELETE CASCADE`; excluir evento passa por `excluirEvento`.
- Rate limit, cache de membership e cache de empresas são **em memória por instância**: durante a troca blue-green
  e com mais réplicas os contadores não são compartilhados.
- Migrations rodam na subida da cor nova enquanto a antiga ainda atende: mantenha compatibilidade retroativa.
- O servidor sempre recalcula o orçamento; não confie em totais enviados pelo navegador.
- Versão congelada não aceita edição (`salvarVersao` recusa); só uma versão aberta por orçamento (índice parcial).
- O Chromium do PDF acessa o próprio app em `127.0.0.1:$PORT`; a página `/print/*` precisa funcionar sem sessão.
