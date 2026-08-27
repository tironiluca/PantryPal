# PantryPal - Current Implementation Plan

This document reflects the repository as of 2026-08-27. Completed work has been removed from the active backlog; the remaining items below are based on the current source and tests.

## Current State

PantryPal is an Angular standalone PWA using SQLite/WASM for local data, Supabase for authentication and sync, Material UI, barcode/OCR features, recipes, meal planning, nutrition, household sharing, and IndexedDB product caching.

## Active Backlog

### P0 - Security and Data Protection

#### 1. Remove credentials from environment files

**Status:** Partial

Environment files now contain placeholders only. `npm start` and `npm run build` generate them from `SUPABASE_URL` and `SUPABASE_ANON_KEY`, loaded from a local `.env` or CI variables, and fail when either value is missing.

- A committed `environment.template.ts` containing placeholders is now available.
- Rotate the exposed Supabase key in the Supabase project and deployment history.
- Verify the production bundle and git history contain no active credentials after rotation and history cleanup.

#### 2. Replace the localStorage database fallback

**Status:** Partial

When OPFS cannot create a writable handle, the database must remain durable without using localStorage.

- IndexedDB fallback is implemented for database reads and writes.
- Use memory-only mode only when both OPFS and IndexedDB are unavailable.
- Expose a user-visible warning when persistence is unavailable. (Implemented via `DbService.persistenceAvailable` and a one-time snackbar.)
- Add focused IndexedDB and memory-only fallback tests.

#### 3. Make recipe import privacy explicit

**Status:** Partial

Recipe URLs are still sent to third-party CORS proxies, even though encoding and private-network rejection are implemented. A privacy notice is now shown beside the import action.

- Add a concise privacy notice beside the import action.
- Document the third-party proxy dependency and its limitations.
- Prefer a first-party Supabase Edge Function proxy when the backend is available.

### P1 - Correctness and Resource Safety

#### 4. Guarantee cleanup for the ZXing scanner path

**Status:** In progress

The native `BarcodeDetector` path uses `finally`; the ZXing fallback relies on dialog cleanup.

- ZXing reader cleanup now runs from timeout, successful decode, and initialization failure paths.
- Keep reader and camera cleanup inside the service promise lifecycle.
- Ensure cancellation and camera-track cleanup are covered as well.
- Add focused scanner cleanup tests with mocked media streams.

#### 5. Finish observable and async error cleanup

**Status:** Partial

Several dialog and voice flows still have unmanaged subscriptions, and some async operations still use silent catches or lack user feedback.

- Apply `takeUntilDestroyed()` to remaining component subscriptions.
- Route HTTP and database failures through the existing error and snackbar services.
- Replace silent catches with intentional handling and logging.
- Add tests for failed product lookup, save, scanner, and dialog workflows.

#### 6. Make duplicate barcode prevention authoritative

**Status:** In progress

The inventory dialog and database now enforce user-scoped barcode uniqueness, including a shared guest scope. Existing databases with conflicting legacy data need cleanup before the index can be created.

- Clean up conflicting legacy barcode rows and verify the migration index.
- Handle constraint errors with a translated user-facing message.
- Add tests for create, edit, guest, and cross-user cases.

### P2 - Feature Completion

#### 7. Finish unit-aware shopping cart calculations

**Status:** In progress

Cart calculations now aggregate compatible units through `UnitConverterService`.

- Keep the conversion behavior covered by focused cart tests.
- Keep incompatible units separate and make the shortage explicit.
- Add cart conversion and mixed-unit tests.

#### 8. Complete list controls and meal-of-day labels

**Status:** Partial

Inventory has filter/sort state and active filter counting, but visible sort controls and some planned details are missing. Ingredient and recipe lists primarily support search. Meal-of-day missing ingredients display IDs rather than resolved names.

- Add visible sort controls and preserve state accessibly.
- Add the missing inventory minimum-stock detail and filter affordances.
- Implement only filters supported by each data model.
- Resolve ingredient IDs to names in meal-of-day output.

#### 9. Decide and implement analytics scope

**Status:** Not started

Consumption/waste tables, an analytics service/model, and an analytics view do not exist.

- Confirm this remains in product scope before implementation.
- If approved, add migrations, ownership/RLS rules, logging at inventory mutation points, and a focused dashboard.
- Define metrics and retention before building charts.

### P3 - UX and Test Coverage

#### 10. Finish responsive navigation and dialog consistency

**Status:** Partial

The refreshed UI is substantially implemented, but mobile navigation does not yet match the planned fixed bottom navigation and dialog patterns are not uniformly complete.

- Decide whether the current mobile toolbar/dropdown replaces bottom navigation.
- Standardize helper text, disabled states, icon affordances, and responsive sections across edit dialogs.
- Fill remaining list loading and empty states where async work is visible.

#### 11. Cover the entire codebase with Vitest and Playwright

**Status:** Not started

The current suite covers only a small subset of the production code. Every production feature and shared service must be covered by both the Vitest unit/component suite and at least one Playwright browser workflow.

- Add Vitest tests for every production TypeScript service, component, guard, model, and utility, including success, failure, loading, empty, and permission branches where applicable.
- Add Playwright coverage for every route and user-facing workflow, including authentication, inventory, ingredients, recipes, meal planning, nutrition, cart, settings, voice, barcode/OCR, household sharing, and error states.
- Link each production area to both a focused Vitest spec and a Playwright spec; new code cannot merge without both.
- Configure Vitest coverage to include all production files and publish text/HTML reports in CI.
- Run Vitest coverage, production build, and Playwright E2E tests in CI; any missing coverage or failing test blocks release.

#### 12. Define the full-coverage test matrix

**Status:** Not started

Maintain a checked-in test matrix mapping every `src/app` production file and route to its Vitest and Playwright coverage. The matrix must be reviewed whenever production code changes.

- Inventory all production files, routes, dialogs, services, guards, and shared components.
- Record the owning Vitest spec and Playwright spec for each area.
- Track uncovered branches and workflows as backlog entries with an owner and acceptance test.
- Require the matrix and coverage reports in pull-request checks.

## Recommended Order

1. Rotate credentials and remove them from build inputs.
2. Complete IndexedDB fallback warnings and tests.
3. Finish scanner cleanup, subscription cleanup, and error handling.
4. Make barcode uniqueness authoritative.
5. Complete cart conversion tests and visible list controls.
6. Decide analytics and navigation scope, then fill the associated Vitest and Playwright tests.

## Verification Commands

```text
npm test
npm run test:coverage
npm run build
npm run e2e
```

The repository requires unit tests, full Vitest coverage, a production build, and Playwright for release. Vitest and Playwright coverage must span the entire production codebase and all routes; security, sync, persistence-fallback, scanner, cart, filtering, and household isolation require dedicated tests rather than incidental coverage.