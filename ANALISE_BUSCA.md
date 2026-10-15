# Banket Busca — Análise da aplicação e proposta de arquitetura

> Etapa 0 do projeto Banket Busca (marketplace de buffets, `busca.banket.com.br`). Elaborada em 15/10/2026 a partir
> do código em produção (`/var/www/banket`, commit `7f01768`), do banco ao vivo, do host (Nginx, DNS, Docker) e
> do layout exportado em `layout-busca/`. **Revisada no mesmo dia** depois das decisões de produto da seção 5 e da
> análise do modelo "Concierge gratuito" implementado no Yosp (`/var/www/yosp`, commits de 15/10/2026).
> Nada foi implementado ainda: o plano de execução está em [PLANO.md](PLANO.md).

## 0. Resumo executivo

- **Modelo aprovado: o Busca é uma funcionalidade do Banket, liberada por plano.** Nasce um sistema de planos no
  próprio app (catálogo, gating centralizado, histórico, trial) e o **Plano Busca** (custo zero) libera só o menu
  "Banket Busca". Os planos pagos (Essencial, Profissional, Prime) liberam os demais módulos conforme a matriz da
  proposta de preços. É o mesmo desenho do Yosp Concierge, adaptado a um app único e sem Stripe (por enquanto).
- **Arquitetura: módulo dentro do app** (opção (a) da seção 2). Páginas públicas do marketplace em
  `busca.banket.com.br` pelo mesmo processo (rewrite por host no middleware); área do buffet dentro de
  `app.banket.com.br`, no menu "Banket Busca". Sem segundo cookie, sem segundo deploy.
- **Fonte única do status "cliente Banket"**: `tenants.plano_id` + função SQL `fn_tenant_entitlements`, com
  override do Manager Hwesta. O catálogo de planos passa a ser do Banket (HCP `plans_catalog: true`), o que
  prepara o Stripe pelo padrão Hwesta sem mudar o gating.
- **O que ainda não existe e fica fora desta entrega**: cobrança (Stripe) e WhatsApp. Até lá, o trial vira
  pago pela ação do Manager (troca de plano/override) e o aviso ao buffet é por e-mail. O código nasce preparado
  para os dois (seções 2.5 e 2.8).
- **Ordem de execução**: a fase 1 é o sistema de planos e gating (toca middleware, menu e `tenants`), antes de
  qualquer tela do Busca. Detalhes, schema e fases em [PLANO.md](PLANO.md).

## 1. O que existe e pode ser reaproveitado

### 1.1 Stack, estrutura, build e deploy

| Item | Como está | Reaproveitamento pelo Busca |
|---|---|---|
| Framework | Astro 7.3 SSR, adapter `@astrojs/node` standalone, `security.checkOrigin` + `allowedDomains` | Páginas públicas SSR (SEO) saem de graça. `allowedDomains` precisa ganhar `busca.banket.com.br` |
| Ilhas | Preact 10 (Kanban, construtor de orçamento, editores) | Filtros, seleção múltipla, galeria e onboarding com salvamento por etapa |
| Validação | zod 4 + preprocessadores de `lib/forms.ts` | Todos os formulários do Busca |
| Build/imagem | `Dockerfile` multi-stage, node 22-alpine + Chromium; `CMD` roda migrations e sobe | Nada muda: o Busca entra no mesmo build |
| Deploy | Blue-green (`scripts/deploy-remoto.sh`), upstream `banket_app` no Nginx, `.deploy-ativo` | Mesmo deploy. O vhost `busca.banket.com.br` aponta ao **mesmo upstream** |
| Host | Nginx + Certbot; `app.banket.com.br` e `banket.com.br` já atrás do **Cloudflare** (proxy) | Precisa de registro DNS, vhost e certificado para `busca.` (seção 3.9) |
| Testes | Vitest (32 arquivos unitários em `src/**`), Playwright (23 specs e2e contra o dev no ar) | Mesmas ferramentas. **Não há lint** no projeto: "lint" = `npx astro check` |
| Site | `site/` estático em `banket.com.br`, com planos e agendamento de demo via Manager | Destino dos CTAs de upsell enquanto não há Stripe |

### 1.2 Banco de dados

- PostgreSQL 15, sem ORM (`pg` + SQL à mão), PKs UUID, migrations numeradas (`000`…`030`) aplicadas pelo
  `scripts/migrate.mjs` na subida do contêiner, uma transação por arquivo, com `schema_migrations`.
- **Multi-tenant por RLS**: toda tabela de negócio tem `tenant_id` + `aplicar_rls('tabela')`; o papel `banket_app`
  (`NOSUPERUSER NOBYPASSRLS`) só enxerga o tenant da transação (`withTenant`). O papel `banket_user` (dono,
  superuser) é usado nos fluxos sem empresa (`withSystem`/`systemQuery`).
