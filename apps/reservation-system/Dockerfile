# ─────────────────────────────────────────────────────────────────────────────
# Dockerfile — apps/reservation-system (Pardos Chicken)
# Multi-stage build para servir la aplicación estática con Nginx.
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Construcción (Builder) ─────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

# ── Stage 2: Servidor (Nginx) ───────────────────────────────────────────────
FROM nginx:alpine
# Copiamos los estáticos generados por Vite (carpeta dist) al directorio de Nginx
COPY --from=builder /app/dist /usr/share/nginx/html
# Exponemos el puerto estándar 80
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
