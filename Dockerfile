FROM node:22-alpine AS builder

# Chromium (geração do PDF das propostas) e fontes para textos com acentuação
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont font-noto font-noto-emoji
ENV CHROMIUM_PATH=/usr/bin/chromium-browser

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Só as dependências de produção para a imagem final (o estágio builder segue completo para o dev)
FROM builder AS producao
RUN npm prune --omit=dev

FROM node:22-alpine AS runtime

RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont font-noto font-noto-emoji
ENV CHROMIUM_PATH=/usr/bin/chromium-browser

WORKDIR /app
ENV NODE_ENV=production
COPY --from=producao /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/db ./db

ENV HOST=0.0.0.0
ENV PORT=4321
EXPOSE 4321

# Aplica as migrations pendentes antes de iniciar o servidor
CMD ["sh", "-c", "node scripts/migrate.mjs && node ./dist/server/entry.mjs"]