- `ensureAppRole` concede privilégios **no schema `public`**. Um schema Postgres `busca` separado exigiria mexer
  nesse script e no `aplicar_rls`; por isso a proposta é **prefixo `busca_` no `public`** (mesma convenção das
  tabelas `fin_`, `pesquisa_`, `hwesta_`).
- Extensões: `pgcrypto` e `uuid-ossp` instaladas; `cube`, `earthdistance`, `pg_trgm` e `unaccent` **disponíveis**
  (contrib) e instaláveis por migration (o dono é superuser). **`postgis` não existe na imagem.**
- Reaproveitável diretamente pelo Busca: `tenants` (empresa = buffet), `usuarios`/`tenant_usuarios`, `auth_tokens`,
  `eventos` + `clientes` + `status_orcamento` (lead no funil), `cardapio_opcoes` (+ seções e itens: cardápio
  detalhado), `espacos` (espaço próprio x domicílio, capacidade, endereço), `configuracoes_tenant`,
  `hwesta_entitlements` (plano), `evento_timeline`.

### 1.3 Autenticação, usuários, tenants e permissões

- Sessão: JWT HS256 (`jose`) em cookie `banket_session` httpOnly, **sem atributo `Domain`** (host-only em
  `app.banket.com.br`). Papel e nome vêm do banco a cada request (`getMembership`, cache 30 s).
- Autoatendimento completo em `server/autoatendimento.ts`: cadastro com verificação de e-mail (24 h), login por
  senha (bcrypt no Postgres), link de acesso (15 min), recuperação (1 h), **login com Google**, convites.
  Rate limits em memória (`lib/rateLimit.ts`). Política de senha em `lib/senha.ts`.
- `criarEmpresa` cria o tenant (slug único, CPF/CNPJ único) e aplica `aplicar_padroes_tenant_completo`. Recusa quem
  já tem empresa e quem repete o documento.
- Papéis `owner | admin | usuario`; `isAdmin()`; middleware restringe `/configuracoes`, `/financeiro`.
- Kill-switch do Manager: `tenants.status` ≠ `active` bloqueia o app (`/conta-suspensa`).
- **Reaproveitamento**: o cadastro gratuito do Busca é o **mesmo fluxo** (`cadastrarConta` → verificação →
  `criarEmpresa` com os padrões), apenas com telas no domínio do Busca e um flag no tenant dizendo que a conta
  nasceu no Busca e **não tem acesso ao app** (seção 2.4). A migração para pagante é só trocar o plano: sem recadastro.

### 1.4 Billing e assinaturas — o que existe de fato

| Peça | Situação |
|---|---|
| Stripe no Banket | **Não existe** (nenhuma dependência, variável, rota ou tabela) |
| Planos | Catálogo vive no **Manager Hwesta**; o Banket declara `plans_catalog: false` e recebe o snapshot por `PUT /api/hwesta/v1/accounts/:id/entitlements` → `hwesta_entitlements` (`plan_slug`, `plan_name`, `status` ∈ `active · trial · past_due · suspended · canceled`, `capabilities` JSONB) |
| Leitura do plano | `can()`, `limit()`, `withinLimit()` em `lib/hwesta/entitlements.ts` (cache 60 s). **Regra atual: empresa sem snapshot não sofre restrição** — nenhuma tela consulta isso hoje |
| Produção | `hwesta_entitlements` está **vazia**; 3 tenants. Para o Busca distinguir "cliente Banket", o Manager precisa empurrar o plano das empresas atuais |
| Trial / webhooks | Não há. O Manager tem tela de "Plano (sem cobrança — trial/pré-ativação)" e botões de Stripe que dependem de o app expor o espelho de cobrança (padrão Hwesta, ainda não implementado no Banket) |
| Padrão de referência | `/var/www/hwesta/stripe/README.md`: assinatura por cartão e Pix, Checkout/Portal hospedados, espelho local em `tenants.stripe_*` + `subscription_status`, `invoices`, `stripe_events`, webhook idempotente, `computeBillingState` pura, guard 402 no middleware, agendador |
| Proposta comercial | `proposta-precificacao-planos.md` (11/10): Essencial R$ 97 · Profissional R$ 197 · Prime R$ 297; chaves de `capabilities` sugeridas (`concierge`, `envio_integrado`, `cardapios`…). Boa base para a chave `busca` do gating |

Consequência para o Busca: a "fonte única da verdade" do status de cliente é, hoje, **`hwesta_entitlements.status`
+ `tenants.status`**; quando o Stripe for implementado pelo padrão Hwesta, passa a ser `tenants.subscription_status`.
O módulo de gating (2.5) encapsula isso num lugar só, para a troca não tocar o resto do Busca.

### 1.5 Módulos que o Busca reaproveita

