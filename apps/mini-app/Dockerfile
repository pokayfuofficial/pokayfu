# ─────────────────────────────────────────────────────────
#  POKAYFU — Mini App Dockerfile
#  Nginx для раздачи статики
# ─────────────────────────────────────────────────────────

# ── Stage 1: Build ─────────────────────────────────────
FROM node:21-alpine AS builder
WORKDIR /app

ARG VITE_API_URL=https://api.pokayfu.com/v1
ENV VITE_API_URL=$VITE_API_URL

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: Serve ─────────────────────────────────────
FROM nginx:alpine AS runner

# Nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s \
  CMD wget -qO- http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
