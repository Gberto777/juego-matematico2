# syntax=docker/dockerfile:1

# --- Etapa 1: compilar la aplicación con Node ---
FROM node:24-alpine AS build
WORKDIR /app

# Primero solo los manifiestos de dependencias, para aprovechar la caché de capas
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# vite.config.ts usa la base de GitHub Pages (/juego-matematico/); aquí Nginx sirve en la raíz
RUN npm run build -- --base=/

# --- Etapa 2: servir los archivos estáticos con Nginx ---
FROM nginx:1.28-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1