| Necessidade do Busca | O que o Banket já tem | Como reaproveitar |
|---|---|---|
| Lead do pedido de orçamento no funil do cliente Banket | `criarEvento(db, {tenantId, id:null}, briefing, clienteNovo, origem)` + `clienteDoPedido`/`briefingDoPedido` do formulário público; `statusDeEntrada` (variante `novo`); timeline `formulario`; e-mail de confirmação ao solicitante | Chamar o mesmo caminho com `origem = 'busca'` (migration amplia o CHECK) e tipo de timeline `busca`. O Kanban mostra o card sem nenhuma mudança |
| Orçamentos versionados, proposta em PDF, Inbox, parcelas | `server/orcamento.ts`, `pdf.ts`, `envio.ts`, `conversas.ts`, `financeiro.ts` (plano de pagamento) | Não entram no Busca; são o **argumento de upsell** ("este pedido já entraria no funil, você geraria a proposta em PDF") e ficam liberados no app quando o buffet vira cliente |
| Cardápios detalhados (cliente Banket) | `cardapio_opcoes` (nome, descrição, preço por pessoa, formato, tags) → `cardapio_opcao_secoes` → itens com restrições | Pacote do Busca pode apontar para uma opção (`busca_pacotes.cardapio_opcao_id`); o perfil público lê seções e itens ao vivo. Sem cadastro duplicado |
| Disponibilidade na data (cliente Banket) | `eventos.data_evento` + `status_orcamento.variante = 'aprovado'`; `espacos`; agenda (`server/agenda.ts`) | "Disponível" = nenhum evento aprovado na data (+ bloqueios manuais do Busca). O layout já prevê "Sincronizar com a agenda do Banket" |
| Espaço próprio / domicílio, capacidade, endereço | `espacos` (`tipo proprio|terceiro`, `capacidade_min/max`, `endereco`, `cidade`) | Pré-preenche a etapa 3/4 do onboarding para clientes Banket |
| Dados da empresa, logo | `tenants` (nome, razão social, CNPJ, e-mail, telefone, endereço, `logo_path`) | Pré-preenche a etapa 1 |
| Notificações por e-mail | `lib/mail.ts` (Resend; sem chave → log), `emailLayout`, `mensagemHtml`, `dominioReservado` (e2e) | Confirmação ao cliente, aviso ao buffet, link de avaliação |
| WhatsApp | **Não há** | Ver 1.8 e D8 |
| Upload de arquivos | `lib/storage.ts` (disco por tenant), `FileUpload.astro` (arrasta/solta, compressão no navegador) | Logo e galeria. **`/uploads/*` é sempre privado**: fotos públicas precisam de rota pública (3.6) |
| Links de uso único | `lib/tokens.ts` (32 bytes, só SHA-256 no banco), `auth_tokens` | Link de avaliação por e-mail (novo tipo ou tabela `busca_avaliacao_tokens`) |
| Anti-spam | `permitir()`/`ipDaRequisicao()` + honeypot `_website` (formulário público, pesquisa) | Mesmo padrão nos formulários públicos do Busca (ver ressalva do Cloudflare em 3.8) |
| Validação de CNPJ/CPF | `lib/documento.ts` + máscaras `data-mascara="cnpj"` | Etapa 1 |
| Paginação, ordenação, CSV | `lib/pagination.ts`, `lib/ordenacao.ts`, `lib/csv.ts` | Listas da área do buffet e relatório de upsell |
| Linha do tempo | `registrarTimeline` | Lead do Busca e respostas registradas no evento |
| Feature flags por plano | `can()/limit()` de `lib/hwesta` | Base do gating (2.5) |
| Relatório para admin | `pages/dashboard` (StatCard, FunnelBreakdown) e `server/dashboard.ts` | Padrão visual do dashboard do buffet e do relatório de `upsell_events` |

### 1.6 Design system e componentes de interface

O layout em `layout-busca/` foi exportado do Claude Design sobre o **mesmo design system** do app
(`_ds/banket-design-system-f9651f…`, idêntico a `design-system/`): tokens, General Sans, Tabler, cards 12 px,
terracota/argila. As telas usam os componentes React do kit; a aplicação já implementa os equivalentes em Astro/CSS:

| No layout (`BanketDesignSystem_f9651f.*`) | Na aplicação |
|---|---|
| Field, TextInput, Select, Textarea | `.field` + `label` + `.control`, `.form-grid` (`global.css`) |
| Button, IconButton | `components/ui/Button.astro`, classes `.btn .btn-*` |
| Checkbox, Switch | `Checkbox.astro`, `.switch`, `.chip` |
| FileField | `FileUpload.astro` |
| Drawer (pedido de orçamento, pacote) | `Drawer.astro` (fetch + JSON, erros por campo, tela cheia no celular) |
| Table, Pagination | `Table.astro` (vira cartão no celular), `Pagination.astro` |
| Tag, StatusBadge, StageDot | `.tag`, `.badge`, `.status-name` |
| Card, EmptyState, Toolbar | `SectionCard.astro`, `EstadoVazio.astro`, `PageToolbar.astro` |
| StatCard | padrão de `pages/dashboard/index.astro` (extrair para `components/ui/StatCard.astro`) |
| Sidebar, AppHeader, Tabs | `Sidebar.astro`/`MobileNav.astro` (hoje presos a `NAV_PRINCIPAL`), `Topbar.astro`, `Submenu.astro` |
| ActionBar (barra "3 buffets selecionados") | `.orc-barra` de `styles/orcamento.css` (generalizar) |
| CalendarMonth (disponibilidade) | grade do mês de `pages/agenda/index.astro` |
| Logo + pill "busca", Avatar, ProgressBar, estrelas de avaliação, galeria, filtros em gaveta, BuffetCard | **Novos** (ProgressBar e Avatar existem no kit, não no app) |

