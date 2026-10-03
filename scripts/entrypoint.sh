#!/bin/sh
set -e

echo "Running database migrations..."
npx drizzle-kit migrate 2>/dev/null || echo "Migrations already applied or skipped"

echo "Running database seed..."
npx tsx src/shared/lib/seed.ts 2>/dev/null || echo "Seed already applied or skipped"

echo "Starting application..."
exec node server.js
