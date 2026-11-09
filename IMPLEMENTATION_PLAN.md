# PantryPal - Implementation Plan

Updated 2026-11-09. This document tracks remaining product, security, and release work. Completed repository changes are summarized below; detailed test ownership is maintained in [TEST_MATRIX.md](TEST_MATRIX.md).

## Completed In Repository

- Environment files use placeholders; build-time Supabase values come from variables or CI secrets.
- Recipe import displays and documents third-party proxy privacy limitations.
- Voice subscriptions use `takeUntilDestroyed()`.
- Ingredient barcode failures use shared error handling and have regression coverage.
- Recipe URL validation now rejects private and local network targets before proxy access, with parser and proxy-fallback regression coverage.
- Cache, voice-command, and recipe-import service behavior now have inferred unit specifications.
- Keyboard, language, theme, snackbar, data-event, auth-guard, and error-handler behavior now have inferred unit specifications.
- Meal-plan, inventory, and meal-of-day relationship lookups use typed, user-scoped `DbService` methods.
- Ingredient categories, available ingredients, recipe summaries, and recipe edit loads now use typed, user-scoped `DbService` methods, with focused regression coverage.
- Barcode migration tests now verify first-row preservation, guest/user isolation, active-row uniqueness, and soft-delete behavior.
- Typed relationship methods now cover meal plans, nutrition logs/goals, recipe nutrition, expiring inventory, and diet-advice recipe matching.
- Feature/dialog behavior specs cover inventory, ingredients, recipes, meal planning, nutrition, settings, voice, barcode/OCR, and household validation.
- Mocked authenticated and failure-path Playwright workflows cover protected feature routes, backend/product failures, and permission denial.
- CI runs unit tests, coverage, production build, and Playwright, and uploads test artifacts.
- Playwright covers unauthenticated access to every protected route.

## Current State

PantryPal is an Angular standalone PWA using SQLite/WASM for local data, Supabase for authentication and sync, Material UI, barcode/OCR features, recipes, meal planning, nutrition, household sharing, and IndexedDB product caching.

## Active Backlog

### P0 - Security and Data Protection

#### 1. Remove credentials from environment files

**Status:** Complete

Environment files now contain placeholders only. `npm start` and `npm run build` generate them from `SUPABASE_URL` and `SUPABASE_ANON_KEY`, loaded from a local `.env` or CI variables, and fail when either value is missing.

- Supabase key rotation and credential-bearing history cleanup were completed administratively on 2026-08-27.
- Verify the production bundle and git history contain no active credentials after rotation and history cleanup.

#### 2. Make recipe import privacy explicit

**Status:** Blocked externally

Recipe URLs are still sent to third-party CORS proxies, even though encoding and private-network rejection are implemented. A privacy notice is now shown beside the import action.

- Prefer a first-party Supabase Edge Function proxy when the backend is available.

### P1 - Correctness and Resource Safety

#### 3. Finish observable and async error cleanup

**Status:** Complete

Audited 2026-11-09. Every component `subscribe()` is piped through `takeUntilDestroyed()`, and `SyncService` clears its auto-sync interval and `online` listener in `stopAutoSync()`. Save, scan, OCR, import, and recognition failures all reach the error handler or snackbar. The remaining empty `catch` blocks are deliberate fallbacks (DB not yet ready, malformed URL treated as unsafe, unparseable date shown raw), not swallowed errors.

- Failure-path specs now cover product lookup, save, scanner, OCR, image recognition, recipe import, and sync push/pull.

#### 4. Make duplicate barcode prevention authoritative

**Status:** Complete

The inventory dialog and database enforce user-scoped barcode uniqueness, including a shared guest scope. Migration now preserves the first legacy row for each scope and clears duplicate barcode values before recreating the active-row index. SQLite-backed migration and guest/user isolation tests pass, and `InventoryEditDialog.save()` now has dedicated regression coverage for create and edit barcode conflicts, same-row edits that keep their own barcode, the unique-constraint catch path, and field validation.

- `src/app/features/inventory/inventory-edit/inventory-edit.dialog.spec.ts` covers create/edit barcode conflict, edit-without-conflict, missing-barcode save, unique-constraint catch handling, and ingredient/quantity/minRestock validation.

#### 5. Move component database access into services

**Status:** Complete

