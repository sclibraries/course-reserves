#!/usr/bin/env bash
# docker/db-shell.sh — Open a MySQL shell inside the db container
#
# Usage:
#   ./docker/db-shell.sh              # Opens mysql CLI for the 'reserves' DB
#   ./docker/db-shell.sh "SHOW TABLES;"  # Run a one-off query

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$(dirname "$SCRIPT_DIR")"

QUERY="${1:-}"

if [ -n "$QUERY" ]; then
    docker compose exec db mysql \
        -u folio-reserves -pfolio-reserves reserves \
        -e "$QUERY"
else
    echo "🗄  Opening MySQL shell — database: reserves"
    echo "   Type 'exit' or Ctrl-D to quit."
    echo ""
    docker compose exec -it db mysql -u folio-reserves -pfolio-reserves reserves
fi
