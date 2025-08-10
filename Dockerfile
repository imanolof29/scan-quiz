FROM node:18-alpine

RUN apk add --no-cache dumb-init

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production && npm cache clean --force

COPY . .

RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE $PORT

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main"]