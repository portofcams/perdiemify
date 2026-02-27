FROM node:20-alpine

# Install Chromium for Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app

COPY package.json tsconfig.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/scraper/package.json ./packages/scraper/

RUN npm install --workspace=packages/scraper --workspace=packages/shared

COPY packages/shared/ ./packages/shared/
COPY packages/scraper/ ./packages/scraper/

RUN npm run build --workspace=packages/shared && npm run build --workspace=packages/scraper

CMD ["node", "packages/scraper/dist/index.js"]
