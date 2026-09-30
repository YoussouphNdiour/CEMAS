#!/bin/sh
set -e

echo "Running database migrations..."
npx drizzle-kit migrate 2>/dev/null || echo "Migrations already applied or skipped"

echo "Starting application..."
exec node server.js
