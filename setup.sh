#!/usr/bin/env bash
# Reinstalls dependencies from the lockfiles. Only needed if node_modules is missing (for example after copying this folder without it).
set -euo pipefail
cd "$(dirname "$0")"
. ./.node-env.sh
echo "Node $(node --version), npm $(npm --version)"
for d in exposure-awareness-mobile exposure-awareness-backend; do
  echo "== $d"
  (cd "$d" && npm ci)
done
if ! python3 -c "import pytest" 2>/dev/null; then
  echo "note: the Python tests need pytest:  python3 -m pip install pytest"
fi
echo "Done. Try:  cd exposure-awareness-mobile && npm test"
