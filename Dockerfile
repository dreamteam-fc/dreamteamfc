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
# PORT is overridden by Railway at runtime. Do NOT rely on ENV HOSTNAME here:
# Railway injects HOSTNAME as the container name, which would override this and
# break healthchecks. scripts/start-standalone.mjs forces 0.0.0.0 at start.
ENV PORT=3000

# Run as root: Railway terminates TLS at the edge, and preDeploy migrate needs a
# reliable filesystem/PATH (Next standalone + non-root USER nextjs was brittle).

# App runtime (official Next standalone layout)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Schema + migrate helper for Railway preDeploy (standalone omits these).
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
# Keep app package.json for require resolution in migrate-deploy.mjs.
COPY --from=builder /app/package.json ./package.json
# Lockfile only needed to pin Prisma CLI version (not installed into /app).
COPY --from=builder /app/package-lock.json /tmp/package-lock.json

# Install a complete Prisma CLI tree in isolation under /opt/prisma-cli.
# CRITICAL: never `npm install` against /app/package.json here.
# With caret ranges (historically next@^16.2.9) and --package-lock=false,
# npm upgrades Next past the version baked into standalone (e.g. 16.2.9 → 16.3.0)
# and the process crash-loops after Ready on:
#   TypeError: Cannot read properties of undefined (reading 'validationLevel')
RUN PRISMA_VERSION="$(node -e "console.log(require('/tmp/package-lock.json').packages['node_modules/prisma'].version)")" \
  && mkdir -p /opt/prisma-cli \
  && cd /opt/prisma-cli \
  && printf '{"name":"prisma-cli","private":true}\n' > package.json \
  && npm install "prisma@${PRISMA_VERSION}" --omit=dev --no-fund --no-audit \
  && node -e "require('effect'); require('@prisma/config'); console.log('prisma ok', require('prisma/package.json').version)" \
  && test -f /app/scripts/migrate-deploy.mjs \
  && rm -f /tmp/package-lock.json /opt/prisma-cli/package.json /opt/prisma-cli/package-lock.json

# Generated client from build-time `prisma generate` (app runtime, not migrate CLI).
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

EXPOSE 3000
CMD ["node", "scripts/start-standalone.mjs"]
