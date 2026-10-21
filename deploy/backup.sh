#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

dir=/opt/treevook-backups
mkdir -p "$dir"
name="${1:-daily}-$(date +%Y%m%d-%H%M%S).sql.gz"
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner' | gzip > "$dir/$name.tmp"
mv "$dir/$name.tmp" "$dir/$name"
ls -1t "$dir"/daily-*.sql.gz 2>/dev/null | tail -n +8 | xargs -r rm -f || true
ls -1t "$dir"/pre-deploy-*.sql.gz 2>/dev/null | tail -n +6 | xargs -r rm -f || true
echo "Backup: $dir/$name ($(du -h "$dir/$name" | cut -f1))"
