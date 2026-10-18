# Banket — Relatório de análise de código

**Data:** 18/10/2026 · **Código revisado:** `main` @ `8b43bc2` · **Produção:** `app.banket.com.br` e `busca.banket.com.br`

Substitui os relatórios de 30/09/2026 (`report.md`, `report-seguranca.md`, `report-ux&ui.md`), removidos no commit
`55a6f33`. As pendências daqueles relatórios que continuam abertas estão listadas aqui com o ID original (`SEG-xx`).

## Método

- Quatro auditorias em paralelo, **só de leitura**: cobrança e planos (Stripe, gating, agendador, WhatsApp, Hwesta),
  Banket Busca, autenticação e isolamento entre empresas, e infraestrutura e qualidade.
- Os achados mais graves foram conferidos no código: login com o Google, limitador de tentativas, IP atrás do
  Cloudflare e proração do upgrade.
- Testes: `npx vitest run` com 249 de 249 passando; `npx astro check` com 0 erros e 0 avisos. Os e2e não foram rodados.
- Verificações sem exploração destrutiva: GET com caminhos codificados na cor ativa, EXPLAIN das consultas da busca e
  leitura dos IPs gravados em `formulario_respostas`.

## Backlog herdado do plano de UX (28/09/2026)

As fases 0 a 4 foram concluídas. Ficaram: UX-066 (legenda da agenda), UX-094 (visão em lista e iCal da agenda),
UX-092 (KPIs clicáveis no dashboard) e a seção 4.8 (oportunidades).

---

## 🔴 Segurança (crítico)

### [Segurança] Sequestro de conta pelo login com Google sobre um cadastro não confirmado
**Arquivo:** `src/server/googleConta.ts:83-93`
**Problema:** a conta é achada pelo e-mail sem olhar `email_verificado_em`. Depois ela é marcada como verificada e a
senha existente é mantida.
**Risco:** o atacante cadastra `vitima@gmail.com` com uma senha dele e não confirma. Quando a vítima entra com o
Google, a conta fica verificada e o atacante entra com a senha dele, mesmo depois de a vítima virar owner.
**Correção sugerida:** se a conta não estiver verificada, trocar a senha por um valor aleatório e invalidar os tokens
dela antes de vincular. Corrigir junto o SEG-03, a sobrescrita de senha em cadastro pendente
(`src/server/autoatendimento.ts:94-102`).

### [Segurança] O app enxerga o IP do Cloudflare, não o do cliente
**Arquivo:** `/etc/nginx/sites-enabled/app.banket.com.br.conf:8`, `src/lib/rateLimit.ts:27`
**Problema:** o Nginx não tem `real_ip_header CF-Connecting-IP` nem `set_real_ip_from`. Em produção,
`formulario_respostas.ip` guarda faixas do Cloudflare.
**Risco:** todos os limites por IP valem por servidor de borda do Cloudflare: login, cadastro, formulário, pesquisa e
métricas. Usuários legítimos são bloqueados juntos, e um atacante distribuído escapa trocando de borda. O IP guardado
não serve para auditoria nem para a LGPD.
**Correção sugerida:** configurar `real_ip_header CF-Connecting-IP` com as faixas oficiais do Cloudflare e liberar as
portas 80/443 da origem só para o Cloudflare. O mesmo vale para o `map $http_cf_connecting_ip` do site.

### [Segurança] O limitador de tentativas pode ser zerado de fora, o que anula a proteção contra força bruta
**Arquivo:** `src/lib/rateLimit.ts:11-20`, `src/pages/api/vitrine/metrica.ts:19`
**Problema:** acima de 10 mil chaves, a limpeza usa a janela de quem está chamando agora, não a de cada chave. O
`POST /api/vitrine/metrica`, público e sem limite por IP, cria uma chave por UUID enviado, mesmo inexistente.
**Risco:** o atacante enche o mapa e depois faz uma chamada com janela de 60 s. Os contadores de login, de 15 min, são
apagados, e ele repete o ciclo. Além disso, o mapa cresce sem teto e cada requisição percorre o mapa inteiro.
**Correção sugerida:** guardar o prazo de expiração em cada entrada e limitar o tamanho do mapa (LRU). Pôr um limite
por IP antes da chave por perfil na métrica. Nas chaves de login, recusar em vez de esquecer quando o mapa estiver
cheio.

