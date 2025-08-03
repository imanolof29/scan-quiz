FROM node:18-alpine AS production

RUN apk add --no-cache dumb-init curl

WORKDIR /app

RUN chown -R nestjs:nodejs /app

USER nestjs

COPY --chown=nestjs:nodejs package*.json ./

RUN npm ci --only=production && npm cache clean --force

COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist

COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE $PORT


ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "dist/main"]