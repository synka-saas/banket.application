# Banket — Relatório de segurança

**Data:** 27/09/2026 · **Código revisado:** `main` @ `f485bad` · **Produção:** `app.banket.com.br` (VPS `synka-main`, atrás da Cloudflare)

Complementa o [report.md](report.md) e aprofunda a parte de segurança. Os IDs deste documento (`SEG-xx`) são próprios.

## Método

- **Análise estática** de `src/` inteira (middleware, `lib/`, `server/`, páginas, endpoints `api/`, scripts de ilhas e
  componentes), `db/migrations/`, `scripts/`, Dockerfile, compose e `package.json`.
- **Verificações na produção, sem exploração destrutiva e sem imprimir segredos:**
  - cabeçalhos HTTP e comportamento do middleware com URLs codificadas;
  - acesso direto à origem sem passar pela Cloudflare;
  - DNS, registros de e-mail e certificados emitidos (crt.sh);
  - varredura do bundle em execução por fragmentos dos segredos do `.env` (só os nomes dos arquivos foram exibidos);
  - usuário dos processos no contêiner, variáveis presentes (só os nomes), rotação de logs, firewall (ufw) e portas;
  - configuração do Nginx.
- **Fora do escopo:** teste de invasão autenticado, fuzzing, revisão das outras aplicações da mesma VPS (Yosp, Hwesta),
  além do impacto que elas têm no Banket.

## Resumo

| Severidade | Qtde | IDs |
|---|---|---|
| Crítica | 0 | — |
| Alta | 6 | SEG-01 a SEG-06 |
| Média | 16 | SEG-07 a SEG-22 |
| Baixa | 21 | SEG-23 a SEG-43 |

**Não encontrei vulnerabilidade crítica**, isto é, leitura ou escrita de dados de outra empresa, ou acesso sem
credenciais explorável remotamente e sem pré-requisitos. O isolamento por RLS está bem construído. Os riscos mais sérios
estão em quatro frentes: (1) segredos embutidos no build; (2) cadeia de autenticação (e-mail desligado, cadastro
sequestrável, sessões sem revogação); (3) disponibilidade (PDF e rate limit atrás da Cloudflare); (4) XSS via SVG com
escalada de papel.

> **Ação imediata recomendada:** rotacionar `JWT_SECRET` e `OPENAI_TOKEN` depois de corrigir o build (SEG-01). Trocar o
> `JWT_SECRET` derruba todas as sessões, o que é esperado.

### Cobertura das 20 categorias solicitadas

| # | Categoria | Situação no Banket | Achados |
|---|---|---|---|
| 1 | Quebra de isolamento multi-tenant | **Parcial**: RLS sólido, mas há FKs de outro tenant aceitas, com exclusão em cascata entre empresas | SEG-10, SEG-26 |
| 2 | BOLA / IDOR | **Não encontrado** nas rotas por id (todas passam por RLS). Há IDOR "por nome" no slug do formulário público e na associação de cliente por e-mail | SEG-16, SEG-31 |
| 3 | Falhas de autenticação / token hijacking | **Presente** | SEG-03, SEG-05, SEG-08, SEG-09, SEG-15, SEG-27, SEG-28, SEG-29, SEG-30 |
| 4 | BFLA | **Presente** (papel `usuario` com funções administrativas; admin gerindo convites de owner) | SEG-17, SEG-32 |
| 5 | Injeções (SQLi/NoSQLi/ORM) | **Não encontrado**: SQL 100% parametrizado; identificadores dinâmicos só de constantes | SEG-43 (higiene) |
| 6 | SSRF | **Não encontrado**: não há fetch para URL do usuário; o Chromium só abre `127.0.0.1` | SEG-21 (endurecimento) |
| 7 | Segredos em repositórios/builds | **Presente**: `JWT_SECRET` e `OPENAI_TOKEN` embutidos no bundle da imagem | SEG-01 |
| 8 | Subdomain takeover / DNS dangling | **Não encontrado** hoje; um CNAME para terceiro deve ser monitorado | SEG-41 |
| 9 | Mass assignment / object injection | **Não encontrado** nos cadastros (listas de campos fixas, zod descarta chaves extras); detalhes menores de protótipo | SEG-37 |
| 10 | Webhooks / assinatura | **Não aplicável**: não há webhooks. Recomendações para os futuros (Resend, cobrança) | Seção 5 |
| 11 | Buckets S3/Blob públicos | **Não aplicável**: uploads em volume local servidos só com sessão. Falta backup | SEG-36 |
| 12 | RCE via upload/processamento | **Risco indireto**: imagens enviadas renderizadas por Chromium `--no-sandbox` como root | SEG-12 |
| 13 | Supply chain / dependency confusion | **Parcial**: sem pacote privado, mas build não reprodutível e sem proteção contra publicação acidental | SEG-38, SEG-39 |
| 14 | Rate limiting / throttling | **Presente**: limites errados atrás da Cloudflare, em memória, e ausentes em rotas caras | SEG-02, SEG-04, SEG-13, SEG-14, SEG-18, SEG-34 |
| 15 | XSS armazenado em áreas administrativas | **Presente** (SVG) | SEG-06, SEG-11 |
| 16 | Prompt injection / LLM | **Baixo risco** (saída restrita por schema); abuso de custo é o problema real | SEG-18, SEG-40 |
| 17 | Deserialização insegura | **Não encontrado**: só `JSON.parse` com validação zod | — |
| 18 | CORS / WebSocket | **Não encontrado**: sem CORS aberto, sem WebSocket. Falta `frame-ancestors`/CSP | SEG-11 |
| 19 | Logs inseguros / observabilidade | **Presente** | SEG-05, SEG-19, SEG-20 |
| 20 | Auditoria / anti-tampering | **Presente**: não há trilha de auditoria fora da timeline do evento | SEG-19 |

