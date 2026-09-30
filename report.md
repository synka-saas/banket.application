# Banket — Relatório de revisão do sistema

**Data:** 27/09/2026 · **Versão revisada:** `main` @ `f485bad` · **Ambiente inspecionado:** VPS `synka-main` (produção)

## Escopo e método

- Leitura do código de `src/` (middleware, `lib/`, `server/`, páginas, endpoints `api/`, ilhas Preact principais),
  `db/migrations/`, Dockerfile, compose de produção e configuração do Nginx do host.
- Conferência de alguns pontos direto em produção, **sem expor segredos**: variáveis presentes no contêiner, cabeçalhos
  HTTP, Nginx e Cloudflare.
- **Limitações:** não rodei `npm test` nem `astro check` na VPS, porque as dependências de desenvolvimento não estão
  instaladas no host (o `astro check` pediu para instalar `@astrojs/check`). Não houve teste de invasão ativo. As
  vulnerabilidades abaixo vêm da análise do código e da configuração, com o cenário de exploração descrito em cada uma.
  `npm audit --omit=dev` não encontrou vulnerabilidades conhecidas nas dependências de produção.

---

## Resumo executivo — o que atacar primeiro

| # | Item | Tipo | Por quê |
|---|---|---|---|
| 1 | **FUN-01** `RESEND_API_KEY` vazia em produção | Funcionalidade / segurança | Nenhum e-mail sai. Cadastro, recuperação de senha, convites e envio de proposta estão quebrados em produção, e os links de acesso vão para o log |
| 2 | **SEC-A1** DoS pelo pool do banco na geração de PDF | Segurança (alta) | ~10 pedidos simultâneos de PDF travam o app para **todas** as empresas |
| 3 | **SEC-A2** Limite de tentativas usa o IP da Cloudflare | Segurança (alta) / funcional | Bloqueia login e formulário público de clientes legítimos e permite travar o login de terceiros |
| 4 | **SEC-A3** XSS armazenado via upload de SVG | Segurança (alta) | Um "usuário" comum pode escalar para owner/admin |
| 5 | **SEC-A4** Sequestro de cadastro não confirmado | Segurança (alta) | Um atacante fica com a senha da conta da vítima e acessa a empresa que ela criar |
| 6 | **SEC-M1** Sessões não revogadas após trocar a senha | Segurança (média) | Quem roubou a sessão continua dentro por até 7 dias |
| 7 | **UX-01** App sem layout para celular | UX | Sidebar fixa de 265 px; o comercial de buffet trabalha muito pelo celular |
| 8 | **REF-01** Condição de corrida no autosave do orçamento | Bug / refatoração | Pode gravar uma versão mais antiga por cima da mais nova |
| 9 | **FUN-03** Sem aviso de novo pedido do formulário | Funcionalidade | O lead entra no Kanban sem avisar ninguém |
| 10 | **REF-10** Sem CI e testes que não rodam no host | Processo | As regressões só aparecem no `make deploy` |

---

## 1. Segurança e vulnerabilidades

Classificação: **Crítica** = exploração remota sem autenticação com vazamento ou controle amplo · **Alta** = impacto
grande com pré-requisito baixo · **Média** = impacto real com pré-requisitos ou alcance limitado · **Baixa** = defesa em
profundidade, higiene.

Pontos fortes observados: RLS forçado com `WITH CHECK` em todas as tabelas de negócio; papel da aplicação sem
`BYPASSRLS`; tokens de uso único guardados só como SHA-256; SQL sempre parametrizado (as interpolações usam só
constantes internas); saída escapada (`escapeHtml`, `renderTexto`); `checkOrigin` do Astro com `sameSite=lax`; cores e
fontes do template validadas por regex/enum (sem injeção de CSS no PDF); proteção contra fórmula no CSV; `resolveKey`
contra path traversal; o membership é conferido a cada request.

### 1.1 Críticas

Nenhuma vulnerabilidade crítica encontrada: não achei caminho para ler ou alterar dados de outra empresa nem para entrar
sem credenciais.

### 1.2 Altas

