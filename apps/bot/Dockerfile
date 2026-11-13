# Imagem do bot de WhatsApp (webhook + workers). Construída a partir da raiz do monorepo:
#   docker build -f apps/bot/Dockerfile -t c1imob-bot .

# 1) Instala o que o bot precisa, empacota o código e separa as dependências de produção.
FROM node:24-alpine AS build
RUN npm install -g pnpm@12.18.0
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter "@c1imob/bot..."
RUN pnpm --filter @c1imob/bot build \
 && pnpm --filter @c1imob/bot deploy --prod /out \
 && cp -r apps/bot/dist /out/dist

# 2) Imagem final: só Node, dependências de produção e o código empacotado.
FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out/package.json ./package.json
COPY --from=build --chown=node:node /out/node_modules ./node_modules
COPY --from=build --chown=node:node /out/dist ./dist
USER node
EXPOSE 8787
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8787/health || exit 1
CMD ["node", "--enable-source-maps", "dist/server.js"]
