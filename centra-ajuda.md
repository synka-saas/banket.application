# Tarefa: Central de Ajuda do Banket (Astro SSG + login obrigatório)

> Você está rodando a partir de `/var/www/banket` (raiz do monorepo). Todos os caminhos abaixo são relativos a essa raiz.

## Contexto
Vou construir a central de ajuda (knowledge base) do Banket em `help/`. Ela é um projeto **separado** do app (`app.banket.com.br`), mas exige **login obrigatório** e reaproveita a sessão que já existe na plataforma.

O diretório `help/` já contém:

### `help/central-ajuda/`: protótipo gerado pelo **Claude Design**
```
Central de Ajuda.dc.html   ← arquivo principal do protótipo (telas e layout); atenção: nome com espaços
_ds/                       ← design system do Claude Design (provavelmente tokens, fontes, estilos e componentes)
image-slot.js              ← script de runtime do Claude Design (provavelmente placeholders de imagem)
support.js                 ← script de runtime/suporte do Claude Design
uploads/                   ← assets enviados ao design (logos, imagens etc.)
```
É a **referência visual e estrutural** do site. Não é código de produção:
- Extraia do `.dc.html` e do `_ds/` o layout, as telas, os componentes, os tokens (cores, tipografia, espaçamentos, raios, sombras) e as fontes.
- `image-slot.js` e `support.js` são, a princípio, scripts do ambiente do Claude Design. **Confirme o que eles fazem**, mas **não os leve para o site final**. Reimplemente em Astro apenas o comportamento de interface que fizer sentido (ex.: busca, menu mobile, accordion).
- Reaproveite de `uploads/` só os assets que o layout realmente usa (logo, ícones, ilustrações).

### `help/support/`: conteúdo
Todos os arquivos `.md` com o conteúdo das páginas e todas as imagens.

Você deve **orquestrar tudo**: transformar o protótipo do Claude Design em um site Astro e usar os documentos de `help/support/` como fonte para gerar a base de conhecimento.

### Decisões de arquitetura (já tomadas, não precisa rediscutir)
- **Astro em modo SSG** (`output: 'static'`), com `base: '/ajuda'`.
- `help/support/` é a **fonte única da verdade** do conteúdo. Adicionar ou editar um `.md` ou imagem ali e regenerar o site deve bastar. Nada de copiar conteúdo manualmente para dentro do projeto Astro.
- `help/central-ajuda/` é **referência** e não deve ser apagada nem alterada. O site Astro novo fica em `help/site/`.
- O site roda em um **container Docker** (build multi-stage: Node gera o estático e `nginx:alpine` serve). A porta fica publicada **apenas em `127.0.0.1`**.
- É servido no **mesmo host da plataforma**, em `platform.banket.app/ajuda/`, para o cookie de sessão ser enviado sem alterar o domínio do cookie.
- A proteção fica no **Nginx do host via `auth_request`**, que consulta um endpoint leve da API antes de repassar qualquer requisição ao container. Nenhum arquivo (HTML, imagens, índice de busca) pode vazar para quem não estiver logado.

## Passo 0: Investigar antes de implementar (obrigatório)
Leia o `CLAUDE.md` da raiz e me reporte, **antes de alterar qualquer coisa**:

1. **Autenticação**: a sessão é por **cookie** ou por **token no header** (Bearer/localStorage)? Informe o nome do cookie, as flags (HttpOnly, SameSite, Domain, Path) e onde a sessão é validada em `api/` (Fastify).
2. **Infra**: porta/upstream da API, onde fica a config do Nginx de `platform.banket.app`, e se o Nginx roda **no host ou em container** (isso muda como ele alcança o container da ajuda). Veja também o `docker-compose.yml` da raiz para seguir as mesmas convenções (rede, restart policy, logs).
3. **Login**: rota de login em `platform/` e se ela já aceita parâmetro de retorno (ex.: `?redirect=`).
4. **Protótipo (`help/central-ajuda/`)**: estrutura do `Central de Ajuda.dc.html` (quais telas ele contém, como estão organizadas), o que há em `_ds/` (tokens, fontes, componentes), o que `image-slot.js` e `support.js` fazem de fato, e quais assets de `uploads/` são usados. Liste os componentes identificáveis (header, sidebar, busca, cards de categoria, página de artigo, rodapé etc.).
5. **Conteúdo (`help/support/`)**: inventário com quantidade de `.md` e imagens, estrutura de pastas, se há frontmatter (e quais campos), como as imagens são referenciadas (caminhos relativos, absolutos, URLs), links internos entre documentos e nomes de arquivo problemáticos (espaços, acentos, maiúsculas).
6. **Problemas encontrados no conteúdo**: imagens referenciadas que não existem, imagens órfãs, links quebrados, documentos sem título.
7. **Encaixe protótipo × conteúdo**: as telas do protótipo cobrem tudo que o conteúdo exige? Aponte lacunas (ex.: o protótipo não tem tela de categoria, 404 ou versão mobile).

