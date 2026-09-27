#!/usr/bin/env python3
"""Hands a simulated person's storage, and the browser audit scripts, to the app running in a local browser.

    python3 scripts/snapshot-server.py [dir]        # default: .sim-out   ->  http://127.0.0.1:8765

Then, in the browser console on the running web app (npm run web):

    const snap = await fetch('http://127.0.0.1:8765/priya.snapshot.json').then(r => r.json());
    localStorage.clear(); for (const [k, v] of Object.entries(snap)) localStorage.setItem(k, v); location.reload();

and to audit whatever screen is showing (see scripts/a11y-audit.js and scripts/a11y-walk.js):

    (0, eval)(await fetch('http://127.0.0.1:8765/scripts/a11y-audit.js').then(r => r.text()));   // then __audit()

Listens on 127.0.0.1 only, serves files read-only, with CORS so the app's origin may fetch them. Nothing else is exposed.
"""
import http.server
import os
import socketserver
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SIM_DIR = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(ROOT, ".sim-out")
SCRIPTS_DIR = os.path.join(ROOT, "scripts")
PORT = 8765


class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        clean = path.split("?", 1)[0].split("#", 1)[0]
        if clean.startswith("/scripts/"):
            name = os.path.basename(clean)
            return os.path.join(SCRIPTS_DIR, name)
        return os.path.join(SIM_DIR, os.path.basename(clean))

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    if not os.path.isdir(SIM_DIR):
        sys.exit(f"{SIM_DIR} does not exist -- run `npm run sim` first")
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as server:
        print(f"serving {SIM_DIR} and {SCRIPTS_DIR}/ on http://127.0.0.1:{PORT}  (Ctrl-C to stop)")
        server.serve_forever()