#### SEC-A1 — Negação de serviço: a geração de PDF esgota o pool do banco (deadlock)
- **Onde:** [src/server/pdf.ts](src/server/pdf.ts), [src/pages/eventos/[id]/orcamento/pdf.ts](src/pages/eventos/[id]/orcamento/pdf.ts), [src/lib/db.ts](src/lib/db.ts)
- **Problema:** `pdfDaVersao` roda **dentro** de `withTenant` e segura uma conexão do `appPool` (máx. 10) enquanto o
  Chromium renderiza até 3 partes (timeout de 30 s cada). Cada parte abre `/print/...`, que precisa de **outra**
  conexão do mesmo pool. Com 10 PDFs simultâneos, todas as conexões ficam presas esperando páginas que não conseguem
  conexão. O app para para todos os tenants até os timeouts. O envio de proposta (`enviarProposta`) também gera o PDF
  dentro da transação. Não há limite de concorrência no Chromium nem rate limit por usuário.
- **Cenário:** um usuário logado (ou alguns cliques repetidos em "Baixar PDF" / "PDF de exemplo") dispara 10 requisições
  paralelas e derruba o SaaS.
- **Correção:** gerar o PDF **fora** da transação (ler os dados → `COMMIT` → imprimir → nova transação curta para gravar
  `pdf_path`/timeline); colocar um semáforo global de impressões (ex.: 2 simultâneas, com fila); aplicar rate limit por
  tenant; separar um pool só para `/print/*` ou passar os dados já montados para a página de impressão.

#### SEC-A2 — O limite de tentativas usa o IP da Cloudflare, não o do cliente
- **Onde:** [src/lib/rateLimit.ts](src/lib/rateLimit.ts), Nginx `/etc/nginx/sites-enabled/app.banket.com.br.conf`
- **Problema:** a produção está atrás da Cloudflare (`server: cloudflare`, `cf-ray`). O Nginx define
  `X-Real-IP $remote_addr`, que é o **IP da borda da Cloudflare**, e não há `set_real_ip_from` +
  `real_ip_header CF-Connecting-IP`. Todos os limites por IP (login, cadastro, recuperação, formulário público) contam
  por nó da Cloudflare, que é compartilhado por milhares de visitantes (ex.: PoP GRU).
- **Cenários:**
  1. Um atacante erra 30 senhas e bloqueia por 15 min o login de **todos** os usuários que passam pelo mesmo IP de borda.
  2. O formulário público aceita 5 envios / 10 min por slug+IP: **leads legítimos passam a receber 429**.
  3. `formulario_respostas.ip` grava o IP da Cloudflare (sem valor para auditoria).
- **Correção:** no Nginx, `set_real_ip_from` com as faixas da Cloudflare + `real_ip_header CF-Connecting-IP;`; restringir
  a origem para aceitar só IPs da Cloudflare (ou Authenticated Origin Pulls), senão dá para chegar na VPS direto e
  contornar o WAF. Opcional: `limit_req` no vhost do Banket, como já existe para o Yosp.

#### SEC-A3 — XSS armazenado via upload de SVG, com escalada de privilégio dentro da empresa
- **Onde:** [src/lib/storage.ts](src/lib/storage.ts) (`IMAGE_TYPES` inclui `image/svg+xml`), [src/pages/uploads/[...path].ts](src/pages/uploads/[...path].ts), [src/server/templates.ts](src/server/templates.ts)
- **Problema:** templates (acessíveis ao papel `usuario`) e o logo da empresa aceitam SVG. O arquivo é servido na mesma
  origem com `Content-Type: image/svg+xml`, sem `Content-Disposition: attachment` e sem CSP. Um SVG com `<script>`
  executa quando alguém abre a URL diretamente. Além disso, o tipo vem de `file.type`, informado pelo navegador, sem
  checar o conteúdo.
- **Cenário:** um usuário com papel `usuario` sobe um SVG malicioso como imagem de template e manda o link
  `/uploads/<tenant>/templates/<uuid>.svg` para o owner. Ao abrir, o script roda com a sessão do owner e faz POST em
  `/configuracoes/usuarios` (convite de owner), `/configuracoes/empresa` etc. O `checkOrigin` não bloqueia porque é a
  mesma origem.
- **Correção:** servir uploads com `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox` e
  `Content-Disposition: inline` somente para raster; ou rasterizar/sanitizar SVG no upload (ou recusar SVG, já que o
  navegador já converte o logo em PNG para a IA); validar o tipo pelos *magic bytes*. O ideal a médio prazo é servir
  uploads de um domínio separado.

