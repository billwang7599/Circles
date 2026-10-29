FROM node:24-slim
ENV NODE_ENV=production NODE_EXTRA_CA_CERTS=/app/api/rds-ca.pem
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY ai/package.json ai/
COPY api/package.json api/
COPY mobile/package.json mobile/
COPY web/package.json web/
RUN npm ci --omit=dev --workspace api
COPY shared shared
COPY api/migrations api/migrations
COPY api/rds-ca.pem api/
COPY api/src api/src
USER node
EXPOSE 3001
CMD ["node", "api/src/index.ts"]
