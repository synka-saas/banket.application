# Banket — Sistema de gestão para buffets

SaaS multi-empresa (multi-tenant) para buffets e casas de eventos. Cobre a captação do pedido (formulário público ou
cadastro manual), o quadro de vendas (Kanban), o orçamento versionado montado a partir do catálogo (cardápios,
bebidas, staff, locação por espaço), a geração do PDF da proposta, o envio por e-mail com as respostas do cliente no
Inbox, a lista de compras por evento, a agenda com reuniões no Google Meet, o dashboard, os espaços de eventos e a gestão
da equipe.

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
| Sessão | JWT HS256 com `jose`, em cookie httpOnly; login por senha, link de acesso ou **Google** (OAuth 2.0) |
| Google | Login (OpenID Connect) e **Calendar API** (reuniões com sala do Google Meet) só com `fetch`, em `lib/google.ts` |
| Senhas | `pgcrypto`: `crypt(senha, gen_salt('bf'))` (bcrypt no próprio Postgres) |
| PDF | **Chromium** via `playwright-core` + **pdf-lib** para juntar capa/miolo/contracapa |
| E-mail | API HTTP do **Resend** (sem chave, o e-mail vai para o log) |
| Interface | CSS escrito à mão sobre os tokens do **design system** (`design-system/` → `src/styles/tokens.css`); fonte **General Sans** servida de `/public/fonts`; ícones **Tabler** em linha |
| Testes | **Vitest** (unitários em `src/**/*.test.ts`) e **Playwright** (e2e em `tests/e2e`) |
| Infra | Docker Compose; Nginx no host; deploy blue-green |
| Node | >= 22.12 |

