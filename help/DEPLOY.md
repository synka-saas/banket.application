# Central de Ajuda — runbook

A Central de Ajuda do Yosp fica em **`https://platform.yosp.app/ajuda/`**.

- A **home é pública**: busca e cards das categorias.
- **Todo o resto exige login** com a mesma conta do painel: categorias, artigos, imagens e índice de busca.
- Ela roda em containers próprios e **não depende de rebuild nem restart da plataforma ou da API**.

Neste documento, "raiz" é `/var/www/yosp` e `help/` é `/var/www/yosp/help`. Cada comando indica de onde rodar.

---

## Como funciona

```
navegador ──► Cloudflare ──► nginx do host (platform.yosp.app.conf)
                              ├─ /ajuda/*  ──► 127.0.0.1:4331  yosp_help_container (nginx:alpine + site estático)
                              │                 └─ auth_request ──► yosp_help_auth_container (Node, rede yosp_net)
                              │                                       └─ valida o cookie auth_token (JWT) + conta ativa no banco
                              └─ /*        ──► 127.0.0.1:4322  platform (inalterada)
```

| Pasta | O que é |
|---|---|
| `help/support/` | **Conteúdo, fonte única da verdade.** Um artigo por pasta, com o `.md` e as imagens dele |
| `help/support/_categorias.yml` | Título, descrição, ícone e ordem dos artigos de cada categoria |
| `help/site/` | Site Astro (SSG) que transforma `support/` em páginas, mais o Pagefind para a busca |
| `help/auth/` | Serviço `help-auth`: responde 200 ou 401 para o `auth_request` do nginx |
| `help/nginx/default.conf` | nginx do container: o que é público, o que é protegido e o cache |
| `help/central-ajuda/` | Protótipo do Claude Design (**referência visual; não editar, não vai para a imagem**) |
| `help/scripts/` | `deploy.sh` e `rollback.sh` |

**Regras de acesso.** O `help-auth` aplica a mesma regra de leitura do painel:
- exige o cookie `auth_token` válido;
- o papel tem de ser `account_owner`, `administrator`, `hoster` ou `property_owner`;
- a conta não pode estar desativada (`accounts.is_active = false`).

Conta pausada ou suspensa por cobrança continua lendo a ajuda, como continua lendo o painel.

**Sem sessão**, a página pedida responde **401 com a tela de login no corpo**. A URL não muda, então depois de entrar a pessoa vê exatamente a página que pediu. Não existe parâmetro `?redirect=` e, portanto, não há risco de open redirect.

A tela de login:
- usa os endpoints que a plataforma já tem no mesmo host (`/api/auth/login`, `/api/auth/mfa/verify`, `/api/auth/refresh`);
- aceita 2FA;
- renova sozinha o token de 15 min quando o `refresh_token` ainda vale.

---

## 1. Subir pela primeira vez

**Pré-requisitos.** Confira, a partir da raiz:
- Docker com Compose v2 (`docker compose version`);
- a rede `yosp_net` (`docker network ls | grep yosp_net`), criada pelo compose do banco;
- no `.env` da raiz, as variáveis `JWT_SECRET`, `DB_NAME_YOSP`, `DB_USER_APP` e `DB_PASS_APP`.

A ajuda lê o `.env` da raiz e não tem `.env` próprio.

**Build e containers** (da raiz):

```bash
make help-deploy
```

Isso faz o mesmo que rodar, dentro de `help/`:

```bash
docker compose --env-file ../.env up -d --build
```

Use o `make`: ele também valida o conteúdo, guarda a versão anterior para rollback e testa as rotas no fim.

**nginx do host.** Isto é feito só uma vez. Em `/etc/nginx/sites-enabled/platform.yosp.app.conf`, antes do `location /`, entra:

```nginx
location = /ajuda {
    return 301 /ajuda/;
}

location /ajuda/ {
    limit_req zone=general burst=60 nodelay;
    proxy_pass http://127.0.0.1:4331;
    include /etc/nginx/proxy_params;
}
```

Depois, da raiz: `make nginx-reload` (roda `nginx -t` antes de recarregar).

**Verificar** (de qualquer lugar):

```bash
curl -sI https://platform.yosp.app/ajuda/                 | head -1   # 200 (home pública)
curl -sI https://platform.yosp.app/ajuda/agenda/          | head -1   # 401 (tela de login)
curl -sI https://platform.yosp.app/ajuda/pagefind/pagefind.js | head -1   # 401
curl -s --max-time 5 http://IP_PUBLICO_DO_SERVIDOR:4331/ || echo "porta fechada para fora (correto)"
```

Depois, no navegador:
1. Abra `/ajuda/agenda/` sem login.
2. Entre com a sua conta: a mesma página abre.
3. Teste a busca.

---

## 2. Regenerar depois de alterar o conteúdo

1. Edite ou adicione arquivos em `help/support/` (veja a seção 3).
2. Da raiz, rode:

```bash
make help-regenerate
```

