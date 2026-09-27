# Sourced by the launcher scripts: makes sure `node` and `npm` are on PATH even when Terminal was opened without a shell profile
# (Node here comes from nvm, which only a profile would put on PATH).
if ! command -v node >/dev/null 2>&1; then
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1
fi
if ! command -v node >/dev/null 2>&1; then
  newest=$(ls -d "$HOME"/.nvm/versions/node/v*/bin 2>/dev/null | sort -V | tail -1)
  [ -n "$newest" ] && export PATH="$newest:$PATH"
fi
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 22.5 or newer is required (this was built on Node 24). Install it from https://nodejs.org and try again."
  read -r -p "Press Return to close." _
  exit 1
fi