⚠️ Se a auth for por **token no header** e não por cookie, **pare e me avise**: o `auth_request` não funciona assim e precisamos decidir a alternativa antes de continuar.

Com base no inventário, proponha **como mapear `help/support/` para a navegação** (categorias, ordem, slugs) e **aguarde minha aprovação**.

## Passo 1: Endpoint de verificação na API
- Criar `GET /auth/session-check` em `api/`.
- Reaproveitar a lógica de validação de sessão existente, sem duplicar regra.
- Responder só `200` (sessão válida) ou `401` (inválida ou ausente), **sem corpo**, o mais leve possível, porque é chamado a cada requisição da ajuda.
- Tenant suspenso: seguir a mesma regra de acesso da plataforma (se a plataforma bloqueia, a ajuda também bloqueia). Me diga qual regra aplicou.

## Passo 2: Site Astro em `help/site/`
**Conteúdo**
- Content Collection lendo **diretamente** de `help/support/` (glob loader com `base: '../support'`, relativo a `help/site/`). Se alguma limitação do Astro impedir isso (por exemplo, com imagens relativas), use um script `prebuild` que sincroniza `help/support/` → `help/site/src/content/` automaticamente a cada build e explique o motivo. O conteúdo nunca deve ser copiado à mão.
- Schema com Zod e frontmatter: `title`, `description`, `category`, `order`, `updatedAt`. Para documentos **sem frontmatter**, derivar valores: título do primeiro `# H1`, categoria da pasta, ordem pelo prefixo numérico do arquivo (se houver), `updatedAt` pela data do arquivo. **Não altere os `.md` originais**, salvo se eu aprovar.
- Imagens otimizadas via pipeline do Astro (`astro:assets`) quando possível.
- Links internos entre `.md` devem funcionar no site (reescrever `outro-doc.md` → `/ajuda/categoria/outro-doc/`).
- **Validação no build**: falhar (ou, no mínimo, listar claramente) imagens inexistentes e links internos quebrados.
- Slugs em minúsculas, sem acento, com hífens.

**Layout (a partir do Claude Design)**
- Converter os tokens de `_ds/` em variáveis CSS globais do site (`help/site/src/styles/tokens.css` ou equivalente) e hospedar as fontes localmente, se o design usar fontes customizadas.
- Converter as telas do `Central de Ajuda.dc.html` em layouts e componentes Astro, mantendo fielmente o visual (cores, tipografia, espaçamentos, estrutura).
- Não incluir `image-slot.js`, `support.js` nem qualquer dependência de runtime do Claude Design no site final. Placeholders de imagem do protótipo devem virar imagens reais (de `uploads/` ou do conteúdo).
- Páginas: home (busca + categorias), listagem por categoria, página de artigo (sidebar de navegação, sumário dos headings, anterior/próximo, data de atualização) e 404 personalizada. Telas que o protótipo não cobrir devem ser criadas seguindo o mesmo design system.
- Link "Voltar para a plataforma" visível.
- Responsivo (o protótipo é a referência; se ele não cobrir mobile, adapte mantendo a identidade visual).
- Textos de interface em **português do Brasil**, com tom formal mas próximo, orientado a UX.

**Busca**
- **Pagefind** executado após o build. O índice fica dentro de `dist/`, portanto também protegido.

## Passo 3: Docker
Criar em `help/`:
- **`help/Dockerfile`** multi-stage:
  - Stage 1 (Node LTS): instala dependências de `site/`, recebe `support/` no contexto, roda o build do Astro e o Pagefind.
  - Stage 2 (`nginx:alpine`): serve o `dist/` em `/ajuda/`, com cache longo para assets com hash, sem cache para HTML, gzip e página 404 do próprio site.