No component calls `db.query()` or `db.exec()` any more; relationship reads were extracted earlier, and the remaining mutations now go through named `DbService` methods: `createInventoryItem`, `updateInventoryItemDetails`, `setInventoryQuantity`, `createIngredient`, `updateIngredientDetails`, `createRecipe`, `createImportedRecipe`, `updateRecipeDetails`, `clearRecipeIngredients`, `deleteRecipeIngredientsByRecipe`, and `addRecipeIngredient`. Plain row deletes reuse the existing allowlisted `hardDelete()`. Each method is a domain operation with a fixed table and parameterized values, not a generic SQL passthrough, and each has a spec asserting its SQL and parameter order.

- Direct SQL now lives only in services (sync, migration, persistence, and the domain services such as `NutritionService` and `IngredientMatchingService`).

### P2 - Feature Completion

#### 6. Decide and implement analytics scope

**Status:** Not started

Consumption/waste tables, an analytics service/model, and an analytics view do not exist.

- Confirm this remains in product scope before implementation.
- If approved, add migrations, ownership/RLS rules, logging at inventory mutation points, and a focused dashboard.
- Define metrics and retention before building charts.

### P3 - UX and Test Coverage

#### 7. Finish responsive navigation and dialog consistency

**Status:** Partial - dialog save validation standardized; visual review remains

The existing mobile toolbar/dropdown is the chosen replacement for fixed bottom navigation. Every edit dialog now disables Save until its required input is valid: the ingredient dialog requires a name and the nutrition-goals dialog requires a positive calorie goal, and both previously let invalid rows be saved. The goals dialog's Cancel button now carries the same `close` icon as every other dialog.

- Keep the existing mobile toolbar/dropdown as the navigation pattern.
- List views already show empty states. Their loads are synchronous SQLite reads, so there is no visible async gap that needs a skeleton; revisit only if a list moves to async loading.
- Remaining: a visual pass on helper text and responsive sections across dialogs at phone width, which needs a browser review rather than code inspection.

#### 8. Cover the entire codebase with Vitest and Playwright

**Status:** Partial

Vitest coverage has passed the 70% stage for statements, functions, and lines; branches are at 69.5%. The CI gate in `vitest.config.mts` is now 70/65/70/70 (statements/branches/functions/lines), raised from 30/25/35/30. The 80% and then 90% stages remain.

- Add Vitest tests for every production TypeScript service, component, guard, model, and utility, including success, failure, loading, empty, and permission branches where applicable.
- Add Playwright coverage for every route and user-facing workflow, including authentication, inventory, ingredients, recipes, meal planning, nutrition, cart, settings, voice, barcode/OCR, household sharing, and error states.
- Link each production area to both a focused Vitest spec and a Playwright spec; new code cannot merge without both.
- CI executes unit tests, coverage, production build, and Playwright and uploads artifacts.
- The latest report (`npm run test:coverage`, the CI command) measures 76.81% statements, 69.54% branches, 76.01% functions, and 77.4% lines (745 tests, 63 spec files); 90% remains the release target.
- Every production component, dialog, and service in `src/app` now has a co-located spec. `sync.service.ts` went from 1% to 89% statement coverage. The only files without a dedicated spec are the `*.routes.ts` route tables, `app.config.ts`, `transloco-loader.ts`, `nav-tabs.ts`, and the interface-only models, none of which contain branching logic.
- Lowest statement coverage, which is next for the 80% stage: `inventory-edit.dialog.ts` (29%; its spec only covers `save()`, not product lookup, barcode scan, or OCR), `db.service.ts` (32%; init, OPFS persistence, and migrations need a real sql.js harness), `nutrition.service.ts` (51%), `products.service.ts` (58%), `cache.service.ts` (58%), and `ingredient-list.component.ts` (58%).
- Protected-route smoke coverage is complete; feature workflow and branch coverage remain listed in `TEST_MATRIX.md`.
- Fixed a webpack production-build failure (`export 'DBSchema' was not found in 'idb'`) by importing `DBSchema`/`IDBPDatabase` from `idb` as `import type` in `cache.service.ts`, since they are type-only exports that some `idb` releases do not expose as a runtime binding; without a committed lockfile, a fresh `npm install` could resolve a patch version that broke the untyped import at any time.
- Fixed every Vercel Preview/Development deployment failing with "Node.js Version '20.x' is discontinued" by bumping `package.json`'s `engines.node` (and the CI workflow's `actions/setup-node`) to `26.x`.
- Fixed every Vercel Preview/Development deployment failing with "Missing required environment variable(s): SUPABASE_URL, SUPABASE_ANON_KEY" by extending both variables' Vercel target scope from `production`-only to `production`, `preview`, and `development`.

