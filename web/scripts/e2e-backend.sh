#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../backend"
export PORT=4100
export DATABASE_URL="${E2E_DATABASE_URL:-postgres://$(whoami)@localhost:5432/adpilot_e2e}"
export REDIS_URL="redis://localhost:6379/2"
export META_MOCK=true
export PLAY_MOCK=true
export AI_MOCK=true
export APP_URL=http://localhost:3400
export WEB_ORIGINS=http://localhost:3400
export OTP_TEST_NUMBERS="9000000007:123456,9000000008:123456,9000000009:123456"
export LOG_LEVEL=warn
createdb adpilot_e2e 2>/dev/null || true
npm run --silent db:migrate >/dev/null
[ -f dist/main.js ] || npm run --silent build
node dist/worker.js &
WORKER=$!
trap 'kill $WORKER 2>/dev/null || true' EXIT
node dist/main.js
