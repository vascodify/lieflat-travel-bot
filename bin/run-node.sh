#!/bin/zsh
# Wrapper to execute Node.js using system node (if available) or Antigravity's embedded Node v24 runtime.
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node 2>/dev/null | tail -n 1)/bin:$PATH"

if command -v node >/dev/null 2>&1; then
  exec node "$@"
elif [ -x "/Applications/Antigravity.app/Contents/MacOS/Antigravity" ]; then
  export ELECTRON_RUN_AS_NODE=1
  exec "/Applications/Antigravity.app/Contents/MacOS/Antigravity" "$@"
else
  echo "Error: Neither system node nor Antigravity.app embedded Node runtime was found." >&2
  exit 1
fi
