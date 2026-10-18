# Central de Ajuda — runbook

Base de conhecimento do Banket em **<https://app.banket.com.br/ajuda/>**, só para quem está logado no app.

Cada comando abaixo indica **de onde rodar**: a raiz do repositório (`/var/www/banket`) ou `help/`.

## Como funciona

```
navegador ──► Nginx do host (app.banket.com.br)
                 │  location /ajuda/
                 ├─ auth_request ──► app (upstream banket_app) GET /api/ajuda/sessao
                 │                     200 = pode ler · 401 = sem sessão · 403 = empresa suspensa
                 │  401 → 302 /auth/login?next=<página>     403 → 302 /conta-suspensa
                 └─ 200 → contêiner banket-help (127.0.0.1:5175) → arquivos estáticos de help/site/dist
```

| Peça | Onde fica |
|---|---|
| Conteúdo (fonte única) | `help/support/`: um `.md` por artigo e as imagens `.webp` na pasta da categoria; `_categorias.yml` (ícone e descrição das categorias) |
| Site (Astro 5, estático) | `help/site/`: lê `help/support/` direto (coleção com `glob`, `base: ../support`); gera `dist/` + índice de busca do **Pagefind** |
| Contêiner | `help/Dockerfile` (Node gera o site, `nginx:stable-alpine` serve) e `help/docker-compose.yml` (projeto `banket-help`, porta **só** em `127.0.0.1:5175`) |
| Verificação de sessão | `src/pages/api/ajuda/sessao.ts` no app: mesma regra do middleware (`conferirSessao` em `src/lib/membership.ts`), todos os planos |
| Nginx do host | `/etc/nginx/conf.d/banket-ajuda.conf` (cache da verificação) e as `location` de `/ajuda/` em `/etc/nginx/sites-enabled/app.banket.com.br.conf`. Cópias versionadas em `help/nginx/host-*.conf` |
| Protótipo (referência, não vai para o site) | `help/central-ajuda/` (Claude Design). As cores e os tokens do site são os do design system do Banket |

O "sim" da verificação fica 30 s em cache no Nginx por cookie (o vínculo, mais 30 s em cache no app): desativar um
usuário ou suspender a empresa leva até 1 minuto para valer na ajuda. Atualizar a ajuda **não** reinicia o app.

---

## 1. Subir pela primeira vez

Pré-requisitos: Docker com Compose v2, o app já publicado com a rota `/api/ajuda/sessao` (`make deploy`) e acesso
root ao Nginx.

**1.1 Contêiner** — na raiz:

```bash
make help-deploy            # ou: bash help/scripts/deploy.sh
```

Na primeira vez, as duas últimas checagens (endereço público) falham, porque o Nginx ainda não conhece `/ajuda/`.
É esperado: siga para o passo 1.2.

**1.2 Nginx do host** — na raiz:

```bash
sudo cp help/nginx/host-banket-ajuda.conf /etc/nginx/conf.d/banket-ajuda.conf
sudo cp /etc/nginx/sites-enabled/app.banket.com.br.conf /root/app.banket.com.br.conf.bak-$(date +%Y%m%d%H%M)
# cole o conteúdo de help/nginx/host-app.banket.com.br.locations.conf dentro do server { … } de 443,
# logo antes de "location / {"
sudo nginx -t && sudo systemctl reload nginx
```

**1.3 Verificar** — de qualquer lugar:

```bash
curl -sI https://app.banket.com.br/ajuda/ | grep -iE '^(HTTP|location)'                      # 302 → /auth/login?next=/ajuda/
curl -sI https://app.banket.com.br/ajuda/pagefind/pagefind.js | grep -iE '^(HTTP|location)'  # 302 também
curl -s -m 5 http://<IP público da VPS>:5175/ || echo "porta fechada para fora (correto)"
```

No navegador: entre no app, clique em **Ajuda** no menu lateral, abra um artigo e use a busca.

---

## 2. Regenerar depois de alterar o conteúdo

1. Edite ou crie os `.md` e as imagens em `help/support/` (veja a seção 3).
2. Na raiz:

   ```bash
   make help-deploy
   ```

   O script valida o conteúdo, guarda a imagem atual como `banket-help:previous`, gera a nova (Astro + Pagefind),
   troca o contêiner e confere as URLs (direto na porta 5175 e pelo endereço público sem cookie). O app e o banco
   não são tocados.
3. Abra o artigo em <https://app.banket.com.br/ajuda/> e confira (Ctrl+F5 se o navegador guardou a página).

O cache do Astro fica num volume do BuildKit: um rebuild só reprocessa imagens novas ou alteradas.

---

## 3. Como escrever um novo artigo

**Onde:** na pasta da categoria, por exemplo `help/support/04-orcamento/14-duplicar-orcamento.md`. O prefixo
numérico só ordena a pasta; a URL fica `/ajuda/orcamento/duplicar-orcamento/` (pasta e arquivo sem o número,
minúsculas, sem acento, com hífens). Renomear o arquivo muda a URL.

**Frontmatter** (todos os artigos atuais têm; o que faltar é derivado):

```yaml
---
title: Duplicar um orçamento          # se faltar: o "# Título" do texto
description: Uma frase sobre o que o artigo ensina.   # aparece no card da categoria, abaixo do título e na busca
category: Orçamento e proposta        # título da categoria (o mesmo nos artigos da pasta)
order: 14                             # ordem dentro da categoria (se faltar: depois dos numerados, por título)
updatedAt: 2026-10-18                 # "Atualizado em" (se faltar: data do arquivo)
tags: [orcamento, versao]             # opcional, não aparece no site
---

# Duplicar um orçamento
```

**Imagens:** salve o `.webp` (ou `.png`/`.jpg`) **na mesma pasta** e cite pelo nome, numa linha sozinha. O texto
alternativo vira a legenda:

