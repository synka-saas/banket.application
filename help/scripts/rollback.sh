#!/usr/bin/env bash
# Volta a Central de Ajuda para a imagem anterior ao último deploy (banket-help:previous).
# Uso:  help/scripts/rollback.sh      ou, da raiz:  make help-rollback
set -euo pipefail

HELP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

docker image inspect banket-help:previous >/dev/null 2>&1 || {
  echo "✗ Não há versão anterior (banket-help:previous). Volte help/ pelo git e rode make help-deploy."
  exit 1
}

# Troca latest ↔ previous: rodar de novo desfaz o rollback.
docker image tag banket-help:latest banket-help:rollback-tmp 2>/dev/null || true
docker image tag banket-help:previous banket-help:latest
docker image tag banket-help:rollback-tmp banket-help:previous 2>/dev/null && docker image rm banket-help:rollback-tmp >/dev/null 2>&1 || true
docker rm -f banket-help-previous >/dev/null 2>&1 || true
docker create --name banket-help-previous banket-help:previous >/dev/null

docker compose -f "$HELP_DIR/docker-compose.yml" up -d --no-build --force-recreate banket-help
echo "✓ Rollback aplicado. Rode de novo para desfazer."