Telas do layout, em ordem, e a adaptação exigida pelo briefing:

| # | Tela | Observação |
|---|---|---|
| 01 | Home (buscador guiado, categorias, serviços, como funciona, destaques, depoimentos, chamada a buffets) | Header/footer públicos (`BuscaHeader`, `BuscaFooter`) são novos layouts, sem sidebar |
| 02 | Resultados (resumo editável, filtros lateral/gaveta, ordenação, seleção múltipla, barra fixa, estado vazio) | Filtros na URL; `BuffetCard` com selo "Usa o Banket para gerenciar eventos e orçamentos" → rótulo "Cliente Banket"; "Disponível em dd/mm" só para clientes Banket, "Consultar disponibilidade" para os demais |
| 03 | Perfil do buffet (galeria, sobre, eventos, pacotes com preço, área, avaliações, orçamento) | Cardápio detalhado e calendário só para cliente Banket |
| 04 | Pedido de orçamento (gaveta/tela cheia, evento pré-preenchido, confirmação) | Um registro por buffet selecionado |
| 05 | Onboarding em **8 etapas** (Empresa · Eventos e serviços · Região · Capacidade · **Cardápios e pacotes** · Fotos · **Disponibilidade** · Revisão) | **Adaptar**: etapa 5 vira "Pacotes" (sem cardápio); "Cardápios" e "Disponibilidade" saem da sequência obrigatória e aparecem na lista com cadeado "Exclusivo Banket" (painel explicativo + CTA para o gratuito; liberadas e sincronizadas para o cliente Banket). Publicação exige as etapas 1–6 |
| 06 | Painel (Início com métricas, Pedidos + detalhe/resposta, Editar perfil, Cardápios, Fotos, Disponibilidade, Avaliações, Prévia, "Conectar ao Banket") | "Conectar ao Banket" vira a conexão automática pelo tenant; os cards "Sincronizado com o Banket"/"Importar do Banket" só para clientes |

O export traz `support.js`/`image-slot.js` (runtime do Claude Design) e componentes React: **nada disso entra no
build**; serve como especificação visual, como já acontece com `design-system/` e `site/_prototipo/`.

### 1.7 Padrões de código, testes e convenções

- Regras de negócio em `src/server/<dominio>.ts` recebendo `db: Db`; páginas só orquestram; POST na própria página
  com flash + redirect (`handleFormPost`), JSON para ilhas (`jsonEndpoint`/`readJson`); erros com `UserError` e
  `userMessage()`; HTML fora de Astro com `html\`\`` de `lib/html.ts`.
- Funções puras testáveis em `src/lib/**` (cálculo, modelo de formulário) — o **ranking** do Busca segue esse molde
  (`lib/busca/ranking.ts` sem `db`), com pesos configuráveis e testes Vitest.
- E2e em série contra o dev (ou contra a VPS com `E2E_CONTAINER`), limpando o que criam; e-mails `@example.com`
  nunca saem (`dominioReservado`).
- Convenções a seguir no Busca: português em tudo, sentence case, só tokens do design system, Tabler, mobile em
  media queries, `withTenant` para dados da empresa, validação de FK no tenant.

### 1.8 O que não existe e precisa ser criado (ou decidido)

| Lacuna | Impacto |
|---|---|
| **Stripe / fluxo de assinatura** | CTAs de upsell não têm para onde apontar dentro do app. D9 (seção 5) |
| **WhatsApp** | "número único do Banket" não existe; só o serviço não oficial da Hwesta ou a Cloud API. D8 (seção 5) |
| Geocodificação e base de cidades | Sem nenhuma fonte de lat/lng. Proposta: tabela `busca_cidades` com os municípios (IBGE + centroide) carregada por seed/migration de dados, e CEP → cidade via ViaCEP (sem chave). D7 (seção 5) |
| Arquivos públicos | `/uploads/*` exige sessão do mesmo tenant: fotos e logos do perfil precisam de rota pública com cache |
| SEO | `Layout.astro` tem só `<title>` e uma description fixa; não há Open Graph, schema.org, sitemap, robots nem `site` configurado. Tudo novo (e simples) no layout público do Busca |
| Cache de páginas públicas | O app serve tudo com cookie/sessão; páginas públicas do Busca precisam de `Cache-Control` público e, no Nginx/Cloudflare, cache curto para aguentar robôs |
| Avaliações, métricas (visualizações, aparições), eventos de funil | Tabelas e contadores novos (`busca_*`) |
| Sidebar reutilizável | `Sidebar`/`MobileNav` recebem a lista fixa `NAV_PRINCIPAL`; a área do buffet precisa de outra lista |

