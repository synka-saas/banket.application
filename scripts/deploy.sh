#!/usr/bin/env bash
# Deploy em produção sem indisponibilidade (blue-green): valida o commit atual (build + testes
# numa cópia limpa), atualiza a VPS com o que está no GitHub e troca o tráfego no Nginx.
#
# Uso: scripts/deploy.sh              (ou `make deploy` no Makefile de dev)
#      scripts/deploy.sh --rollback   (ou `make rollback`) volta para a versão anterior
# Variáveis opcionais: DEPLOY_HOST (padrão synka-main), DEPLOY_DIR, DEPLOY_URL
set -euo pipefail
cd "$(dirname "$0")/.."

HOST="${DEPLOY_HOST:-synka-main}"
DIR="${DEPLOY_DIR:-/opt/banket.application}"
URL="${DEPLOY_URL:-https://app.banket.com.br}"

passo() { printf '\n\033[1;34m→ %s\033[0m\n' "$*"; }
erro() { printf '\n\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

verificar_url() {
  passo "Verificando $URL"
  local codigo
  codigo="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$URL/auth/login")"
  [ "$codigo" = 200 ] || erro "$URL respondeu HTTP $codigo"
}

if [ "${1:-}" = --rollback ]; then
  passo "Rollback em $HOST"
  ssh "$HOST" "cd '$DIR' && bash scripts/deploy-remoto.sh --rollback"
  verificar_url
  printf '\n\033[1;32m✓ Rollback concluído\033[0m\n'
  exit 0
fi

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

# 3. Atualiza a VPS: sobe a cor inativa, troca o Nginx quando ela responder, para a antiga
passo "Deploy blue-green em $HOST:$DIR"
ssh "$HOST" "cd '$DIR' && git pull -q --ff-only && bash scripts/deploy-remoto.sh"

verificar_url
printf '\n\033[1;32m✓ Deploy concluído: %s\033[0m\n' "$COMMIT"
