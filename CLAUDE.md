# Healthspan (repo: flying-pig)

A private, single-user training app (running, lifting, physical therapy, health metrics) that runs as an iPhone home-screen web app. Read this first, then `src/BUILD.md`.

## Where everything lives
- **Live app:** https://j3mayo.github.io/flying-pig/ (GitHub Pages serves `index.html` from `main`; a push to `main` deploys in about a minute).
- **Code:** this repo. Edit only the sources below; `index.html` is generated.
  - `src/coach/flying-pig.html`: all UI (Today, Plan, Health, You tabs, workout mode, sheets). One IIFE script.
  - `src/pwa/platform.js`: data layer over Supabase (same API the UI uses: `db.collection(c).doc(id).set/update/delete/onSnapshot`), sign-in screen, photo and PDF text reading.
  - `src/pwa/port.py`: builds `src/pwa/app.html` (head tags, Supabase script, version stamp). `src/build.sh` copies it to `index.html`.
  - `sw.js`, `manifest.webmanifest`, icons: home-screen app shell.
- **Data:** Supabase project `jpfvrrdxulcawectrozo`, one table `public.docs(owner, coll, id, data jsonb, version, updated_at)`, key `(coll, id)`. Row level security is owner-only and sign-ups are locked to the one owner. The client uses only the publishable key. Never add secret keys to this repo.
- **Watch data:** Apple Health exports land in a Google Drive folder ("Flying Pig Export") and are imported nightly.
- **Nightly coach:** a scheduled task ("Nightly marathon coach review", midnight Eastern) reads and writes `public.docs`, adjusts the plan, answers in-app requests, and can ship small app changes from this repo. Keep the data shape below compatible with it.

## Commands
- Build and test: `bash src/build.sh` (build, syntax check, `src/pwa/vv2.js` and `src/pwa/vv3.js` Playwright suites at iPhone size). Push only when it prints `ALL TESTS PASS`.
- Test fixtures live in `src/export/` (git-ignored). To make them: run `select coll, id, data from public.docs where coll in ('plan','loads','liftlog','runs','updates','settings')` through the Supabase connector, save the rows as a JSON array, then `python3 src/tools/write_fixtures.py rows.json`.
- Playwright and Chromium are expected to be installed; tests mock Supabase, so no network is needed.

## Data shape (collections in public.docs)
- `plan/{date}`: day plan `{run:{miles,label,detail,long}, lift:"A".."D", extra (PT session text), soccer, note, phase, week}`.
- `loads/{id}`: exercises and current targets per lift day (A to D, P = PT session). Blocks sharing a letter (A1, A2) are supersets.
- `liftlog/{date}` and `liftlog/{date}~{day}`: one row per session; always use each row's `date` and `day` fields.
- `runs/{id}`, `daily/{date}` (check-in, sleep, HRV, RHR, weight, steps, `pt` home PT counts, `warm` run warm-up checks), `requests/{id}`, `updates/{id}`, `settings/*` (goals, goalSuggestions, ptDaily, milestones, gear, main, coach).

## Design rules
- Dark theme only. Four tabs: Today, Plan, Health, You. Color only for meaning: run green, lift blue, PT purple, soccer orange, recovery teal, body yellow.
- Text in buttons, rows, pills and boxes stays on one line (ellipsis, never wrap). Touch targets at least 44 pt. Works at iPhone SE width (320 and 375) and 390.
- No em dashes anywhere. Health claims in the UI cite peer-reviewed sources only.
- Number-only boxes use `type="number"` (no `inputmode`, so the keyboard can switch); boxes that take text like `35/15` or `28:44` use `type="text"`.
- Never redraw under a focused input (see `queue()`); never commit fixtures, exports or personal data (the repo is public).

## Working agreement
- Show 2 to 4 options before real design choices, then build the whole thing.
- Add a test to `src/pwa/vv3.js` for every new feature, run `bash src/build.sh`, and list what was checked.
- Commit as `Claude <noreply@anthropic.com>`; push to `main` only after the owner says yes (the nightly task may push small fixes it was asked for).
