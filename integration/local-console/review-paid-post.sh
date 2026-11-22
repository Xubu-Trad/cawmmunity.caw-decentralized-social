#!/bin/sh
set -eu
cd "$(dirname "$0")"
npm ci --ignore-scripts
node test-paid-post-preview.mjs
node paid-post-preview.mjs paid-post-example.json
node --test test-console-transport.mjs test-paid-post-signing.mjs
if [ "$#" -gt 0 ]; then
  python3 reproduce-paid-post-live.py "$@"
fi
