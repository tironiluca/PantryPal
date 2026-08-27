# PantryPal - Current Implementation Plan

This document reflects the repository as of 2026-08-27. Completed work has been removed from the active backlog; the remaining items below are based on the current source and tests.

## Current State

PantryPal is an Angular standalone PWA using SQLite/WASM for local data, Supabase for authentication and sync, Material UI, barcode/OCR features, recipes, meal planning, nutrition, household sharing, and IndexedDB product caching.

## Completed Work

The following items are implemented and are no longer active tasks:

- Database tables and migrations for recipes, meal plans, nutrition, voice, image recognition, sync, and user settings.
- Database initialization de-duplication with `initPromise`.
- User-scoped inventory, ingredient, recipe, and notification queries, including guest `NULL` handling.
- Household member ownership checks and source RLS migration for `users` and `household_members`.
- Print HTML escaping, invitation email validation, proxy URL encoding, and private-network URL rejection.
- Household recipe-ingredient sync, typed auto-sync cleanup, and migration timeout error handling.
- In-memory nutrition staging for new ingredients, voice-service reset behavior, nutrition unit conversion, and batch database helpers.
- Native barcode-detector stream cleanup, product caching with IndexedDB, and reusable skeleton loading states.
- Smart meal-of-day scoring, inventory search/filter/sort logic, confirmation dialogs, and keyboard shortcuts.
- Responsive navigation, refreshed Material theme, and card-based inventory, ingredient, recipe, and cart views.
- Focused unit/component tests for diet advice, ingredient matching, nutrition, unit conversion, login, and confirmation dialogs.

## Active Backlog

### P0 - Security and Data Protection

#### 1. Remove credentials from environment files

**Status:** Outstanding

The Supabase URL and anon key remain in `src/environments/environment.ts` and `environment.prod.ts`. They are ignored for future changes, but remain in the working tree/history.

- Rotate the exposed Supabase key.
- Add a committed `environment.template.ts` containing placeholders only.
- Generate environment files during CI/build with separate development and production values.
- Verify the production bundle and git history contain no active credentials.

#### 2. Allowlist all dynamic SQL identifiers

**Status:** Partial

Remote sync columns are filtered, but `db.service.ts` still interpolates table and column names in query, bulk-operation, delete, sync, and migration helpers. Sync table names also need an explicit allowlist.

- Define one database table allowlist and per-table column allowlists.
- Validate table and column arguments before constructing SQL.
- Reject unknown or empty column lists.
- Add tests covering malicious table and column identifiers from sync data.

#### 3. Replace the localStorage database fallback

**Status:** Outstanding

When OPFS cannot create a writable handle, the complete SQLite database is stored in localStorage.

- Use IndexedDB for the persistence fallback.
- Use memory-only mode only when both OPFS and IndexedDB are unavailable.
- Expose a user-visible warning when persistence is unavailable.

#### 4. Make recipe import privacy explicit

**Status:** Partial

Recipe URLs are still sent to third-party CORS proxies, even though encoding and private-network rejection are implemented.

- Add a concise privacy notice beside the import action.
- Document the third-party proxy dependency and its limitations.
- Prefer a first-party Supabase Edge Function proxy when the backend is available.

### P1 - Correctness and Resource Safety

#### 5. Guarantee cleanup for the ZXing scanner path

**Status:** Partial

The native `BarcodeDetector` path uses `finally`; the ZXing fallback relies on dialog cleanup.

- Keep reader and camera cleanup inside the service promise lifecycle.
- Ensure timeout, successful decode, initialization failure, and cancellation all call `reset()` and stop tracks.
- Add focused scanner cleanup tests with mocked media streams.

#### 6. Finish observable and async error cleanup

**Status:** Partial

Several dialog and voice flows still have unmanaged subscriptions, and some async operations still use silent catches or lack user feedback.

- Apply `takeUntilDestroyed()` to remaining component subscriptions.
- Route HTTP and database failures through the existing error and snackbar services.
- Replace silent catches with intentional handling and logging.
- Add tests for failed product lookup, save, scanner, and dialog workflows.

#### 7. Make duplicate barcode prevention authoritative

**Status:** Partial

The inventory dialog checks for duplicates, but the check is not user-scoped and there is no database constraint.

- Scope the check to the current user, including guest data behavior.
- Add a uniqueness strategy that permits separate users to use the same barcode.
- Handle constraint errors with a translated user-facing message.
- Add tests for create, edit, guest, and cross-user cases.

#### 8. Close the product-cache initialization race

**Status:** Partial

`ProductsService` starts `CacheService.init()` without awaiting it, so an early lookup can race cache setup.

- Make cache readiness part of the lookup flow.
- Add a test proving the first lookup is deterministic during initialization.

### P2 - Feature Completion

#### 9. Finish unit-aware shopping cart calculations

**Status:** Outstanding

Cart calculations still aggregate quantities by raw unit and do not use `UnitConverterService`.

- Convert compatible units before summing stock and calculating shortages.
- Keep incompatible units separate and make the shortage explicit.
- Add cart conversion and mixed-unit tests.

#### 10. Complete list controls and meal-of-day labels

**Status:** Partial

Inventory has filter/sort state and active filter counting, but visible sort controls and some planned details are missing. Ingredient and recipe lists primarily support search. Meal-of-day missing ingredients display IDs rather than resolved names.

- Add visible sort controls and preserve state accessibly.
- Add the missing inventory minimum-stock detail and filter affordances.
- Implement only filters supported by each data model.
- Resolve ingredient IDs to names in meal-of-day output.

#### 11. Decide and implement analytics scope

**Status:** Not started

Consumption/waste tables, an analytics service/model, and an analytics view do not exist.

- Confirm this remains in product scope before implementation.
- If approved, add migrations, ownership/RLS rules, logging at inventory mutation points, and a focused dashboard.
- Define metrics and retention before building charts.

### P3 - UX and Test Coverage

#### 12. Finish responsive navigation and dialog consistency

**Status:** Partial

The refreshed UI is substantially implemented, but mobile navigation does not yet match the planned fixed bottom navigation and dialog patterns are not uniformly complete.

- Decide whether the current mobile toolbar/dropdown replaces bottom navigation.
- Standardize helper text, disabled states, icon affordances, and responsive sections across edit dialogs.
- Fill remaining list loading and empty states where async work is visible.

#### 13. Expand regression coverage

**Status:** Partial

There are no focused tests for most security fixes, database migrations, sync allowlists, caching readiness, barcode cleanup, filtering, cart conversion, or keyboard shortcuts.

- Add unit tests for P0/P1 items before deployment.
- Add migration and sync integration coverage, including household isolation.
- Extend Playwright coverage for inventory, barcode failure, recipe import, and household permissions.
- Run production build, unit tests, and E2E tests in CI.

## Recommended Order

1. Rotate credentials and remove them from build inputs.
2. Harden SQL identifier validation and replace the localStorage fallback.
3. Finish scanner cleanup, subscription cleanup, and error handling.
4. Make barcode uniqueness and product-cache readiness deterministic.
5. Complete cart conversions and visible list controls.
6. Decide analytics and navigation scope, then fill the associated tests.

## Verification Commands

```text
npm test
npm run build
npm run e2e
```

The repository currently has focused unit tests, but security, sync, persistence-fallback, scanner, and broader workflow areas still need dedicated coverage.