#### SEC-A4 — Sequestro de conta pelo cadastro não confirmado (*pre-account takeover*)
- **Onde:** [src/server/autoatendimento.ts](src/server/autoatendimento.ts) `cadastrarConta` / `verificarEmail`
- **Problema:** se já existe um cadastro **não confirmado** para o e-mail, um novo cadastro **sobrescreve a senha** e
  reenvia a confirmação ao dono do e-mail. Quem clica no link confirma a conta com a senha do atacante.
- **Cenário:** a vítima se cadastra (senha A) e ainda não confirmou. O atacante cadastra o mesmo e-mail (senha B). A
  vítima recebe um novo e-mail "Confirme seu e-mail", clica, cai no onboarding e cria a empresa. O atacante entra com a
  senha B como **owner** da empresa da vítima.
- **Correção:** não sobrescrever a senha de cadastro pendente. Guardar a senha junto com o token (ou só definir a senha
  depois da confirmação), ou exigir, na confirmação, a senha que o usuário digitou no cadastro. Invalidar sessões ao
  confirmar.

#### SEC-A5 — E-mail de produção desligado: tokens de acesso vão para o log
- **Onde:** [src/lib/mail.ts](src/lib/mail.ts), `.env` de produção (`RESEND_API_KEY` vazia, conferido no contêiner `banket-webapp_green-1`)
- **Problema:** sem a chave, `sendMail` escreve o corpo do e-mail no log, **incluindo** links de redefinição de senha,
  link de acesso sem senha (15 min) e convites. Quem tem acesso aos logs (ou a um coletor de logs futuro) consegue
  entrar como qualquer usuário que pedir um link. Nada impede subir a produção sem a chave.
- **Correção:** configurar a chave (ver **FUN-01**); em `import.meta.env.PROD`, **falhar na subida** se `RESEND_API_KEY`
  faltar e nunca logar o corpo do e-mail fora de dev.

### 1.3 Médias

#### SEC-M1 — Sessão JWT de 7 dias sem revogação
- **Onde:** [src/lib/auth.ts](src/lib/auth.ts), [src/server/autoatendimento.ts](src/server/autoatendimento.ts) `redefinirSenha`, [src/pages/auth/logout.ts](src/pages/auth/logout.ts)
- Trocar ou redefinir a senha e fazer logout não invalidam JWTs já emitidos. Um cookie roubado vale 7 dias. O
  membership só ajuda quando o vínculo é desativado.
- **Correção:** coluna `usuarios.sessao_versao` (ou `senha_alterada_em`) no JWT, conferida junto com o membership (já
  existe a consulta com cache de 30 s); incrementar em reset/troca de senha e em "sair de todos os dispositivos".

#### SEC-M2 — Chaves estrangeiras de outro tenant aceitas em alguns cadastros
- **Onde:** [src/server/cardapio.ts](src/server/cardapio.ts) `salvarItem` (`secao_id`, `categoria_principal_id`,
  `categoria_secundaria_id`, `formato_servico_id`), `atualizarCategoriaPrincipal`, `salvarOpcao` (`formato_servico_id`);
  [src/server/staff.ts](src/server/staff.ts) `salvarProfissional` / `atualizarEspecialidade` (`servico_id`)
- Contraria a regra do próprio projeto ("FKs não passam pelo RLS"). Com um UUID de outra empresa, a FK aceita: o item
  fica ligado à seção de outro tenant, e um `ON DELETE CASCADE` no tenant B **apaga dados do tenant A**. A exploração
  exige conhecer UUIDs de terceiros, o que é difícil hoje, mas é um furo de isolamento.
- **Correção:** um helper genérico `exigirVisivel(db, tabela, id)` (padrão de `validarReferencias`) usado em todo
  INSERT/UPDATE com FK vinda do usuário. Opcional: FKs compostas `(tenant_id, id)`, que resolvem no banco.

