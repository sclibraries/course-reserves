#!/usr/bin/env bash
# docker/stop.sh — Stop the local Docker development environment

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$(dirname "$SCRIPT_DIR")"

echo "🛑 Stopping course-reserves Docker environment..."
docker compose down --remove-orphans
echo "✓  All containers stopped. DB data preserved in named volume."
echo "   Run './docker/start.sh --fresh' to wipe and re-import."