### [Segurança] As avaliações do Banket Busca podem ser forjadas pelo próprio buffet
**Arquivo:** `src/server/pesquisas.ts:203, 233`, `src/server/busca/publico.ts:350-367`
**Problema:** a exigência de "evento aprovado e já realizado" só existe na tela. Qualquer usuário gera o link da
pesquisa para qualquer evento, responde com nota 5 e libera o depoimento.
**Risco:** fraude de reputação num marketplace. A avaliação pesa 25% do ranking e decide as vagas de Destaque, e a
nota é exibida ao consumidor como real.
**Correção sugerida:**
- exigir no servidor a etapa aprovado e a data já passada;
- excluir respostas cujo e-mail ou IP seja de usuário da empresa;
- dar mais peso a eventos de origem `busca` ou `formulario`.

---

## 🟠 Bugs de comportamento e segurança (alto)

### [Bug] O upgrade com assinatura libera o plano maior sem cobrar
**Arquivo:** `src/server/assinatura.ts:371-386`
**Problema:** a troca usa `create_prorations`, então a diferença só entra na próxima fatura, mas o plano novo é
liberado na hora.
**Risco:** subir para o Prime, cancelar e repetir dá acesso ao plano maior sem pagar.
**Correção sugerida:** no upgrade, `always_invoice` com `payment_behavior: 'pending_if_incomplete'`, e liberar o plano
só no `invoice.paid`.

### [Bug] Rebaixa ou cancela quem já pagou quando o webhook atrasa
**Arquivo:** `src/server/assinatura.ts:704-728, 857-873, 671-674`
**Problema:** a decisão de rebaixar sai só do espelho local. O `voidInvoice(...).catch(() => null)` engole erros e o
QR do Pix continua pagável.
**Risco:** cobrança sem serviço: o cliente paga e fica sem plano e sem assinatura.
**Correção sugerida:** antes de qualquer ação destrutiva, buscar a fatura e a assinatura direto no Stripe. Cancelar o
PaymentIntent do Pix antes de anular a fatura e abortar se a anulação falhar.

### [Bug] Pix com cobrança no fim do teste dá cerca de 8 dias a mais sem pagar
**Arquivo:** `src/lib/planos/cobranca.ts:47-57`, `src/server/assinatura.ts:291, 330`
**Problema:** a primeira fatura chega como `subscription_cycle`, então a regra da primeira fatura em aberto não se
aplica.
**Risco:** qualquer empresa em teste ganha cerca de 8 dias de plano pago escolhendo Pix no fim do teste e não pagando.
**Correção sugerida:** tratar como "primeira em aberto" a primeira fatura com valor de uma assinatura que ainda não
tem nenhuma fatura paga.

### [Bug] Duas assinaturas vivas para a mesma empresa
**Arquivo:** `src/server/assinatura.ts:273, 306-319, 572-577`
**Problema:** duas abas de Checkout, ou um cartão depois de uma contratação Pix, criam uma segunda assinatura. O
espelho alterna entre as duas.
**Risco:** cobrança em dobro.
**Correção sugerida:** expirar a sessão anterior ao abrir outra e cancelar a assinatura duplicada no
`checkout.session.completed`.

### [Bug] O rebaixamento feito pelo Manager não mexe no Stripe
**Arquivo:** `src/server/planos.ts:385-390`
**Problema:** `aplicarDoManager` rebaixa mas não solta a assinatura.
**Risco:** a cobrança continua, e a reconciliação seguinte devolve a empresa ao plano pago.
**Correção sugerida:** encerrar e soltar a assinatura no Stripe, ou responder 409.

### [Bug] Assinatura encerrada sem pagamento rebaixa uma empresa em teste (corrida)
**Arquivo:** `src/lib/planos/cobranca.ts:60-62`, `src/server/assinatura.ts:678, 685, 770`
**Problema:** o status `canceled` é gravado antes de a assinatura ser solta. Nesse intervalo, outro avaliador rebaixa
a empresa.
**Risco:** a empresa perde o teste e recebe um e-mail de cancelamento sem nunca ter pago.
**Correção sugerida:** assinatura encerrada sem nenhuma fatura paga segue a regra do teste.