```markdown
1. Clique em **Criar nova versão**.

   ![Botão Criar nova versão no topo do orçamento](01-duplicar-orcamento.webp)
```

Dentro de um passo numerado, indente a imagem com 3 espaços (como acima) para ela ficar no passo. As imagens são
otimizadas no build (WebP em vários tamanhos). `help/support/imagens.csv` é só o inventário histórico das capturas:
o site não o lê.

**Links entre artigos:** caminho relativo para o `.md`, que o build reescreve para a URL do site:
`[Criar um evento](../03-propostas-e-eventos/02-criar-evento.md)` (âncoras `#secao` funcionam).

**Avisos:** citação (`> …`) vira um aviso em terracota suave; começando com **Atenção**, **Importante** ou
**Cuidado**, vira aviso em ocre.

**Nova categoria:** crie a pasta `NN-nome/` (o número dá a posição na home), ponha os artigos com o mesmo `category`
e acrescente a entrada em `help/support/_categorias.yml` com `icone` (nome de um ícone Tabler outline,
<https://tabler.io/icons>) e `descricao`.

---

## 4. Atualizar o layout

- **Cores, fontes e tokens** vêm do design system do Banket. Quando ele mudar (`src/styles/tokens.css` do app), em
  `help/site/`:

  ```bash
  npm run sync:tokens
  ```

  e publique (`make help-deploy`, na raiz). As regras são as mesmas do app: só aliases semânticos, pesos 400 e 500,
  ícones Tabler.
- **Estrutura** (protótipo do Claude Design): se o design for refeito e reexportado para `help/central-ajuda/`, abra
  o `Central de Ajuda.dc.html` num navegador e compare tela a tela (Início, Categoria, Artigo). Leve as mudanças para:
  `src/layouts/Base.astro` (moldura), `src/components/` (cabeçalho, busca, rodapé, suporte), `src/pages/` (telas) e
  `src/styles/global.css` (medidas). Não copie `support.js`, `image-slot.js` nem o `_ds/` do protótipo: são o runtime
  do Claude Design e o design system usado nele.
- Logos e favicon: cópias de `public/logo-light.png`, `public/logo-dark.png` e `public/favicon.svg` do app, em
  `help/site/public/`.

---

## 5. Desenvolvimento local (sem login)

Em `help/site/`:

```bash
npm install
npm run dev          # http://localhost:4321/ajuda/ — recarrega ao salvar um .md de help/support/
```

A busca não funciona no `dev` (o Pagefind roda depois do build). Para testar o site completo, com busca:

```bash
npm run build && npx astro preview     # http://localhost:4321/ajuda/
```

---

## 6. Validação antes de publicar

Em `help/site/`:

```bash
npm run check:content
```

**Falha** com link para artigo inexistente, imagem inexistente, artigo sem título, duas URLs iguais ou ícone de
categoria inexistente. **Avisa** sobre imagem que nenhum artigo usa, link sem HTTPS e imagem sem texto alternativo.
O `npm run build` (e portanto o `make help-deploy`) roda a mesma validação e, além dela, o build do Astro falha se um
link ou imagem não resolver.

---

## 7. Rollback

Na raiz:

```bash
make help-rollback       # ou: bash help/scripts/rollback.sh
```

Volta o contêiner para `banket-help:previous` (a imagem do deploy anterior). Rodar de novo desfaz o rollback. Para ir
mais longe, volte `help/` pelo git (`git log -- help/`, `git checkout <commit> -- help/support`) e rode
`make help-deploy`.

Para tirar a ajuda do ar sem mexer no app: `docker compose -f help/docker-compose.yml stop` (na raiz). O Nginx passa a
responder 502 em `/ajuda/` para quem está logado; o resto do app segue normal.

---

## 8. Troubleshooting

**Login em loop (entra e volta para o login)**
- Confira a verificação com o cookie do navegador (DevTools › Application › Cookies › `banket_sessao`):
  `curl -s -o /dev/null -w '%{http_code}\n' -H 'Cookie: banket_sessao=<valor>' http://127.0.0.1:5168/api/ajuda/sessao`
  (5168 = blue, 5169 = green; a cor ativa está em `.deploy-ativo`). Deve dar 200.
- 404 aí = o app no ar ainda não tem a rota: rode `make deploy` na raiz.
- Um redirect guardado pela Cloudflare: confira se a resposta do 302 tem `Cache-Control: no-store` (o bloco
  `@ajuda_login`); se tiver sido publicado sem ele, faça um purge de `app.banket.com.br/ajuda/*` na Cloudflare.

**Vai para /conta-suspensa** — a empresa da sessão está suspensa no Manager (mesma regra do app).

**502 Bad Gateway em /ajuda/**
- O contêiner caiu ou não subiu: `docker ps --filter name=banket-help` e `make help-logs` (na raiz).
- Porta errada no Nginx: deve ser `127.0.0.1:5175`, a mesma do `help/docker-compose.yml`.
- 500 em vez de 502 costuma ser a verificação: veja `sudo tail /var/log/nginx/error.log` (`auth request unexpected status`).

**Imagem não aparece**
- `npm run check:content` (em `help/site/`) aponta imagem inexistente ou nome errado (maiúsculas contam).
- A imagem precisa estar numa linha sozinha (com linha em branco antes e depois) para virar figura com legenda.

**A busca não encontra um artigo novo**
- O índice só é gerado no build: rode `make help-deploy` (na raiz).
- O navegador pode estar com o `pagefind-entry.json` antigo: recarregue com Ctrl+F5.
- No `npm run dev` a busca nunca funciona (seção 5).

**Mudança no `.md` não aparece** — o deploy não rodou ou falhou na validação: veja a saída do `make help-deploy`.