---

## 2. Arquitetura aprovada

### 2.1 Comparação das opções (resumo)

| Critério | (a) Módulo no app, tabelas `busca_` no mesmo Postgres | (b) App Astro separado no monorepo, banco e código comuns | (c) App separado por API/SSO |
|---|---|---|---|
| Reaproveita banco, tenants, auth, e-mail, uploads, componentes | Direto | Só depois de extrair `src/lib` e `src/server` para um pacote (eles dependem de `import.meta.env`, `astro:middleware`, tipos do Astro) | Duplicação |
| Lead no funil, cardápios, agenda, plano | Chamadas locais, mesma transação | Pacote compartilhado acaba sendo `src/server` inteiro | API nova + webhooks |
| Deploy | Nada novo: 1 vhost a mais no mesmo upstream | 2 imagens, 2 blue-green, 2 upstreams, decidir quem roda migrations | 2 pipelines |
| SEO/subdomínio | Rewrite por host no middleware (Astro 7 suporta `next('/caminho')`); sitemap/robots por rota dinâmica | Limpo | Limpo |
| Risco para a produção | Baixo (módulo aditivo, como Financeiro e Pesquisas) + mudanças no middleware testadas | Alto (refatoração antes de qualquer feature) | Médio/alto |

**Escolhida: (a).** O modelo "Busca = funcionalidade por plano" reforça a escolha: a área do buffet **é** o app
Banket com o menu reduzido pelo plano, o que elimina a sessão compartilhada, o handoff e o layout de painel
separado que a primeira versão desta análise previa.

### 2.2 Organização do código

```
src/lib/planos/           recursos.ts (catálogo de recursos: slug, rótulo, tipo, grupo), rotas.ts (prefixo → recurso, puro),
                          gating.ts (leitura de fn_tenant_entitlements com cache 15 s; podeUsar/limite/dentroDoLimite)
src/server/planos.ts      transições: trocarPlano, iniciarTrial, recusarTrial, rebaixarParaBusca, restaurarAposUpgrade,
                          excedentes; histórico; avisos do trial (D-7, D-1, D0)
src/server/busca/         perfil.ts, pacotes.ts, fotos.ts, pedidos.ts, avaliacoes.ts, metricas.ts, upsell.ts,
                          publico.ts (leituras cruzadas, conexão de sistema, READ ONLY), sincronizacao.ts (cliente Banket)
src/lib/busca/            ranking.ts, matching.ts, catalogos.ts (tipos de evento/serviço globais), seo.ts, geo.ts (puros)
src/pages/busca/**        área do buffet (menu "Banket Busca"), em app.banket.com.br
src/pages/vitrine/**      páginas públicas, servidas em busca.banket.com.br pelo rewrite de host
src/pages/api/busca/**    JSON da área do buffet; src/pages/api/vitrine/** JSON público (pedido, cidades)
src/pages/planos.astro    comparação de planos + CTA (trial / falar com a equipe)
src/components/busca/     BuffetCard, filtros, galeria, onboarding (Preact), cadeado/upsell, prévia
src/layouts/VitrineLayout.astro (público, SEO)   src/styles/busca.css
db/migrations/031_planos.sql · 032_busca.sql · 033_busca_cidades.sql   db/seeds/010_busca_demo.sql
```

### 2.3 Subdomínio e roteamento

- Nginx: vhost `busca.banket.com.br` → `proxy_pass http://banket_app` (mesmo upstream e blue-green), certificado
  Certbot, DNS no Cloudflare com proxy. `CF-Connecting-IP` passa a ser o IP real (seção 3.8).
- Middleware: `Host = BUSCA_HOST` → `next('/vitrine' + pathname)`; URL pública limpa (`/buffet/[slug]`,
  `/buffet/casamento/campinas`). No host do app, `/vitrine/*` responde 404 (em dev, `localhost:4321/vitrine/*`
  funciona direto). Páginas da vitrine são públicas, sem sessão, com `Cache-Control: public, s-maxage=300`.
- `astro.config`: `allowedDomains` ganha `busca.banket.com.br`. Links absolutos da vitrine usam `BUSCA_URL`.

### 2.4 Planos, contas e os dois perfis de buffet

- **Catálogo no app** (`planos`, com `recursos JSONB` por plano). Planos: **Busca** (gratuito, público só na
  vitrine), **Essencial**, **Profissional**, **Prime** (públicos) e **Completo** (interno, não público, tudo
  liberado: backfill das empresas atuais). O site institucional continua lendo os preços do próprio JS; a página
  `/planos` do app lê o catálogo.
