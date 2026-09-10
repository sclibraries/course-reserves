#!/usr/bin/env bash
# docker/logs.sh — Follow container logs
#
# Usage:
#   ./docker/logs.sh              # All services
#   ./docker/logs.sh backend      # PHP/Apache only
#   ./docker/logs.sh frontend     # Vite only
#   ./docker/logs.sh db           # MariaDB only
#   ./docker/logs.sh proxy        # nginx only

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$(dirname "$SCRIPT_DIR")"

SERVICE="${1:-}"

if [ -n "$SERVICE" ]; then
    docker compose logs -f "$SERVICE"
else
    docker compose logs -f
fi
