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
