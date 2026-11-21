#!/bin/sh
set -eu
cd "$(dirname "$0")"
npm ci --ignore-scripts
node test-paid-post-preview.mjs
node paid-post-preview.mjs paid-post-example.json