---

## 1. Altas

### SEG-01 — `JWT_SECRET` e `OPENAI_TOKEN` embutidos em texto puro na imagem Docker
*Categoria 7 · CWE-798 / CWE-540*

- **Evidência:** a varredura do contêiner em execução (`banket-webapp_green-1`) encontrou fragmentos dos valores do
  `.env` em:
  - `JWT_SECRET` → `/app/dist/server/chunks/auth_*.mjs` e `/app/dist/server/chunks/printToken_*.mjs`, no formato
    `process.env.JWT_SECRET ?? "<segredo literal>"`;
  - `OPENAI_TOKEN` → `/app/dist/server/chunks/imagemFundo_*.mjs`.

  As senhas do Postgres não apareceram, porque o código lê `DATABASE_URL`, que não está no `.env`. O bundle do cliente
  (`dist/client`) está limpo.
- **Causa:** não existe `.dockerignore`. O `COPY . .` do estágio builder leva o `.env` para o build, o Vite/Astro carrega
  o arquivo e **substitui estaticamente** `import.meta.env.X` pelo valor literal. Isso vale para o padrão usado em
  [src/lib/auth.ts](src/lib/auth.ts), [src/lib/printToken.ts](src/lib/printToken.ts), [src/lib/openai.ts](src/lib/openai.ts),
  [src/lib/mail.ts](src/lib/mail.ts) e [src/lib/db.ts](src/lib/db.ts). O `.env` também fica na camada do builder (cache
  do Docker na VPS), junto com `.git`, `Makefile`, `.deploy-ativo` e `uploads/` locais.
- **Impacto:** quem obtém a imagem (`docker save`, um registry futuro, backup de `/var/lib/docker`, cache de CI) tem o
  segredo de assinatura das sessões e forja sessão de **qualquer usuário de qualquer empresa**. Basta conhecer o par
  `usuario_id`/`tenant_id`: o membership confere o vínculo, mas não a autenticidade. Também forja print tokens (leitura
  do conteúdo das propostas) e usa a chave da OpenAI por conta da empresa. Além disso, girar a variável no compose não
  remove o valor antigo do bundle.
- **Correção:**
  1. Criar `.dockerignore` com `.env*`, `.git`, `node_modules`, `uploads`, `dist`, `Makefile`, `.deploy-ativo`,
     `test-results`, `playwright-report`.
  2. Ler segredos **somente** de `process.env` no servidor (remover o fallback `import.meta.env`) ou usar `astro:env`
     com `access: 'secret'`.
  3. Checagem no build/CI que falhe se um valor do `.env` aparecer em `dist/`.
  4. Rebuild, depois rotação de `JWT_SECRET` e `OPENAI_TOKEN`. Limpar o cache de build antigo com `docker builder prune`.

### SEG-02 — Negação de serviço: a geração de PDF esgota o pool do banco (deadlock)
*Categorias 14 · CWE-400 / CWE-833*

- **Onde:** [src/server/pdf.ts](src/server/pdf.ts), [src/pages/eventos/[id]/orcamento/pdf.ts](src/pages/eventos/[id]/orcamento/pdf.ts),
  [src/pages/templates/[id]/exemplo.ts](src/pages/templates/[id]/exemplo.ts), [src/server/envio.ts](src/server/envio.ts), [src/lib/db.ts](src/lib/db.ts)
- **Mecânica:** `pdfDaVersao` e `pdfExemploTemplate` rodam dentro de `withTenant` e **seguram uma conexão** do
  `appPool` (máx. 10) enquanto o Chromium imprime até 3 partes (30 s de timeout cada). Cada parte abre
  `/print/...`, que pede **outra** conexão ao mesmo pool. Com cerca de 10 pedidos simultâneos, todas as conexões ficam
  presas esperando páginas que nunca conseguem conexão, e o app inteiro (todas as empresas) para até os timeouts. Não
  há semáforo no Chromium, nem rate limit, nem limite por tenant.
- **Quem explora:** qualquer usuário autenticado (inclusive de um trial), com um script de 10 requisições paralelas a
  `/templates/<id>/exemplo`.
- **Correção:** imprimir **fora** da transação (ler → `COMMIT` → imprimir → transação curta para gravar);
  semáforo global (ex.: 2 impressões simultâneas, com fila e timeout); rate limit por usuário e tenant; opcionalmente
  passar à página de impressão um payload já montado (um JWT curto com id de cache), evitando a segunda conexão.

### SEG-03 — Sequestro de conta pelo cadastro não confirmado (*pre-account takeover*)
*Categoria 3 · CWE-287 / CWE-640*

