# syntax=docker/dockerfile:1
FROM node:24.19.0-bookworm-slim AS build
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY . .
RUN npm run build

FROM node:24.19.0-bookworm-slim AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    FORMA_DATA_DIR=/data \
    FORMA_MIGRATIONS_DIR=/app/drizzle \
    FORMA_SALES_ENABLED=false
WORKDIR /app
COPY --from=build --chown=node:node /build/dist/standalone/ ./
COPY --from=build --chown=node:node /build/lib/runtime.ts ./lib/runtime.ts
COPY --from=build --chown=node:node /build/drizzle/ ./drizzle/
COPY --from=build --chown=node:node /build/scripts/check-runtime.mjs ./scripts/check-runtime.mjs
COPY --from=build --chown=node:node /build/deploy/start.mjs ./deploy/start.mjs
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--experimental-strip-types", "deploy/start.mjs"]
