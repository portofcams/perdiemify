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

# Keep monorepo structure so @perdiemify/shared resolves correctly
COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY --from=builder /app/packages/api/package.json ./packages/api/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

EXPOSE 3001

CMD ["node", "packages/api/dist/index.js"]
