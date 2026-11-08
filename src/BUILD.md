# Healthspan app source

- `src/coach/flying-pig.html`: the app UI (views, workout mode, Health page). Edit this for design and feature changes.
- `src/pwa/platform.js`: Supabase data layer, sign-in, attachment text reading.
- `src/pwa/port.py`: builds `src/pwa/app.html` from the two files above (head tags, Supabase wiring, version stamp) and stamps the cache name in `sw.js`.
- `src/build.sh`: builds, copies to `index.html` at the repo root, syntax-checks, and runs both test suites. Prints `ALL TESTS PASS` or `TESTS FAILED`.
- `src/pwa/vv2.js`, `src/pwa/vv3.js`: Playwright tests at iPhone size, light and dark. Playwright comes from `package.json` (`npm ci`, then `npx playwright install chromium` once).
- `src/tools/make_fixtures.py`: writes synthetic, non-personal fixtures to `src/export/` (git-ignored). `build.sh` runs it when that folder is missing, so a fresh clone and CI can run the suites. `src/tools/write_fixtures.py` writes real rows exported from Supabase instead, for checking a change against live data.

- `supabase/functions/hae/index.ts`, `supabase/functions/push/index.ts`: Deno edge functions (watch import, web push). Deploy through the Supabase connector or `supabase functions deploy`; both run with `verify_jwt` off and check their own keys. `supabase/migrations/*.sql`: the database side (Vault keys, secret readers, push trigger); apply in the SQL editor.

Setup on a new machine:

```
npm ci
npx playwright install chromium
bash src/build.sh
```

Rules for changes: no em dashes; text in buttons, rows and boxes stays on one line (ellipsis, never wrap); touch targets at least 44 pt; neutral iOS look with color only for meaning; keep the data shape of public.docs compatible; never commit `src/export` or personal data. Add a test to `vv3.js` for every new feature. Push only when `build.sh` prints `ALL TESTS PASS`; CI runs the same script on every push.