O comando:
1. valida links, imagens e títulos;
2. gera o site e o índice de busca dentro da imagem Docker (imagens já otimizadas ficam em cache, então o rebuild é rápido);
3. troca o container;
4. confere que a home responde 200 e as páginas internas 401.

Platform e API não são tocadas.

Para conferir o resultado:
- abra o artigo novo no navegador, logado;
- busque por uma palavra dele;
- se algo der errado, use `make help-rollback`.

---

## 3. Como escrever um novo artigo

**Onde colocar.** Crie uma pasta para o artigo dentro da pasta da categoria. O nome da pasta vira a URL (minúsculas, sem acento, com hífens):

```
help/support/05-agenda/
└── reagendar-servico/                    → /ajuda/agenda/reagendar-servico/
    ├── reagendar-servico.md              (um único .md por pasta; o nome do arquivo não importa)
    ├── reagendar-servico-01.webp
    └── reagendar-servico-02.webp
```

**Estrutura do texto.** Siga o padrão dos artigos existentes:

```markdown
# Como reagendar um serviço

Primeiro parágrafo: vira o resumo exibido abaixo do título e na listagem da categoria.

## Quem pode usar
## Onde encontrar
## Passo a passo

1. Clique em **Agenda**.
2. Abra o agendamento.

   ![Agendamento aberto com o botão Editar](reagendar-servico-01.webp)

3. ...

## Observações importantes

> **Atenção:** este texto vira um aviso amarelo. Uma citação sem "Atenção:" vira um aviso azul.

## Perguntas frequentes
## Artigos relacionados

- [Como criar um agendamento](../criar-agendamento/criar-agendamento.md)
- [Como cadastrar um imóvel](../../03-imoveis/cadastrar-imovel/cadastrar-imovel.md)
```

**O que cada elemento do Markdown vira:**

| No Markdown | No site |
|---|---|
| `# Título` | Título do card (é obrigatório ter um) |
| Primeiro parágrafo | Resumo (subtítulo cinza) |
| `## Seção` | Seção, com entrada em "Nesta página" |
| `1. 2. 3.` | Passos com número em círculo |
| `- item` | Lista com ponto azul |
| Tabela | Tabela com bordas finas |
| `> **Atenção:** …` | Aviso amarelo |
| `![texto](imagem.webp)` sozinha num parágrafo | Captura com moldura. O **texto alternativo vira a legenda**: escreva-o curto e descritivo |

**Imagens.**
- Ficam na pasta do artigo, referenciadas só pelo nome: `![…](arquivo.webp)`.
- Prefira WebP. As capturas em 2x são redimensionadas sozinhas no build.
- Dentro de um passo numerado, recue a imagem com 3 espaços, com uma linha em branco antes, para ela não quebrar a numeração.
- Se a mesma captura servir para dois artigos, copie o arquivo para as duas pastas.

**Links entre artigos.** Use o caminho relativo até o `.md`:
- mesma categoria: `../outro-artigo/outro-artigo.md`;
- outra categoria: `../../03-imoveis/x/x.md`.

O build converte o link para `/ajuda/categoria/artigo/` e **falha se o destino não existir**.

**Frontmatter (opcional).** Use só se quiser sobrescrever o que é derivado:

```yaml
---
title: Título diferente do # H1
description: Resumo diferente do primeiro parágrafo
order: 3                    # posição na categoria (vale mais que _categorias.yml)
updatedAt: 2026-10-09       # data exibida; sem ela, vale a data de modificação do arquivo
category: agenda            # mover o artigo para outra categoria sem mudar de pasta
---
```

**Ordem na categoria.** É a lista `artigos:` da categoria em `help/support/_categorias.yml`. Artigo que não estiver na lista vai para o fim, em ordem alfabética.