#### SEC-M3 — Open redirect após o login
- **Onde:** [src/pages/auth/login.astro](src/pages/auth/login.astro)
- `next` é aceito se começar com `/` e não com `//`, mas `/\evil.com` passa e os navegadores tratam `\` como `/`. Com
  isso, um link de phishing com `?next=/\site-falso` leva ao site falso depois de um login legítimo.
- **Correção:** validar com `new URL(next, APP_URL).origin === APP_URL` ou rejeitar `\` e caracteres de controle.

#### SEC-M4 — Ausência de Content-Security-Policy
- **Onde:** [src/middleware.ts](src/middleware.ts)
- Não há CSP em nenhuma resposta. Qualquer XSS futuro (e o SEC-A3) tem impacto total.
- **Correção:** CSP com `script-src 'self'` (+ hashes/nonce para os scripts inline do Astro), `img-src 'self' data:`,
  `font-src fonts.gstatic.com`, `frame-ancestors` (substitui `X-Frame-Options`, com exceção de `/f/*`).

#### SEC-M5 — Formulário público sem proteção contra spam distribuído
- **Onde:** [src/pages/api/public/formularios/[slug].ts](src/pages/api/public/formularios/[slug].ts)
- Há só honeypot e limite por slug+IP. Um bot com vários IPs cria clientes e eventos à vontade no Kanban da empresa,
  sem teto por formulário. O corpo JSON também não tem limite de tamanho além dos 20 MB do Nginx.
- **Correção:** Cloudflare Turnstile (já está atrás da Cloudflare), teto global por slug/hora, limite de tamanho do
  corpo (ex.: 64 KB).

#### SEC-M6 — Envio de proposta como relay de e-mail
- **Onde:** [src/server/envio.ts](src/server/envio.ts)
- Qualquer usuário logado envia texto livre + anexo para até 5 endereços arbitrários, com o remetente do domínio
  Banket e sem limite de frequência. O mesmo vale para convites. O risco é a reputação do domínio (spam/phishing a
  partir de contas de trial).
- **Correção:** rate limit por usuário/tenant (ex.: 50/dia no trial), registro de auditoria, `from` com o nome da
  empresa e domínio verificado, bloqueio de links no corpo para contas novas.

#### SEC-M7 — Contêiner roda como root e o Chromium sem sandbox
- **Onde:** [Dockerfile](Dockerfile), [src/server/pdf.ts](src/server/pdf.ts)
- Não há `USER node`, e o Chromium é lançado com `--no-sandbox` em conteúdo parcialmente controlado pelo usuário (texto
  escapado, fontes externas). Uma falha no Chromium vira root no contêiner com acesso ao volume de uploads de todos os
  tenants. A imagem de runtime leva também as `devDependencies`.
- **Correção:** `USER node` (ajustando a permissão de `/data/uploads`), `npm ci --omit=dev` no runtime, bloquear
  requisições de rede do Chromium exceto `127.0.0.1` e Google Fonts (`page.route`), ou embutir as fontes localmente.

#### SEC-M8 — Senhas padrão no compose
- **Onde:** [docker-compose.prod.yml](docker-compose.prod.yml)
- `POSTGRES_PASSWORD`/`APP_DB_PASSWORD` têm fallback `banket_pass`/`banket_app_pass`. Em produção o `.env` define
  valores fortes (conferido), mas um `.env` incompleto sobe silenciosamente com senhas públicas.
- **Correção:** usar `${VAR:?mensagem}` como já é feito com `JWT_SECRET`.

### 1.4 Baixas

| ID | Onde | Problema | Correção |
|---|---|---|---|
| SEC-B1 | [src/middleware.ts](src/middleware.ts) `isPublic` | Qualquer rota terminada em `.png/.js/.css/...` é pública; rotas com `[id]` (ex.: `/clientes/x.png`, `/api/cardapio/opcoes/x.js`) executam sem `locals.user` e dão 500/400. Não vaza dados hoje, mas é uma armadilha | Tratar como estático só o que existe em `public/` (lista gerada no build) ou prefixos fixos |
| SEC-B2 | [src/pages/auth/logout.ts](src/pages/auth/logout.ts) | Logout por GET (CSRF de logout por `<img>`) | POST com formulário |
| SEC-B3 | [src/server/autoatendimento.ts](src/server/autoatendimento.ts) | Enumeração de e-mails: o cadastro responde "Já existe uma conta", e o login leva tempo diferente quando o e-mail não existe (sem bcrypt) | Mensagem neutra no cadastro; `crypt` contra um hash fictício quando o e-mail não existe |
| SEC-B4 | [src/lib/senha.ts](src/lib/senha.ts) | bcrypt ignora o que passa de 72 bytes, mas a política aceita até 128 caracteres | Limitar a 72 bytes ou aplicar pré-hash |
| SEC-B5 | `db/migrations/001` policy de `usuarios` | O papel do app pode fazer `UPDATE` em `usuarios` (senha/e-mail) de quem pertence ao tenant, inclusive usuários que também estão em outras empresas. Hoje nenhum código faz isso, mas uma SQLi futura permitiria sequestro entre empresas | `REVOKE UPDATE (senha_hash, email) ON usuarios FROM banket_app`; não expor `senha_hash` no `SELECT` do papel do app |
| SEC-B6 | [src/server/usuarios.ts](src/server/usuarios.ts) | `reenviarConvite`/`cancelarConvite` não checam papel: um admin reenvia ou cancela convite de **owner** | Aplicar `exigirPermissaoSobre` também aos convites |
| SEC-B7 | [src/server/orcamento.ts](src/server/orcamento.ts) `conteudoSchema` | Arrays sem `.max()` e valores monetários negativos aceitos (`preco_manual`, `valor_unit`, `total_manual`), o que permite JSONB gigante e totais negativos | `.max()` nos arrays, `.min(0)` nos valores |
| SEC-B8 | [src/server/formularios.ts](src/server/formularios.ts) `clienteDoPedido` | O formulário público associa o pedido ao cliente existente pelo e-mail: qualquer pessoa "anexa" eventos a um cliente real (poluição de dados) | Marcar como "a confirmar", ou só vincular se nome/telefone também baterem |
| SEC-B9 | [src/lib/rateLimit.ts](src/lib/rateLimit.ts), caches | Contadores em memória por instância: na troca blue-green ou com réplicas, os limites zeram | Contador em Postgres (`INSERT … ON CONFLICT`) ou Redis |
| SEC-B10 | Arquivos x transação | `removeFile`/`removeDir` rodam **antes** do `COMMIT` (excluir evento, trocar imagem do template): se a transação falhar, o registro fica apontando para um arquivo apagado | Apagar arquivos depois do commit (lista de "a remover" devolvida pela função) |
| SEC-B11 | Backups | DEPLOY.md não documenta backup do `banket_postgres_data` nem do `banket_uploads_data` | `pg_dump` diário + cópia do volume para fora da VPS, com teste de restauração |

---

## 2. Usabilidade e experiência do usuário

### 2.1 Alta prioridade

- **UX-01 — Sem layout responsivo no app autenticado.** [Sidebar.astro](src/components/Sidebar.astro) tem 265 px fixos,
  [AppLayout.astro](src/layouts/AppLayout.astro) usa `height: 100vh` com `padding: 32px 45px`, e o `global.css` não tem
  `@media`. Só dashboard, agenda, templates e as telas públicas se adaptam. No celular o Kanban, o orçamento e as
  tabelas ficam inutilizáveis. Faltam sidebar recolhível (menu hambúrguer), tabelas em cartões e Kanban com rolagem
  horizontal por coluna.
- **UX-02 — Kanban só funciona com mouse.** O arrastar e soltar usa HTML5 DnD, que não funciona em telas touch, e não
  há alternativa por teclado. Sugestão: menu "Mover para…" no card e uma biblioteca com suporte a pointer events.
- **UX-03 — E-mails não chegam (FUN-01).** Para o usuário final, o cadastro "some" depois de criar a conta, e o
  "Esqueci a senha" e os convites não funcionam, sem nenhum aviso na tela.
- **UX-04 — Autosave do orçamento sem proteção contra conflito.** Duas abas ou dois usuários editando a mesma versão:
  o último grava por cima sem avisar (sem `updated_at`/versão otimista). Ver também REF-01.
- **UX-05 — Baixar PDF ignora erro de salvamento.** Em [OrcamentoBuilder.tsx](src/components/orcamento/OrcamentoBuilder.tsx),
  se o salvamento falha, o download segue e gera um PDF com dados antigos. Também não há indicador real de progresso: o
  botão libera sozinho após 6 s.

### 2.2 Média prioridade

- **UX-06 — Seleção de cliente no evento carrega todos os clientes** num `<select>`
  ([eventos.ts](src/server/eventos.ts) `opcoesFormularioEvento`). Com centenas de clientes vira uma lista enorme. Trocar
  por busca com autocomplete.
- **UX-07 — Sem página "Minha conta".** O usuário não troca o próprio nome, telefone, e-mail ou senha logado (só pelo
  "esqueci a senha"). Falta também "sair de todos os dispositivos".
- **UX-08 — "Termos e Condições de Uso" sem link** no cadastro ([cadastro.astro](src/pages/auth/cadastro.astro)): o
  checkbox é obrigatório, mas não há texto para ler. Também falta política de privacidade.
- **UX-09 — Ícone "info" do topo sem função** ([Topbar.astro](src/components/Topbar.astro)). Ou vira ajuda contextual,
  ou sai.
- **UX-10 — Menu do usuário inacessível por teclado.** O gatilho é uma `<div>` com clique, sem `button`,
  `aria-expanded` nem Esc para fechar. Há ~30 atributos `aria-*` no projeto inteiro: falta uma revisão geral de
  acessibilidade (foco visível, rótulos, contraste, `role="dialog"` e foco preso no Drawer).
- **UX-11 — Confirmações com `window.confirm`.** Funcionam, mas destoam do visual e não explicam consequências (ex.:
  excluir evento apaga orçamento e PDFs). Sugestão: modal próprio com o texto do impacto e, para exclusões grandes,
  "desfazer" via toast.
- **UX-12 — Mensagem flash pode se perder.** `consumeFlash` roda em toda requisição, inclusive nas chamadas `fetch` das
  ilhas (ex.: a galeria de IA consulta `/api/templates/imagem-fundo` em loop). Uma mensagem gravada pelo redirect some
  antes de ser exibida. Consumir o flash só em requisições de página (`Accept: text/html`).
- **UX-13 — Erros genéricos.** Vários fluxos mostram só "Ocorreu um erro ao processar a requisição." (ex.: falha no
  Resend, PDF). Registrar um código de correlação e mostrá-lo ao usuário ajuda o suporte.
- **UX-14 — Sem estado vazio orientado em listas-chave** (a conferir tela a tela): o dashboard tem "primeiros passos",
  mas cardápios, staff e templates poderiam guiar a primeira configuração, que é a maior barreira do trial.

### 2.3 Baixa prioridade

- **UX-15** Terminologia: "Sessão" do cardápio (UI) × "seção" (código/banco). Padronizar para "Seção".
- **UX-16** Placeholders "XXXXXXXX" e "xxxx@xxxx.com.br" nas telas de autenticação: usar exemplos reais ou nenhum.
- **UX-17** A política de senha aparece como texto, mas só é conferida ao enviar: falta checagem em tempo real (itens
  que ficam verdes conforme a senha atende cada regra). O botão de mostrar/ocultar senha já existe.
- **UX-18** O Kanban mostra contagem e soma por coluna, mas não mostra a "idade" do card (dias sem movimentação), que
  já é calculada no dashboard como "orçamentos parados".

---

## 3. Funcionalidades pendentes ou incompletas

### 3.1 Bloqueantes / alta

- **FUN-01 — Configurar o e-mail transacional em produção.** O contêiner `banket-webapp_green-1` está com
  `RESEND_API_KEY` vazia. Depende de: chave do Resend, domínio `banket.com.br` verificado (SPF/DKIM/DMARC),
  `MAIL_FROM` válido. Sem isso não funcionam o cadastro self-service, a recuperação de senha, o link de acesso, os
  convites nem o **envio de proposta** (a tela avisa que "foi para o log", mas o cliente do buffet não recebe).
- **FUN-02 — Trial de 30 dias e cobrança.** O cadastro promete "teste grátis por 30 dias", mas não existe plano,
  expiração, bloqueio, cobrança nem tela de assinatura (não há `plano`/`trial_expira_em` em `tenants`). Hoje o trial é
  eterno.
- **FUN-03 — Notificação de novo pedido.** Um pedido do formulário público só aparece no Kanban. Faltam e-mail (ou
  WhatsApp) para a empresa e confirmação automática para o cliente que preencheu.
- **FUN-04 — Termos de uso, política de privacidade e LGPD.** Não há páginas legais, consentimento no formulário
  público (que coleta nome, e-mail, WhatsApp), exportação dos dados nem exclusão de conta/empresa.

### 3.2 Média

- **FUN-05 — Aceite da proposta pelo cliente.** O fluxo termina no envio do PDF. Falta link público da proposta com
  "Aprovar/Recusar" (e opcionalmente assinatura), que moveria o card para `aprovado`/`recusado` e alimentaria a
  conversão do dashboard.
- **FUN-06 — Staff não chega na operação.** `profissionais` é só cadastro: não há escala de profissionais por evento
  (quem vai, confirmação, pagamento via Pix). `staff_servicos.hora_extra` é gravado mas **não entra em nenhum cálculo**.
- **FUN-07 — Custos e margem.** `catalogo_itens.custo_unitario` existe mas não é usado. Falta margem por orçamento e
  por evento, o que é valioso para o dono do buffet.
- **FUN-08 — Financeiro do evento.** Sem parcelas, sinal, vencimentos nem status de pagamento. `orcamentos.data_vencimento`
  existe sem uso aparente na UI.
- **FUN-09 — Agenda sem integração.** Sem exportação iCal/Google Calendar e sem conflito de data/espaço (dois eventos
  "casa" no mesmo horário).
- **FUN-10 — Permissões por papel pouco granulares.** O papel `usuario` pode excluir eventos e clientes, publicar e
  apagar formulários públicos, trocar o template padrão e subir imagens. Sugestão: permissões por módulo (ou pelo menos
  "somente leitura" e "comercial").
- **FUN-11 — Auditoria.** A timeline cobre eventos, mas mudanças de configuração, usuários, templates e catálogo não
  deixam rastro.
- **FUN-12 — Limpeza técnica pendente documentada.** Remover `orcamento_templates.rodape_logo_path` (migration 014
  anunciou) e ainda listado em `CAMPOS_IMAGEM`; remover tabelas legadas do baseline (`pipeline_colunas`,
  `orcamento_opcoes`, `evento_cardapio_*`, `evento_equipe`) se não forem mais usadas.

### 3.3 Baixa

- **FUN-13** Duplicar evento (festas recorrentes de clientes corporativos).
- **FUN-14** Importação de catálogo/clientes por planilha (onboarding do trial).
- **FUN-15** Anexos no evento (contrato assinado, planta do local, laudos do checklist).
- **FUN-16** Histórico de envios por versão (hoje `enviado_em`/`enviado_para` guardam só o último envio).

---

## 4. Oportunidades de refatoração e melhoria

### 4.1 Correção / robustez

- **REF-01 — Autosave com corrida.** Em [OrcamentoBuilder.tsx](src/components/orcamento/OrcamentoBuilder.tsx), um novo
  `salvarAgora` pode sair enquanto o anterior está em voo. As duas requisições chegam ao servidor fora de ordem e a mais
  antiga pode gravar por último. Serializar (fila de 1 + "próximo pendente") e enviar um número de revisão;
  o servidor recusa revisões antigas (`409`).
- **REF-02 — Transações longas com I/O externo.** PDF (Chromium), envio de e-mail (Resend, sem timeout no `fetch`) e
  IA rodam dentro de `withTenant`. Além do SEC-A1, um e-mail enviado não se desfaz se o `COMMIT` falhar. Padrão:
  preparar → commit → efeito externo → registrar. Pôr `AbortSignal.timeout` no `sendMail`.
- **REF-03 — `MAX_SIMULTANEAS` da IA sem lock.** `registrarFundo` conta e depois insere: duas requisições paralelas
  passam do limite. Usar `pg_advisory_xact_lock(hashtext(tenant))` ou índice parcial.
- **REF-04 — Validar FKs de forma central** (ver SEC-M2): helper único e teste e2e cobrindo "id de outro tenant" em
  todos os formulários com select.

### 4.2 Organização do código

- **REF-05 — Utilitários duplicados:** `env()` em `db.ts`, `mail.ts`, `openai.ts` (e leitura de `JWT_SECRET` em
  `auth.ts` e `printToken.ts`) → um `lib/env.ts` validado com zod na subida (falha cedo se faltar
  `JWT_SECRET`/`RESEND_API_KEY` em produção). `slugify` duplicado em `autoatendimento.ts` e `formularios.ts`. A regex de
  UUID `/^[0-9a-f-]{36}$/i` repetida em vários arquivos → `isUuid()`.
- **REF-06 — Páginas grandes com lógica e scripts inline:** [TemplateForm.astro](src/components/templates/TemplateForm.astro)
  (742 linhas), [f/[slug].astro](src/pages/f/[slug].astro) (597), [eventos/index.astro](src/pages/eventos/index.astro)
  (474), [FileUpload.astro](src/components/ui/FileUpload.astro) (401). Extrair os scripts para módulos `.ts` testáveis e
  dividir em componentes (isso também facilita a CSP com `script-src 'self'`).
- **REF-07 — Rotas de API sem `jsonEndpoint`:** [api/configuracoes/categorias/tipos.ts](src/pages/api/configuracoes/categorias/tipos.ts)
  repete o try/catch à mão. Padronizar.
- **REF-08 — Documentação e arquivos legados:** `modelagem-banco-de-dados.md` (schema antigo, 563 linhas) e
  `db/seeds/_legacy_*` confundem. Mover para `docs/historico/` ou remover. `CLAUDE.md`/`AGENTS.md` duplicados em 42 KB
  cada: um único arquivo com o outro apontando para ele reduz o risco de divergência (hoje depende de copiar à mão).
- **REF-09 — `rodape_logo_path`** ainda percorrido em `CAMPOS_IMAGEM`, `duplicarTemplate`, `arquivoEmUso`: concluir a
  remoção em dois deploys (FUN-12).

### 4.3 Qualidade, testes e operação

- **REF-10 — CI inexistente.** Não há `.github/workflows`. Os testes só rodam no `make deploy` do Mac. Criar pipeline
  com `npm ci`, `vitest`, `astro check`, `npm audit` e e2e com Postgres de serviço. A VPS não tem as devDependencies,
  então não dá para validar nada ali.
- **REF-11 — Cobertura de testes do servidor.** Há 12 arquivos de unidade, quase todos em `lib/`. Funções críticas
  como `salvarVersao`, `criarNovaVersao`, `receberResposta`, `usuarios.ts` (regras de owner) e `templates.ts` só têm
  cobertura e2e. Sugestão: testes de integração com banco real (Testcontainers ou o Postgres do compose) rodando dentro
  de `withTenant`, incluindo testes de RLS ("tenant A não enxerga B" para cada tabela, gerados a partir de
  `pg_policies`).
- **REF-12 — Observabilidade.** Só `console.error`. Faltam logs estruturados (JSON com tenant, usuário, rota, request
  id), rastreio de erros (Sentry ou similar), métricas do pool do Postgres e do Chromium, e alerta no `/api/health`.
- **REF-13 — Escalabilidade das listagens.** O Kanban carrega todos os eventos do intervalo sem limite. Com "eventos sem
  data sempre aparecem", isso cresce indefinidamente. Paginar por coluna ou arquivar recusados/antigos. Índices para
  `ILIKE` de busca (`pg_trgm`) em clientes/eventos.
- **REF-14 — Pool de sistema pequeno e usado em todo request.** `getMembership` e `empresasDoUsuario` (Topbar) usam o
  `systemPool` (máx. 3) a cada miss de cache. Sob carga vira gargalo. Aumentar o pool ou unificar as duas consultas
  numa só com cache comum.
- **REF-15 — Imagem Docker.** `npm install` → `npm ci`; runtime com `--omit=dev`; `USER node`; `HEALTHCHECK` no
  Dockerfile; fontes do PDF embutidas (evita depender do Google Fonts na hora de imprimir e o `networkidle` lento).
- **REF-16 — Uploads prontos para S3.** A interface de `storage.ts` já foi pensada para isso. Com dois contêineres
  (blue/green) no mesmo volume funciona, mas não escala para múltiplas VPS. Planejar S3/R2 + URLs assinadas, o que
  também resolve o SEC-A3 ao servir de outro domínio.

---

## 5. Plano sugerido

1. **Imediato (esta semana):** FUN-01 (Resend + falhar sem chave em produção), SEC-A2 (real IP da Cloudflare no
   Nginx), SEC-A1 (PDF fora da transação + semáforo), SEC-A3 (bloquear/sanitizar SVG + CSP em `/uploads`).
2. **Curto prazo (2–4 semanas):** SEC-A4, SEC-M1, SEC-M2, SEC-M3, REF-01, UX-05, CI (REF-10), backups (SEC-B11).
3. **Próximo ciclo de produto:** UX-01/UX-02 (mobile), FUN-02 (trial/cobrança), FUN-03 (notificações), FUN-04 (LGPD),
   FUN-05 (aceite online da proposta).
4. **Contínuo:** demais itens de média/baixa prioridade, refatorações de organização e observabilidade.
