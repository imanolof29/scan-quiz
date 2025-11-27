# Dockerfile para producción
FROM node:18-alpine AS builder

# Instalar dependencias necesarias
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./
COPY tsconfig*.json ./

# Instalar SOLO dependencias de producción
RUN npm ci --only=production && \
    npm cache clean --force

# Copiar el código fuente
COPY . .

# Compilar la aplicación (si usas TypeScript)
RUN npm run build

# Etapa de producción
FROM node:18-alpine AS production

RUN apk add --no-cache libc6-compat dumb-init

WORKDIR /app

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copiar dependencias y build desde la etapa builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./

# Variables de entorno para producción
ENV NODE_ENV=production
ENV PORT=3000

# Cambiar a usuario no-root
USER nodejs

EXPOSE $PORT

# Usar dumb-init para manejar señales correctamente
CMD ["dumb-init", "node", "dist/main.js"]