### [Bug] A varredura dos testes roda numa única transação
**Arquivo:** `src/server/agendador.ts:19`, `src/server/planos.ts:311-362`
**Problema:** um erro numa empresa aborta a transação inteira e o COMMIT vira ROLLBACK. Os e-mails já saíram. O envio
de e-mail sem `await` ainda gera consultas paralelas no mesmo client.
**Risco:** o teste vencido não é rebaixado e os e-mails D-7, D-1 e D0 se repetem a cada 10 minutos.
**Correção sugerida:** uma transação por empresa e os e-mails depois do commit, com `await`.

### [Bug] O cartão recusado uma vez cancela a assinatura em cerca de 36 h
**Arquivo:** `src/lib/planos/cobranca.ts:52-55`, `src/server/assinatura.ts:598`
**Problema:** às 12h do dia seguinte o app cancela a assinatura e descarta as novas tentativas automáticas do Stripe.
⚠️ Investigar com o produto se essa é a regra desejada.
**Risco:** perda de cliente pagante por uma falha temporária do cartão.
**Correção sugerida:** no cartão, esperar o status `unpaid`, isto é, o fim das novas tentativas.

### [Bug] Descer entre planos pagos não aplica os limites do Busca
**Arquivo:** `src/server/planos.ts:141-151, 200-215`
**Problema:** só `restaurarBusca` roda. Ela devolve tudo e o corte pelo limite novo nunca acontece.
**Risco:** quem desce do Prime para o Essencial fica com 60 fotos e 10 tipos.
**Correção sugerida:** chamar `aplicarExcedentesBusca` depois de restaurar.

### [Bug] A importação CSV perde as linhas sem avisar e diz que importou
**Arquivo:** `src/server/importacao.ts:40-56, 85-108`
**Problema:** uma linha duplicada aborta a transação e o COMMIT vira ROLLBACK silencioso.
**Risco:** a tela mostra "N importados" e nada é gravado.
**Correção sugerida:** um `SAVEPOINT` por linha.

### [Segurança] O Assistente de Negociação mostra e-mails de outros usuários ao papel `usuario`
**Arquivo:** `src/server/ia/comum.ts`, `src/pages/eventos/[id]/ia-contexto/[analiseId].ts`
**Problema:** a análise feita por um admin inclui todas as conversas do evento, e a leitura dela não filtra por
usuário.
**Risco:** um usuário comum lê mensagens que o Inbox esconderia dele.
**Correção sugerida:** guardar o escopo de quem gerou a análise e mostrar só a quem está no mesmo escopo.

### [Disponibilidade] As métricas públicas usam o pool de sistema de 3 conexões, o mesmo do login
**Arquivo:** `src/server/busca/publico.ts:516-530`
**Problema:** cada visualização, busca e clique grava pelo `systemPool`, com `await` na página.
**Risco:** um scraper ocupa as 3 conexões e o login, o cadastro e os webhooks param.
**Correção sugerida:** pool próprio para as métricas, sem `await`, e contagem uma vez por IP e perfil.

### [Segurança] Relays de e-mail sem limite suficiente
**Arquivo:** `src/server/busca/reivindicacao.ts:97-128` (reivindicação), `src/server/formularios.ts:500-516`
(formulário público), `src/server/whatsapp.ts:40-58` (teste do WhatsApp)
**Problema:**
- **Reivindicação:** o limite por perfil cai trocando a grafia do endereço, e o recibo vai para qualquer e-mail.
- **Formulário público:** a confirmação vai para o e-mail digitado, com o nome da empresa escrito pela própria conta.
- **Teste do WhatsApp:** dispara para qualquer número, sem limite.

**Risco:** o domínio do Banket vira canal de phishing, e o número do WhatsApp Business pode ser bloqueado.
**Correção sugerida:** limites por empresa e por e-mail, e confirmação do número antes de ativar o WhatsApp.