- **Vínculo**: `tenants.plano_id`, `trial_ate`, `trial_iniciado_em`, `trial_usado_em`, `trial_recusado_em`,
  `plano_rebaixado_em`, `origem_cadastro` (`site | busca`). Toda mudança passa por `server/planos.ts` e grava
  `tenant_plano_historico`.
- **Perfil gratuito** = plano Busca. **Cliente Banket** = qualquer plano não gratuito, em trial ou ativo.
  O `nivel` (`gratuito | cliente`) fica materializado em `busca_perfis` a cada transição (ranking e selo leem
  uma coluna, sem join com planos em cada busca).
- **Cadastro**: o mesmo autoatendimento (`cadastrarConta` → verificação → `criarEmpresa`), com `?plano=busca`
  quando vem da vitrine. Conta do Busca nasce no plano Busca, sem trial, e cai em `/busca` depois do login.
  Cadastro pelo site nasce em **trial de 30 dias do Profissional** (`trial_ate`) e cai no dashboard.
- **Trial a partir do Busca**: owner/admin clica num cadeado ou em "Iniciar teste grátis" → escolhe o plano →
  `trial_ate = hoje + 30`, menu abre. Uma vez por empresa (`trial_usado_em`). No fim: se o Manager não
  converteu, volta ao plano Busca (D+1 12h, `America/Sao_Paulo`), com avisos D-7, D-1 e D0 por e-mail.
- **Rebaixamento nunca apaga.** Excedentes do plano Busca: usuários além de 1 (owner sempre fica) ficam
  `ativo = false` com `bloqueado_plano_em`; fotos além de 5, tipos de evento/serviço além de 3 ficam marcados
  como excedentes e fora do perfil público; históricos além de 3 meses deixam de aparecer. Upgrade restaura tudo.

### 2.5 Feature gating centralizado

Uma função SQL `fn_tenant_entitlements(uuid)` (`SECURITY DEFINER`, como no Yosp) devolve
`{ plano_slug, plano_nome, gratuito, trial: {ate, dias} | null, recursos: {slug: valor} }`, onde
`valor = override do Manager ?? planos.recursos[slug]`. O catálogo de recursos (`lib/planos/recursos.ts`) é a lista
tipada de slugs:

| Grupo | Recursos (booleanos) | Limites (`-1` = sem limite) |
|---|---|---|
| Módulos do app | `propostas` (funil, orçamento, PDF, dashboard), `inbox`, `cardapios`, `clientes`, `agenda`, `formularios`, `financeiro`, `estoque`, `staff`, `espacos`, `templates`, `documentos`, `pesquisas`, `reunioes`, `ia`, `configuracoes` | `usuarios`, `espacos`, `templates`, `cardapios_opcoes`, `formularios`, `documento_modelos`, `email_modelos`, `estoque_itens`, `ia_analises_mes`, `ia_fundos_mes` |
| Busca | `busca` (sempre `true`), `busca_cardapios`, `busca_disponibilidade`, `busca_prioridade`, `busca_selo`, `busca_fotos_tags`, `busca_aviso_email`, `busca_aviso_whatsapp` | `busca_fotos` (5 no gratuito), `busca_tipos_evento` (3), `busca_tipos_servico` (3), `historico_meses` (3) |

Regras: (1) toda checagem no **servidor** (middleware por prefixo de rota, `podeUsar()`/`dentroDoLimite()` nos
pontos de criação, consultas de histórico com o recorte de meses); a UI só espelha; (2) resposta padronizada
`403 { code: 'RECURSO_FORA_DO_PLANO' | 'LIMITE_DO_PLANO', recurso, limite, uso, upgrade_url }`, páginas bloqueadas
redirecionam para `/busca?bloqueado=<recurso>` (gratuito) ou `/dashboard?bloqueado=` (pagos) abrindo o painel de
upsell; (3) empresa **sem plano** = permissiva (como hoje), mas depois do backfill nenhuma fica assim; (4) cache de
15 s por tenant, invalidado em toda transição.

Plano Busca: `busca = true`, `busca_aviso_email = false`, limites acima, todos os módulos `false`, `usuarios = 1`.
Planos pagos: matriz da proposta de preços (seção 11.1), com `busca_* = true` e `busca_fotos = -1`.

### 2.6 Dados públicos, busca e geolocalização

- Leituras cruzadas (resultados, perfil, landings, sitemap) só em `server/busca/publico.ts`, conexão de sistema em
  transação `READ ONLY`, filtrando `publicado` e `tenants.status = 'active'`. Escritas públicas (pedido, avaliação,
  métricas) entram por `withTenant` do buffet alvo.
- **earthdistance + cube** (migration `CREATE EXTENSION`): `lat/lng` em `busca_perfis` e `busca_cidades`, índice
  GiST em `ll_to_earth`, `earth_distance()` em metros. PostGIS não existe na imagem `postgres:15-alpine` e trocá-la
  em produção não se justifica para raio em km. `unaccent` + `pg_trgm` para o autocomplete de cidade/bairro.