- **Onde:** [src/server/autoatendimento.ts](src/server/autoatendimento.ts) `cadastrarConta` → `verificarEmail`
- **Mecânica:** se o e-mail tem cadastro **não confirmado**, um novo cadastro **troca a senha** e envia outro link de
  confirmação ao dono do e-mail.
- **Cenário:** a vítima se cadastra (senha A) e ainda não abriu o e-mail. O atacante cadastra o mesmo e-mail (senha B).
  A vítima clica no link mais recente, confirma e cria a empresa no onboarding. O atacante entra com a senha B como
  **owner** dessa empresa.
- **Correção:** não sobrescrever a senha de um cadastro pendente. Guardar o hash da senha no `payload` do token de
  verificação e aplicá-lo só na confirmação, ou pedir a senha na confirmação. Com cadastro pendente, apenas reenviar o
  link, sem alterar dados.

### SEG-04 — O rate limit usa o IP da Cloudflare: bloqueio de usuários legítimos e *lockout* provocado
*Categorias 14 e 3 · CWE-307 / CWE-348*

- **Evidência:** a produção responde com `server: cloudflare` e `cf-ray`. O Nginx define `X-Real-IP $remote_addr` (IP
  da borda) e não há `set_real_ip_from` / `real_ip_header CF-Connecting-IP` em `/etc/nginx`.
  [src/lib/rateLimit.ts](src/lib/rateLimit.ts) usa esse IP como chave.
- **Impacto:**
  - Login: 30 falhas em 15 min **por IP de borda**. Um atacante bloqueia o login de todos os usuários que saem pelo
    mesmo nó da Cloudflare (ex.: PoP GRU). O mesmo vale para cadastro (20/h) e recuperação (10/h).
  - Formulário público: 5 envios / 10 min por slug+IP de borda, então **leads reais recebem 429**.
  - A força bruta distribuída continua possível: o limite por IP+e-mail é de 10/15 min por IP, e o atacante troca de IP.
  - `formulario_respostas.ip` guarda o IP da Cloudflare, o que é inútil para investigação.
- **Correção:** `set_real_ip_from` com as faixas publicadas da Cloudflare + `real_ip_header CF-Connecting-IP;`. Somar
  um limite por conta (e-mail) independente do IP, com atraso progressivo, e um CAPTCHA (Turnstile) depois de N falhas.

### SEG-05 — E-mail transacional desligado em produção: tokens de autenticação vão para o log
*Categorias 3 e 19 · CWE-532*

- **Evidência:** `RESEND_API_KEY` vazia no contêiner em produção. [src/lib/mail.ts](src/lib/mail.ts) grava no stdout
  o texto completo de cada e-mail, com os links `/auth/redefinir?token=…` (1 h), `/auth/entrar?token=…` (15 min, login
  sem senha) e `/auth/cadastro-convidado?token=…` (7 dias).
- **Impacto:** quem lê `docker logs` (ou um coletor de logs que venha a ser ligado) entra como **qualquer usuário**: basta
  pedir um "link de acesso" para o e-mail da vítima e copiar o token do log. Funcionalmente, o cadastro, a
  recuperação, os convites e o envio de propostas não funcionam.
- **Correção:** configurar o Resend (o domínio já tem DKIM `resend._domainkey` e DMARC `p=reject`); em produção,
  **falhar na subida** sem a chave; nunca logar o corpo do e-mail fora de `DEV`.

### SEG-06 — XSS armazenado via SVG, com escalada de papel dentro da empresa
*Categorias 15 e 12 · CWE-79 / CWE-434*

- **Onde:** [src/lib/storage.ts](src/lib/storage.ts) (`IMAGE_TYPES` com `image/svg+xml`; tipo tirado de `file.type`,
  que é informado pelo navegador), [src/pages/uploads/[...path].ts](src/pages/uploads/[...path].ts), uploads em
  [src/server/templates.ts](src/server/templates.ts) (qualquer papel) e [src/pages/configuracoes/empresa.astro](src/pages/configuracoes/empresa.astro).
- **Mecânica:** o SVG é servido **na mesma origem**, com `Content-Type: image/svg+xml`, sem CSP, sem `sandbox` e sem
  `Content-Disposition: attachment`. Aberto como documento (link direto, "abrir imagem em nova aba"), o `<script>`
  roda com a sessão de quem abriu.
- **Cenário:** um membro com papel `usuario` sobe um SVG malicioso como fundo de template e envia o link a um owner.
  O script faz `POST /configuracoes/usuarios` convidando o atacante como owner, ou altera dados da empresa, o modelo de
  e-mail e os formulários públicos. O `checkOrigin` não barra, porque é a mesma origem.
- **Correção:** para `/uploads/*`, responder com `Content-Security-Policy: default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox`
  e `X-Content-Type-Options: nosniff`. Recusar SVG, ou rasterizar/sanitizar no servidor. Validar o tipo pelos *magic
  bytes*. A médio prazo, servir uploads de um domínio separado (ex.: `files.banket.com.br`) com URLs assinadas.

---

## 2. Médias

### SEG-07 — Contêiner roda como root e o Chromium roda sem sandbox
*Categoria 12 · CWE-250*
- **Evidência:** `uid=0(root)` para `node` e para `chromium … --no-sandbox`; `/data/uploads` pertence a root com
  permissão 755. A imagem de runtime leva as `devDependencies`, porque o Dockerfile usa `npm install` completo.
