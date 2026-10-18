# syntax=docker/dockerfile:1
# Central de Ajuda do Banket — build multi-stage.
# Contexto: help/ (precisa de site/, support/ e nginx/; central-ajuda/ fica fora via .dockerignore).
#
#   1) Node: valida o conteúdo, gera o site estático (Astro) e o índice de busca (Pagefind).
#   2) nginx: serve dist/ em /ajuda/. A proteção por login é do Nginx do host (auth_request no app).

FROM node:22-bookworm-slim AS build
WORKDIR /app/site
COPY site/package.json site/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY site/ ./
COPY support/ ../support/
# O cache do Astro guarda as imagens já otimizadas: rebuild só reprocessa imagem nova ou alterada.
RUN --mount=type=cache,target=/app/site/node_modules/.astro npm run build

FROM nginx:stable-alpine
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/site/dist /usr/share/nginx/html/ajuda
RUN rm -f /usr/share/nginx/html/index.html /usr/share/nginx/html/50x.html
ARG BUILD_ID=dev
LABEL org.opencontainers.image.title="banket-help" org.opencontainers.image.revision=$BUILD_ID
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1/healthz || exit 1
EXPOSE 80