- Base de cidades: municípios do IBGE com centroide (lat/lng) numa migration de dados; CEP → cidade via ViaCEP no
  onboarding (sem chave); geocodificação de endereço exato fica para depois.
- **Ranking** em `lib/busca/ranking.ts` (puro, pesos configuráveis, testes): filtro eliminatório → grupo (cliente
  antes de gratuito) → pontuação (completude, avaliação, taxa de resposta, distância). Detalhes no PLANO.md.

### 2.7 Pedidos, pedidos no funil e comunicação

- Um pedido da vitrine gera, **para cada buffet escolhido**, dentro do tenant dele: cliente (reaproveitado pelo
  e-mail), **evento** `origem = 'busca'` na etapa de entrada (card no Kanban), `busca_pedidos` (dados do pedido,
  status) e a **conversa** do evento no Inbox com a mensagem do cliente. O solicitante recebe confirmação por
  e-mail; o buffet responde pela tela "Pedidos" do menu Banket Busca (thread reaproveitada de `inbox/Conversa.astro`),
  e a resposta sai por e-mail com `Reply-To` da conversa.
- **Plano Busca** vê e responde os pedidos só dentro do app ("só recebe inbox"); os módulos Propostas e Inbox
  continuam com cadeado. Planos pagos recebem também o aviso por e-mail (`busca_aviso_email`) e, quando existir, por
  WhatsApp (`busca_aviso_whatsapp`, atrás de `lib/whatsapp.ts` injetável).
- Status do pedido (novo, respondido, em negociação, fechado, perdido) deriva do evento: etapa de entrada sem resposta
  = novo; com resposta = respondido; `negociacao` = em negociação; `aprovado` = fechado; `recusado` = perdido. O
  gratuito muda a etapa pela própria tela de pedidos; o pago, pelo Kanban ou pela tela.

### 2.8 O que fica preparado para depois

- **Stripe** (padrão Hwesta): `planos.stripe_*` já nascem no schema; `trocarPlano` é o único ponto de transição e
  ganhará `promoverPeloStripe`. Até lá, a conversão do trial é do Manager via HCP (troca de plano aceita quando o
  `plan_slug` existe no catálogo; `capabilities` continuam como override).
- **WhatsApp**: `busca_aviso_whatsapp` no catálogo e `lib/whatsapp.ts` com provedor nulo.

---

## 3. O que precisa mudar no Banket

Tudo aditivo e compatível com a cor anterior do blue-green. Em ordem de impacto:

1. **Middleware** (`src/middleware.ts`): gate por plano (prefixo → recurso, 403/redirect), rewrite por host para a
   vitrine, rotas públicas novas, página inicial por plano. Lógica em funções puras testadas.
2. **`tenants`** (migration): `plano_id`, colunas do trial e do rebaixamento, `origem_cadastro`. Backfill: as 3
   empresas no plano Completo; `tenant_plano_historico` com uma linha `migracao` por empresa.
3. **HCP** (`lib/hwesta/adapter.ts`): `plans_catalog: true` (`listPlans` lê `planos`), `applyEntitlements` passa a
   trocar o plano pelo `plan_slug` (via `server/planos.ts`) e a gravar `capabilities` como override;
   `getAccount` devolve `plan_slug`/status com trial. Combinar com o Manager a leitura do catálogo.
4. **Menu** (`lib/nav.ts`, `Sidebar.astro`, `MobileNav.astro`): `recurso` por item, estado com cadeado, item "Banket
   Busca" com a marca própria e o indicador "Publique seu perfil", card do plano no rodapé (gratuito: "Plano Busca ·
   Iniciar teste grátis"; trial: dias restantes). `Sidebar`/`MobileNav` ganham `items` opcional.
5. **Autoatendimento** (`server/autoatendimento.ts`): `criarEmpresa` recebe o plano de origem (`busca` ou trial do
   Profissional), grava histórico e origem; página inicial por plano no login/verificação/Google.
6. **Pontos de limite** (proposta de preços, 11.2): `withinLimit` em templates, cardápios, formulários, documentos,
   convites/usuários, espaços, estoque, IA, e-mails. Hoje nenhum é consultado.
7. **Uploads**: rota pública `/busca-media/[tenant]/[...key]` só para a pasta `busca/` do tenant, com cache público.
8. **IP real atrás do Cloudflare**: `set_real_ip_from` + `real_ip_header CF-Connecting-IP` no Nginx (o app lê
   `X-Real-IP`). Hoje os limites de login/cadastro valem por borda do Cloudflare, não por visitante.
9. **`criarEvento`/`timeline`**: `origem = 'busca'` (CHECK recriado) e tipo `busca` na linha do tempo.
10. **Agendador mínimo** (`server/agendador.ts`): `setInterval` singleton por processo (como o Yosp faz no
    `middleware.js`) para o rebaixamento D+1 12h e os avisos do trial, com dedup por tabela (as duas cores podem
    rodar ao mesmo tempo). Hoje o Banket não tem nenhum job periódico.
