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
# Writable home for nextjs: npx/prisma may write caches during preDeploy.
ENV HOME=/home/nextjs

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 --home /home/nextjs nextjs \
  && mkdir -p /home/nextjs \
  && chown -R nextjs:nodejs /home/nextjs

# App runtime (official Next standalone layout)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Needed for Railway pre-deploy migrate: CLI + engines + generated client.
# Must be owned by nextjs — image USER is nextjs and preDeploy runs as that user.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
RUN mkdir -p node_modules/.bin \
  && ln -sf ../prisma/build/index.js node_modules/.bin/prisma \
  && chown -R nextjs:nodejs node_modules/.bin

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
