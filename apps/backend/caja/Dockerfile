# ─────────────────────────────────────────────────────────────────────────────
# Dockerfile — svc-caja (Pardos Chicken)
# Multi-stage build optimizado para producción en ECS Fargate.
# ─────────────────────────────────────────────────────────────────────────────

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:20-alpine AS runner
WORKDIR /app

RUN addgroup -g 1001 -S pardos && \
    adduser -S pardos -u 1001 -G pardos

COPY --from=deps --chown=pardos:pardos /app/node_modules ./node_modules
COPY --chown=pardos:pardos . .

USER pardos

EXPOSE 8080
ENV PORT=8080
ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1

CMD ["node", "src/server.js"]
