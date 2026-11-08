# Healthspan

Private, single-user training app (marathon build, lifting, physical therapy, health metrics) served at https://j3mayo.github.io/flying-pig/ as an iPhone home-screen web app.

- `CLAUDE.md`: how the app is built, where the data lives, and how the nightly coach works.
- `src/BUILD.md`: build and test steps.

```
npm ci
npx playwright install chromium
bash src/build.sh
```

The repo holds no personal data. Test fixtures are generated (`src/tools/make_fixtures.py`) and git-ignored.
