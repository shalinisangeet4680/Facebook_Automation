#!/usr/bin/env bash
set -euo pipefail
sha="${SSH_ORIGINAL_COMMAND:-}"
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo "Expected a full commit SHA"; exit 2; }
exec sg docker -c "/opt/treevook/deploy/update.sh $sha"
