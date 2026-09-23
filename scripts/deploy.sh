#!/usr/bin/env bash
# Deploy em produção: valida o commit atual (build + testes numa cópia limpa)
# e atualiza a VPS com o que está no GitHub.
#
# Uso: scripts/deploy.sh   (ou `make deploy` na raiz do workspace)
# Variáveis opcionais: DEPLOY_HOST (padrão synka-main), DEPLOY_DIR, DEPLOY_URL
set -euo pipefail
cd "$(dirname "$0")/.."

HOST="${DEPLOY_HOST:-synka-main}"
DIR="${DEPLOY_DIR:-/opt/banket.application}"
URL="${DEPLOY_URL:-https://app.banket.com.br}"

passo() { printf '\n\033[1;34m→ %s\033[0m\n' "$*"; }
erro() { printf '\n\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# 1. Só o que está commitado e enviado ao GitHub vai para produção
[ "$(git rev-parse --abbrev-ref HEAD)" = main ] || erro "Deploy só a partir da branch main."
if [ -n "$(git status --porcelain)" ]; then
  printf '\033[1;33m⚠ Alterações não commitadas (NÃO vão para produção):\033[0m\n'
  git status --short
fi
git fetch -q origin main
if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
  if git merge-base --is-ancestor origin/main HEAD; then
    erro "Há commits locais não enviados. Rode: git push"
  fi
  erro "A main local está atrás ou divergente de origin/main. Rode: git pull"
fi
COMMIT="$(git log --oneline -1)"

# 2. Build e testes do commit exato, numa cópia limpa (ignora o que não foi commitado)
passo "Validando $COMMIT"
TMP="$(mktemp -d)"
limpar() { git worktree remove --force "$TMP/wt" >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap limpar EXIT
git worktree add -q --detach "$TMP/wt" HEAD
ln -s "$PWD/node_modules" "$TMP/wt/node_modules"
(cd "$TMP/wt" && npm run build >"$TMP/build.log" 2>&1) || { tail -30 "$TMP/build.log"; erro "Build falhou. Nada foi enviado para produção."; }
echo "build ok"
(cd "$TMP/wt" && npm test >"$TMP/test.log" 2>&1) || { tail -30 "$TMP/test.log"; erro "Testes falharam. Nada foi enviado para produção."; }
echo "testes ok"

# 3. Atualiza a VPS (se o build lá falhar, o container antigo continua no ar)
passo "Atualizando $HOST:$DIR"
ssh "$HOST" bash -s -- "$DIR" <<'REMOTO'
set -euo pipefail
cd "$1"
DC="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
git pull -q --ff-only
echo "commit: $(git log --oneline -1)"
$DC up -d --build >/tmp/banket-deploy.log 2>&1 || { tail -30 /tmp/banket-deploy.log; echo "✗ Build na VPS falhou (versão anterior segue no ar)"; exit 1; }
PORTA="$(grep -E '^APP_PORT=' .env | cut -d= -f2)"; PORTA="${PORTA:-5168}"
for _ in $(seq 1 30); do
  curl -sf -o /dev/null "http://127.0.0.1:$PORTA/auth/login" && { echo "app respondendo na porta $PORTA"; break; }
  sleep 2
done
$DC logs --tail 12 webapp
curl -sf -o /dev/null "http://127.0.0.1:$PORTA/auth/login" || { echo "✗ App não respondeu após o deploy"; exit 1; }
REMOTO

# 4. Confere o acesso público
passo "Verificando $URL"
CODIGO="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$URL/auth/login")"
[ "$CODIGO" = 200 ] || erro "$URL respondeu HTTP $CODIGO"
printf '\n\033[1;32m✓ Deploy concluído: %s\033[0m\n' "$COMMIT"
