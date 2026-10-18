#!/usr/bin/env bash
# Publica a Central de Ajuda: valida o conteúdo, gera a imagem e troca o container.
# Não toca em platform, service, api nem no banco.
#
# Uso (de qualquer diretório):  help/scripts/deploy.sh      ou, da raiz:  make help-deploy
set -euo pipefail

HELP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT_DIR="$(cd "$HELP_DIR/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"
COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$HELP_DIR/docker-compose.yml")
PORT=4331

cd "$HELP_DIR"
[ -f "$ENV_FILE" ] || { echo "✗ $ENV_FILE não encontrado"; exit 1; }
docker network inspect yosp_net >/dev/null 2>&1 || { echo "✗ rede yosp_net não existe (ela nasce com o compose do banco)"; exit 1; }

echo "▸ 1/5 Validando o conteúdo de help/support/"
if [ -d site/node_modules ]; then
  (cd site && node scripts/check-content.mjs)
else
  echo "  (site/node_modules ausente: a validação roda dentro do build da imagem)"
fi

echo "▸ 2/5 Guardando a versão atual para rollback"
if docker image inspect yosp_help:latest >/dev/null 2>&1; then
  docker image tag yosp_help:latest yosp_help:previous
  # Um container parado segura a imagem: o prune diário (docker image prune -af --filter until=24h)
  # só apaga imagens sem container. Assim o rollback continua possível depois de 24 h.
  docker rm -f yosp_help_previous >/dev/null 2>&1 || true
  docker create --name yosp_help_previous yosp_help:previous >/dev/null
fi

echo "▸ 3/5 Gerando a imagem (Astro + Pagefind)"
export HELP_BUILD_ID="$(date -u +%Y%m%d%H%M%S)"
DOCKER_BUILDKIT=1 "${COMPOSE[@]}" build

echo "▸ 4/5 Trocando os containers"
"${COMPOSE[@]}" up -d

echo "▸ 5/5 Verificando"
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/healthz" || true)
  [ "$code" = "200" ] && break
  sleep 1
done
check() { # url esperado
  local got; got=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT$1")
  if [ "$got" = "$2" ]; then echo "  ✓ $1 → $got"; else echo "  ✗ $1 → $got (esperado $2)"; return 1; fi
}
ok=0
check /ajuda/ 200 || ok=1
check /ajuda/entrar/ 200 || ok=1
check /ajuda/agenda/ 401 || ok=1
check /ajuda/pagefind/pagefind.js 401 || ok=1
if [ $ok -ne 0 ]; then
  echo "✗ Verificação falhou. Para voltar à versão anterior: make help-rollback"
  exit 1
fi
echo "✓ Central de Ajuda publicada (build $HELP_BUILD_ID)."
