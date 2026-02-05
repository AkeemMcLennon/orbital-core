#!/bin/sh
set -e

echo "🚀 Starting Orbital Backend..."
echo ""

# Run database migrations
echo "📦 Running database migrations..."
bun run db:migrate:local

echo ""
echo "✅ Migrations complete!"
echo ""

# Start the backend server
echo "🌐 Starting backend server..."
exec bun run start
