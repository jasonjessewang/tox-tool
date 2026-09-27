#!/bin/bash
# Double-click to run the app in development. It opens in your browser; press Ctrl-C in this window to stop it.
cd "$(dirname "$0")" || exit 1
. ./.node-env.sh
cd exposure-awareness-mobile || exit 1
if [ ! -d node_modules ]; then
  echo "Installing dependencies first (once)..."
  npm ci || { read -r -p "Install failed. Press Return to close." _; exit 1; }
fi
npm run web
