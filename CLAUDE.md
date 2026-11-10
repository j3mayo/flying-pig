# Healthspan (repo: flying-pig)

A private, single-user training app (running, lifting, physical therapy, health metrics) that runs as an iPhone home-screen web app. Read this first, then `src/BUILD.md`.

## Where everything lives
- **Live app:** https://j3mayo.github.io/flying-pig/ (GitHub Pages serves `index.html` from `main`; a push to `main` deploys in about a minute).
- **Code:** this repo. Edit only the sources below; `index.html` and the cache name in `sw.js` are generated.
  - `src/coach/flying-pig.html`: all UI (Today, Plan, Health, You tabs, workout mode, sheets). One IIFE script.
  - `src/pwa/platform.js`: data layer over Supabase (same API the UI uses: `db.collection(c).doc(id).set/update/delete/onSnapshot`), sign-in screen, photo and PDF text reading.
  - `src/pwa/port.py`: builds `src/pwa/app.html` (head tags, Supabase script, version stamp). `src/build.sh` copies it to `index.html`.
  - `sw.js`, `manifest.webmanifest`, icons: home-screen app shell.
- **Data:** Supabase project `jpfvrrdxulcawectrozo`, one table `public.docs(owner, coll, id, data jsonb, version, updated_at)`, key `(coll, id)`. Row level security is owner-only and sign-ups are locked to the one owner. The client uses only the publishable key. Never add secret keys to this repo.
- **Watch data:** Health Auto Export posts straight to the `hae` edge function (`supabase/functions/hae`), which writes `daily/*` metrics and `runs/*` and stamps `settings/import`. The Google Drive folder ("Flying Pig Export") is the fallback the coach reads only when that stamp is missing or stale.
- **Backend:** `supabase/functions/hae` (watch import), `supabase/functions/push` (web push: subscribe, send, VAPID setup), `supabase/migrations/20261108_push_and_import.sql` (keys in Vault, `fp_secret` readers, the `fp_notify` trigger that pushes on a new `notify/*` row or a request reply). Deploy functions with the Supabase connector; apply the migration in the SQL editor. Secrets are generated inside Postgres and never live in this repo.
- **Nightly coach:** a scheduled cloud task ("Nightly marathon coach review", now firing 9 AM Eastern so last night's sleep counts for today) imports watch data, answers in-app requests, keeps the plan written two weeks ahead, adjusts plan and lifting targets by its rules, and can ship small app changes from this repo. It acts on its own and documents every change (see below). Keep the data shape below compatible with it.

## How changes are documented
- **In the app:** every plan, load, PT or goal change the coach makes gets an `updates/{id}` row (title, detail, date). The You tab shows them.
- **In Claude:** the Claude doc "Healthspan Coach Log" gets one dated entry per review: what was imported, what changed and why, what is being watched, and anything that needs the owner. Code changes are commits on `main` with a one-line message.
- The coach asks the owner only for the race goal, the go/no-go decision, pain that needs a professional, or a request it cannot read. Everything else it does and logs.

## Commands
- Setup once: `npm ci` then `npx playwright install chromium`.
- Build and test: `bash src/build.sh` (build, syntax check, `src/pwa/vv2.js` and `src/pwa/vv3.js` Playwright suites at iPhone size). Push only when it prints `ALL TESTS PASS`. CI (`.github/workflows/ci.yml`) runs the same script on every push.
- Fixtures live in `src/export/` (git-ignored). `build.sh` generates synthetic ones with `src/tools/make_fixtures.py` when the folder is missing. To test against real data instead: run `select coll, id, data from public.docs where coll in ('plan','loads','liftlog','runs','daily','updates','settings')` through the Supabase connector, save the rows as a JSON array, then `python3 src/tools/write_fixtures.py rows.json`. Delete `src/export/` to go back to synthetic fixtures.
- Tests mock Supabase, so no network is needed. Tests must not hard-code values from real data; derive expectations from the seed.

## Data shape (collections in public.docs)
- `plan/{date}`: day plan `{run:{miles,label,detail,long}, lift:"A".."D", extra (PT session text), soccer, note, phase, week}`.
- `loads/{id}`: exercises and current targets per lift day (A to D, P = PT session). Blocks sharing a letter (A1, A2) are supersets; `Prep` and `Finish` blocks list several moves in one name separated by commas.
- `liftlog/{date}` and `liftlog/{date}~{day}`: one row per session; always use each row's `date` and `day` fields.
- `runs/{id}`, `daily/{date}` (check-in, sleep, HRV, RHR, weight, steps, `pt` home PT counts, `warm` run warm-up checks), `requests/{id}`, `updates/{id}`, `settings/*` (goals, goalSuggestions, ptDaily, milestones, gear, main, coach, program, import).
- `notify/{id}` `{title, body, url}`: inserting one sends a push to every `push/{id}` subscription (written by the push function, one per device). The coach writes at most one notify row per run, only when something needs the owner.
- `settings/main` also holds `ref5k` (mm:ss, the 5K reference the pace targets are predicted from), `maxHR`, `easyCap`, optional `weightLb`. `settings/fuel {notes}` and `plan.fuel` (per day) are coach notes shown on the Fuel tab. `runs.awaitWatch`, `daily.soccer`, `daily.ptLog` are described in the coach prompt.

## Design rules
- Dark theme only, "Forge": neutral charcoal greys (equal R, G, B), never tinted. Five tabs: Today, Plan, Health, Fuel, You. Color only for meaning: run green, lift blue, PT red, soccer amber, recovery cyan, body gold; burnt orange (the tint) is for interaction only.
- Layout, "Focus": the one thing that matters most comes first (Up next on Today, today's targets on Fuel, the two trend cards on Health); detail opens in a sheet instead of printing on the page. No icon-plus-heading cards, no nested cards, no rings (labeled bars instead).
- Text in buttons, rows, pills and boxes stays on one line (ellipsis, never wrap). Touch targets at least 44 pt. Works at iPhone SE width (320 and 375) and 390.
- No em dashes anywhere. Health claims in the UI cite peer-reviewed sources only.
- Follows the owner's design-standards skill: sentence case (no uppercase labels), no eyebrow label above a title (state goes in a small text pill), every color meaning also shown as text (no color-only dots), no colored side borders, number readouts 24 px or less, buttons name the action ("Mark done", "Check off"), no instruction text on screen, "No data" instead of a dash for missing values.
- Number-only boxes use `type="number"` (no `inputmode`, so the keyboard can switch); boxes that take text like `35/15` or `28:44` use `type="text"`.
- Never redraw under a focused input (see `queue()`); never commit fixtures, exports or personal data (the repo is public).

## Working agreement
- Show 2 to 4 options before real design choices, then build the whole thing.
- Add a test to `src/pwa/vv3.js` for every new feature, run `bash src/build.sh`, and list what was checked.
- Commit as `Claude <noreply@anthropic.com>`. Small fixes and anything the owner asked for go straight to `main` once `build.sh` passes; say what shipped. Big redesigns, new screens or storage changes: agree the plan with the owner first.
