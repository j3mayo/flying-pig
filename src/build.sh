#!/usr/bin/env bash
# Build the app: src/coach/flying-pig.html + src/pwa/platform.js -> index.html (repo root). Then run the tests.
# Needs python3, Node 22, `npm ci` (Playwright) and `npx playwright install chromium` once.
set -euo pipefail
cd "$(dirname "$0")/pwa"
ROOT=../..
[ -d "$ROOT/node_modules/playwright" ] || { echo "Playwright is not installed: run npm ci && npx playwright install chromium"; exit 1; }
python3 port.py
cp app.html "$ROOT/index.html"
# JavaScript syntax check of every inline script
node -e "const h=require('fs').readFileSync('app.html','utf8');const re=/<script>([\s\S]*?)<\/script>/g;let m,n=0;while((m=re.exec(h))){new Function(m[1]);n++;}console.log('syntax ok',n)"
# Fixtures: real rows exported from Supabase if present, otherwise synthetic ones (neither is ever committed)
if [ ! -d ../export ]; then echo "No fixtures in src/export: writing synthetic ones"; python3 ../tools/make_fixtures.py; fi
OUT="${TMPDIR:-/tmp}"
node vv2.js | tee "$OUT/vv2.out"
node vv3.js | tee "$OUT/vv3.out"
if grep -q '^FAIL' "$OUT/vv2.out" "$OUT/vv3.out"; then echo "TESTS FAILED"; exit 1; fi
echo "ALL TESTS PASS"
