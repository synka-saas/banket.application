# Deploy na VPS

Produção: `https://app.banket.com.br` — Docker + Docker Compose, Nginx no host.

Todos os comandos de compose abaixo usam o override de produção:

```bash
alias dc='docker compose -f docker-compose.yml -f docker-compose.prod.yml'
```

## Primeira vez

```bash
git clone git@github.com:synka-saas/banket.application.git /opt/banket.application
cd /opt/banket.application
cp .env.example .env
# Edite o .env: senhas fortes para POSTGRES_PASSWORD e APP_DB_PASSWORD,
# JWT_SECRET (openssl rand -base64 48), APP_URL=https://app.banket.com.br, RESEND_API_KEY
nano .env
dc up -d --build
```

O app sobe em `127.0.0.1:4321` (altere com `APP_PORT` no `.env`). O Postgres não é exposto fora do Docker.
As migrations rodam automaticamente na inicialização do container.

## Nginx (HTTPS)

`/etc/nginx/sites-available/app.banket.com.br`:

```nginx
server {
    server_name app.banket.com.br;
    client_max_body_size 20m;
    location / {
        proxy_pass http://127.0.0.1:4321;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/app.banket.com.br /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d app.banket.com.br
```

## Atualizar

```bash
cd /opt/banket.application && git pull --ff-only && dc up -d --build
```

## Útil

```bash
dc logs -f webapp
dc exec postgres psql -U banket_user banket_db
```