- **Impacto:** uma falha em qualquer decodificador de imagem ou fonte do Chromium, acionada por uma imagem enviada
  pelo usuário e embutida no PDF (SEG-12), vira execução de código **como root** no contêiner. Isso dá acesso aos
  uploads e PDFs de todas as empresas e às credenciais do banco.
- **Correção:** `USER node` com o volume ajustado; `npm ci --omit=dev` no runtime; sandbox do Chromium (seccomp ou
  usuário não root sem `--no-sandbox`); `read_only: true`, `cap_drop: [ALL]` e `no-new-privileges` no compose.

### SEG-08 — Sessão JWT de 7 dias sem revogação
*Categoria 3 · CWE-613*
- **Onde:** [src/lib/auth.ts](src/lib/auth.ts), [src/server/autoatendimento.ts](src/server/autoatendimento.ts) (`redefinirSenha`), [src/pages/auth/logout.ts](src/pages/auth/logout.ts)
- Redefinir a senha e fazer logout não invalidam JWTs emitidos. Um cookie roubado vale até 7 dias. Somado ao SEG-01,
  a janela fica ainda maior.
- **Correção:** `usuarios.sessao_versao` (ou `senha_alterada_em`) no token, conferida junto com o membership (que já
  tem cache de 30 s); incrementar ao redefinir ou trocar a senha e em "sair de todos os dispositivos". Considerar
  sessão mais curta (ex.: 12 h) com renovação deslizante.

