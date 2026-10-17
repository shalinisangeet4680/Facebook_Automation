#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

git -C .. pull --ff-only
docker compose build
docker compose run --rm api node dist/shared/database/migrate.js
docker compose up -d --remove-orphans
docker image prune -f >/dev/null
docker compose ps --format "table {{.Service}}\t{{.Status}}"