11. **Host e DNS** (fora do git): registro `busca.banket.com.br`, vhost + Certbot, `BUSCA_URL`/`BUSCA_HOST` no
    `.env` e no compose.
12. **Documentação**: `CLAUDE.md`/`AGENTS.md`, `DEPLOY.md`, `INTEGRACAO_HWESTA.md`, `.env.example`.

---

## 4. Riscos e impactos na aplicação em produção

| Risco | Prob. / impacto | Mitigação |
|---|---|---|
| Gate por plano bloqueia indevidamente uma empresa paga (regressão) | Média / alto | Backfill no plano Completo (tudo `true`, `-1`), "sem plano = permissivo", e2e `plan-gating` com conta paga antes e depois |
| Erro no middleware (host, gate) derruba ou expõe rotas | Baixa / alto | Funções puras testadas, `seguranca.spec.ts`, blue-green com rollback |
| Leituras públicas pela conexão de sistema vazam dados | Baixa / alto | Módulo único, `READ ONLY`, só colunas públicas, teste de não exposição (perfil não publicado, tenant suspenso) |
| Robôs/SEO competem com o app no mesmo processo e pool | Média / médio | `s-maxage` no Cloudflare, rate limit por host no Nginx, pool de leitura pública próprio |
| Rebaixamento automático por um agendador novo (bug = empresa paga rebaixada) | Baixa / alto | Só rebaixa plano **em trial** com `trial_ate` vencido e sem conversão; nunca toca plano pago sem trial; log + histórico; teste |
| Conta gratuita com mais de 1 usuário/5 fotos/3 tipos após rebaixamento | Certa / baixo | Regra de excedentes (mantém os mais recentes, owner sempre), tela "itens além do limite" |
| Manager e app divergem sobre o plano | Média / médio | Catálogo no app (HCP `plans_catalog`), push aceito só com `plan_slug` existente; override só em `capabilities` |
| Spam nos formulários públicos; limite por IP ineficaz atrás do Cloudflare | Alta / médio | Item 3.8, honeypot, limite por e-mail/telefone, confirmação por e-mail |
| Migrations tocam `tenants`, `eventos`, `tenant_usuarios` | Baixa / médio | Só `ADD COLUMN` com default e CHECK mais permissivo |
| LGPD: dados do solicitante vão a vários buffets; avaliações públicas | Média / médio | Consentimento explícito no pedido, `/privacidade`, avaliação só por link de pedido real, retenção |
| Volume de e-mail (Resend) | Média / baixo | 2 e-mails por pedido + avisos de trial; cota em `emails_mes` |
| Caches em memória por instância (gating, membership, rate limit) | Já existe / baixo | Invalidação em toda transição; relevante só na troca blue-green |

---

## 5. Decisões de produto (fechadas em 15/10/2026)

| # | Decisão | Resposta |
|---|---|---|
| D1 | Arquitetura | Módulo dentro do app; vitrine pública em `busca.banket.com.br`; área do buffet no menu "Banket Busca" |
| D2 | Catálogo de planos | No app (`planos`), HCP `plans_catalog: true`; Manager envia override e pode trocar o plano |
| D3 | Empresas atuais e cadastros pelo site | Backfill no plano **Completo** (interno); cadastro pelo site = trial de 30 dias do Profissional; conversão pelo Manager enquanto não há Stripe |
| D4 | Plano Busca | Custo zero, 1 usuário, só o menu Banket Busca. Limites: aviso de pedidos só dentro do app; 3 tipos de evento e 3 tipos de serviço; sem cardápio; 5 fotos (pagos: sem limite e com tags); histórico de 3 meses (mensagens e eventos fechados/perdidos) |
| D5 | Fim do trial sem assinatura | Cai para o plano Busca (D+1 12h), dados preservados |
| D6 | Trial a partir do Busca | Na primeira versão: a qualquer momento, uma vez por empresa, 30 dias, volta ao Busca se não converter |
| D7 | Geolocalização | earthdistance + cube; cidades do IBGE com centroide; CEP via ViaCEP |
| D8 | WhatsApp | Fora da primeira versão; catálogo e módulo injetável preparados |
| D9 | Stripe | Fora da primeira versão; schema e ponto único de transição preparados para o padrão Hwesta |
| A1 (suposição) | "Free só recebe inbox" | Lido como: o gratuito é avisado e conversa só dentro do app (thread do pedido); os pagos recebem também e-mail e, no futuro, WhatsApp. Corrigir se for outro o sentido |
| A2 (suposição) | Relatório de `upsell_events` para admin | Endpoint HCP para o Manager (`/api/hwesta/v1/metrics/busca-funil`) + visão SQL; sem tela própria no Banket |

## 6. Próximo passo

[PLANO.md](PLANO.md): schema das tabelas de planos e `busca_*`, rotas, ranking, gating, seed e as fases de execução
com critérios de validação (`npm run build`, `npx astro check`, `npm test`, e2e).
