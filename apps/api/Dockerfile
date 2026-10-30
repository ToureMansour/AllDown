# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS build

WORKDIR /app
ENV NODE_ENV=development

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

RUN npm ci --workspace @alldown/api --include=optional

COPY apps/api ./apps/api

ARG YTDLP_VERSION=2026.10.26
ENV YTDLP_VERSION=${YTDLP_VERSION}

RUN npm run build -w @alldown/api \
  && npm run setup:engine -w @alldown/api


FROM node:22-bookworm-slim AS runtime

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates ffmpeg \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production \
    PORT=4000 \
    TEMP_DIR=/tmp/alldown

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/bin ./apps/api/bin
COPY apps/api/package.json ./apps/api/package.json

RUN mkdir -p /tmp/alldown && chown -R node:node /tmp/alldown /app/apps/api

USER node
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 4000) + '/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/api/dist/server.js"]