### [Bug] Disponibilidade de redes: evento numa unidade tira as outras da busca
**Arquivo:** `src/server/busca/publico.ts:192-196, 455-466`
**Problema:** a checagem de data ocupada olha os eventos da empresa inteira, não os do espaço da unidade.
**Risco:** a rede some da busca em toda data ocupada de qualquer unidade.
**Correção sugerida:** filtrar `e.espaco_id = p.espaco_id`.

### [Segurança] O endereço do perfil pode ser tomado
**Arquivo:** `src/server/busca/onboarding.ts:105-110`, `src/server/busca/perfil.ts:100, 155`
**Problema:** um buffet pago pode usar o nome de um concorrente como endereço. Os endereços antigos nunca expiram e
não há lista de nomes reservados.
**Risco:** impersonação, desvio de tráfego da marca e acúmulo de nomes.
**Correção sugerida:** limitar ou dar validade aos endereços antigos, criar uma lista de reservados e bloquear o nome
de outro perfil.

### [Bug] Envio da proposta sem trava contra duplo clique
**Arquivo:** `src/server/envio.ts:108-150`
**Problema:** a checagem de "enviada há menos de 60 s" não trava a linha.
**Risco:** o cliente recebe a proposta duas vezes, e a segunda some do Inbox.
**Correção sugerida:** `FOR UPDATE` na versão.

### [Bug] O plano de pagamento pode duplicar as parcelas
**Arquivo:** `src/server/financeiro.ts:474-516`
**Problema:** dois envios simultâneos do mesmo plano inserem as parcelas duas vezes.
**Risco:** contas a receber em dobro.
**Correção sugerida:** `FOR UPDATE` no evento.

### [Segurança] Pendências do relatório de 30/09, ainda abertas
**Arquivo:** vários
- **SEG-06:** SVG enviado como imagem e servido inline (`src/lib/storage.ts:16`).
- **SEG-09:** open redirect `/\evil.com` no login (`src/pages/auth/login.astro:15`) e agora também no login com o
  Google (`src/pages/auth/google.ts:15` → `callback.ts:51`).
- **SEG-10:** ids de cardápio e staff gravados sem conferir se são da empresa.
- **SEG-15:** rotas com extensão ficam públicas (`src/middleware.ts:38`).
- **SEC-B6:** admin reenvia ou cancela convite de proprietário (`src/server/usuarios.ts:161-178`).
- **SEG-08:** troca de senha não derruba as outras sessões e o logout é por GET.
- **Tokens de uso único:** o link de acesso e a verificação consomem o token no GET (scanners de link "queimam" o
  link, e é possível um login CSRF).

---

## 🟡 Infraestrutura e performance

### [Infra] Pools do `pg` sem tratamento de erro nem timeout
**Arquivo:** `src/lib/db.ts:13-27`
**Problema:** sem `pool.on('error')`, sem `connectionTimeoutMillis` e sem `statement_timeout`.
**Risco:** um restart do Postgres derruba o processo, e com o pool cheio as requisições esperam para sempre.
**Correção sugerida:** tratador de erro nos três pools e os timeouts.

### [Infra] Transação aberta durante o Chromium e a OpenAI
**Arquivo:** `src/pages/eventos/[id]/orcamento/pdf.ts:12`, `src/server/envio.ts:117`, `src/server/ia/*`
**Problema:** a conexão fica presa enquanto o PDF é gerado ou a IA responde (até 55 s). A página de impressão precisa
de outra conexão do mesmo pool de 10.
**Risco:** cerca de 10 PDFs ou análises simultâneos travam o app.
**Correção sugerida:** fazer commit antes de chamar o Chromium ou a OpenAI, como `documentos.ts` já faz.

### [Infra] Chromium sem limite de concorrência, como root e com `--no-sandbox`
**Arquivo:** `src/server/pdf.ts:24-48`, `Dockerfile`
**Problema:** nenhuma fila de impressões, e o processo tem no ambiente a credencial do banco que ignora o RLS.
**Risco:** pico de PDFs derruba a VPS compartilhada, e um renderer comprometido vira root com acesso ao banco inteiro.
**Correção sugerida:** semáforo de 2 a 3 impressões e `USER node` no contêiner.

