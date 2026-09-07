FROM node:22-bookworm-slim AS build

WORKDIR /app

RUN apt-get update \
    && apt-get install --no-install-recommends -y openssl python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx prisma generate \
    && npm run build \
    && test -f dist/src/main.js

FROM build AS migration

RUN chown node:node /app/package.json /app/package-lock.json \
    && chown -R node:node /app/prisma

USER node

CMD ["npx", "prisma", "migrate", "deploy"]

FROM build AS runtime-dependencies

RUN npm prune --omit=dev --omit=optional \
    && npm cache clean --force

FROM node:22-bookworm-slim AS production

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

RUN apt-get update \
    && apt-get install --no-install-recommends -y ca-certificates openssl tini \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /app/storage \
    && chown node:node /app/storage

COPY --from=runtime-dependencies --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=runtime-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist

USER node

EXPOSE 3000
VOLUME ["/app/storage"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "const http=require('http');const request=http.get('http://127.0.0.1:3000/api/health/live',(response)=>{response.resume();process.exit(response.statusCode>=200&&response.statusCode<400?0:1)});request.on('error',()=>process.exit(1));request.setTimeout(4000,()=>{request.destroy();process.exit(1)})"]

ENTRYPOINT ["tini", "--"]
CMD ["node", "dist/src/main.js"]
