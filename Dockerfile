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

# Run as root in the container: Railway terminates TLS at the edge proxy, and
# Prisma migrate (preDeploy) is unreliable as USER nextjs in Next standalone
# images (HOME/npx/.bin + partial node_modules). Prefer a working migrate path.
#
# App runtime (official Next standalone layout)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Schema + migrate helper script
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/scripts/migrate-deploy.mjs ./scripts/migrate-deploy.mjs

# Generated client used by the app (standalone usually traces it; keep explicit).
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Install a complete Prisma CLI (with transitive deps: effect, c12, engines…).
# Copying only node_modules/prisma + @prisma is NOT enough for `migrate deploy`.
RUN PRISMA_VERSION="$(node -e "console.log(require('./package-lock.json').packages['node_modules/prisma'].version)")" \
  && npm install -g "prisma@${PRISMA_VERSION}" \
  && prisma -v \
  && node -e "require('fs').accessSync('/usr/local/lib/node_modules/prisma/build/index.js')" \
  && rm -f package-lock.json

EXPOSE 3000
CMD ["node", "server.js"]