### [Infra] Não existe `.dockerignore`
**Arquivo:** `Dockerfile:9-11`
**Problema:** o build leva o `scrapping/` (2,2 GB), o `.env`, o `.git` e o `node_modules` do host. A imagem sai com as
dependências de desenvolvimento e sem `NODE_ENV`.
**Risco:** deploy lento, segredo e dados coletados nas camadas do Docker, build não reprodutível.
**Correção sugerida:** criar o `.dockerignore`, usar `npm ci` e `--omit=dev` e definir `NODE_ENV=production`.

### [Infra] O Kanban carrega todos os eventos
**Arquivo:** `src/server/eventos.ts:240-247`
**Problema:** sem `LIMIT`, e as 4 empresas de produção estão com o intervalo do Kanban vazio.
**Risco:** a página fica mais lenta a cada evento do histórico.
**Correção sugerida:** limite por coluna, ou um intervalo padrão.

### [Infra] Migrations sem lock e deploy que não testa o banco
**Arquivo:** `scripts/migrate.mjs:62-77`, `scripts/deploy-remoto.sh:22`
**Problema:** nada impede duas instâncias de migrar ao mesmo tempo, e a checagem do deploy usa `/auth/login` em vez
de `/api/health`.
**Risco:** migration aplicada em paralelo, e tráfego enviado para uma cor que está sem banco.
**Correção sugerida:** `pg_advisory_lock` no `migrate.mjs` e `/api/health` no deploy.

### [Infra] Consultas da vitrine com o papel dono das tabelas e sem timeout
**Arquivo:** `src/lib/db.ts:22-27, 77-82`
**Problema:** a leitura pública usa a credencial que ignora o RLS e não tem `statement_timeout`.
**Risco:** uma consulta lenta prende o pool de 6 conexões, e qualquer injeção futura leria o banco inteiro.
**Correção sugerida:** `SET LOCAL statement_timeout` e um papel Postgres só de leitura para a vitrine.

### [Infra] `Promise.all` no mesmo client do `pg`
**Arquivo:** `src/server/pesquisas.ts:330`, `envio.ts:63`, `documentos.ts:258`, `orcamento.ts:706`,
`conversas.ts:149`, `formularios.ts:236`, `clientes.ts:54`, `espacos.ts:95, 179`
**Problema:** consultas simultâneas no mesmo client.
**Risco:** vira erro quando o `pg` for atualizado para a versão 9.
**Correção sugerida:** trocar por `await` em sequência.

### [Infra] Variáveis que não chegam aos contêineres
**Arquivo:** `docker-compose.prod.yml`, `docker-compose.yml`
**Problema:** `DB_POOL_VITRINE` e `BANKET_SEM_AGENDADOR` estão documentadas mas não estão no `environment` do compose.
As senhas do banco têm valor padrão em produção.
**Risco:** quem muda essas variáveis no `.env` acha que mudou algo, e nada muda; numa reinstalação o banco subiria com
senha conhecida.
**Correção sugerida:** incluir as duas variáveis e usar `${POSTGRES_PASSWORD:?…}` em produção.

### [Segurança] Fotos continuam públicas depois de bloqueio ou remoção
**Arquivo:** `src/pages/busca-media/[tenant]/[...key].ts:13-19`
**Problema:** a rota serve o arquivo do disco sem conferir no banco, e o pedido de remoção do buffet não apaga os
arquivos.
**Risco:** imagens de quem pediu remoção continuam acessíveis por URL, o que é problema de LGPD.
**Correção sugerida:** conferir no banco antes de servir e apagar o diretório na remoção.

---

## 🔵 Qualidade e ⚪ incompleto

### [Incompleto] `robots.txt`, `sitemap.xml` e `/avaliar` respondem 404
**Arquivo:** `src/lib/busca/host.ts:19`
**Problema:** as três rotas são reescritas para a vitrine, mas nenhuma página existe.
**Risco:** as landings de SEO dependem do sitemap para serem descobertas, e a avaliação pós-pedido do Busca não
existe.
**Correção sugerida:** criar as duas primeiras a partir dos perfis publicados e implementar ou tirar `/avaliar`.