### SEG-09 — Open redirect após o login
*Categoria 3 · CWE-601*
- **Onde:** [src/pages/auth/login.astro](src/pages/auth/login.astro)
- `next` é aceito se começar com `/` e não com `//`, mas `/\evil.com` passa, e os navegadores normalizam `\` para `/`.
  Com isso, um link de phishing leva ao site falso depois de um login legítimo (útil para "sua sessão expirou,
  digite a senha de novo").
- **Correção:** `const u = new URL(next, APP_URL); if (u.origin !== new URL(APP_URL).origin) usar /dashboard`.

### SEG-10 — Chaves estrangeiras de outro tenant aceitas, com exclusão em cascata entre empresas
*Categoria 1 · CWE-639*
- **Onde:**
  - [src/server/cardapio.ts](src/server/cardapio.ts): `salvarItem` (`secao_id`, `categoria_principal_id`,
    `categoria_secundaria_id`, `formato_servico_id`), `atualizarCategoriaPrincipal`, `salvarOpcao`
    (`formato_servico_id`);
  - [src/server/staff.ts](src/server/staff.ts): `salvarProfissional`, `atualizarEspecialidade` (`servico_id`).
- **Mecânica:** FKs não passam pelo RLS. Com o UUID de uma seção de outra empresa, o item da empresa A fica filho da
  seção da empresa B. Quando B exclui a seção, o `ON DELETE CASCADE` (executado sem RLS) **apaga o item de A**. Não
  há vazamento de leitura, porque os JOINs continuam filtrados. Hoje a exploração depende de conhecer UUIDs de outra
  empresa, que não são expostos.
- **Correção:** um helper `exigirVisivel(db, tabela, id)` em todo INSERT/UPDATE com FK vinda do usuário, como já faz
  `validarReferencias`. Estruturalmente: FKs compostas `(tenant_id, id)`, que tornam o erro impossível no banco. Teste
  e2e cobrindo isso.

### SEG-11 — Ausência de Content-Security-Policy e de `frame-ancestors`
*Categorias 15 e 18 · CWE-1021*
- **Onde:** [src/middleware.ts](src/middleware.ts). Não há CSP em nenhuma resposta. `/f/*` pode ser embutido em
  qualquer site (proposital), mas sem lista de domínios permitidos.
- **Correção:** CSP com `default-src 'self'; script-src 'self' 'nonce-…'; style-src 'self' 'unsafe-inline' fonts.googleapis.com; font-src fonts.gstatic.com; img-src 'self' data: blob:; frame-ancestors 'self'`.
  Em `/f/*`, `frame-ancestors` com os domínios cadastrados pela empresa. Os scripts inline do Astro precisam de hash ou
  nonce, o que facilita extrair scripts para módulos.

### SEG-12 — Imagens enviadas pelo usuário são processadas pelo Chromium privilegiado (vetor de RCE)
*Categoria 12 · CWE-434*
- **Onde:** [src/server/proposta.ts](src/server/proposta.ts) (`dataUri`), [src/components/proposta/Proposta.astro](src/components/proposta/Proposta.astro)
- Os arquivos de template e o logo (tipo declarado pelo cliente, sem conferir o conteúdo) são decodificados pelo
  Chromium a cada PDF. O Chromium 152 do Alpine só é atualizado quando a imagem é reconstruída. Com o SEG-07, uma n-day
  em decodificador (histórico: libwebp CVE-2023-4863) vira RCE como root.
- **Correção:** validar os *magic bytes* e **re-encodar** as imagens no upload (ex.: `sharp` com limites de pixels) antes
  de guardar; rebuild periódico (semanal) da imagem para atualizar o Chromium; mitigações do SEG-07.

### SEG-13 — Formulário público sem proteção contra automação
*Categoria 14 · CWE-799*
- **Onde:** [src/pages/api/public/formularios/[slug].ts](src/pages/api/public/formularios/[slug].ts)
- Há só honeypot e limite por slug+IP (que ainda está errado, SEG-04). Sem CAPTCHA, sem teto global por formulário e
  sem limite de tamanho do corpo (vale o `client_max_body_size 20M` do Nginx). Um bot com vários IPs enche o Kanban e a
  base de clientes de uma empresa.
- **Correção:** Cloudflare Turnstile; teto por slug/hora e por tenant/dia; corpo máximo de 64 KB; fila de moderação
  para envios suspeitos.

### SEG-14 — Envio de proposta e convites usados como relay de e-mail
*Categoria 14 · CWE-799*
- **Onde:** [src/server/envio.ts](src/server/envio.ts), [src/server/usuarios.ts](src/server/usuarios.ts)
- Qualquer usuário logado manda texto livre + anexo para até 5 endereços arbitrários, sem limite de frequência e com
  remetente do domínio `banket.com.br`. Os convites também não têm limite. Com o cadastro self-service, contas de trial
  viram canal de spam ou phishing e queimam a reputação do domínio (DMARC `p=reject` já está ativo).
- **Correção:** limites por usuário e tenant (e menores no trial); registrar os envios; `from` no formato
  "Empresa via Banket"; bloquear links no corpo para contas novas; webhook de *bounces/complaints* do Resend (ver
  seção 5).

### SEG-15 — Rotas com "extensão" executam sem autenticação
*Categorias 3 e 19 · CWE-285*
- **Onde:** [src/middleware.ts](src/middleware.ts) `isPublic`: qualquer caminho terminado em `.png/.js/.css/.map/...`
  é tratado como público.
- **Evidência (produção, sem sessão):** `GET /eventos/x.png` → **500**; `DELETE /api/cardapio/opcoes/x.js` e
  `GET /api/formularios/abc.css` → 400 com "Ocorreu um erro". Os handlers rodam com `locals.user` indefinido.
- **Impacto:** hoje não vaza dados, porque os handlers quebram ao acessar `locals.user.tenantId`. Mas é um bypass de
  autenticação latente: qualquer rota futura com `[param]` que não leia `locals.user` logo no início fica aberta. Cada
  chamada gera `console.error`, então um anônimo **inunda o log** (que gira em 30 MB, SEG-19) e apaga evidências.
- **Correção:** considerar estático só o que existe em `public/` (lista no build) e os prefixos `/_astro/`; nas rotas
  protegidas, falhar com 401 se `locals.user` faltar (guarda central).

### SEG-16 — Slug de formulário público pode ser "tomado" por outra empresa (*dangling slug*)
*Categorias 2 e 8 (análogo a subdomain takeover) · CWE-706*
- **Onde:** [src/server/formularios.ts](src/server/formularios.ts) (`slug` único global, livre depois de renomear ou excluir)
- **Cenário:** o buffet X divulga `app.banket.com.br/f/buffet-x` no site e no Instagram, depois renomeia o slug ou exclui
  o formulário. Outra conta (um trial qualquer) registra `buffet-x` e passa a **receber os leads** (nome, e-mail,
  WhatsApp, dados do evento) destinados a X. Também é possível reservar de antemão slugs com nomes de concorrentes.
- **Correção:** manter slugs antigos reservados para o mesmo tenant (tabela de histórico com redirecionamento);
  quarentena longa antes de liberar; bloquear slugs que imitem o nome de outra empresa cadastrada; exibir de forma clara
  a empresa dona na página pública.

### SEG-17 — BFLA: papel `usuario` com funções administrativas e de exfiltração
*Categoria 4 · CWE-285*
- **Onde:** middleware protege só `/configuracoes*`. O papel `usuario` pode:
  - exportar **toda a base de eventos com contatos** ([src/pages/eventos/exportar.ts](src/pages/eventos/exportar.ts));
  - excluir eventos e clientes;
  - criar, publicar e excluir **formulários públicos** e mudar o slug;
  - alterar preços do catálogo e do staff;
  - trocar o **template padrão** da empresa e subir arquivos (vetor do SEG-06);
  - gastar a cota de IA (SEG-18).
- **Correção:** matriz de permissões por módulo (no mínimo: exportar, excluir, publicar formulários, preços e template
  padrão só para admin/owner), checada no servidor por um helper `exigirPapel(user, 'admin')`.

### SEG-18 — Abuso de custo da IA (LLM e geração de imagem)
*Categorias 14 e 16 · CWE-770*
- **Onde:** [src/pages/api/templates/sugestao.ts](src/pages/api/templates/sugestao.ts) (40 / 10 min por tenant = 240/h),
  [src/pages/api/templates/imagem-fundo/index.ts](src/pages/api/templates/imagem-fundo/index.ts) (15/h por tenant,
  `quality: 'high'`).
- Os contadores ficam em memória e zeram a cada deploy ou troca de cor. Qualquer papel pode chamar. Cada empresa nova
  (cadastro self-service) ganha cota nova. O limite de 2 simultâneas é verificado sem lock (corrida). Resultado: uma
  conta de trial gera cerca de 360 imagens de alta qualidade por dia na conta OpenAI da Banket.
- **Correção:** cota **persistida** por tenant/mês (tabela de uso), bem menor no trial; lock (`pg_advisory_xact_lock`)
  na checagem de simultâneas; alerta de gasto na OpenAI (*usage limits* do projeto).

### SEG-19 — Ausência de trilha de auditoria e logs sem integridade
*Categorias 19 e 20 · CWE-778*
- Não há registro de: login (sucesso ou falha), troca de empresa, redefinição de senha, convites aceitos, mudança de
  papel ou ativação, alterações de configuração, empresa, templates, catálogo e preços, exportação de CSV, exclusão de
  clientes, eventos e formulários. As falhas de login vivem só na memória do rate limit.
- A `evento_timeline` é a única trilha, e é **apagável**: o papel da aplicação tem `UPDATE/DELETE` nela, e excluir o
  evento apaga a timeline em cascata.
- Os logs ficam só no `json-file` do Docker, com rotação de 10 MB × 3 por contêiner. São perdidos em horas sob ataque
  (SEG-15), são locais (quem compromete o host apaga) e não têm correlação (request id, tenant, usuário).
- **Correção:** tabela `auditoria` só de inserção (`REVOKE UPDATE, DELETE` do papel do app; RLS de leitura para o
  próprio tenant), gravada por um helper nos pontos acima; trocar o `DELETE` do evento por *soft delete*; enviar logs
  para destino externo imutável (Loki, CloudWatch, Better Stack…); tela "Atividade" para owners.

### SEG-20 — Dados sensíveis em logs
*Categoria 19 · CWE-532*
- [src/lib/mail.ts](src/lib/mail.ts): corpo completo dos e-mails (tokens, SEG-05) e destinatários.
- [src/lib/forms.ts](src/lib/forms.ts) `userMessage`: faz `console.error(err)` de erros do Postgres não mapeados. Esses
  erros trazem `detail`, por exemplo `Failing row contains (… nome, e-mail, CPF …)` em violações de CHECK e NOT NULL:
  PII em log.
- [src/lib/openai.ts](src/lib/openai.ts) e `sendMail` logam até 500 caracteres ou o corpo inteiro das respostas de erro
  de terceiros.
- Tokens de uso único trafegam em **query string** (`?token=`). Eles aparecem no access log do Nginx, que não tem
  `access_log` próprio no vhost e usa o arquivo compartilhado com as outras aplicações da VPS, e nos logs da
  Cloudflare. O convite vale 7 dias.
- **Correção:** logger estruturado com redação de campos (`token`, `senha`, `email`, `documento`); logar só `code`,
  `constraint` e `table` dos erros do Postgres; trocar `?token=` por um POST que lê o token do fragmento (`#token=`,
  que não vai ao servidor) ou consumir e trocar por cookie curto no primeiro GET; `access_log` próprio do Banket, sem
  query string nas rotas `/auth/*`.

### SEG-21 — Origem acessível diretamente, contornando a Cloudflare
*Categorias 14 e 6 (endurecimento) · CWE-284*
- **Evidência:** `curl --resolve app.banket.com.br:443:<IP da VPS> https://app.banket.com.br/api/health` → 200. O ufw
  libera 80/443 para qualquer origem.
- **Impacto:** WAF, proteção DDoS e regras da Cloudflare são contornáveis. Com a correção do SEG-04, requisições diretas
  ainda funcionariam com IP próprio.
- **Correção:** permitir 443 só das faixas da Cloudflare (ufw/iptables) ou usar *Authenticated Origin Pulls* (mTLS) ou
  Cloudflare Tunnel.

### SEG-22 — Host compartilhado com serviços expostos fora do Banket
*Infraestrutura · CWE-668*
- **Evidência:** na mesma VPS, `yosp_db_container` publica Postgres em `0.0.0.0:4320`. As portas publicadas pelo Docker
  **ignoram o ufw**, porque o Docker escreve direto no iptables. O ufw ainda libera 4321, 5050 e 5291. O access log do
  Nginx é compartilhado entre projetos.
- **Impacto:** o comprometimento de outra aplicação ou banco no mesmo host dá acesso ao Docker e, portanto, aos volumes
  `banket_postgres_data`, `banket_uploads_data` e aos segredos do Banket.
- **Correção:** bancos só em `127.0.0.1` ou rede interna; `DOCKER-USER` chain para filtrar portas publicadas; revisar
  as regras do ufw; idealmente isolar o Banket (VPS ou usuário e daemon próprios).

---

## 3. Baixas

| ID | Categoria | Onde | Problema | Correção |
|---|---|---|---|---|
| SEG-23 | Config | [docker-compose.prod.yml](docker-compose.prod.yml) | Fallback `banket_pass`/`banket_app_pass` para as senhas do banco. Em produção o `.env` define valores fortes (48 caracteres, conferido), mas um `.env` incompleto sobe com senhas públicas | `${VAR:?mensagem}` |
| SEG-24 | Auth | [src/pages/auth/logout.ts](src/pages/auth/logout.ts) | Logout por GET (CSRF de logout) | POST |
| SEG-25 | Auth | [src/server/autoatendimento.ts](src/server/autoatendimento.ts) | Enumeração de contas: cadastro diz "Já existe uma conta com este e-mail"; login mais rápido quando o e-mail não existe (sem bcrypt) | Mensagem neutra; `crypt` contra hash fictício |
| SEG-26 | Isolamento | `db/migrations/001` (policy `usuarios`) | O papel do app pode fazer `UPDATE` em `usuarios.senha_hash/email` de membros que **também pertencem a outras empresas** e lê `senha_hash`. Não há código que faça isso, mas uma SQLi futura em um tenant permitiria sequestrar contas usadas em outro | `REVOKE UPDATE (senha_hash, email) ON usuarios`; view sem `senha_hash` para o app |
| SEG-27 | Auth | [src/lib/senha.ts](src/lib/senha.ts) | bcrypt ignora além de 72 bytes; a política aceita 128 caracteres | Limitar a 72 bytes ou pré-hash |
| SEG-28 | Auth | [src/lib/auth.ts](src/lib/auth.ts) | Sessão e onboarding assinados com a mesma chave, sem `aud`/`iss`/`typ`. Hoje não há confusão (campos obrigatórios diferentes), mas é frágil | `aud` distinto por uso; chaves derivadas (HKDF), como já feito no print token |
| SEG-29 | Auth | Cookies | Sem prefixo `__Host-` na sessão | `__Host-banket_session` (exige `Secure`, `Path=/`, sem `Domain`) |
| SEG-30 | Auth / DoS | [src/pages/auth/recuperacao.astro](src/pages/auth/recuperacao.astro), [link-acesso.astro](src/pages/auth/link-acesso.astro) | Limite de 3 / 15 min **por e-mail**: terceiros impedem a vítima de recuperar a senha | Contar por e-mail só dentro do IP, ou exigir CAPTCHA em vez de bloquear |
| SEG-31 | BOLA | [src/server/formularios.ts](src/server/formularios.ts) `clienteDoPedido` | O formulário público anexa pedidos a um cliente existente só pelo e-mail: qualquer pessoa cria eventos "em nome" de um cliente real | Marcar como não confirmado ou exigir coincidência de telefone |
| SEG-32 | BFLA | [src/server/usuarios.ts](src/server/usuarios.ts) | Admin reenvia ou cancela convite de **owner** (`reenviarConvite`/`cancelarConvite` sem checar papel); `garantirOutroProprietario` sem lock (dois owners rebaixando-se ao mesmo tempo deixam a empresa sem owner) | Checar papel do convite; `SELECT … FOR UPDATE` nos owners |
| SEG-33 | Validação | [src/server/orcamento.ts](src/server/orcamento.ts) `conteudoSchema` | Arrays sem `.max()` (JSONB de até 20 MB por PUT de autosave); valores negativos aceitos em preços, extras e `total_manual` | `.max()` e `.min(0)`; corpo máximo no endpoint |
| SEG-34 | Rate limit | [src/lib/rateLimit.ts](src/lib/rateLimit.ts) | Contadores em memória por instância: zeram no deploy e na troca de cor. Rotas sem limite: PDF, envio, convites, CSV, autosave, aceite de convite (senha de conta existente), cadastro complementar | Contador persistido (Postgres/Redis); limite padrão por usuário em `/api/*` |
| SEG-35 | Integridade | [src/pages/eventos/[id]/index.astro](src/pages/eventos/[id]/index.astro), [src/server/templates.ts](src/server/templates.ts) | Arquivos apagados **antes** do `COMMIT`: se a transação falha, o registro aponta para um arquivo inexistente | Remover depois do commit |
| SEG-36 | Storage | Volumes Docker | Sem backup documentado de `banket_postgres_data` e `banket_uploads_data` (risco de ransomware ou perda). Uploads sem criptografia em repouso | `pg_dump` + cópia criptografada fora da VPS; teste de restauração |
| SEG-37 | Object injection | [src/lib/forms.ts](src/lib/forms.ts) `formToObject`; [src/server/envio.ts](src/server/envio.ts) `aplicarVariaveis` | Campo `__proto__` repetido troca o protótipo do objeto local (sem poluição global); `{constructor}` no modelo de e-mail é substituído por `function Object()…` por usar `in` | `Object.create(null)` / `Object.hasOwn` |
| SEG-38 | Supply chain | [package.json](package.json), [Dockerfile](Dockerfile) | Sem `"private": true` (um `npm publish` acidental publica o código como `webapp`); `npm install` em vez de `npm ci` (lockfile não garantido); imagens `node:22-alpine`/`postgres:15-alpine` sem digest; `apk` sem versão; sem Dependabot/Renovate | `"private": true`, `npm ci`, digests fixos, Renovate com auditoria |
| SEG-39 | Supply chain | [src/styles/global.css](src/styles/global.css), [AuthLayout.astro](src/layouts/AuthLayout.astro), [Proposta.astro](src/components/proposta/Proposta.astro) | Fontes e ícones carregados do Google em tempo de execução (terceiro no caminho da UI e do PDF; o PDF depende de rede externa para renderizar) | Hospedar as fontes localmente |
| SEG-40 | LLM | [src/server/identidadeVisual.ts](src/server/identidadeVisual.ts) | Prompt injection pela imagem do logo ou pelos valores `atuais` tem efeito limitado: a saída é restrita por JSON Schema estrito, enum de fontes e regex de cor, e `motivo` é exibido via `textContent` com 300 caracteres. O logo da empresa é enviado à OpenAI (tratamento por terceiro, LGPD) | Mencionar a OpenAI na política de privacidade; manter a validação de saída |
| SEG-41 | DNS | `send.banket.com.br` | CNAME para `send.forge.rmta.net` (serviço de terceiro). Hoje resolve (SPF e MX ativos), mas se o serviço for descontinuado sem remover o registro, o subdomínio fica *dangling*. Nenhum outro subdomínio ou CNAME pendurado foi encontrado; o crt.sh mostra só `*.banket.com.br` | Inventário de DNS; remover registros de serviços desativados |
| SEG-42 | Info disclosure | Layout | `<meta name="generator" content="Astro v7.3.4">` e página 500 revelam a stack e a versão | Remover o meta generator |
| SEG-43 | Injeção (higiene) | [src/server/eventos.ts](src/server/eventos.ts) (`FROM ${tabela}`, `LIMIT ${page.pageSize}`), [src/server/formularios.ts](src/server/formularios.ts) (`idPorNome`) | Interpolação só de constantes internas e inteiros: **não explorável**, mas uma mudança futura pode abrir SQLi | `pg-format` com `%I` para identificadores, regra de lint contra template strings em `db.query` |

---

## 4. Categorias sem ocorrência: o que foi verificado

- **SQL/NoSQL/ORM injection:** todas as consultas usam parâmetros `$n`. Não há ORM nem banco NoSQL. `ILIKE` escapa
  curingas (`searchTerm`). Os JSONB são montados pelo driver.
- **BOLA/IDOR por id:** todas as páginas e endpoints com `[id]` consultam dentro de `withTenant`, e o RLS com
  `FORCE ROW LEVEL SECURITY` filtra. Subrecursos conferem o pai (checklist com `evento_id`). `/uploads` confere
  `tenantId` da sessão e `resolveKey` bloqueia `../`. O print token vale 5 min e está amarrado a tenant + recurso.
  `POST /api/sessao/empresa` confere o vínculo.
- **Middleware × URL codificada:** `/%63onfiguracoes/usuarios`, `/%64ashboard` e `/AUTH/login` foram tratados
  corretamente em produção (o middleware vê o caminho decodificado).
- **Uso da conexão de sistema:** restrito a login, cadastro, convites, recuperação, membership, resolução de slug e
  health, como documentado.
- **SSRF:** `fetch` só para `api.resend.com` e `api.openai.com` fixos. O Chromium abre apenas `127.0.0.1`. Imagens
  entram como data URI do próprio storage. A URL do Google Fonts usa fontes de um enum. O evento `upload:externo` é só
  client-side.
- **Deserialização:** apenas `JSON.parse` (cookie de flash, corpo JSON, JSONB) seguido de zod. `pdf-lib` só lê PDFs
  gerados pelo próprio Chromium.
- **CORS / WebSocket:** nenhuma resposta envia `Access-Control-Allow-*`; não existe WebSocket. CSRF coberto por
  `checkOrigin` + `SameSite=Lax`. O `allowedDomains` só confia em `X-Forwarded-*` para o próprio domínio.
- **XSS refletido/DOM:** o Astro escapa por padrão; `set:html` só com `renderTexto` (escapa e depois formata); toasts e
  galerias usam `textContent`; CSV protegido contra fórmula.
- **Segredos no Git:** o histórico (19 commits) só tem `.env.example`; nenhum padrão de chave encontrado. `.env` e
  `Makefile` estão no `.gitignore`. O problema está no **build** (SEG-01), não no repositório.
- **Buckets públicos:** não há S3/Blob; uploads locais servidos com sessão e `Cache-Control: private`.

---

## 5. Webhooks: recomendações para quando existirem

Hoje não há webhooks. Os próximos prováveis são *bounces* e *complaints* do Resend (SEG-14) e cobrança (trial/assinatura):
- validar a assinatura (Resend usa Svix: `svix-id`, `svix-timestamp`, `svix-signature`) com comparação em tempo
  constante sobre o **corpo bruto**;
- rejeitar `timestamp` fora de ±5 min e guardar `id` processado (idempotência / anti-replay);
- endpoint fora de `/api/public/*` genérico, sem sessão, com rate limit próprio e sem ecoar erros internos;
- nunca confiar em valores do payload sem reconsultar a API do provedor (ex.: status de pagamento).

---

## 6. Plano de correção sugerido

| Prazo | Itens |
|---|---|
| **Hoje** | SEG-01 (`.dockerignore`, só `process.env`, rebuild, **rotacionar `JWT_SECRET` e `OPENAI_TOKEN`**); SEG-05 (Resend + falhar sem chave) |
| **Esta semana** | SEG-04 e SEG-21 (IP real + origem só via Cloudflare); SEG-02 (PDF fora da transação + semáforo); SEG-06 (CSP/sandbox em `/uploads`, sem SVG); SEG-03 |
| **2–4 semanas** | SEG-07, SEG-08, SEG-09, SEG-10, SEG-15, SEG-17, SEG-18, SEG-20, SEG-22, SEG-23 |
| **Próximo ciclo** | SEG-11 (CSP global), SEG-12, SEG-13, SEG-14, SEG-16, SEG-19 (auditoria), e as baixas |

