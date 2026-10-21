#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

main() {
  exec 9>/tmp/treevook-deploy.lock
  flock -n 9 || { echo "Another deploy is running"; exit 1; }

  target="${1:-origin/main}"
  git -C .. fetch -q origin main
  sha=$(git -C .. rev-parse --verify "$target^{commit}")
  git -C .. merge-base --is-ancestor "$sha" origin/main || { echo "$sha is not on main"; exit 1; }

  tag=$(git -C .. rev-parse --short=12 "$sha")
  previous=$(sed -n 's/^IMAGE_TAG=//p' .env)
  before=$(git -C .. rev-parse HEAD)
  echo "Deploying $tag (running: ${previous:-none})"

  git -C .. checkout -q --detach "$sha"
  IMAGE_TAG=$tag docker compose build

  if [ -n "$(git -C .. diff --name-only "$before" "$sha" -- backend/drizzle)" ]; then
    ./backup.sh pre-deploy
  fi

  set_tag() { sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=$1/" .env; }

  healthy() {
    for _ in $(seq 1 30); do
      bad=0
      for svc in api web; do
        docker compose ps --status running --format '{{.Service}}' | grep -qx "$svc" || continue
        state=$(docker inspect -f '{{.State.Health.Status}}' "$(docker compose ps -q "$svc")")
        [ "$state" = healthy ] || bad=1
      done
      [ $bad = 0 ] && return 0
      sleep 4
    done
    return 1
  }

  set_tag "$tag"
  docker compose run --rm api node dist/shared/database/migrate.js
  docker compose up -d --remove-orphans
  if [ -n "$(git -C .. diff --name-only "$before" "$sha" -- deploy/Caddyfile deploy/Caddyfile.api)" ]; then
    docker compose up -d --force-recreate --no-deps caddy
  fi

  if ! healthy; then
    echo "Health check failed, rolling back to ${previous:-latest}"
    docker compose logs --tail 40 api web || true
    set_tag "${previous:-latest}"
    git -C .. checkout -q --detach "$before"
    docker compose up -d --remove-orphans
    exit 1
  fi

  for repo in treevook-backend treevook-web; do
    docker image ls "$repo" --format '{{.CreatedAt}}\t{{.Tag}}' | sort -r | awk -F'\t' 'NR>3 {print $2}' |
      while read -r old; do [ "$old" = "$tag" ] || docker image rm -f "$repo:$old" >/dev/null 2>&1 || true; done
  done
  docker image prune -f >/dev/null
  docker compose ps --format 'table {{.Service}}\t{{.Status}}'
  echo "Deployed $tag"
}

main "$@"
exit
