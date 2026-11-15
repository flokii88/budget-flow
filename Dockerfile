# Stage 1: Build Vite / React app
FROM node:20-alpine AS builder

WORKDIR /app

# Arguments de build pour les variables d'environnement Vite
ARG VITE_POCKETBASE_URL
ENV VITE_POCKETBASE_URL=$VITE_POCKETBASE_URL

# Installation des dépendances
COPY package*.json ./
RUN npm ci

# Copie du code source et build de production
COPY . .
RUN npm run build

# Stage 2: Serveur Nginx ultra-léger
FROM nginx:alpine AS runner

# Configuration Nginx optimisée pour SPA React
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copie des fichiers statiques générés
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
