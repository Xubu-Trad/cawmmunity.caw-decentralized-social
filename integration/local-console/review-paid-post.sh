#!/bin/sh
set -eu
cd "$(dirname "$0")"
npm ci --ignore-scripts
node test-paid-post-preview.mjs
node paid-post-preview.mjs paid-post-example.json
node --test test-console-transport.mjs test-paid-post-signing.mjs test-paid-post-delivery.mjs test-recorded-post.mjs
node test-paid-post-by-hash.mjs
node test-paid-post-settlement.mjs
if [ "$#" -gt 0 ]; then
  python3 reproduce-paid-post-live.py "$@"
fi
