#!/usr/bin/env bash
# Engine soak run: every persona in its own timezone process (Jest cannot switch TZ mid-run),
# then the timezone-independent experiments. Outputs JSON to $SIM_OUT (default ./.sim-out).
#
#   npm run sim
#   SIM_OUT=/tmp/run1 SIM_SEED=7 SIM_DAYS=120 npm run sim
set -euo pipefail
cd "$(dirname "$0")/.."

OUT="${SIM_OUT:-.sim-out}"
mkdir -p "$OUT"
export SIM=1 SIM_OUT="$OUT"

for pair in mina:Asia/Seoul marcus:America/Chicago elena:Europe/Madrid priya:America/Los_Angeles; do
  id="${pair%%:*}"
  tz="${pair#*:}"
  echo "== persona $id ($tz)"
  TZ="$tz" SIM_MODE=persona SIM_PERSONA="$id" npx jest src/sim/engineRun.test.ts --runInBand --silent=false 2>&1 | grep -E "✓|✕|Tests:|Error|error" || true
done

echo "== experiments"
TZ=UTC SIM_MODE=experiments npx jest src/sim/engineRun.test.ts --runInBand --silent=false 2>&1 | grep -E "✓|✕|Tests:|Error|error" || true

echo "raw results in $OUT"
echo
node scripts/sim-report.mjs "$OUT"
