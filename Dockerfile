FROM node:22-bookworm-slim AS deps
WORKDIR /app
# Lockfile is generated with npm 11 (Windows/local). Image default is npm 10,
# which fails `npm ci` on optional @emnapi/* resolution. Pin npm to match lockfile.
RUN npm install -g npm@11.6.2
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
# Prisma needs OpenSSL on Debian slim to detect the correct engine binary.
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npx next build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
# Prisma migrate deploy (Railway preDeploy) needs OpenSSL on Debian slim.
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Run as root: Railway terminates TLS at the edge, and preDeploy migrate needs a
# reliable filesystem/PATH (Next standalone + non-root USER nextjs was brittle).

# App runtime (official Next standalone layout)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Schema + migrate helper for Railway preDeploy (standalone omits these).
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/scripts ./scripts

# Install a complete Prisma CLI tree (effect, c12, engines, …) into /app.
# Selective COPY of node_modules/prisma + @prisma is NOT enough: @prisma/config
# requires transitive deps that are easy to miss and break `migrate deploy`.
# Prefer local install (matches migrate-deploy.mjs) over global-only.
RUN PRISMA_VERSION="$(node -e "console.log(require('./package-lock.json').packages['node_modules/prisma'].version)")" \
  && npm install "prisma@${PRISMA_VERSION}" --omit=dev --no-save --package-lock=false \
  && node -e "require('effect'); require('@prisma/config'); console.log('prisma ok', require('prisma/package.json').version)" \
  && test -f scripts/migrate-deploy.mjs \
  && rm -f package-lock.json

# Generated client from build-time `prisma generate` (keep after npm install so engines stay intact).
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

EXPOSE 3000
CMD ["node", "server.js"]