- **`help/docker-compose.yml`**: serviço `banket-help`, porta publicada **somente em `127.0.0.1`** (escolha uma porta livre e verifique conflito), `restart: unless-stopped`, healthcheck e convenções alinhadas ao `docker-compose.yml` da raiz. Se o Nginx do host estiver em container, use a rede Docker adequada em vez da porta local.
- **`help/.dockerignore`** (excluir `node_modules`, `dist`, `central-ajuda`, `.git` etc.).
- O contexto do build é `help/`, para o container enxergar `site/` e `support/`. O protótipo (`central-ajuda/`) não entra na imagem.

## Passo 4: Nginx do host
No `server` de `platform.banket.app`, algo nesta linha (ajuste à config real e à porta escolhida):

```nginx
location /ajuda/ {
    auth_request /_auth_check;
    error_page 401 = @login_redirect;
    proxy_pass http://127.0.0.1:PORTA_HELP;
    proxy_set_header Host $host;
}

location = /_auth_check {
    internal;
    proxy_pass http://127.0.0.1:PORTA_API/auth/session-check;
    proxy_pass_request_body off;
    proxy_set_header Content-Length "";
    proxy_set_header Cookie $http_cookie;
}

location @login_redirect {
    return 302 /login?redirect=$request_uri;
}
```

- Validar com `nginx -t`. **Me mostre o diff antes de recarregar o Nginx.**
- Se o login em `platform/` não suportar `?redirect=`, implemente aceitando **apenas caminhos relativos internos** (evitar open redirect).
- Adicionar um link "Ajuda" no menu/header da plataforma apontando para `/ajuda/`.

## Passo 5: Runbook `help/DEPLOY.md`
Criar um markdown claro, em português, para eu (ou outra pessoa) usar sempre que precisar. Todos os comandos devem indicar de qual diretório rodar (raiz `/var/www/banket` ou `help/`). Ele deve cobrir:
- **Subir pela primeira vez**: pré-requisitos, build e `docker compose up -d --build`, configuração do Nginx e como verificar se está funcionando.
- **Regenerar após alterar conteúdo**: editar/adicionar `.md` e imagens em `help/support/`, rodar o comando de rebuild e verificar o resultado. De preferência, um único comando a partir da raiz (alvo no `Makefile` da raiz, ex.: `make help-deploy`, e/ou script `help/scripts/deploy.sh`).
- **Como escrever um novo artigo**: onde colocar, frontmatter, como referenciar imagens, links entre artigos e como criar uma nova categoria.
- **Atualizar o layout**: se o design for refeito no Claude Design e reexportado para `help/central-ajuda/`, como levar as mudanças para `help/site/`.
- **Desenvolvimento local**: `npm run dev` em `help/site/` com preview, sem login.
- **Validação**: como rodar a checagem de links e imagens antes de publicar.
- **Rollback**: como voltar à versão anterior se um build quebrar (por exemplo, tag da imagem anterior).
- **Troubleshooting**: 401 em loop, 502 do Nginx, imagens não aparecendo, busca não encontrando artigos novos.

## Critérios de aceite
- [ ] Todos os `.md` de `help/support/` viram páginas e todas as imagens referenciadas aparecem.
- [ ] O visual corresponde ao protótipo do Claude Design (`help/central-ajuda/`).
- [ ] Nenhum script de runtime do Claude Design (`image-slot.js`, `support.js`) está no build final.
- [ ] O build falha ou alerta sobre imagens e links quebrados.
- [ ] Sem login: `/ajuda/`, um artigo, uma imagem e o índice do Pagefind redirecionam para o login (testar com `curl -I` sem cookie).
- [ ] Após login, o redirect volta para a página originalmente pedida.
- [ ] Logado: navegação e busca funcionando.
- [ ] A porta do container **não** responde de fora do servidor (só `127.0.0.1`).
- [ ] `?redirect=https://evil.com` é ignorado.
- [ ] Alterar um `.md` em `help/support/` + rodar o comando do runbook atualiza o site, sem rebuild ou restart da plataforma ou da API.
- [ ] `help/DEPLOY.md` criado e testado seguindo os próprios passos.
- [ ] `CLAUDE.md` da raiz atualizado com a nova estrutura e um link para `help/DEPLOY.md`.

## Forma de trabalho
- Execute em etapas independentes (0 → 5).
- **Pare após o Passo 0** com o inventário e a proposta de navegação, e aguarde minha aprovação.
- Mostre os diffs de Nginx e de auth antes de aplicar.
- Não altere `help/central-ajuda/` nem os arquivos originais de `help/support/` sem autorização.