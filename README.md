# PantryPal

An offline-first pantry, recipe, meal-planning and nutrition PWA built with Angular 21. Data lives in a local SQLite database (sql.js, persisted to OPFS or IndexedDB) and syncs to Supabase, which also provides authentication and household sharing.

## Quick start

```bash
cp .env.example .env   # fill in SUPABASE_URL and SUPABASE_ANON_KEY
npm ci
npm start
```

Open http://localhost:4200.

- `npm ci` copies `sql-wasm.wasm` into `src/assets/` through the `postinstall` script.
- `npm start` and `npm run build` generate `src/environments/*.ts` from `SUPABASE_URL` and `SUPABASE_ANON_KEY`. The anon (publishable) key is meant to be public; never use the service-role key here.
- The committed environment files contain placeholders. Regenerating them locally changes tracked files, so don't commit those changes.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm start` | Dev server |
| `npm run build` | Production build into `dist/pantrypal` |
| `npm run test:coverage` | Vitest unit tests with the coverage gate from `vitest.config.mts` |
| `npm run e2e` | Playwright end-to-end tests (starts the dev server) |
| `npm run format` / `format:check` | Prettier |

Set `PLAYWRIGHT_CHROMIUM_PATH` to use an already-installed Chromium for `npm run e2e` instead of downloading one.

## CI and deployment

- `.github/workflows/ci.yml` installs from `package-lock.json`, then runs unit tests with coverage, the production build and Playwright. Without repository secrets it uses placeholder Supabase values, which is enough for the build and the mocked tests.
- Vercel deploys `main` to production and supplies the real `SUPABASE_URL`/`SUPABASE_ANON_KEY`.
- Commit `package-lock.json` whenever dependencies change; CI uses `npm ci`.

## Notes

- Recipe import fetches pages through third-party CORS proxies, which can log the requested URL. Don't import private or authenticated URLs. See `IMPLEMENTATION_PLAN.md` (A4) for the planned first-party proxy.
- Supabase schema, policies and setup steps: `supabase/migrations/` and `SUPABASE_SETUP.md`.
- Work in progress and known issues: `IMPLEMENTATION_PLAN.md`. Test ownership: `TEST_MATRIX.md`.
