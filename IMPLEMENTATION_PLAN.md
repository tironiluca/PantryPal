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

#### 2. Make recipe import privacy explicit

**Status:** Partial

Recipe URLs are still sent to third-party CORS proxies, even though encoding and private-network rejection are implemented. A privacy notice is now shown beside the import action.

- Add a concise privacy notice beside the import action.
- Document the third-party proxy dependency and its limitations.
- Prefer a first-party Supabase Edge Function proxy when the backend is available.

### P1 - Correctness and Resource Safety

#### 3. Finish observable and async error cleanup

**Status:** Partial

Several dialog and voice flows still have unmanaged subscriptions, and some async operations still use silent catches or lack user feedback.

- The voice control overlay now uses `takeUntilDestroyed()` for transcript and error streams instead of manually tracking subscriptions.
- Ingredient barcode lookup failures now go through the shared error handler, with regression coverage for the fallback editor flow.
- Apply `takeUntilDestroyed()` to remaining component subscriptions.
- Route HTTP and database failures through the existing error and snackbar services.
- Replace silent catches with intentional handling and logging.
- Add tests for failed product lookup, save, scanner, and dialog workflows.

#### 4. Make duplicate barcode prevention authoritative

**Status:** Partial

The inventory dialog and database enforce user-scoped barcode uniqueness, including a shared guest scope. Migration now preserves the first legacy row for each scope and clears duplicate barcode values before recreating the active-row index.

- Add database migration tests and tests for create, edit, guest, and cross-user cases.

#### 5. Move component database access into services

**Status:** Partial

Some components still construct raw SQL for related data and know the database schema directly. For example, meal-of-day logic now uses `DbService.getIngredientInventory()`, but similar ingredient, inventory, recipe, and meal-plan lookups remain in component code or are duplicated across services.

- Meal-plan ingredient and inventory deduction lookups now use typed, user-scoped `DbService` methods; the existing ingredient inventory lookup is user-scoped as well, with focused service tests.
- Inventory ingredient-name lookups now use a typed, user-scoped `DbService` method with empty-input handling and focused service tests.
- Meal-of-day recipe, ingredient, and expiry lookups now use user-scoped `DbService` methods instead of raw SQL in the component.
- Inventory, ingredient, recipe, and meal-plan relationship queries should be exposed through typed methods on `DbService` or the owning domain service.
- Components should consume service methods and focus on presentation, filtering state, and user interaction rather than SQL construction.
- Preserve user and household scoping when replacing direct queries.
- Add focused service tests for each extracted query and component tests for the resulting behavior.
- Avoid creating a generic query wrapper that merely relocates raw SQL without defining a useful domain contract.

### P2 - Feature Completion

#### 6. Decide and implement analytics scope

**Status:** Not started

Consumption/waste tables, an analytics service/model, and an analytics view do not exist.

- Confirm this remains in product scope before implementation.
- If approved, add migrations, ownership/RLS rules, logging at inventory mutation points, and a focused dashboard.
- Define metrics and retention before building charts.

### P3 - UX and Test Coverage

#### 7. Finish responsive navigation and dialog consistency

**Status:** Partial

The refreshed UI is substantially implemented, but mobile navigation does not yet match the planned fixed bottom navigation and dialog patterns are not uniformly complete.

- Decide whether the current mobile toolbar/dropdown replaces bottom navigation.
- Standardize helper text, disabled states, icon affordances, and responsive sections across edit dialogs.
- Fill remaining list loading and empty states where async work is visible.

#### 8. Cover the entire codebase with Vitest and Playwright

**Status:** Not started

The current suite covers only a small subset of the production code. Every production feature and shared service must be covered by both the Vitest unit/component suite and at least one Playwright browser workflow.

- Add Vitest tests for every production TypeScript service, component, guard, model, and utility, including success, failure, loading, empty, and permission branches where applicable.
- Add Playwright coverage for every route and user-facing workflow, including authentication, inventory, ingredients, recipes, meal planning, nutrition, cart, settings, voice, barcode/OCR, household sharing, and error states.
- Link each production area to both a focused Vitest spec and a Playwright spec; new code cannot merge without both.
- Configure Vitest coverage to include all production files and publish text/HTML reports in CI.
- Run Vitest coverage, production build, and Playwright E2E tests in CI; any missing coverage or failing test blocks release.

#### 9. Define the full-coverage test matrix

**Status:** Not started

Maintain a checked-in test matrix mapping every `src/app` production file and route to its Vitest and Playwright coverage. The matrix must be reviewed whenever production code changes.

- Inventory all production files, routes, dialogs, services, guards, and shared components.
- Record the owning Vitest spec and Playwright spec for each area.
- Track uncovered branches and workflows as backlog entries with an owner and acceptance test.
- Require the matrix and coverage reports in pull-request checks.

## Recommended Order

1. Rotate credentials and remove them from build inputs.
2. Finish subscription cleanup and error handling.
3. Add authoritative barcode migration tests.
4. Move remaining component database access into typed service methods.
5. Decide analytics and navigation scope, then fill the associated Vitest and Playwright tests.

## Verification Commands

```text
npm test
npm run test:coverage
npm run build
npm run e2e
```

The repository requires unit tests, full Vitest coverage, a production build, and Playwright for release. Vitest and Playwright coverage must span the entire production codebase and all routes; security, sync, persistence-fallback, scanner, cart, filtering, and household isolation require dedicated tests rather than incidental coverage.