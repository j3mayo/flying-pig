#!/usr/bin/env bash
# Build the app: src/coach/flying-pig.html + src/pwa/platform.js -> index.html (repo root). Then run the tests.
set -euo pipefail
cd "$(dirname "$0")/pwa"
python3 port.py
cp app.html ../../index.html
# JavaScript syntax check of every inline script
node -e "const h=require('fs').readFileSync('app.html','utf8');const re=/<script>([\s\S]*?)<\/script>/g;let m,n=0;while((m=re.exec(h))){new Function(m[1]);n++;}console.log('syntax ok',n)"
if [ -d ../export ]; then node vv2.js | tee /tmp/vv2.out; node vv3.js | tee /tmp/vv3.out; ! grep -q '^FAIL' /tmp/vv2.out /tmp/vv3.out && echo "ALL TESTS PASS"; else echo "No fixtures in src/export: run tools/write_fixtures.py first"; exit 1; fi