#### 9. Define the full-coverage test matrix

**Status:** Partial - matrix updated; exhaustive ownership remains

Maintain a checked-in test matrix mapping every `src/app` production file and route to its Vitest and Playwright coverage. The matrix must be reviewed whenever production code changes.

- Inventory all production files, routes, dialogs, services, guards, and shared components.
- Record the owning Vitest spec and Playwright spec for each area.
- Track uncovered branches and workflows as backlog entries with an owner and acceptance test.
- Require the matrix and coverage reports in pull-request checks.
- `TEST_MATRIX.md` records current Vitest and Playwright ownership and marks uncovered areas as release blockers.

## External Blockers

- Recipe proxy owner: deploy a Supabase Edge Function that accepts only validated public recipe URLs, fetches server-side, applies timeouts and response-size limits, and returns the existing parser input. Then configure the client to prefer it and retain the third-party proxy only as an explicitly approved fallback. Acceptance: deployed function, privacy/retention policy, staging validation, and passing proxy failure tests.
- Analytics product owner: decide whether analytics is in scope, define consumption/waste metrics, retention, ownership/RLS, and deletion behavior. Acceptance: recorded decision and approved data contract, or an explicit out-of-scope decision that closes this backlog item.
- Test owner: provide a dedicated test account or approve a deterministic Supabase mock strategy for authenticated Playwright workflows. Acceptance: inventory, ingredients, recipes, meal planning, nutrition, cart, settings, voice, barcode/OCR, and household workflows pass in CI.
- Repository owner: run the local verification tasks that do not require external access: credential scan of the bundle/history, migration and barcode isolation tests, remaining typed query extraction, dialog/error-path tests, matrix updates, and coverage threshold enforcement.

## Partial-Item Conclusion

Reviewed against repository evidence on 2026-11-09. Error-path cleanup (item 3) and component database access (item 5) are complete, every production component and service has a focused spec, and the CI coverage gate enforces the 70% stage. Still partial: the 80% and 90% coverage stages, a visual dialog review at phone width, and Playwright UI assertions in place of route-level smoke checks. Recipe privacy and realistic authenticated browser coverage still require external proxy deployment, policy, or test-account decisions. The plan is not release-complete until those acceptance gates pass.

## Next Steps

### Local Implementation Queue

1. Done - `InventoryEditDialog.save()` now has dedicated create/edit barcode-conflict, validation, and error-path tests in `src/app/features/inventory/inventory-edit/inventory-edit.dialog.spec.ts`.
2. Done - every production component, dialog, and service has a co-located Vitest spec recorded in `TEST_MATRIX.md`.
3. In progress - the 70% coverage stage is reached and enforced in CI. Next is 80%, starting with the files listed under item 8; raise the `vitest.config.mts` gate as each stage is reached.
4. Replace route-level failure smoke checks with UI assertions for save, product lookup, scanner, OCR, persistence fallback, permissions, and household isolation.
5. Fix the memory-only persistence fallback for inventory edits. In `DbService.exec()`, the memory-only `UPDATE inventory` handler reads the row id from `params[9]`, but the update passes nine parameters, so the id is at `params[8]`. When neither OPFS nor IndexedDB is available, editing an inventory item therefore silently does nothing. The same handler also receives `setInventoryQuantity()` (three parameters: quantity, updatedAt, id), so the fix must tell the two statement shapes apart rather than only correcting the index. Add a memory-only round-trip test for both.
6. Replace the native `prompt()` in `ProfileComponent.deleteAccount()` with a typed-confirmation dialog consistent with the app's other confirmations.

### External Decisions And Operations

1. Verify the production bundle and git history contain no active credentials after the completed rotation and cleanup.
2. Decide whether analytics is in scope, then define metrics, retention, ownership/RLS, and acceptance tests before implementing it.
3. Deploy and validate a first-party Supabase Edge Function proxy before removing the third-party recipe proxy.

### Acceptance Gate

The plan is complete when all external decisions are recorded, the matrix has no uncovered production areas, Vitest reaches at least 90% for all four metrics, authenticated and unauthenticated Playwright workflows pass, CI is green, and the production bundle contains no active credentials.

## Verification Commands

```text
npm test
npm run test:coverage
npm run build
npm run e2e
```

The repository requires unit tests, full Vitest coverage, a production build, and Playwright for release. Vitest and Playwright coverage must span the entire production codebase and all routes; security, sync, persistence-fallback, scanner, cart, filtering, and household isolation require dedicated tests rather than incidental coverage.
