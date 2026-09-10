#!/usr/bin/env bash
# S00 — Create Clean Monorepo from Legacy Copy
# Run from repo root: bash scripts/s00-setup.sh

set -e
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LEGACY="$REPO_ROOT/legacy-source"

echo "=== S00: Creating monorepo from legacy-source ==="
echo "Repo root: $REPO_ROOT"

# -------------------------------------------------------
# Task 1: Copy admin frontend
# -------------------------------------------------------
echo ""
echo "--- Task 1: Copying admin frontend to apps/admin-web ---"

cp -r "$LEGACY/src"               "$REPO_ROOT/apps/admin-web/src"
cp -r "$LEGACY/public"            "$REPO_ROOT/apps/admin-web/public"
cp -r "$LEGACY/.storybook"        "$REPO_ROOT/apps/admin-web/.storybook"
cp    "$LEGACY/index.html"        "$REPO_ROOT/apps/admin-web/"
cp    "$LEGACY/vite.config.js"    "$REPO_ROOT/apps/admin-web/"
cp    "$LEGACY/package.json"      "$REPO_ROOT/apps/admin-web/"
cp    "$LEGACY/package-lock.json" "$REPO_ROOT/apps/admin-web/"
cp    "$LEGACY/tailwind.config.js" "$REPO_ROOT/apps/admin-web/"
cp    "$LEGACY/tailwind.config.ts" "$REPO_ROOT/apps/admin-web/"
cp    "$LEGACY/postcss.config.js" "$REPO_ROOT/apps/admin-web/"
cp    "$LEGACY/tsconfig.json"     "$REPO_ROOT/apps/admin-web/"
cp    "$LEGACY/tsconfig.app.json" "$REPO_ROOT/apps/admin-web/"
cp    "$LEGACY/tsconfig.node.json" "$REPO_ROOT/apps/admin-web/"
cp    "$LEGACY/eslint.config.js"  "$REPO_ROOT/apps/admin-web/"
cp    "$LEGACY/components.json"   "$REPO_ROOT/apps/admin-web/"
cp    "$LEGACY/vitest.workspace.js" "$REPO_ROOT/apps/admin-web/"
cp    "$LEGACY/.env.development"  "$REPO_ROOT/apps/admin-web/"
cp    "$LEGACY/.env.docker"       "$REPO_ROOT/apps/admin-web/"
cp    "$LEGACY/.gitignore"        "$REPO_ROOT/apps/admin-web/"
cp    "$LEGACY/.npmrc"            "$REPO_ROOT/apps/admin-web/"

echo "Admin frontend copied."

# -------------------------------------------------------
# Task 2: Copy faculty form, backend, and database files
# -------------------------------------------------------
echo ""
echo "--- Task 2: Copying faculty form, backend, and database ---"

# Faculty form — copy entire directory (skip .git, node_modules, dist)
rsync -a --exclude='.git' --exclude='node_modules' --exclude='dist' \
  "$LEGACY/reserves-form/" "$REPO_ROOT/apps/faculty-form/"

# Yii2 backend — flatten from deeply-nested root to apps/api/
rsync -a --exclude='vendor' --exclude='runtime' --exclude='files' \
  "$LEGACY/backend/course-reserves/backend/" "$REPO_ROOT/apps/api/"

# Database files
cp -r "$LEGACY/db/migrations"                  "$REPO_ROOT/packages/database/migrations"
cp    "$LEGACY/reserves_2026-03-03.sql"        "$REPO_ROOT/packages/database/"
cp    "$LEGACY/folio_reports_2026-03-04.sql"   "$REPO_ROOT/packages/database/"

echo "Faculty form, backend, and database copied."

# -------------------------------------------------------
# Task 3: Copy Docker, scripts, .github, and root files
# -------------------------------------------------------
echo ""
echo "--- Task 3: Copying Docker, scripts, .github, and creating root files ---"

# Docker configs (skip stop.sh/start.sh/logs.sh/db-shell.sh — those are shortcuts)
rsync -a "$LEGACY/docker/" "$REPO_ROOT/docker/"

# Root docker-compose.yml
cp "$LEGACY/docker-compose.yml" "$REPO_ROOT/"

# Scripts
rsync -a "$LEGACY/scripts/" "$REPO_ROOT/scripts/"

# .github CI/CD
if [ -d "$LEGACY/.github" ]; then
  cp -r "$LEGACY/.github" "$REPO_ROOT/"
fi

# Root .gitignore
cp "$LEGACY/.gitignore" "$REPO_ROOT/"

echo "Docker, scripts, and root files copied."

# -------------------------------------------------------
# Task 3 cont: Create root package.json
# -------------------------------------------------------
echo ""
echo "--- Creating root package.json ---"
cat > "$REPO_ROOT/package.json" << 'EOF'
{
  "name": "course-reserves-monorepo",
  "private": true,
  "workspaces": ["apps/admin-web", "apps/faculty-form"]
}
EOF
echo "Root package.json created."

echo ""
echo "=== S00 file copy complete ==="
