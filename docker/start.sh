#!/usr/bin/env bash
# docker/start.sh — Start the local Docker development environment
#
# Usage:
#   ./docker/start.sh          # Start all services (keep existing DB data)
#   ./docker/start.sh --fresh  # Wipe DB volume and re-import schema from scratch
#   ./docker/start.sh --build  # Force rebuild of images before starting
#   ./docker/start.sh --fake-folio  # Use the synthetic FOLIO service and API URL

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

FRESH=false
FAKE_FOLIO=false
BUILD_FLAG=""

for arg in "$@"; do
    case $arg in
        --fresh) FRESH=true ;;
        --build) BUILD_FLAG="--build" ;;
        --fake-folio) FAKE_FOLIO=true ;;
    esac
done

FOLIO_OVERRIDE=""
if $FAKE_FOLIO; then
    export FOLIO_UPSTREAM=fake
    FOLIO_OVERRIDE="$(mktemp -t course-reserves-fake-folio.XXXXXX)"
    cat > "$FOLIO_OVERRIDE" <<'YAML'
services:
  backend:
    environment:
      FOLIO_SEARCH_BASE_URL: http://fake-folio:3000/folio/web/search
YAML
    trap 'rm -f "$FOLIO_OVERRIDE"' EXIT
else
    export FOLIO_UPSTREAM=real
fi

run_compose() {
    if [[ -n "$FOLIO_OVERRIDE" ]]; then
        docker compose -f docker-compose.yml -f "$FOLIO_OVERRIDE" "$@"
    else
        docker compose -f docker-compose.yml "$@"
    fi
}

if $FRESH; then
    echo "⚠  --fresh: stopping containers and wiping DB volume..."
    run_compose down -v --remove-orphans 2>/dev/null || true
    echo "✓  Volume wiped. The schema will be re-imported on startup."
fi

echo "🐳 Starting course-reserves Docker environment..."
echo "   FOLIO upstream: $FOLIO_UPSTREAM"
echo "   DB init SQL: ${DEV_DB_INIT_SQL:-packages/database/schema.sql} will auto-import if DB is new."
echo ""

run_compose up $BUILD_FLAG -d

echo ""
echo "✅ Services started:"
run_compose ps
echo ""
echo "🌐 Access points:"
echo "   Frontend (dev + HMR):  http://localhost:5173/course-reserves/"
echo "   Full-stack via nginx:  http://localhost:8080/course-reserves/"
if $FAKE_FOLIO; then
    echo "   Fake FOLIO controls:   http://localhost:8080/_fake-folio/"
fi
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
