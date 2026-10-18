#!/usr/bin/env bash
# Volta a Central de Ajuda para a imagem anterior ao último deploy (yosp_help:previous).
# Uso:  help/scripts/rollback.sh      ou, da raiz:  make help-rollback
set -euo pipefail

HELP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$(cd "$HELP_DIR/.." && pwd)/.env"

docker image inspect yosp_help:previous >/dev/null 2>&1 || {
  echo "✗ Não há versão anterior (yosp_help:previous). Use git para voltar help/ e rode make help-deploy."
  exit 1
}

# Troca latest ↔ previous: rodar de novo desfaz o rollback.
docker image tag yosp_help:latest yosp_help:rollback-tmp 2>/dev/null || true
docker image tag yosp_help:previous yosp_help:latest
docker image tag yosp_help:rollback-tmp yosp_help:previous 2>/dev/null && docker image rm yosp_help:rollback-tmp >/dev/null 2>&1 || true
docker rm -f yosp_help_previous >/dev/null 2>&1 || true
docker create --name yosp_help_previous yosp_help:previous >/dev/null

docker compose --env-file "$ENV_FILE" -f "$HELP_DIR/docker-compose.yml" up -d --no-build --force-recreate yosp_help
echo "✓ Rollback aplicado. Rode de novo para desfazer."
