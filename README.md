# PantryPal Angular 20 Starter

## Quick start
```bash
npm i
npm start
```

Open http://localhost:4200 — you should see an Inventory table with Add/Edit/Delete (CRUD).

### Notes
- This starter includes a **sql.js** (SQLite/wasm) integration with OPFS persistence. If the `sql-wasm.wasm` asset is not found, the app automatically falls back to an in-memory store so you can still try CRUD immediately.
- To enable SQLite persistence, download `sql-wasm.wasm` from the `sql.js` package and place it in `src/assets/`.
- PWA service worker is enabled. Use an HTTPS origin or `localhost` for notifications.
- Recipe import sends the entered URL to the configured third-party CORS proxy so the page can be fetched from the browser. Do not import private, authenticated, or sensitive URLs. The proxy may log requests and can change availability or response content; a first-party Supabase Edge Function should replace it before production use.

### CI requirements
- Configure `SUPABASE_URL` and `SUPABASE_ANON_KEY` as repository or environment secrets. They are required only when generating local or CI environment files and must never be committed.
- The CI workflow runs unit tests, coverage, the production build, and Playwright. See [TEST_MATRIX.md](TEST_MATRIX.md) for current coverage gaps.

### Formatting
Use Prettier to keep Angular templates, TypeScript, and SCSS indented consistently:

```bash
npm run format       # writes fixes
npm run format:check # verifies formatting
```
