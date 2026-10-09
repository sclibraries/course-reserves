#!/usr/bin/env bash
# docker/start.sh — Start the local Docker development environment
#
# Usage:
#   ./docker/start.sh          # Start all services (keep existing DB data)
#   ./docker/start.sh --fresh  # Wipe DB volume and re-import schema from scratch
#   ./docker/start.sh --build  # Force rebuild of images before starting

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

FRESH=false
BUILD_FLAG=""

for arg in "$@"; do
    case $arg in
        --fresh) FRESH=true ;;
        --build) BUILD_FLAG="--build" ;;
    esac
done

if $FRESH; then
    echo "⚠  --fresh: stopping containers and wiping DB volume..."
    docker compose down -v --remove-orphans 2>/dev/null || true
    echo "✓  Volume wiped. The schema will be re-imported on startup."
fi

echo "🐳 Starting course-reserves Docker environment..."
echo "   DB init SQL: ${DEV_DB_INIT_SQL:-packages/database/schema.sql} will auto-import if DB is new."
echo ""

docker compose up $BUILD_FLAG -d

echo ""
echo "✅ Services started:"
docker compose ps
echo ""
echo "🌐 Access points:"
echo "   Frontend (dev + HMR):  http://localhost:5173/course-reserves/"
echo "   Full-stack via nginx:  http://localhost:8080/course-reserves/"
echo "   PHP API direct:        (internal - see nginx proxy)"
echo "   DB (host):             127.0.0.1:3306  user=folio-reserves  pass=folio-reserves"
echo ""
echo "🔑 Local auth:"
echo "   http://localhost:8080/course-reserves/backend/admin/authorize-local.php"
echo ""
echo "📋 Useful commands:"
echo "   ./docker/logs.sh           — tail all container logs"
echo "   ./docker/logs.sh backend   — tail PHP/Apache logs only"
echo "   ./docker/db-shell.sh       — open a MySQL shell"
echo "   ./docker/stop.sh           — stop all containers"
