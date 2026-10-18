#!/usr/bin/env bash
# Publica a Central de Ajuda: valida o conteúdo, gera a imagem e troca o contêiner.
# Não toca no app (blue-green), no Postgres nem no Nginx.
#
# Uso (de qualquer diretório):  help/scripts/deploy.sh      ou, da raiz:  make help-deploy
set -euo pipefail

HELP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE=(docker compose -f "$HELP_DIR/docker-compose.yml")
PORT=5175
PUBLICO="${HELP_URL_PUBLICA:-https://app.banket.com.br}"

cd "$HELP_DIR"

echo "▸ 1/5 Validando o conteúdo de help/support/"
if [ -d site/node_modules ]; then
  (cd site && node scripts/check-content.mjs)
else
  echo "  (site/node_modules ausente: a validação roda dentro do build da imagem)"
fi

echo "▸ 2/5 Guardando a versão atual para rollback"
if docker image inspect banket-help:latest >/dev/null 2>&1; then
  docker image tag banket-help:latest banket-help:previous
  # Um contêiner parado segura a imagem: um "docker image prune" só apaga imagens sem contêiner.
  docker rm -f banket-help-previous >/dev/null 2>&1 || true
  docker create --name banket-help-previous banket-help:previous >/dev/null
fi

echo "▸ 3/5 Gerando a imagem (Astro + Pagefind)"
export HELP_BUILD_ID="$(date -u +%Y%m%d%H%M%S)"
DOCKER_BUILDKIT=1 "${COMPOSE[@]}" build

echo "▸ 4/5 Trocando o contêiner"
"${COMPOSE[@]}" up -d

echo "▸ 5/5 Verificando"
for _ in $(seq 1 30); do
  [ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/healthz" || true)" = "200" ] && break
  sleep 1
done
check() { # url esperado
  local got; got=$(curl -s -o /dev/null -w '%{http_code}' "$1")
  if [ "$got" = "$2" ]; then echo "  ✓ $1 → $got"; else echo "  ✗ $1 → $got (esperado $2)"; return 1; fi
}
ok=0
# Direto no contêiner (só 127.0.0.1): o site está lá
check "http://127.0.0.1:$PORT/ajuda/" 200 || ok=1
check "http://127.0.0.1:$PORT/ajuda/primeiros-passos/o-que-e-o-banket/" 200 || ok=1
check "http://127.0.0.1:$PORT/ajuda/pagefind/pagefind.js" 200 || ok=1
# Pelo endereço público, sem cookie: tudo manda para o login
check "$PUBLICO/ajuda/" 302 || ok=1
check "$PUBLICO/ajuda/pagefind/pagefind.js" 302 || ok=1
if [ $ok -ne 0 ]; then
  echo "✗ Verificação falhou. Para voltar à versão anterior: make help-rollback (ver help/DEPLOY.md)"
  exit 1
fi
echo "✓ Central de Ajuda publicada (build $HELP_BUILD_ID)."
