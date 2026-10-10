FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# --- Dependencies ---
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# --- Build ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}

RUN pnpm build

# --- Production ---
FROM base AS runner
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Client PostgreSQL : sauvegardes déclenchées depuis l'application (passage à l'année suivante)
RUN apk add --no-cache postgresql16-client

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy drizzle migrations for runtime migration
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/scripts/entrypoint.sh ./entrypoint.sh

# Copy source files for seed script (tsx needs .ts sources)
COPY --from=builder /app/src/shared/lib/seed.ts ./src/shared/lib/seed.ts
COPY --from=builder /app/src/shared/lib/db.ts ./src/shared/lib/db.ts
COPY --from=builder /app/src/shared/lib/utils.ts ./src/shared/lib/utils.ts
COPY --from=builder /app/src/modules/auth/schema.ts ./src/modules/auth/schema.ts
COPY --from=builder /app/src/modules/academic/schema.ts ./src/modules/academic/schema.ts
COPY --from=builder /app/src/modules/finance/schema.ts ./src/modules/finance/schema.ts
COPY --from=builder /app/src/modules/students/schema.ts ./src/modules/students/schema.ts
COPY --from=builder /app/src/modules/transport/schema.ts ./src/modules/transport/schema.ts
COPY --from=builder /app/src/modules/payroll/schema.ts ./src/modules/payroll/schema.ts
COPY --from=builder /app/src/modules/settings/schema.ts ./src/modules/settings/schema.ts
COPY --from=builder /app/src/modules/settings/defaults.ts ./src/modules/settings/defaults.ts
COPY --from=builder /app/src/modules/finance/tarifs-defaut.ts ./src/modules/finance/tarifs-defaut.ts

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "./entrypoint.sh"]
