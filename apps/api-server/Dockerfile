# ─────────────────────────────────────────────────────────
#  POKAYFU — API Server Dockerfile
#  Multi-stage build для минимального образа
# ─────────────────────────────────────────────────────────

# ── Stage 1: Dependencies ──────────────────────────────
FROM node:21-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma/

RUN npm ci --only=production && \
    npx prisma generate

# ── Stage 2: Builder ───────────────────────────────────
FROM node:21-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npx tsc --skipLibCheck

# ── Stage 3: Runner ────────────────────────────────────
FROM node:21-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Создаём непривилегированного пользователя
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 pokayfu

# Копируем только нужное
COPY --from=deps    --chown=pokayfu:nodejs /app/node_modules ./node_modules
COPY --from=deps    --chown=pokayfu:nodejs /app/prisma      ./prisma
COPY --from=builder --chown=pokayfu:nodejs /app/dist        ./dist

USER pokayfu

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "dist/index.js"]