Ícones: somente **Tabler Icons** (outline), desenhados em linha por `components/ui/Icon.astro` e `Icon.tsx` a partir de
`lib/icones.ts`. Visual, tokens e componentes: ver [Design system](#design-system-interface).

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
    membership.ts      confere vínculo usuário↔empresa e o status da empresa a cada request (cache 30 s)
    hwesta/            integração com o Manager Hwesta (HCP v1): núcleo genérico + adapter.ts do Banket
    printToken.ts      JWT de 5 min para o Chromium abrir /print/*
    tokens.ts          tokens aleatórios de uso único (só o SHA-256 vai ao banco)
    rateLimit.ts       limite por janela fixa em memória + IP real atrás do Nginx
    senha.ts           política de senha
    cripto.ts          AES-256-GCM com chave derivada do JWT_SECRET (tokens OAuth do Google guardados cifrados)
    google.ts          OAuth do Google (state assinado + nonce), perfil, renovação de token e Calendar API (evento + Meet)
    storage.ts         arquivos em disco particionados por tenant
    mail.ts            envio via Resend / log em dev; appUrl(); remetente com nome de exibição, Reply-To e cabeçalhos
    resendReceiving.ts leitura de e-mails recebidos (Receiving API do Resend: corpo, cabeçalhos, anexos); injetável
    resendWebhook.ts   verificação da assinatura Svix dos webhooks do Resend (node:crypto)
    openai.ts          chamada à OpenAI (Chat Completions) com imagem e resposta JSON estruturada
    forms.ts           FormData → objeto, preprocessadores zod, UserError, tradução de erros do Postgres
    actions.ts         handleFormPost (POST → redirect → GET com flash)
    api.ts             jsonEndpoint / readJson para endpoints JSON
    flash.ts           mensagens que sobrevivem ao redirect (cookie banket_flash)
    html.ts            escapeHtml + template tag html`` para montar células de tabela com segurança
    icones.ts          ícones Tabler (miolo dos SVGs) + svgIcone() para scripts de navegador
    texto.ts           marcação simples dos blocos da proposta e dos documentos → HTML seguro
    extenso.ts         números, valores e datas por extenso (documentos)
    editorTexto.ts     barra de formatação do editor de documentos (aplica a marcação na seleção; navegador)
    documentos/        variáveis dos modelos de documento ({cliente}, {data_evento_extenso}…) e campos extras (puro)
    money.ts datas.ts documento.ts pagination.ts nav.ts
    calculo/           cálculo PURO do orçamento e do staff (roda no navegador e no servidor)
    formularios/       modelo do formulário de captação (compartilhado servidor/ilha/página pública)
  server/              regras de negócio por domínio; recebem `db` já dentro de withTenant
    espacos.ts         espaços de eventos (próprios/terceiros) e faixas de locação por espaço
    emailModelos.ts    modelos de e-mail (assunto/corpo com variáveis) e aplicarVariaveis
    emailTexto.ts      listaEmails, mensagemHtml (texto → HTML de e-mail), enderecoPuro
    conversas.ts       Inbox: conversas/mensagens por evento, envio dentro da conversa, permissões por papel
    inbox/receber.ts   processamento dos webhooks do Resend (e-mail recebido, status de entrega), idempotência
    documentos.ts      modelos de documento (contratos), geração por evento com numeração, PDF, envio pelo Inbox
    googleConta.ts     conta Google do usuário (login, vínculo, agenda ativa, access token renovado); conexão de sistema
    reunioes.ts        reuniões agendadas na agenda Google do organizador (Meet + convites), por evento ou avulsas
  pages/               rotas Astro (SSR); POST de formulário na própria página
  pages/api/           endpoints JSON usados pelas ilhas Preact; api/webhooks/resend.ts recebe o webhook do Resend
  pages/print/         páginas de impressão da proposta e dos documentos (só com print token)
  components/          ui/ (Button, Table, Drawer, Toast…), ilhas Preact (orcamento/ — inclui ListaCompras —, cardapio/,
                       formularios/), reunioes/ReuniaoDrawer.astro (agendar/editar reunião),
                       proposta/Proposta.astro (layout impresso), eventos/, templates/, espacos/ (drawer),
                       inbox/Conversa.astro (thread de e-mails com resposta), documentos/ (ModeloForm: editor com barra
                       de formatação e prévia; DocumentoImpresso: página de impressão do documento)
  layouts/             Layout, AppLayout (sidebar+topbar), AuthLayout, EventoLayout (abas do evento), FormularioLayout
  styles/              tokens.css (tokens do design system + @font-face), global.css (base e classes utilitárias),
                       orcamento.css, editor.css, formularios.css (ilhas Preact), inbox.css (thread e lista do Inbox)
db/migrations/         NNN_nome.sql, aplicadas em ordem
db/seeds/              dados de demonstração (só com --seed); arquivos com "_" no início são ignorados
scripts/               migrate.mjs, deploy.sh (Mac), deploy-remoto.sh (VPS), screenshots.mjs
tests/e2e/             Playwright (helpers.ts: login, leitura de links de e-mail no log do contêiner)
public/ref/            PDFs de cardápios de referência (Brunch, Buffet, Boteco, Empratado) que originaram os seeds
public/fonts/          General Sans (woff2, pesos 300–700 + itálicos); logos em public/logo-{dark,light,mark}.png
design-system/         fonte de verdade do visual: readme.md (fundamentos), tokens/, components/ (especificação em
                       React + CSS .bk-*), ui_kits/banket-app (telas de referência), guidelines/. Não entra no build.
site/                  site institucional (https://banket.com.br): HTML estático de página única (index.html), servido
                       direto pelo Nginx. Não entra no build do app. Ver "Site institucional" em Infraestrutura e deploy.
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
`criancas_meia_ate` (11), `espaco_padrao_id` (→ `espacos`, pré-selecionado em eventos novos e no formulário público),
`assinatura_nome/cargo/telefone`, `kanban_intervalo_meses` (NULL, 1, 3 ou 6). `local_padrao`, `email_assunto` e
`email_corpo` ficaram **sem uso** (substituídos por `espaco_padrao_id` e por `email_modelos`; remover num deploy futuro).

**`email_modelos`** — modelos de e-mail (Configurações › Modelos de e-mail): `nome` (UNIQUE por empresa), `assunto`,
`corpo` (variáveis `{nome_cliente} {evento} {data_evento} {empresa} {valor_total} {versao}`), `padrao` (índice parcial:
um padrão por empresa), `ativo`, `ordem`. O padrão preenche o drawer de envio da proposta; qualquer modelo ativo pode
ser escolhido no envio, na resposta do Inbox e na mensagem nova.

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
**`espacos`** — locais onde os eventos acontecem (menu Espaços, todos os usuários). `nome` (UNIQUE por empresa), `tipo`
CHECK `proprio | terceiro`, `descricao`, `endereco`, `cidade`, `capacidade_min/max`, `contato_nome/telefone/email` e
`valor_referencia` (só terceiros: locação sugerida), `observacoes`, `ativo`, `ordem`. Próprio = locação calculada pelas
faixas; terceiro = valor de referência. Não pode ser excluído enquanto houver eventos nele (desative).
**`faixas_locacao`** (`espaco_id` → `espacos` CASCADE, `min_convidados`, `max_convidados` NULL = sem teto, `valor`,
`observacao`) — locação de um espaço **próprio** por faixa de convidados, sem sobreposição dentro do espaço. Faixas
antigas sem `espaco_id` contam como do espaço padrão (`COALESCE` nas leituras).

### Cardápio

**`catalogo_secoes`** — `nome`, `descricao`, `ordem`, `preco` (opcional), `unidade_cobranca` (`pessoa | unidade`).
**`catalogo_itens`** — `secao_id` (NOT NULL, CASCADE), `nome` (UNIQUE por seção), `descricao`, `categoria_principal_id`,
`categoria_secundaria_id`, `formato_servico_id`, `custo_unitario`, `preco`, `unidade_cobranca`, `composicao`,
`restricoes TEXT[]` (`vegetariana, vegana, sem_gluten, sem_lactose, alergenicos`), `dados_operacionais TEXT[]`, `ativo`, `ordem`,
**`porcao_qtd`** + **`porcao_unidade`** (`g | kg | ml | l | un`): porção por pessoa, base da lista de compras do orçamento.
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
`perfil_convidados`, `espaco_id` (→ `espacos`, SET NULL), `local_tipo` (`casa | externo`, derivado do espaço: próprio =
casa), `local_nome` (espelho do nome do espaço, ou texto livre em "Outro local"), `endereco`, `infraestrutura`, `verba_total`,
`verba_por_pessoa`, `forma_pagamento`, `qualificacao` (`alta | media | baixa`), `responsavel_nome/email/whatsapp`,
`convite_experiencia`, `estilo_principal`, `estilo_secundario`, `bebidas_alcoolicas`, `bebidas_sem_alcool`,
`restricoes TEXT[]`, `compliance TEXT[]`, `staff_terceiros`, `comentario_cliente`, `origem` (`manual | formulario`),
`criado_por`.

**`evento_checklist`** — `item`, `status` (`pendente | agendado | enviado | concluido`), `prazo`, `ordem`.
**`evento_timeline`** — histórico: `tipo` (`criado, editado, status, checklist, orcamento_criado, orcamento_versao,
pdf_gerado, email_enviado, email_recebido, formulario, anotacao`), `descricao`, `dados JSONB`, `usuario_id` (null nos
registros do webhook). Sempre gravar via `registrarTimeline()` (`server/timeline.ts`).

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
`miolo_introducao`, `rodape_logo_ativo`, `rodape_logo_posicao` (`esquerda | centro | direita`; o rodapé usa o `logo_path`),
`rodape_titulo`, `rodape_conteudo`, `contracapa_ativa`,
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
  "locacao": { "incluir", "espaco_id", "espaco_nome", "faixa_id", "descricao", "valor_calc", "valor_manual" },
                                                 // espaco_id acompanha o evento na versão aberta; snapshot nas congeladas
  "extras": [{ "key", "descricao", "quantidade", "valor_unit" }],
  "informacoes_complementares": [BlocoInfo], "condicoes_gerais": [BlocoInfo],   // linhas label/valor, algumas "auto"
  "blocos_texto": [{ "key", "bloco_id", "titulo", "texto", "pagina" }],          // cópia do cadastro de blocos
  "lista_compras": [{ "key", "ref", "item_id", "nome", "grupo", "origem": "cardapio|bebida|manual", "unidade", "porcao",
                      "quantidade_calc", "quantidade_manual", "comprado", "observacao" }],   // uso interno, não vai à proposta
  "total_manual": null, "mostrar_valor_total": true, "observacoes": null,
  "totais": { "alimentos", "bebidas", "staff", "locacao", "extras", "total_calc", "total", "pagantes_equivalentes" }
}
```

Campos `*_calc` e `totais` são recalculados; `*_catalogo` são snapshots do preço no momento da inclusão; `*_manual`
são sobrescritas do usuário. O conteúdo é validado/normalizado por `conteudoSchema` (`server/orcamento.ts`), que aceita
conteúdo antigo ou parcial preenchendo padrões. Itens de cardápio e bebidas carregam `porcao_qtd`/`porcao_unidade`
(snapshot do catálogo; na versão em edição `sincronizarPorcoes` reaplica o cadastro atual). `lista_compras` é derivada
por `calcularListaCompras`: linhas `cardapio`/`bebida` nascem dos itens selecionados (`ref` = `item:<id>` ou `nome:<nome>`,
quantidade = porção × convidados; bebida por unidade = quantidade do orçamento; o mesmo item em dois cardápios soma) e só
guardam os ajustes do usuário (`quantidade_manual`, `comprado`, `observacao`); linhas `manual` são do usuário; linha
derivada cujo item saiu do orçamento desaparece.

### Formulários de captação

**`formularios`** — `nome`, `descricao`, `slug` (**UNIQUE global**, regex `^[a-z0-9]+(-[a-z0-9]+)*$`; a página pública
`/f/<slug>` descobre o tenant pelo slug), `ativo`, `config JSONB` (só os ajustes sobre o modelo), `mensagem_sucesso`.
**`formulario_respostas`** — `formulario_id`, `evento_id`, `cliente_id`, `dados JSONB` (snapshot legível
`[{secao, chave, rotulo, valor}]`), `ip`.

### Documentos (contratos e formais)

**`documento_modelos`** — modelos editados por owner/admin: `nome` (UNIQUE por empresa), `descricao`, `titulo` (aceita
variáveis; vira o título da página e o nome do PDF), `corpo` (marcação simples com `{variaveis}`; toda variável que não
é do sistema vira campo a preencher ao gerar), `incluir_assinaturas`, `testemunhas`, `ativo`, `ordem` e a **identidade
visual própria** (`VisualDocumento`): `logo_path` (upload em `documentos/`), `logo_local` (`nenhum | cabecalho | rodape`),
`logo_alinhamento` (`esquerda | centro | direita`), `rodape_ativo`, `rodape_texto`, `fonte_titulo`, `fonte_corpo`
(lista `FONTES`), `cor_primaria` (títulos), `cor_secundaria` (detalhes), `cor_texto`. Página sempre A4 branca, sem imagem
de fundo. `template_id` ficou sem uso (migration 023).
**`documentos`** — cada documento gerado num evento: `evento_id` (CASCADE), `cliente_id`, `modelo_id`, `visual JSONB`
(snapshot do visual do modelo na geração: reimpressões saem iguais), `ano` + `numero` (UNIQUE por empresa: `2026/0007`,
sequencial por ano, lock consultivo na geração), `titulo`, `modelo_nome`, `corpo` (texto final com os dados aplicados),
`campos JSONB` (extras digitados), `incluir_assinaturas`, `testemunhas`, `pdf_path` (`documentos/{eventoId}/{id}.pdf`),
`pdf_gerado_em`, `criado_por`.

### Inbox (conversas por e-mail)

**`conversas`** — uma por (evento, usuário dono): `evento_id` (CASCADE), `cliente_id`, `usuario_id` (quem enviou a
proposta ou iniciou; owner/admin veem todas, usuário comum só as suas), `assunto`, `token` (UNIQUE: endereço de resposta
`r-<token>@RESEND_INBOUND_DOMAIN`), `participantes TEXT[]` (e-mails do cliente), `ultima_mensagem_em`, `ultima_direcao`,
`ultimo_trecho`, `nao_lidas`, `arquivada`.
**`mensagens`** — cada e-mail: `conversa_id` (CASCADE), `direcao` (`entrada | saida`), `usuario_id` (remetente nas
saídas), `de`, `para TEXT[]`, `cc TEXT[]`, `assunto`, `texto`, `html` (recebido, já sem script/handlers), `message_id`,
`in_reply_to`, `referencias TEXT[]`, `resend_id` (UNIQUE parcial), `status` (`enviada | entregue | devolvida | falhou |
recebida`), `status_em`, `status_detalhe`, `anexos JSONB` (`[{nome, tipo, tamanho, path|null}]`), `lida_em`.
**`resend_events`** — eventos do webhook do Resend (`id` = svix-id, `type`, `payload`, `received_at`, `processed_at`,
`error`); RLS forçado sem política: só a conexão de sistema. Idempotência e reprocessamento dos pendentes.

### Google e reuniões

**`usuario_google`** — conta Google vinculada ao usuário (global, como `usuarios`; RLS forçado sem política: só a conexão
de sistema). PK `usuario_id`, `google_sub` (UNIQUE), `email`, `nome`, `refresh_token` e `access_token` **cifrados**
(`lib/cripto.ts`), `access_expira_em`, `escopos`, `agenda_ativa` (escopo `calendar.events` concedido + refresh token
guardado: pode agendar reuniões).
**`reunioes`** — reunião criada na agenda Google do organizador: `evento_id` (CASCADE, opcional), `cliente_id`, `usuario_id`
(organizador), `titulo`, `descricao`, `inicio`/`fim` TIMESTAMPTZ (interface em `America/Sao_Paulo`), `participantes TEXT[]`,
`local`, `google_event_id`, `meet_link`, `google_link`, `status` (`agendada | cancelada`).

### Funções SQL

| Função | O que faz |
|---|---|
| `app_tenant_id()` | tenant da transação (base de todas as políticas) |
| `aplicar_rls(tabela)` | RLS forçado + política `tenant_isolation` + índice em `tenant_id` |
| `aplicar_padroes_tenant(id)` | `configuracoes_tenant`, 4 status do Kanban, tipos Social/Corporativo, 5 formatos, categorias de item, espaço próprio "Nosso espaço" (padrão) com 4 faixas de locação |
| `aplicar_padroes_tenant_proposta(id)` | template padrão + blocos Crianças, Hora adicional, Formas de pagamento |
| `aplicar_padroes_formulario(id)` | formulário "Formulário de contato" com slug `contato-xxxxxx` |
| `aplicar_padroes_email_modelos(id)` | modelo "Proposta padrão" a partir de `email_assunto`/`email_corpo` |
| `aplicar_padroes_documentos(id)` | modelo "Contrato de prestação de serviços" (texto genérico de exemplo) |
| `aplicar_padroes_tenant_completo(id)` | chama as cinco acima; usado no cadastro de empresa nova |

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
| `014_template_rodape_logo` | `rodape_logo_ativo` + `rodape_logo_posicao`; `rodape_logo_path` fica sem uso (remover num deploy futuro) |
| `015_template_fundos_ia` | galeria `template_fundos_ia` (fundos gerados por IA, status gerando/pronto/erro) |
| `016_fase4_ux` | `eventos.motivo_perda`/`fechado_em` (etapas recusado/aprovado), `evento_timeline.retorno_em` (anotações), `tenant_usuarios.ocultar_primeiros_passos` |
| `017_hwesta_integracao` | `tenants.status`/`suspenso_em`/`suspenso_motivo` (kill-switch do Manager), `hwesta_entitlements` (snapshot do plano, RLS por tenant), `hwesta_events` (eventos recebidos, só conexão de sistema) |
| `018_cores_etapas_design_system` | cores padrão das etapas do funil nos tons do design system (`#B0A194`, `#E35336`, `#5E8B65`, `#3A302A`); só troca etapas que ainda tinham a cor padrão antiga; `aplicar_padroes_tenant` passa a criar com as novas |
| `019_espacos` | tabela `espacos`; `faixas_locacao.espaco_id`, `configuracoes_tenant.espaco_padrao_id`, `eventos.espaco_id`; backfill de um espaço próprio por empresa (nome = `local_padrao` ou "Nosso espaço") com as faixas e os eventos "na casa"; `aplicar_padroes_tenant` cria o espaço |
| `020_email_modelos` | tabela `email_modelos` (um padrão por empresa), `aplicar_padroes_email_modelos` (backfill "Proposta padrão" a partir de `email_assunto`/`email_corpo`), `aplicar_padroes_tenant_completo` com 4 chamadas |
| `021_inbox` | `conversas`, `mensagens` (RLS) e `resend_events` (só sistema) |
| `022_documentos` | `documento_modelos` e `documentos`; `aplicar_padroes_documentos` (contrato de exemplo em toda empresa); `aplicar_padroes_tenant_completo` com 5 chamadas |
| `023_documentos_visual` | identidade visual própria dos modelos de documento (logo e posição, rodapé, fontes, três cores) e `documentos.visual` (snapshot); `template_id` sem uso |
| `024_porcoes_lista_compras` | `catalogo_itens.porcao_qtd`/`porcao_unidade` (porção por pessoa; a lista de compras fica em `orcamento_versoes.conteudo.lista_compras`) |
| `025_google_reunioes` | `usuario_google` (conta Google e tokens cifrados; só sistema) e `reunioes` (RLS) |

### Seeds (somente dev, `--seed`)

`001` tenant Banket + usuários · `002` tenant "Outro Buffet" (isolamento) · `003` ajuste de tipos/categorias demo ·
`004` catálogo e opções a partir de `public/ref` · `005` staff e profissionais · `006` eventos demo · `007` template e
blocos no estilo dos PDFs de referência · `008` usuário `operacao@` (papel usuario) · `009` espaço de terceiro "Sede
TechCorp" ligado ao evento corporativo. `_legacy_*` são ignorados.

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
- Públicas: `/auth/*`, `/f/*`, `/api/public/*`, `/api/hwesta/*` (Bearer do Manager), `/api/webhooks/*` (assinatura
  Svix do Resend conferida na rota), `/print/*` (exige print token), `/_astro/*`, `/_image`, `/api/health` e estáticos
  de `/public`. **`/uploads/*` é sempre protegido** e só serve arquivos do tenant da sessão.
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
7. **Login com o Google** (`/auth/google` → consentimento → `/auth/google/callback`; `lib/google.ts`, `server/googleConta.ts`):
   só aparece com `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`. O `state` é um JWT de 10 min (`google-oauth:` + `JWT_SECRET`)
   com um nonce que também vai no cookie `banket_google_nonce` (evita login CSRF). O consentimento já pede o escopo
   `calendar.events` com acesso offline: quem entra com o Google ativa a agenda para agendar reuniões. A conta é achada
   pelo `sub`, senão pelo e-mail confirmado pelo Google (vinculando e marcando o e-mail como verificado), senão é criada
   (senha aleatória; "Esqueceu a senha" define uma). Em **Minha conta › Conta Google** o usuário vincula/desvincula a conta
   (`GET /api/google/vincular`, `?agenda=1` força `prompt=consent` para obter um refresh token novo) e vê se a agenda
   está ativa. Tokens ficam cifrados em `usuario_google`; `accessTokenAgenda` renova pelo refresh token e, se o Google
   revogou (`invalid_grant`), desativa a agenda e pede para reativar.

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

Navegação lateral (`components/Sidebar.astro`): Dashboard, Funil de vendas, Inbox (com o contador de não lidas,
calculado no `AppLayout`), Cardápios, Clientes, Agenda, Formulários, Staff, Espaços, Templates, Documentos,
Configurações (só admin), Suporte.

### Dashboard — `/dashboard` (`server/dashboard.ts`)
Indicadores por período de entrada do pedido (30, 90, 365 dias ou tudo): eventos e valor por status, pedidos recebidos,
pipeline em negociação, aprovados, recusados, taxa de conversão, ticket médio, próximos eventos e **orçamentos parados**
(enviados há mais de 7 dias sem mudança). Valor do evento = total da versão atual do orçamento. Também mostra
"primeiros passos" para empresas novas.

### Fase 4 de UX (resumo do que existe além do descrito abaixo)
- **Etapas de fechamento**: mover para `recusado` pede o motivo e `aprovado` a data (`EtapaDialogo`, `moverEvento`
  com extras); sair da etapa limpa `motivo_perda`/`fechado_em`. A faixa do resumo troca etapa via fetch com Desfazer.
- **Anotações**: linha do tempo aceita anotações manuais (`registrarAnotacao`, tipo `anotacao`) com `retorno_em`;
  o dashboard lista os "Retornos combinados". Primeiros passos para todos, com "Ocultar" por usuário.
- **Formulários**: `/f/:slug?previa=1` mostra prévia ao dono logado (até inativo, sem envio); respostas com
  detalhe, filtro por período e CSV (`/formularios/:id/respostas-exportar`); "Compartilhar" com QR (lib `qrcode`),
  iframe e WhatsApp; confirmação por e-mail a quem preencheu; rascunho em `sessionStorage`.
- **Importação CSV** (`server/importacao.ts` + `lib/csv.ts`): `/clientes/importar` e `/cardapio/importar`
  (modelo para baixar; válidas entram, inválidas voltam por linha; seções criadas pelo nome).
- **Minha conta** (`/conta`, `server/conta.ts`, conexão de sistema): perfil, troca de senha, empresas, **Conta Google**
  (vincular/desvincular, situação da agenda, "Ativar agenda").
- **Termos**: `/termos` e `/privacidade` (públicas), aceite com link no cadastro/convite.
- **Login**: "Manter conectado" (cookie de sessão vs 7 dias, `setSessionCookie(…, persistente)`).
- **Categorias de item**: em Cardápios › Categorias (`/cardapio/categorias`); Configurações ficou com Ocasiões.
- **Prévias**: `/eventos/:id/orcamento/previa` (proposta) e a prévia real no editor de template, ambas via
  `/print/*` com print token; `FileUpload` comprime imagem no navegador (`comprimirKb`).

### Quadro de vendas (eventos) — `/eventos` (`server/eventos.ts`)
- Kanban com colunas = `status_orcamento` (arrastar e soltar → `PATCH /api/eventos/:id/status`, registra na timeline)
  e visão em lista paginada. Filtros: busca (título, cliente, responsável, local), período, tipo, formato, status.
- Intervalo de trabalho do Kanban (`kanban_intervalo_meses`): hoje até +N meses, eventos sem data sempre aparecem;
  datas escolhidas no filtro substituem o intervalo. Datas relativas usam `America/Sao_Paulo`.
- Exportação CSV (`/eventos/exportar`, separador `;` para o Excel em português).
- Evento (`/eventos/novo`, `/eventos/:id`, `/editar`): briefing completo, cliente existente ou novo no mesmo formulário.
  O local é um select de **Espaço** (nossos espaços, de terceiros ou "Outro local" com nome/endereço livres); o espaço
  padrão da empresa já vem selecionado. Abas do `EventoLayout`: resumo, **Orçamento**, Informações complementares,
  Condições gerais, **Mensagens** (Inbox do evento), **Documentos** (contratos gerados), Linha do tempo.
- Checklist operacional por evento (degustação, laudos, documentos) com status e prazo.
- Mudanças relevantes (data, convidados, cliente, espaço, status) vão para a linha do tempo.

### Espaços — `/espacos`, `/espacos/:id` (`server/espacos.ts`, `components/espacos/EspacoDrawer.astro`)
Cadastro dos locais onde os eventos acontecem, visível a todos os usuários. **Nosso espaço** (próprio): dados gerais,
capacidade e, no detalhe, as **faixas de locação** por número de convidados (antes em Configurações › Locação).
**Espaço de terceiro**: contato e valor de referência da locação. Espaços entram no select do evento, no select da seção
Locação do orçamento e no "Espaço padrão" de Configurações › Empresa. Excluir é bloqueado com eventos vinculados
(desative). O formulário público "no nosso espaço" aponta para o espaço padrão.

### Orçamento — `/eventos/:id/orcamento` (`server/orcamento.ts`, `lib/calculo/orcamento.ts`, `components/orcamento/*`)
- Criar o orçamento gera a **versão 01** com conteúdo inicial (staff marcado como padrão, blocos ativos por padrão,
  locação pelo espaço do evento) e move o evento de `novo` para o primeiro status `negociacao`.
- Construtor Preact (`OrcamentoBuilder`) com seções: Cardápios (a partir de opções prontas ou do catálogo, itens
  selecionáveis, preços manuais), Bebidas, Staff, Locação e extras, Textos da proposta (blocos). Salvamento automático
  parcial via `PUT /api/orcamentos/:eventoId/versoes/:numero`; o servidor mescla só as partes editáveis, **recalcula** e
  devolve o conteúdo.
- **Versionamento**: só a versão não congelada é editável; "Criar nova versão" congela a atual e abre `n+1`
  (também serve para restaurar uma versão antiga como nova). A versão em edição acompanha os dados atuais do evento
  (cabeçalho, convidados, espaço); versões congeladas preservam o que foi proposto (recalculadas **sem** as referências
  de locação, mantendo o `valor_calc` gravado) e reaproveitam o PDF já gerado.
- **Espaço na seção Locação**: o select mostra os espaços ativos (mais o já escolhido); trocar o espaço no orçamento
  também atualiza o evento (`salvarVersao` recebe `user`, grava `eventos.espaco_id/local_tipo/local_nome` e registra na
  timeline). `contextoOrcamento` devolve `refs: ReferenciasLocacao` (todos os espaços + faixas) e `espacos` (seleção).
- Template da proposta por orçamento (`definirTemplate`; vazio = padrão da empresa).
- **Lista de compras** (`/eventos/:id/lista-compras`, sub-aba do orçamento, `components/orcamento/ListaCompras.tsx`; uso
  interno, não entra na proposta): quantidade de cada item selecionado = **porção por pessoa** do cadastro do item
  (Cardápios › Itens, campo "Porção por pessoa" + unidade; também na importação CSV, colunas `porcao`/`porcao_unidade`)
  × convidados da versão. Ajuste manual por linha (vazio = calculado), "comprado", observação, linhas avulsas, aviso dos
  itens sem porção e exportação CSV (`/eventos/:id/lista-compras/exportar?versao=n`). Salva como parte `lista_compras`
  da versão pelo mesmo `PUT`; versão congelada é somente leitura. Quantidades em g/ml ≥ 1000 aparecem em kg/l.

**Regras de cálculo (função pura, mesmo código no navegador e no servidor):**
- Valor efetivo em todos os níveis = `manual ?? calculado`.
- Pagantes equivalentes = convidados − isentas − meia + meia × 0,5.
- Preço de uma seção = preço manual, senão preço do catálogo da seção, senão soma dos itens selecionados.
- Cardápio: preço por pessoa = `preco_base` da opção + soma das seções; subtotal = pp × pagantes equivalentes.
- Bebida: unitário × pagantes equivalentes (`pessoa`) ou × quantidade (`unidade`).
- Staff: quantidade = `quantidade_fixa` se por evento, senão `max(minimo, ceil(convidados / convidados_por_profissional))`;
  unitário = cachê/diária + auxílio.
- Locação (`calcularLocacao`): espaço próprio → faixa do espaço que contém o nº de convidados; espaço de terceiro →
  `valor_referencia`; sem espaço (ou apagado) → 0, mantendo `espaco_nome` como snapshot. Só com `incluir`.
- Total = alimentos + bebidas + staff + locação + extras (ou `total_manual`). Arredondamento a centavos.
- Blocos automáticos em Informações complementares: equipe (linhas por função) e contagem de opções por restrição
  alimentar; viram manuais quando o usuário edita.

### PDF da proposta (`server/pdf.ts`, `server/proposta.ts`, `components/proposta/Proposta.astro`)
- `GET /eventos/:id/orcamento/pdf[?versao=n][&ver=1]` baixa (ou abre) o PDF. Documentos usam o mesmo pipeline
  (`imprimir`), só com a parte `miolo` e a página `/print/documento/:id` (`components/documentos/DocumentoImpresso.astro`).
- Um Chromium compartilhado (lançado sob demanda, `--no-sandbox`) abre `http://127.0.0.1:$PORT/print/orcamento/:versaoId`
  com `?parte=capa|miolo|contracapa&token=<print token 5 min>`; cada parte vira um PDF A4 e o **pdf-lib** junta.
  Capa e contracapa só entram se ativas no template.
- As imagens do template/empresa são embutidas como data URI (a página de impressão não tem sessão).
- PDF salvo em `{UPLOAD_DIR}/{tenant}/orcamentos/{eventoId}/v{n}.pdf`; registra `pdf_gerado` na timeline.
- `/templates/:id/exemplo` gera um PDF com conteúdo fictício para conferir o visual.
- O Dockerfile instala `chromium` e fontes Noto (acentuação/emoji); `CHROMIUM_PATH=/usr/bin/chromium-browser`.

### Envio da proposta (`server/envio.ts`)
Rascunho com destinatário (responsável do evento ou e-mail do cliente) e select **Modelo** (modelos ativos com as
variáveis aplicadas no servidor; o padrão preenche assunto/mensagem). Até 5 destinatários, PDF anexado. O envio abre (ou
continua) a **conversa** do usuário com o cliente no evento (`obterOuCriarConversa` + `enviarNaConversa`): remetente
`"<usuário> · <empresa>" <MAIL_FROM>`, `Reply-To` = endereço da conversa (`r-<token>@RESEND_INBOUND_DOMAIN`; sem o
domínio, o e-mail do usuário), `In-Reply-To`/`References` com os ids já conhecidos. Grava a mensagem de saída (PDF em
`anexos`), `enviado_em`/`enviado_para` na versão e `email_enviado` na timeline.

### Inbox — `/inbox`, `/inbox/:id`, `/eventos/:id/mensagens` (`server/conversas.ts`, `server/inbox/receber.ts`, `components/inbox/Conversa.astro`)
- Conversas sempre ligadas a um evento: nascem no envio da proposta ou em "Nova mensagem" na aba Mensagens do evento.
  Lista com busca, filtros todas / não lidas / minhas (admin), responsável (admin) e arquivadas; thread com as
  mensagens enviadas (status de entrega) e recebidas (texto; "Ver e-mail formatado" abre o HTML limpo num
  `<iframe sandbox>`), anexos (`/uploads/…`, sempre como download) e o form de resposta com "Inserir modelo".
- **Permissões**: `owner`/`admin` veem e respondem todas as conversas da empresa; `usuario` só as suas (`usuario_id`).
  Todas as consultas levam o fragmento `VISIVEL` (`isAdmin(user) OR usuario_id = user.id`); fora do escopo → UserError.
- **Recebimento** (Resend Receiving, GA; o produto "Inboxes" do Resend não é usado): o domínio `RESEND_INBOUND_DOMAIN`
  tem MX apontando para o Resend; `POST /api/webhooks/resend` verifica a assinatura Svix (`RESEND_WEBHOOK_SECRET`),
  registra o evento em `resend_events` (duplicado → 200) e processa: `email.received` → conversa pelo token do
  destinatário (ou por `In-Reply-To`/`References` contra `mensagens.message_id`) → corpo/cabeçalhos pela Receiving API e
  anexos (≤ 10 MB, até 10; a URL de download vale 1 h) em `mensagens/{eventoId}/…` → `receberMensagem` (não lidas + 1,
  timeline `email_recebido`); `email.delivered|bounced|complained|failed|delivery_delayed` → status da mensagem pelo
  `resend_id`. Token desconhecido ou id de e-mail transacional → ignorado (200); erro transitório → 500 e o Resend
  reenvia (o evento fica `pendente` e é reprocessado). Só o token → empresa e o `resend_id` → empresa usam a conexão de
  sistema; o resto roda em `withTenant`.
- Contador de não lidas no menu (`contarNaoLidas`, uma consulta por página no `AppLayout`); abrir a conversa zera.
  Sem `RESEND_INBOUND_DOMAIN`, as telas avisam que as respostas vão para o e-mail do usuário.

### Reuniões — `/eventos/:id/reunioes`, `/reunioes` (`server/reunioes.ts`, `components/reunioes/ReuniaoDrawer.astro`)
- Disponível só para quem tem a **agenda Google ativa** (login/vínculo com o Google, ver Autenticação); caso contrário as
  telas mostram o aviso com o link para Minha conta (ou avisam que o Google não está configurado no servidor).
- Agendar (título, evento opcional na página geral, data, horário, duração, participantes, local, descrição) cria o
  evento na **agenda principal do usuário** com sala do **Google Meet** (`conferenceData.createRequest`) e convites
  (`sendUpdates=all`), e grava em `reunioes` com `meet_link`/`google_link`; evento ligado recebe `reuniao` na timeline.
  A aba do evento pré-preenche o título e os e-mails do responsável/cliente.
- Editar e cancelar: só o organizador ou owner/admin; a alteração sai da agenda do organizador (token dele). Cancelar
  apaga o evento no Google (404/410 contam como feito) e marca `cancelada`.
- A **Agenda** (`/agenda`) mostra as reuniões no mês e na semana (tom cobalto, link para a aba do evento ou `/reunioes`)
  e tem o botão "Reuniões" (`/reunioes`: próximas/passadas, Meet, editar, cancelar, drawer com select de eventos em aberto).

### Documentos — `/documentos`, `/documentos/:id`, `/eventos/:id/documentos` (`server/documentos.ts`)
- **Modelos** (menu Documentos; lista visível a todos, edição só owner/admin): nome, descrição, título com variáveis,
  card **Identidade visual** (logotipo com upload e "Capturar cores do logo" via `POST /api/templates/sugestao`, posição
  do logo no cabeçalho ou no rodapé com alinhamento, rodapé sim/não com texto, fontes de título e texto, cores primária,
  secundária e do texto; A4 branco, sem imagem de fundo; o arquivo do logo é apagado só quando nenhum modelo/documento
  o usa, `logoEmUso`), corpo em marcação simples editado com **barra de formatação** (`lib/editorTexto.ts`: negrito, itálico, título `# `, subtítulo `## `, lista,
  lista numerada `1. `, centralizar `>> `, quebra de página `---`) e chips das variáveis do sistema
  (`lib/documentos/variaveis.ts`, grupos empresa/cliente/evento/orçamento/documento, com `{valor_total_extenso}`,
  `{data_evento_extenso}`, `{numero_documento}`…). Prévia ao vivo com dados de exemplo; "PDF de exemplo"
  (`/documentos/:id/exemplo`); duplicar (nasce inativo), excluir. Toda `{variavel}` desconhecida vira **campo extra**
  obrigatório na geração (`camposExtras`). Bloco de assinaturas (empresa com razão social/CNPJ e assinante das
  Configurações, cliente com CPF/CNPJ) e testemunhas opcionais por modelo.
- **Geração** (aba Documentos do evento): escolhe o modelo e preenche os campos extras; `criarDocumento` aplica as
  variáveis do evento/cliente/empresa/orçamento atual (`valoresDoEvento`), numera por empresa e ano e grava o texto
  final com o snapshot do visual; **em outra transação** `gerarPdfDocumento` imprime o PDF (`/print/documento/:id`,
  token `alvo: 'documento'`, só a parte `miolo`; `imprimir` de `server/pdf.ts` com título) — a página de impressão roda
  em outra requisição e só enxerga o documento depois do commit. Timeline `documento_gerado`. Lista com download (`…/pdf`, `?ver=1`
  abre), **Enviar** por e-mail (PDF anexado na conversa do Inbox, `enviarDocumento`) e excluir (apaga o PDF; o número
  não é reaproveitado). O PDF guardado é reusado; se faltar no disco, é reimpresso a partir do texto final.

### Cardápios — `/cardapio/itens`, `/cardapio/sessoes`, `/cardapio/opcoes` (`server/cardapio.ts`)
Catálogo de seções e itens (preço, unidade de cobrança, custo, categorias principal/secundária, formato, composição,
restrições, dados operacionais, ativo). Opções prontas (pacotes) editadas numa ilha Preact (`OpcaoEditor`) via
`/api/cardapio/opcoes[/:id]` (GET, POST cria/duplica, PUT, DELETE).

### Clientes — `/clientes`, `/clientes/:id` (`server/clientes.ts`)
Cadastro PF/PJ com CPF/CNPJ validado, e-mail e documento únicos por empresa, histórico de eventos do cliente.

### Agenda — `/agenda` (`server/agenda.ts`)
Eventos com data, por mês ou semana, coloridos pela cor do status; filtro por variante de status. Mostra também as
reuniões agendadas (`reunioesNoPeriodo`) e dá acesso a `/reunioes`.

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
convertido em PNG no navegador; 40 pedidos / 10 min por empresa). Os fundos de capa, conteúdo e contracapa têm
"Gerar com IA" e uma galeria (`server/imagemFundo.ts`, `components/templates/GaleriaFundos.astro`): JPEG 1664×2352
(A4 ~200 dpi) gerado em segundo plano (leva 1–2 min, acima do timeout do Nginx). `POST /api/templates/imagem-fundo`
cria a linha `gerando` em `template_fundos_ia` e dispara a geração; a tela consulta `GET /api/templates/imagem-fundo`
enquanto houver pendentes (dá para sair da página e voltar). A galeria é por empresa e página; escolher uma imagem
envia `ia_<campo>` e o template passa a usar o mesmo arquivo. Arquivos só são apagados quando nem templates nem a
galeria os usam (`arquivoEmUso`). Gerações presas há mais de 6 min viram erro. Limite: 15 / hora e 2 simultâneas. O rodapé do conteúdo não tem logo
próprio: liga/desliga e posição do logotipo principal. Blocos de informação por página da proposta, com marcação simples.

### Configurações (owner/admin) — `/configuracoes/*` (`server/configuracoes.ts`, `server/empresa.ts`, `server/usuarios.ts`)
Usuários e convites · Tipos de evento · Categorias (com toggles de tipo via `/api/configuracoes/categorias/tipos`) ·
Status de orçamento (colunas do Kanban: nome, variante, cor, ordem, intervalo do Kanban) · Formatos de serviço ·
Modelos de e-mail (`/configuracoes/modelos-email`, `server/emailModelos.ts`: nome, assunto, corpo com chips de
variáveis e prévia, padrão único, ativo; ao excluir o padrão o próximo ativo assume) · Empresa (dados cadastrais, logo,
validade da proposta, faixas de crianças, espaço padrão, assinatura). A locação saiu daqui: fica em Espaços.

### Uploads (`lib/storage.ts`, `pages/uploads/[...path].ts`)
Disco em `{UPLOAD_DIR}/{tenantId}/{pasta}/{uuid}.{ext}` (volume Docker `/data/uploads`). Imagens PNG/JPEG/WebP/SVG até
5 MB por padrão. `resolveKey` impede sair da pasta do tenant. Servidos em `/uploads/{tenantId}/…` apenas para a sessão
do mesmo tenant (`Cache-Control: private`). Anexos de e-mails recebidos (`mensagens/…`) saem com
`Content-Disposition: attachment`. Interface pensada para trocar por S3.

### Upload de arquivos (`components/ui/FileUpload.astro`)
Todo campo de arquivo usa o `FileUpload`: área "arraste e solte ou procure" e, com arquivo, cartão com miniatura, nome
e ações (Trocar, Remover/Desfazer, Descartar). O `<input type="file">` real segue no formulário (multipart normal).
Remoção: `removerName` (checkbox aplicado ao salvar) ou `removerAcao` (submit imediato com `_action`). Evento
`upload:externo` ({url, nome}) mostra uma imagem vinda de outra origem (galeria de IA).

### E-mail (`lib/mail.ts`, `server/emails.ts`)
`sendMail` usa `https://api.resend.com/emails` com `RESEND_API_KEY`/`MAIL_FROM`; sem chave, ou quando todos os
destinatários são de domínio reservado (`example.com`, `.test`…, ver `dominioReservado`), registra no log e retorna
`delivered: false` — é assim que os e2e leem os links mesmo com a chave ativa. `fromName` troca só o nome de exibição
(o endereço continua o de `MAIL_FROM`); `replyTo` aceita lista; `headers` leva `In-Reply-To`/`References`. E-mails
transacionais usam `emailLayout` (título, parágrafos, botão, rodapé); os do usuário (proposta, Inbox) usam
`mensagemHtml` (`server/emailTexto.ts`). Links usam `APP_URL`.

### Componentes de interface compartilhados
- **Drawer** (`components/ui/Drawer.astro`): envia o form por `fetch` com `Accept: application/json`; `handleFormPost`
  responde `{ok, redirect}` (flash no cookie) ou `{ok:false, error, fields}`. Em erro o painel continua aberto com a
  mensagem no topo e junto de cada campo (`.field-erro`, `aria-invalid`); fechar com alterações pede confirmação.
  `data-drawer-nativo` no form mantém o POST tradicional. `saveLoadingLabel` define o rótulo durante o envio.
- **Erros por campo**: `fieldErrors(err)` (`lib/forms.ts`) usa o `path` do zod (dê `path: ['campo']` aos `refine`),
  `UserError(msg, campo)` e o nome da restrição única do Postgres (`*_email_*`, `*_documento_*`, `*_nome_*`…).
- **`lib/ui.ts`** (navegador): `toast(msg, tipo, {acao})`, `confirmar({titulo, texto, confirmar, perigo})`,
  `emCarregamento(botao, rotulo)`, `baixarArquivo(url)`. Nunca use `window.confirm`/`window.banketToast` direto.
- **Toast**: erro fica até fechar (`role="alert"`); sucesso some em 5 s; ação opcional (ex.: Desfazer).
- **Confirmar** (`components/ui/Confirmar.astro`, `<dialog>`): também via `data-confirm="Pergunta?"`
  (+ `data-confirm-texto`, `data-confirm-rotulo`); verbos Excluir/Remover/Cancelar/Descartar deixam o botão vermelho.
- **Carregando**: `data-carregando="Salvando…"` no botão de envio de formulário comum.
- **Máscaras** (`lib/mascaras.ts` + `components/ui/Mascaras.astro`): `data-mascara="telefone|cep|numero|cpf|cnpj|dinheiro"`;
  `data-mascara="documento" data-mascara-tipo="<id do select PF/PJ>"` (+ `data-rotulo-documento` no label).
- **Glossário** (`lib/rotulos.ts`): Tipo, Ocasião, Formato de serviço, Estilo gastronômico, Etapa, Funil de vendas.
  A interface usa estes nomes; o banco continua com `tipos_evento`, `categorias_evento`, `status_orcamento`.
- **Cores e foco**: só tokens do design system (ver [Design system](#design-system-interface)). Foco: `:focus-visible`
  global (`--focus-ring-forte`); campos usam borda `--border-focus` + `--focus-ring`; quem zera o `outline`/`box-shadow`
  precisa repor o anel.
- **Listas**: `EstadoVazio` no slot `empty` da `Table` (diferencie "sem cadastro" de "sem resultado": `estaFiltrando`);
  ordenação por coluna com `ordenar` na coluna + `orderBy(ord, MAPA, padrao)` no servidor (`lib/ordenacao.ts`: só
  expressões fixas do mapa entram no SQL); paginação com `?por=20|50|100`.
- **Reordenar** (`components/ui/Reordenar.astro`): `data-reordenar="<url PATCH>"` + `data-id`; na `Table`, prop
  `reordenar` (linhas com `_id`/`_nome`). Servidor: `server/reordenar.ts` (lista branca de tabelas).
- **Orçamento**: sub-abas `OrcamentoAbas` (itens, informações, condições); incluir itens com `AdicionarBusca`;
  remoções sem modal com `useRemoverComDesfazer` (Desfazer no aviso).

### Versão mobile (Fase 3 de UX)
- **Tudo em media queries** — `≤768px` celular, `769–1024px` tablet — para o desktop permanecer intocado.
  Nada de estilo mobile fora de `@media (max-width: …)`.
- Navegação: `NAV_PRINCIPAL` (`lib/nav.ts`) alimenta a `Sidebar` (desktop; só ícones no tablet) e a
  `MobileNav.astro` (barra inferior com Dashboard, Funil, Agenda, Clientes + painel "Mais" com o resto).
  O `.page-content` reserva espaço para a barra; toast sobe acima dela.
- `Table.astro`: cada célula sai com `data-key`/`data-rotulo`; no celular a linha vira cartão rótulo→valor,
  a coluna `acoes` vai para o rodapé do cartão e célula vazia some. Cabeçalho (e ordenação) só no desktop.
- Funil: chips `[data-etapa-chip]` mostram uma coluna por vez (`.kanban-col.mobile-ativa`); mover é pelo menu ⋯.
- `Drawer`: tela cheia no celular; ao abrir, os irmãos da cadeia de ancestrais ficam `inert` (toast e `dialog`
  preservados), Tab circula dentro e o foco volta a quem abriu. Menu do usuário: botão com `aria-expanded`,
  Esc e setas.
- E2e mobile em `tests/e2e/mobile.spec.ts` (viewport 390×844).

### Regra de salvamento (UX-013)
- Ilhas de edição contínua (orçamento, blocos, textos da proposta): salvamento automático com indicador de estado.
- Formulários (drawer, empresa, template, evento): botão Salvar; alterações não salvas pedem confirmação ao sair
  (drawer faz sozinho; página inteira: `data-form-sujo` no `<form>`).
- Exclusão: modal (`data-confirm`/`confirmar`) com o impacto; remoção reversível dentro de uma ilha: sem modal,
  com Desfazer no aviso.
- Filtros e período (selects de listagem, dashboard): aplicam na hora, não precisam de confirmação.

### Health check
`GET /api/health` → `{status:'ok'}` ou 503 se o banco não responde (usado no deploy).

### Integração com o Manager Hwesta (HCP v1) — detalhes em [INTEGRACAO_HWESTA.md](INTEGRACAO_HWESTA.md)
- O Manager (`manager.hwesta.tech`) gerencia empresas, usuários, plano, suspensão e chamados **só por HTTP**, pelas
  rotas `/api/hwesta/v1/*` (públicas no middleware; autenticadas por Bearer `HWESTA_MANAGER_KEY`).
- `src/lib/hwesta/` é o núcleo genérico do protocolo (vem da skill `integrar-gestao`; não editar aqui). O que é do
  Banket fica em `src/lib/hwesta/adapter.ts` (conexão de sistema) e nas `capabilities` que ele declara.
- **Kill-switch**: `tenants.status` ≠ `active` → o middleware redireciona para `/conta-suspensa` (API: 403
  `ACCOUNT_SUSPENDED`). O status vem em `getMembership`; ao mudá-lo, chame `invalidateTenant()`.
- **Planos**: o catálogo é do Manager; aqui só o snapshot em `hwesta_entitlements`. Use `can()`/`limit()`/
  `withinLimit()` de `lib/hwesta`. Empresa sem snapshot não sofre restrição; nenhum limite é aplicado hoje.
- **Suporte** (`/suporte`, `server/suporte.ts`): chamados abertos no helpdesk do Manager; cada usuário vê os seus,
  na empresa atual. Respostas chegam também como evento em `hwesta_events`.

---

## Design system (interface)

Fonte de verdade: o diretório [`design-system/`](design-system/readme.md) — `readme.md` (fundamentos de conteúdo e
visual), `tokens/`, `components/<grupo>/` (cada componente em React com `.d.ts`, `.prompt.md` e o CSS `.bk-*` do grupo),
`ui_kits/banket-app/` (telas de referência; abra o `index.html` por um servidor HTTP) e `guidelines/`.
A aplicação **não importa** esse CSS nem os componentes React: ela implementa os mesmos valores nos componentes
Astro/Preact, com os nomes de classe próprios. O CSS `.bk-*` é a especificação de medidas, cores e estados.

**Direção:** "ateliê de cerâmica" — papel quente, argila e terracota; calmo e profissional. Cerca de 85% neutros
quentes, 10% terracota, 5% esmaltes (sálvia, ocre, cobalto, vinho). Sem gradiente, textura, emoji ou cinza frio.

### Tokens (`src/styles/tokens.css`)

Cópia de `design-system/tokens/*.css` mais os `@font-face` (General Sans em `/public/fonts`). Ao mudar o design system,
recopie os valores; não crie variável de cor fora dele. No código do produto use os **aliases semânticos**:

| Papel | Tokens |
|---|---|
| Superfícies | `--bg-app` (fundo, argila-50) · `--bg-surface` (cards) · `--clay-25` (cabeçalho de tabela, hover de linha, painéis) · `--bg-subtle` · `--bg-sidebar` · `--bg-accent-subtle`/`--bg-accent-soft` (destaque terracota) · `--bg-overlay` (scrim) |
| Texto | `--text-strong` · `--text-heading` · `--text-body` · `--text-secondary` · `--text-muted` · `--text-placeholder` · `--text-link`/`--text-accent` (terracota-700) · `--text-on-accent` |
| Bordas | `--border-subtle` (divisórias) · `--border-default` (cards) · `--border-strong` (campos, botões secundários) · `--border-accent` · `--border-focus` + `--focus-ring` |
| Ações | `--action-primary` (terracota-600; hover `-hover`, press `-active`) · `--action-secondary-*` · `--action-ghost-hover` |
| Situação | `--success*` (sálvia) · `--warning*` (ocre) · `--danger*` (vinho — erro nunca é terracota) · `--info*` (cobalto) |
| Funil | `--stage-new` · `--stage-negotiation` · `--stage-won` · `--stage-lost` (as etapas reais usam `status_orcamento.cor`, cujos padrões são estes tons) |
| Tipografia | `--font-sans` (General Sans) · `--font-mono` (variáveis `{nome_cliente}` e hex) · `--fw-regular` 400 / `--fw-medium` 500 · `--fs-11…40` · papéis `--type-*` |
| Espaço e forma | `--space-*` (base 4px) · `--radius-xs|sm|md|lg|xl|full` (4/6/8/12/16/pílula) · `--shadow-xs|sm|md|lg|xl|inset` · `--dur-fast|base|slow` + `--ease-out` |
| Layout | `--sidebar-width` 248 · `--header-height` 64 · `--subnav-height` 48 · `--content-pad-x/y` 32/28 · `--drawer-width` 560 · `--control-h-sm|md|lg` 32/40/48 |

### Regras

- **Tipografia**: General Sans, pesos **400** (texto) e **500** (interface e títulos); 600/700 não são usados na interface.
  Corpo 14px/1,5; rótulos 13px/500; legendas 12px; título de página 20px; saudação 24px; título de card 15px/500;
  KPI 28px/500 com `--ls-tight`. Números em colunas e valores: `font-variant-numeric: tabular-nums` (classe `.tabular`).
- **Caixa**: *sentence case* em títulos, botões, rótulos, abas e tags. Única exceção: **eyebrows** (rótulo de KPI, rótulo
  de grupo, dias da semana) — classe `.eyebrow` (11px/500, caixa alta, `--ls-eyebrow`).
- **Cantos**: campos e botões 8 · cards, tabelas e painéis 12 · tags 6 · checkbox e botões mínimos 4 · badges e switches em pílula.
- **Cards**: fundo branco, borda `--border-default`, raio 12, `--shadow-xs`; título 15px/500 com ícone em quadro
  `--bg-accent-subtle`/`--terracotta-600`. Card clicável: hover com `--border-strong` + `--shadow-md`.
- **Sombras** quentes e curtas: `xs` cards, `sm` controles, `md` hover, `lg` menus e barra flutuante, `xl` drawers e diálogos.
  Transparência e blur só no scrim (`--bg-overlay` + blur 2px) e na barra de ações flutuante (branco 92% + blur 8px).
- **Estados**: hover escurece um passo (primário 600→700; `--action-ghost-hover` em ícones; `--clay-25` em linhas);
  press = mais um passo + `translateY(.5px)`; movimento com `--dur-*` e `--ease-out`, sem bounce.
- **Botões**: um só primário por região; ação de card = `secondary`; destrutiva = `danger`; de linha de tabela =
  `.row-action`; texto no formato verbo + objeto ("Novo cliente", "Exportar CSV").
- **Microcopy**: pt-BR, voz prática e direta; valor vazio = travessão `—` (`.vazio`; a `Table` já faz isso com `''`,
  `null` e `'-'`); metadados separados por ` · `; contagens com dois dígitos em cards e colunas; sem emoji.
- **Ícones**: Tabler outline, traço 1,5 (1,75 até 16px), tamanhos 16 (botões) · 18 (padrão) · 20 (sidebar) · 22–26
  (estados vazios). `<Icon name="circle-plus" size={18} />`; em scripts, `svgIcone(nome, tamanho)`. Ícone novo: copie o
  miolo de `icons/outline/<nome>.svg` do pacote `@tabler/icons@3.19.0` para `lib/icones.ts`. Em pseudo-elementos de CSS
  use as data-URI de `global.css` (`--icone-chevron-down`, `--icone-alert-circle`, `--icone-check`) com `mask`.
- **Celular** (≤768px) e tablet (769–1024px) seguem os mesmos tokens, sempre dentro de media query.
- **`hidden`**: `global.css` garante `[hidden] { display: none !important }`; não precisa repetir por componente.
- **Estilo de célula de tabela**: a `Table` não tem variante por coluna; as páginas usam
  `:global(.data-table tbody td[data-key='…'])`. O cabeçalho da coluna `acoes` fica só para leitores de tela.

### Do design system para o código

| Design system | Na aplicação |
|---|---|
| Button, IconButton | `components/ui/Button.astro` (`primary · secondary/outline · ghost · soft · text · danger · success · dark`; `sm · md · large`; `icon`, `iconRight`); em HTML montado à mão e nas ilhas: `.btn .btn-<variante> .btn-<tamanho>` (os estilos ficam em `global.css`) |
| TextInput, Select, Textarea, Field | `.field` + `label` + campo, `.control`, `.form-grid` (`global.css`); telas de autenticação: `components/ui/Input.astro` |
| Checkbox, Switch | `components/ui/Checkbox.astro`; `.chip` (seleção em pílula) e `.switch` / `.switch-sm` (`global.css`) |
| FileField | `components/ui/FileUpload.astro` |
| SegmentedControl | `.segmented` |
| Tag · StatusBadge · StageDot | `.tag` (+ `tag-accent|sage|ochre|cobalt|wine`, `tag-sm`) · `.badge` (+ `badge-success|warning|danger|info|accent`) · `.status-name` + `.dot` |
| Table, Pagination, ReorderControls | `components/ui/Table.astro`, `Pagination.astro`, `Reordenar.astro` |
| Card | `components/ui/SectionCard.astro` (`title`, `description`, `icon`, `collapsible`, slot `actions`); título avulso com ícone: `.bloco-titulo`; rótulo → valor: `.kv` |
| CatalogCard | `components/ui/InfoCard.astro` (`title`, `description`, `rows`, `tags`; slots `status`, `subtitle`, padrão e `footer`) |
| StatCard, FunnelBreakdown, AgendaItem | `pages/dashboard/index.astro` |
| KanbanColumn, EventCard, Menu | `pages/eventos/index.astro` |
| CalendarMonth | `pages/agenda/index.astro` |
| Toolbar | `components/ui/PageToolbar.astro` |
| EmptyState | `components/ui/EstadoVazio.astro` |
| Drawer | `components/ui/Drawer.astro` (`md` = 560px, `lg` = 720px; Excluir/Salvar no cabeçalho) |
| Sidebar, AppHeader, UserMenu, Tabs | `components/Sidebar.astro`, `Topbar.astro` (título "Módulo / Página" vira trilha), `Submenu.astro`, `MobileNav.astro`; abas dentro da página: `components/orcamento/OrcamentoAbas.astro` |
| BackLink | classe `.voltar` (`global.css`) |
| CopyField, FormSection | formulários (`pages/formularios/*`, `components/formularios/FormularioEditor.tsx`, `styles/formularios.css`); seções numeradas também no editor de opção (`styles/editor.css`) |
| ActionBar (barra flutuante com o estado do salvamento) | editor de formulário (`styles/formularios.css`) e construtor de orçamento / blocos (`.orc-barra` em `styles/orcamento.css`) |
| VariableChip, ColorInput | `pages/configuracoes/empresa.astro` (variáveis do e-mail) e `components/templates/TemplateForm.astro` (cores do template) |
| Toast e modal de confirmação (não existem no kit) | `components/ui/Toast.astro` e `Confirmar.astro`, desenhados com os mesmos tokens |

### Fora do design system

- **PDF da proposta** (`components/proposta/Proposta.astro`, `pages/print/*`) e a prévia dele no editor de template:
  fontes, cores e imagens são as do template de cada buffet.
- **E-mails** (`server/emails.ts`, `server/envio.ts`): mesma paleta, mas com cores em hex e fontes de sistema — clientes
  de e-mail não carregam webfont nem variáveis CSS (por isso títulos e botões usam peso 600: Arial não tem 500).
- **Telas de autenticação** (`AuthLayout`): o véu terracota sobre `/bg-login.png` é o único gradiente da interface.
- Cores escolhidas pela empresa (etapas do funil, templates) vêm do banco e são aplicadas por `style`.

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
  No frontmatter, não quebre linha dentro de `${ … }` de um `html``…`` com outro `html``…`` aninhado: o compilador do
  Astro perde o fim do frontmatter ("CompilerError: Unexpected token"); extraia para uma função auxiliar.
- Listagens: `pageParams`/`pageInfo`/`searchTerm` (`?q=&page=`, 20 por página).
- Interface nova segue o [design system](#design-system-interface): só tokens de `tokens.css` (nada de hex, cinza frio,
  peso 600/700 ou caixa alta fora de eyebrow), componentes de `components/ui` antes de CSS novo e ícones Tabler.
- Funções puras que rodam no navegador (cálculo, modelo de formulário, money) não podem importar `db` nem Node.
- Toda ação relevante sobre um evento registra na timeline (`registrarTimeline`).
- Unitários ficam ao lado do código (`*.test.ts`); fluxos de ponta a ponta em `tests/e2e/*.spec.ts`
  (agenda-dashboard, autoatendimento, cardápio, conta, drawer, eventos, formulários, listas, mobile, orçamento,
  segurança, staff, templates).
  Os e2e usam os seeds, rodam em série (`workers: 1`) e limpam o que criam. Contra a VPS:
  `APP_URL=https://app.banket.com.br E2E_CONTAINER=banket-webapp_$(cat .deploy-ativo)-1 E2E_DB_CONTAINER=banket-postgres-1
  npx playwright test` (e-mails de teste sempre em `@example.com`).

---

## Variáveis de ambiente

| Variável | Uso |
|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | dono das tabelas (`banket_user` / `banket_db`) |
| `APP_DB_USER` / `APP_DB_PASSWORD` | papel da aplicação sujeito ao RLS (`banket_app`) |
| `DATABASE_URL` / `DATABASE_URL_SYSTEM` | montadas pelo compose; defina à mão só fora do Docker |
| `JWT_SECRET` | sessão, onboarding e print token (≥ 32 caracteres, obrigatório) |
| `APP_URL` | URL pública nos links de e-mail |
| `RESEND_API_KEY` / `MAIL_FROM` | e-mail; **obrigatório em produção**. Para o Inbox a chave precisa ser de **acesso completo** (uma chave "sending only" recebe 401 na Receiving API) |
| `RESEND_INBOUND_DOMAIN` / `RESEND_WEBHOOK_SECRET` | Inbox: domínio que recebe as respostas (`respostas.banket.com.br`, MX → Resend) e segredo `whsec_…` do webhook `/api/webhooks/resend`; sem o domínio, o Reply-To é o e-mail do usuário; sem o segredo, o webhook responde 503 |
| `OPENAI_TOKEN` / `OPENAI_MODEL` / `OPENAI_IMAGE_MODEL` | IA do template: sugestões de fontes/cores (padrão `gpt-4.1-mini`) e imagens de fundo (padrão `gpt-image-2`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | login com o Google e reuniões com Google Meet (cliente OAuth 2.0 "Aplicativo da Web" com a API Google Calendar ativada; URI de redirecionamento padrão `APP_URL/auth/google/callback`). Sem as chaves, botão e agendamento ficam ocultos |
| `UPLOAD_DIR` | uploads e PDFs (`/data/uploads` no contêiner) |
| `APP_PORT_BLUE` / `APP_PORT_GREEN` | portas do host em produção (5168 / 5169) |
| `HWESTA_APP_ID` / `HWESTA_MANAGER_URL` / `HWESTA_APP_KEY` / `HWESTA_MANAGER_KEY` | integração com o Manager Hwesta (só no compose de produção); sem as chaves a integração fica desligada |
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
- **Site institucional** (`site/`, <https://banket.com.br>): HTML estático sem build nem contêiner. É **página única**:
  todas as seções (hero, como funciona, recursos, para quem é, planos, dúvidas, contato) ficam no `index.html` e o menu
  usa âncoras; só páginas de fato separadas ganham arquivo `.html` próprio. `assets/css/design-system.css` é cópia
  concatenada de `design-system/tokens` e `components` (recopiar quando o design system mudar); `assets/css/site.css` e
  `assets/js/site.js` são do site (JS puro: passos do "Como funciona", cobrança mensal/anual, comparação, dúvidas,
  staff, formulário, menu do celular). Nginx: `/etc/nginx/sites-enabled/banket.com.br.conf` (root em
  `/var/www/banket/site`, `www` e HTTP redirecionam, `/_prototipo/` bloqueado); certificado `banket.com.br` (Certbot);
  DNS pelo Cloudflare (proxy), que guarda CSS/JS em cache: ao alterá-los, suba o `?v=` dos links no `index.html`.
  Publicar = salvar o arquivo. `site/_prototipo/` guarda o export original do Claude Design (runtime `support.js` +
  React), só como referência.
- **Agendamento da demonstração** (formulário de `#contato`): acoplado à Agenda do Manager Hwesta
  (`/var/www/hwesta/manager`, calendário público `crm-banket`, 30 min, Google Meet + e-mail pelo Resend). O navegador
  só chama `/api/agenda/slots` (GET), `/api/agenda/bookings` (POST) e `/api/agenda/ics/<token>` (GET) no próprio
  domínio; o Nginx repassa ao contêiner do Manager (`127.0.0.1:4329`, `/api/public/agenda/crm-banket/…`) com
  `snippets/banket-agenda-proxy.conf`, método restrito por rota, `limit_req` por IP real (`conf.d/banket-site.conf`,
  `CF-Connecting-IP`) e sem cookies. Não há chave de API no site: usa-se o modo público do Manager, que aplica limite
  por IP, campo-isca `website` e máximo de 3 chamadas abertas por e-mail. Plano e volume de eventos vão em `notes`.
  Cabeçalhos em `snippets/banket-site-headers.conf`: CSP `script-src 'self'` (nenhum script em linha nem externo —
  o beacon do Cloudflare Web Analytics fica bloqueado), `connect-src 'self'`, `frame-ancestors 'self'`, HSTS.
  No JS, tudo que vem da API entra por `textContent`; a tela de confirmação só mostra o convite `.ics` (token
  validado por regex) — o link do Meet e o de cancelar chegam pelo e-mail. Para testar de ponta a ponta sem sujar a agenda, cancele a reserva com
  `POST /api/public/agenda/bookings/<token>/cancel` no Manager.
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
- `conteudoSchema` descarta chaves desconhecidas: todo campo gravado numa versão congelada que precise sobreviver (ex.:
  `locacao.valor_calc`) tem de estar no schema; versões congeladas são recalculadas sem referências de locação.
- O webhook do Resend usa a conexão de sistema só para achar a empresa (token → conversa; `resend_id` → mensagem);
  o resto roda em `withTenant`. Anexos recebidos nunca são servidos inline. Reenvios do Resend são normais: idempotência
  por svix-id em `resend_events`.
- Faixas de locação gravadas pela versão anterior do código (sem `espaco_id`) pertencem ao espaço padrão; `local_padrao`
  e `email_assunto`/`email_corpo` ficaram sem uso até o próximo deploy.
- Tokens do Google são cifrados com chave derivada do `JWT_SECRET`: trocar o segredo invalida os vínculos (cada usuário
  precisa vincular de novo). `usuario_google` só é lida pela conexão de sistema (`server/googleConta.ts`); o resto das
  reuniões roda em `withTenant`. O Google só manda `refresh_token` no primeiro consentimento (ou com `prompt=consent`):
  por isso "Ativar agenda" usa `?agenda=1`.
- A lista de compras usa **todos** os convidados (crianças comem), não os pagantes equivalentes do cálculo de preço.
