# Healthspan app source

- `src/coach/flying-pig.html`: the app UI (views, workout mode, Health page). Edit this for design and feature changes.
- `src/pwa/platform.js`: Supabase data layer, sign-in, attachment text reading.
- `src/pwa/port.py`: builds `src/pwa/app.html` from the two files above (head tags, Supabase wiring, version stamp).
- `src/build.sh`: builds, copies to `index.html` at the repo root, syntax-checks, and runs both test suites.
- `src/pwa/vv2.js`, `src/pwa/vv3.js`: Playwright tests at iPhone size, light and dark. They need fixtures in `src/export/` (git-ignored): export them from Supabase and run `tools/write_fixtures.py`.

Rules for changes: no em dashes; text in buttons, rows and boxes stays on one line (ellipsis, never wrap); touch targets at least 44 pt; neutral iOS look with color only for meaning; keep the data shape of public.docs compatible; never commit fixtures or personal data. Push only when build.sh prints ALL TESTS PASS.