**Nova categoria:**
1. Crie a pasta `help/support/NN-nome/`. O número define a posição na home, e a URL usa só o `nome`.
2. Adicione a entrada em `_categorias.yml`: `titulo`, `descricao` e `icone` (nome de um ícone de <https://lucide.dev/icons>; o build avisa se não existir).
3. Rode `make help-regenerate`.

Sobre os arquivos de apoio: `help/support/README.md` e `IMAGENS.md` não viram páginas. O `IMAGENS.md` foi o guia de inserção das capturas originais e cita os caminhos antigos, anteriores à organização em pastas.

---

## 4. Atualizar o layout

O visual veio de `help/central-ajuda/Central de Ajuda.dc.html` e do Design System em `help/central-ajuda/_ds/`. O site **não** usa os scripts do Claude Design (`support.js`, `image-slot.js`, `_ds_bundle.js`). Os componentes foram reescritos em Astro.

Quando o design for refeito e reexportado para `help/central-ajuda/`:

1. **Tokens.** Regere `help/site/src/styles/tokens.css` a partir de `_ds/…/tokens/` (rodar em `help/`):

   ```bash
   DS=central-ajuda/_ds/*/tokens; { echo "/* Tokens do Yosp Design System (gerado de central-ajuda/_ds). */"; cat $DS/colors.css $DS/typography.css $DS/spacing.css $DS/effects.css; } > site/src/styles/tokens.css
   ```

2. **Fontes.** Copie os `.woff2` usados (General Sans 300, 400 e 500) de `_ds/…/fonts/` para `help/site/public/fonts/`.
3. **Telas.** Compare o `.dc.html` novo com os arquivos abaixo e transcreva as mudanças:

   | Parte do protótipo | Arquivo no site |
   |---|---|
   | `<header>` azul | `site/src/components/Hero.astro` |
   | Busca + dropdown | `site/src/components/Search.astro` |
   | Home (`isHome`) | `site/src/pages/index.astro` |
   | Categoria (`isCat`) | `site/src/pages/[categoria]/index.astro` |
   | Artigo (`isArt`), blocos | `site/src/pages/[categoria]/[artigo].astro` e `site/src/plugins/rehype-help.mjs` |
   | "Não encontrou…" | `site/src/components/SupportCta.astro` |
   | Rodapé | `site/src/components/Footer.astro` |
   | Estilos (os `style="…"` do protótipo) | `site/src/styles/global.css` |
   | Logo | `site/src/components/Logo.astro` (paths do `Logo` em `_ds_bundle.js`) |

4. Confira localmente (seção 5) e publique com `make help-regenerate`.

---

## 5. Desenvolvimento local (sem login)

Rodar da raiz:

```bash
make help-dev       # http://127.0.0.1:4321/ajuda/  — recarrega ao editar site/ ou support/; a busca não funciona aqui
make help-preview   # http://127.0.0.1:4399/ajuda/  — build completo + busca (Pagefind), igual à produção, sem login
```

Ou, dentro de `help/site/`: `npm install`, depois `npm run dev`, ou `npm run build && npm run preview`.

Fora do container não há nginx, então nada pede login. A tela de entrada pode ser vista em `/ajuda/entrar/`.

---

## 6. Validação antes de publicar

Rodar da raiz:

```bash
make help-check
```

| Tipo | O que acontece | O que é verificado |
|---|---|---|
| **Erro** | O build para | link para artigo inexistente, imagem inexistente, artigo sem título, duas pastas gerando a mesma URL, mais de um `.md` na mesma pasta de artigo, ícone de categoria inexistente |
| **Aviso** | O build segue | imagem que nenhum artigo usa, imagem sem texto alternativo, link `http://` |

O `make help-regenerate` roda a mesma validação. Durante o build, o Astro também falha se uma imagem referenciada sumir.

---

## 7. Rollback

Rodar da raiz:

```bash
make help-rollback
```

- Volta para a imagem anterior ao último deploy (`yosp_help:previous`). Rodar de novo desfaz.
- Um container parado, `yosp_help_previous`, segura essa imagem. É por isso que o prune diário de imagens (`/etc/cron.d/docker-image-prune`) não a apaga.
- Só existe **uma** versão anterior. Para voltar mais, restaure o conteúdo de `help/` pelo git (ou backup) e rode `make help-regenerate`.

---

## 8. Troubleshooting

**401 em loop** (entra e volta para a tela de login):
- Veja se a conta está desativada (`accounts.is_active`) ou se o papel do usuário é aceito.
- Veja se o cookie `auth_token` está chegando: ele é *host-only* de `platform.yosp.app`. Abrir a ajuda por outro domínio não funciona.
- Veja se o `JWT_SECRET` do container é o mesmo da plataforma. Depois de trocar o segredo no `.env`, rode `make help-regenerate` para recriar o `help-auth`.
- Veja os logs: `make help-logs`.

**502 no nginx do host:**
- `make help-ps`: os dois containers precisam estar `healthy`.
- `curl -sI http://127.0.0.1:4331/healthz` deve dar 200.
- Se o `yosp_help_auth_container` não subir, falta variável no `.env` ou a rede `yosp_net` não existe.

**500 na ajuda:** o nginx do container não alcança o `help-auth`. Rode `docker logs yosp_help_container`.

**Imagens não aparecem:**
- Rode `make help-check`. O nome no `.md` tem de bater exatamente com o arquivo (maiúsculas contam), e a imagem tem de estar na pasta do artigo.
- Se a imagem dá 401: a sessão expirou. Recarregue a página para renovar.

**Busca não encontra artigos novos:**
- O índice só é gerado no `make help-regenerate`.
- Confira se o deploy terminou com "✓ Central de Ajuda publicada" e recarregue com Ctrl+F5.
- Na home, sem login, a busca mostra "Entre para buscar nos artigos". Isso é esperado.

**Mudou o `.env`:** rode `make help-regenerate`. Recriar o container relê as variáveis; `docker restart` não relê.

**Comandos úteis** (da raiz):

```bash
make help-ps
make help-logs
docker exec yosp_help_container nginx -t
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4331/ajuda/agenda/   # 401 esperado sem cookie
```
