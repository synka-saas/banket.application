# Banket

SaaS multi-empresa (multi-tenant) para buffets e casas de eventos. Cobre captação do pedido (formulário público
ou cadastro manual), quadro de vendas (Kanban), orçamento versionado montado a partir do catálogo (cardápios,
bebidas, staff, locação), geração do PDF da proposta, envio por e-mail, agenda e dashboard.

Produção: <https://app.banket.com.br>. Deploy e operação da VPS estão no [DEPLOY.md](DEPLOY.md).

## Stack

- **Astro 7 SSR** (adapter Node) + **Preact** nas telas interativas (Kanban, construtor de orçamento, editores).
- **PostgreSQL 15** com **Row Level Security** por empresa. Acesso com `pg`, sem ORM; validação com **zod**.
- **Chromium** (playwright-core) para gerar o PDF da proposta; **pdf-lib** para juntar capa/conteúdo/contracapa.
- **Resend** para e-mails (sem chave, os e-mails vão para o log do servidor).
- Tudo em **Docker Compose**. Uploads (logos, imagens, PDFs) ficam no volume `/data/uploads`.

## Rodando localmente

Pré-requisitos: Docker e Node 22+ (Node só é necessário para testes e checagem de tipos no host).

```bash
cp .env.example .env              # preencha JWT_SECRET: openssl rand -base64 48
npm install                       # dependências no host (testes, astro check)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build   # ou: make dev
```

Acesse <http://localhost:4321>. No ambiente de dev, o contêiner aplica as migrations **e os seeds de demonstração**
ao subir.

| Usuário | Senha | Empresa | Papel |
|---|---|---|---|
| leandro@banket.com.br | Banket.2026 | Banket | Proprietário |
| operacao@banket.com.br | Banket.2026 | Banket | Usuário |
| demo@outrobuffet.com.br | Banket.2026 | Outro Buffet | Proprietário (teste de isolamento) |

Para criar uma empresa do zero, use **/auth/cadastro**; o link de confirmação aparece no log do contêiner
(`docker logs application-webapp-1`) quando `RESEND_API_KEY` está vazio.

> **Atenção (iCloud/bind mount):** o Vite não percebe todas as mudanças de arquivos do servidor pelo volume. Depois de
> alterar `src/server`, `src/lib`, `src/middleware.ts` ou criar rotas novas, rode `docker restart application-webapp-1`.

## Variáveis de ambiente

Todas estão documentadas no [.env.example](.env.example). As principais:

| Variável | Uso |
|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Dono das tabelas: migrations e fluxos sem empresa (login, cadastro, convites) |
| `APP_DB_USER` / `APP_DB_PASSWORD` | Papel da aplicação (sem superuser, sujeito ao RLS), criado pelo `scripts/migrate.mjs` |
| `JWT_SECRET` | Assinatura da sessão e dos tokens de impressão (mínimo 32 caracteres; obrigatório) |
| `APP_URL` | URL pública, usada nos links dos e-mails |
| `RESEND_API_KEY` / `MAIL_FROM` | Envio de e-mails. **Obrigatório em produção** para cadastro, recuperação de senha e envio de propostas |
| `UPLOAD_DIR` | Pasta dos arquivos enviados e dos PDFs gerados |

## Banco de dados

- `db/migrations/NNN_nome.sql`: aplicadas em ordem por `scripts/migrate.mjs` (tabela `schema_migrations`),
  sempre ao subir o contêiner. Nunca edite uma migration já aplicada; crie a próxima.
- `db/seeds/NNN_nome.sql`: dados de demonstração, só com `--seed` (ambiente de dev). Arquivos iniciados com `_`
  são ignorados.
- Toda tabela de negócio tem `tenant_id` e passa por `aplicar_rls('tabela')` (RLS forçado com `USING` e `WITH CHECK`).
- Uma empresa nova recebe os padrões (status do Kanban, tipos, formatos, faixas, template e blocos da proposta,
  formulário) com `SELECT aplicar_padroes_tenant_completo(<tenant_id>)`.

```bash
npm run db:migrate   # aplica migrations (fora do Docker: exporte DATABASE_URL_SYSTEM)
make migrate         # migrations + seeds no contêiner em execução
```

## Arquitetura

```
src/
  middleware.ts      sessão (JWT), papel atual, rotas públicas, restrição de Configurações, cabeçalhos de segurança
  lib/               infraestrutura: db (withTenant/withSystem), auth, forms (zod), mail, storage, rateLimit, cálculos puros
  server/            regras de negócio por domínio (eventos, orcamento, pdf, envio, templates, autoatendimento…)
  pages/             rotas Astro; POST de formulário no padrão POST → redirect → GET com mensagem (lib/actions)
  pages/api/         endpoints JSON usados pelas ilhas Preact
  components/        UI (ui/), ilhas Preact (orcamento/, cardapio/, formularios/) e a proposta impressa (proposta/)
```

Regras que valem para todo código novo:

- **Toda consulta de dados de empresa passa por `withTenant(tenantId, db => …)`**: transação com o tenant definido
  para o RLS. `withSystem`/`systemQuery` só em fluxos sem empresa (login, cadastro, convites, formulário público).
- **Chaves estrangeiras não passam pelo RLS**: ao gravar um id vindo do usuário, confirme que ele é visível no
  tenant (ver `validarReferencias` em `server/eventos.ts`).
- **O cálculo do orçamento é uma função pura** (`lib/calculo/orcamento.ts`) usada pelo navegador e pelo servidor;
  o servidor sempre recalcula ao salvar. Valor manual prevalece sobre o calculado em todos os níveis.
- **Versões de orçamento são snapshots**: só a versão atual é editável; "Criar nova versão" congela a anterior, e
  versões congeladas reaproveitam o PDF já gerado.
- **Ícones**: somente Google Material Symbols (`components/ui/Icon.astro` e `Icon.tsx`).
- **Papéis**: `owner` e `admin` acessam Configurações; `usuario` opera o dia a dia.

## Testes

```bash
npm test                 # unitários (Vitest): cálculos, validações, datas, rate limit…
npx astro check          # tipos
npm run test:e2e         # ponta a ponta (Playwright) contra o ambiente de dev em execução
```

Os testes e2e usam os dados de demonstração e o Docker local: leem links de e-mail do log do contêiner e limpam o que
criam. Rode com o ambiente de dev no ar (`make dev`). `SHOTS=/pasta npm run test:e2e` salva screenshots das telas.

## Deploy

`make deploy` (no Mac) valida build e testes do commit enviado ao GitHub e publica na VPS sem indisponibilidade
(blue-green); `make rollback` volta à versão anterior. Detalhes, primeira instalação e Nginx no [DEPLOY.md](DEPLOY.md).