### [Incompleto] Estorno e contestação não afetam o plano
**Arquivo:** `src/server/assinatura.ts:837-840`, `src/lib/hwesta/adapter.ts:37-38`
**Problema:** estorno e contestação no Stripe não mudam nada, e o Manager não vê a inadimplência.
**Risco:** acesso pago depois de estorno ou contestação, e a equipe sem visibilidade da cobrança.
**Correção sugerida:** tratar estorno total e contestação, e derivar o status enviado ao Manager da situação da
cobrança.

### [Bug] Recursos pagos que escapam do plano no Busca
**Arquivo:** `src/pages/vitrine/buffet/[slug].astro:51-54`, `src/server/busca/onboarding.ts:262`
**Problema:**
- os grupos de fotos aparecem no perfil público mesmo no plano gratuito;
- o servidor aceita raio de até 500 km, mas a busca só olha 200 km.

**Risco:** o gratuito fica com um recurso pago e um buffet com raio grande some de buscas compatíveis.
**Correção sugerida:** esconder os grupos sem o recurso e validar o raio contra a lista da tela (10/25/50/100 km).

### [Qualidade] Dados guardados além do necessário
**Arquivo:** `src/server/assinatura.ts:738`, `src/components/inbox/Conversa.astro:105`
**Problema:**
- `stripe_events.payload` guarda CPF/CNPJ, endereço e dados do cartão para sempre;
- o e-mail recebido no Inbox carrega imagens remotas.

**Risco:** retenção de dados pessoais além do necessário (LGPD), e o remetente fica sabendo quando o e-mail foi lido.
**Correção sugerida:** guardar só os ids do evento e bloquear imagens remotas no `srcdoc`.

### [Qualidade] Código morto e arquivos grandes
**Arquivo:** `src/server/templates.ts:18`, `src/server/busca/onboarding.ts:301`, `src/pages/f/[slug].astro`,
`src/server/assinatura.ts`
**Problema:**
- colunas marcadas "sem uso" ainda são lidas ou gravadas: `rodape_logo_path`, `valor_minimo`;
- índices sobrepostos em `eventos` (`idx_eventos_data`, `idx_eventos_tenant` e `idx_eventos_tenant_data`);
- arquivos de mais de 1.000 linhas: `f/[slug].astro`, `eventos/index.astro` e `assinatura.ts` (994).

**Risco:** as colunas não podem ser removidas sem antes um deploy só de código, e os arquivos grandes são difíceis de
manter.
**Correção sugerida:** tirar as referências agora e remover as colunas numa migration posterior; separar o
`assinatura.ts` em checkout, webhook e varredura.

### ⚠️ Investigar
- **Destaques:** a primeira página pode abrir com 6 pagantes seguidos (3 Destaques e mais 3)
  (`src/lib/busca/ranking.ts:218-229`).
- **Inbox:** a conversa é achada só por `References` em qualquer empresa, e as mensagens de saída não guardam
  `message_id` (`src/server/inbox/receber.ts:127`).
- **Formulários:** a prévia de formulário inativo aceita um JWT de usuário já removido da empresa
  (`src/pages/f/[slug].astro:14`).

---

## Conferido sem problema

- Webhooks: Stripe com corpo bruto; Resend, Meta e Hwesta com `timingSafeEqual`.
- `exigirAdmin` em todas as ações de `/api/assinatura/*`; limites do plano conferidos no servidor.
- Middleware: caminhos codificados chegam normalizados; sem bypass das rotas de admin.
- `/uploads` protegido contra path traversal e restrito ao tenant da sessão; `/busca-media` só aceita
  `busca/<uuid>.(png|jpg|webp)`.
- Print token amarra alvo, id e tenant; tokens de autenticação de uso único, com expiração e só o hash no banco.
- Escapes (`renderTexto`, `html```, `escapeHtml`, JSON-LD) corretos; e-mail recebido em `<iframe sandbox="">`.
- `orderBy` e `reordenar` com listas brancas; nenhum SQL montado com dado do usuário.
- Pool da vitrine em `READ ONLY`; `_perfil` de outra empresa barrado pela RLS; prévia restrita à empresa dona.
- Agendador idempotente entre as duas cores do blue-green.
- Nenhum segredo versionado; migrations de 000 a 048 sem duplicata nem buraco.

