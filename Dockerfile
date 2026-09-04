# ---- ビルド ----
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- 実行 ----
FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY config ./config
COPY widget ./widget
COPY public ./public

# 知識ベースと会話ログの置き場（docker-compose でボリュームに割り当て）
RUN mkdir -p /app/data && chown -R node:node /app/data
USER node

EXPOSE 8787
HEALTHCHECK --interval=60s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server.js"]
