FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json tsconfig.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/api/package.json ./packages/api/

RUN npm install --workspace=packages/api --workspace=packages/shared

COPY packages/shared/ ./packages/shared/
COPY packages/api/ ./packages/api/

RUN npm run build --workspace=packages/shared && npm run build --workspace=packages/api

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/packages/api/dist ./dist
COPY --from=builder /app/packages/api/package.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3001

CMD ["node", "dist/index.js"]