---

## Resumo

| # | Categoria | Problema | Arquivo | Prioridade |
|---|---|---|---|---|
| 1 | Segurança | Sequestro de conta pelo Google com cadastro não confirmado | `server/googleConta.ts:83` | 🔴 Crítico |
| 2 | Segurança | IP do Cloudflare no lugar do IP do cliente | Nginx, `lib/rateLimit.ts:27` | 🔴 Crítico |
| 3 | Segurança | Limitador de tentativas zerável, anula a proteção do login | `lib/rateLimit.ts:11` | 🔴 Crítico |
| 4 | Segurança | Avaliações do Busca forjáveis | `server/pesquisas.ts:203` | 🔴 Crítico |
| 5 | Bug | Upgrade libera o plano sem cobrar | `server/assinatura.ts:371` | 🟠 Alto |
| 6 | Bug | Rebaixa quem pagou quando o webhook atrasa | `server/assinatura.ts:704` | 🟠 Alto |
| 7 | Bug | Pix no fim do teste dá ~8 dias grátis | `lib/planos/cobranca.ts:47` | 🟠 Alto |
| 8 | Bug | Duas assinaturas para a mesma empresa | `server/assinatura.ts:273` | 🟠 Alto |
| 9 | Bug | Manager rebaixa e o Stripe continua cobrando | `server/planos.ts:385` | 🟠 Alto |
| 10 | Bug | Varredura dos testes numa transação só | `server/agendador.ts:19` | 🟠 Alto |
| 11 | Bug | Importação CSV perde linhas sem avisar | `server/importacao.ts:40` | 🟠 Alto |
| 12 | Segurança | IA mostra e-mails de outros usuários | `server/ia/comum.ts` | 🟠 Alto |
| 13 | Disponib. | Métricas no pool do login | `server/busca/publico.ts:516` | 🟠 Alto |
| 14 | Bug | Limites do Busca ao descer de plano pago | `server/planos.ts:141` | 🟠 Alto |
| 15 | Segurança | Relays de e-mail e WhatsApp sem limite | reivindicação, formulário, WhatsApp | 🟠 Alto |
| 16 | Bug | Disponibilidade de redes por empresa, não por unidade | `server/busca/publico.ts:192` | 🟠 Alto |
| 17 | Segurança | Endereço do perfil pode ser tomado | `server/busca/onboarding.ts:105` | 🟠 Alto |
| 18 | Bug | Envio duplicado e parcelas duplicadas | `server/envio.ts:108`, `server/financeiro.ts:474` | 🟠 Alto |
| 19 | Segurança | Pendências de 30/09 (SVG, open redirect, FKs, sessões) | vários | 🟠 Alto |
| 20 | Infra | Pools sem tratamento de erro nem timeout | `lib/db.ts:13` | 🟡 Alto |
| 21 | Infra | Transação aberta durante o PDF e a IA | `orcamento/pdf.ts`, `server/ia/*` | 🟡 Alto |
| 22 | Infra | Chromium sem fila, como root | `server/pdf.ts`, `Dockerfile` | 🟡 Alto |
| 23 | Infra | Sem `.dockerignore` (2,2 GB e `.env` no build) | `Dockerfile` | 🟡 Alto |
| 24 | Infra | Kanban sem limite, migrations sem lock, vitrine sem timeout | vários | 🟡 Médio |
| 25 | Incompleto | `robots`, `sitemap` e `/avaliar` com 404; estorno ignorado | `lib/busca/host.ts:19`, `server/assinatura.ts:837` | ⚪ Médio |
| 26 | Qualidade | `Promise.all` no client do pg, código morto, retenção de dados | vários | 🔵 Médio |

**Por onde começar:** pelo #1, o sequestro de conta pelo Google. É a única falha que entrega uma conta inteira,
inclusive a de um proprietário, a quem só fez um cadastro, e a correção é pequena e fica num arquivo só. Logo depois,
os itens #2 e #3 juntos: são uma regra no Nginx e um ajuste no `rateLimit.ts`, e hoje deixam o login praticamente sem
limite de tentativas.
