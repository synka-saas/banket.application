# Deploy na VPS

Produção: `https://app.banket.com.br` — Docker Compose (`docker-compose.prod.yml`) + Nginx no host, deploy **blue-green**
(sem indisponibilidade).

## Como funciona

- Duas cópias do app: `webapp_blue` (`127.0.0.1:${APP_PORT_BLUE}`, padrão 5168) e `webapp_green`
  (`127.0.0.1:${APP_PORT_GREEN}`, padrão 5169). Mesmo Postgres, mesmo volume de uploads.
- O Nginx envia o tráfego para o upstream `banket_app`, definido em `/etc/nginx/conf.d/banket-upstream.conf`.
- A cada deploy, `scripts/deploy-remoto.sh` constrói e sobe a cor **inativa**, espera ela responder, reescreve o
  upstream, dá `nginx -t` + `reload` (gracioso) e, após 15 s de drenagem, **para** a cor antiga (sem remover).
- Se a cor nova não subir, o Nginx não é tocado e a versão atual segue no ar.
- A cor ativa fica em `.deploy-ativo` (fora do git).

## Fluxo do dia a dia (no Mac)

```bash
git add … && git commit -m "…" && git push
make deploy      # na raiz do workspace (ou application/scripts/deploy.sh)
make rollback    # volta para a versão anterior (religa a cor parada), se algo der errado
```

`make deploy` recusa o deploy se houver commits não enviados, valida build + testes do commit numa cópia limpa,
faz o `git pull` na VPS, roda o blue-green e confere a URL pública.

## ⚠ Migrations precisam ser compatíveis com a versão anterior

Durante a troca, a versão antiga continua atendendo com o banco **já migrado** pela nova (as migrations rodam na
inicialização do container). E o `make rollback` volta o código, mas **não** desfaz migrations. Então:

- **Adicionar** tabela/coluna (nullable ou com default): ok.
- **Remover ou renomear** coluna/tabela: em dois deploys — primeiro o código para de usar, no deploy seguinte a
  migration remove.
- Nunca editar uma migration que já rodou em produção; sempre criar um arquivo novo.

## Primeira instalação

```bash
git clone git@github.com:synka-saas/banket.application.git /opt/banket.application
cd /opt/banket.application
cp .env.example .env
# Edite o .env: senhas fortes para POSTGRES_PASSWORD e APP_DB_PASSWORD,
# JWT_SECRET (openssl rand -base64 48), APP_URL=https://app.banket.com.br, RESEND_API_KEY
nano .env
printf 'upstream banket_app {\n    server 127.0.0.1:5168;\n}\n' > /etc/nginx/conf.d/banket-upstream.conf
```

`/etc/nginx/sites-enabled/app.banket.com.br.conf`:

```nginx
server {
    listen 80;
    server_name app.banket.com.br;
    client_max_body_size 20m;
    location / {
        proxy_pass http://banket_app;
        proxy_next_upstream error timeout;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
nginx -t && systemctl reload nginx
certbot --nginx -d app.banket.com.br
bash scripts/deploy-remoto.sh     # primeira subida
```

## Útil (na VPS)

```bash
cd /opt/banket.application
alias dc='docker compose -f docker-compose.prod.yml'
cat .deploy-ativo                  # cor no ar
dc ps
dc logs -f webapp_$(cat .deploy-ativo)
dc exec postgres psql -U banket_user banket_db
```
