#!/usr/bin/env bash
# Deploy blue-green na VPS (chamado por scripts/deploy.sh após o git pull).
#
#   scripts/deploy-remoto.sh              sobe o código atual na cor inativa e troca o tráfego para ela
#   scripts/deploy-remoto.sh --rollback   religa a cor anterior (container parado) e volta o tráfego para ela
#
# A cor ativa fica em .deploy-ativo; o Nginx lê o upstream de $NGINX_UPSTREAM.
# Se a cor nova não responder, o Nginx não é tocado e a versão atual segue no ar.
set -euo pipefail
cd "$(dirname "$0")/.."

DC="docker compose -f docker-compose.prod.yml"
UPSTREAM="${NGINX_UPSTREAM:-/etc/nginx/conf.d/banket-upstream.conf}"
ESTADO=.deploy-ativo
DRENAGEM="${DEPLOY_DRENAGEM:-15}"   # segundos que a cor antiga segue atendendo requisições em andamento

variavel() { grep -E "^$1=" .env | cut -d= -f2 || true; }
porta() {
  local p
  if [ "$1" = blue ]; then p="$(variavel APP_PORT_BLUE)"; echo "${p:-5168}"
  else p="$(variavel APP_PORT_GREEN)"; echo "${p:-5169}"; fi
}
responde() { curl -sf -o /dev/null --max-time 5 "http://127.0.0.1:$1/auth/login"; }
erro() { echo "✗ $*" >&2; exit 1; }

ATIVA="$(cat "$ESTADO" 2>/dev/null || echo blue)"
if [ "$ATIVA" = blue ]; then NOVA=green; else NOVA=blue; fi
PORTA_NOVA="$(porta "$NOVA")"

echo "commit: $(git log --oneline -1)"
echo "cor ativa: $ATIVA → nova: $NOVA (127.0.0.1:$PORTA_NOVA)"

$DC up -d postgres >/dev/null 2>&1

if [ "${1:-}" = --rollback ]; then
  $DC start "webapp_$NOVA" >/dev/null 2>&1 || erro "Não há container $NOVA para voltar (nenhum deploy anterior)."
else
  $DC build "webapp_$NOVA" >/tmp/banket-build.log 2>&1 || { tail -30 /tmp/banket-build.log; erro "Build falhou; $ATIVA segue no ar."; }
  $DC up -d --no-deps --force-recreate "webapp_$NOVA" >/dev/null 2>&1
fi

# Espera a cor nova responder (migrations rodam na inicialização)
for _ in $(seq 1 60); do responde "$PORTA_NOVA" && break; sleep 2; done
if ! responde "$PORTA_NOVA"; then
  $DC logs --tail 30 "webapp_$NOVA"
  $DC stop "webapp_$NOVA" >/dev/null 2>&1
  erro "webapp_$NOVA não respondeu; tráfego continua em $ATIVA."
fi
echo "webapp_$NOVA respondendo"

# Troca o tráfego: reload do Nginx é gracioso (conexões em andamento terminam no processo antigo)
cp "$UPSTREAM" "$UPSTREAM.bak" 2>/dev/null || true
printf '# Gerado por banket.application/scripts/deploy-remoto.sh — cor ativa: %s\nupstream banket_app {\n    server 127.0.0.1:%s;\n}\n' "$NOVA" "$PORTA_NOVA" >"$UPSTREAM"
if ! nginx -t >/dev/null 2>&1; then
  if [ -f "$UPSTREAM.bak" ]; then mv "$UPSTREAM.bak" "$UPSTREAM"; fi
  erro "nginx -t falhou; upstream restaurado, tráfego continua em $ATIVA."
fi
systemctl reload nginx
echo "$NOVA" >"$ESTADO"
echo "tráfego → $NOVA"

# Drena e para (sem remover) a cor antiga: fica pronta para --rollback
sleep "$DRENAGEM"
$DC stop "webapp_$ATIVA" >/dev/null 2>&1 || true
echo "webapp_$ATIVA parado (disponível para rollback)"
