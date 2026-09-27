#!/bin/bash
# Double-click to open the compiled app (outputs/web-app) in your browser. Press Ctrl-C in this window to stop it.
cd "$(dirname "$0")/outputs/web-app" || exit 1
PORT=8090
echo "Serving the compiled app at http://localhost:$PORT   (Ctrl-C to stop)"
( sleep 1; open "http://localhost:$PORT" ) &
python3 -m http.server "$PORT" --bind 127.0.0.1
