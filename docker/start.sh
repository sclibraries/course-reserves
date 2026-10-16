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

wait_for_fake_folio() {
    local deadline=$((SECONDS + 20))
    local http_status

    while (( SECONDS < deadline )); do
        if http_status="$(curl --silent --output /dev/null --write-out '%{http_code}' \
            --max-time 1 http://localhost:8080/_fake-folio/ 2>/dev/null)" \
            && [[ "$http_status" == "200" ]]; then
            return 0
        fi
        sleep 1
    done

    return 1
}

verify_fake_folio() {
    local folio_search_base_url

    if ! folio_search_base_url="$(run_compose exec -T backend printenv FOLIO_SEARCH_BASE_URL 2>/dev/null)" \
        || [[ "$folio_search_base_url" != http://fake-folio:3000/* ]]; then
        echo "ERROR: Fake FOLIO mode verification failed: backend FOLIO_SEARCH_BASE_URL does not point to fake-folio. FOLIO traffic may be going to real FOLIO." >&2
        return 1
    fi

    if ! wait_for_fake_folio; then
        echo "ERROR: Fake FOLIO mode verification failed: http://localhost:8080/_fake-folio/ did not return HTTP 200 within 20 seconds. FOLIO traffic may be going to real FOLIO." >&2
        return 1
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

echo "🔧 Building nginx proxy image..."
run_compose build proxy

run_compose up $BUILD_FLAG -d

if $FAKE_FOLIO; then
    verify_fake_folio
fi

echo ""
echo "✅ Services started:"
run_compose ps
echo ""
echo "🌐 Access points:"
echo "   Frontend (dev + HMR):  http://localhost:5173/course-reserves/"
echo "   Full-stack via nginx:  http://localhost:8080/course-reserves/"
if $FAKE_FOLIO; then
    echo "   Fake FOLIO controls:   http://localhost:8080/_fake-folio/"
    echo ""
    echo "📋 Fake FOLIO next steps:"
    echo "   docker exec -it course_reserves_backend php yii migrate --interactive=0"
    echo "   docker exec -it course_reserves_backend php yii dev-seed/test-courses"
    echo "   Faculty form:         http://localhost:8080/form/"
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
