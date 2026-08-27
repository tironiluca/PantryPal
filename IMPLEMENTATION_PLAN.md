# PantryPal - Implementation Plan

Updated 2026-08-27. This document tracks remaining product, security, and release work. Completed repository changes are summarized below; detailed test ownership is maintained in [TEST_MATRIX.md](TEST_MATRIX.md).

## Completed In Repository

- Environment files use placeholders; build-time Supabase values come from variables or CI secrets.
- Recipe import displays and documents third-party proxy privacy limitations.
- Voice subscriptions use `takeUntilDestroyed()`.
- Ingredient barcode failures use shared error handling and have regression coverage.
- Meal-plan, inventory, and meal-of-day relationship lookups use typed, user-scoped `DbService` methods.
- CI runs unit tests, coverage, production build, and Playwright, and uploads test artifacts.
- Playwright covers unauthenticated access to every protected route.

## Current State

PantryPal is an Angular standalone PWA using SQLite/WASM for local data, Supabase for authentication and sync, Material UI, barcode/OCR features, recipes, meal planning, nutrition, household sharing, and IndexedDB product caching.

## Active Backlog

### P0 - Security and Data Protection

#### 1. Remove credentials from environment files

**Status:** Partial

Environment files now contain placeholders only. `npm start` and `npm run build` generate them from `SUPABASE_URL` and `SUPABASE_ANON_KEY`, loaded from a local `.env` or CI variables, and fail when either value is missing.

- Rotate any previously exposed Supabase key in the Supabase project and deployment history.
- Verify the production bundle and git history contain no active credentials after rotation and history cleanup.

#### 2. Make recipe import privacy explicit

**Status:** Partial

Recipe URLs are still sent to third-party CORS proxies, even though encoding and private-network rejection are implemented. A privacy notice is now shown beside the import action.

- Prefer a first-party Supabase Edge Function proxy when the backend is available.

### P1 - Correctness and Resource Safety

#### 3. Finish observable and async error cleanup

**Status:** Partial

Several dialog and voice flows still have unmanaged subscriptions, and some async operations still use silent catches or lack user feedback.

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

**Status:** Partial

The current suite covers only a small subset of the production code. Every production feature and shared service must be covered by both the Vitest unit/component suite and at least one Playwright browser workflow.

- Add Vitest tests for every production TypeScript service, component, guard, model, and utility, including success, failure, loading, empty, and permission branches where applicable.
- Add Playwright coverage for every route and user-facing workflow, including authentication, inventory, ingredients, recipes, meal planning, nutrition, cart, settings, voice, barcode/OCR, household sharing, and error states.
- Link each production area to both a focused Vitest spec and a Playwright spec; new code cannot merge without both.
- CI executes unit tests, coverage, production build, and Playwright and uploads artifacts.
- Protected-route smoke coverage is complete; feature workflow and branch coverage remain listed in `TEST_MATRIX.md`.

#### 9. Define the full-coverage test matrix

**Status:** Partial

Maintain a checked-in test matrix mapping every `src/app` production file and route to its Vitest and Playwright coverage. The matrix must be reviewed whenever production code changes.

- Inventory all production files, routes, dialogs, services, guards, and shared components.
- Record the owning Vitest spec and Playwright spec for each area.
- Track uncovered branches and workflows as backlog entries with an owner and acceptance test.
- Require the matrix and coverage reports in pull-request checks.
- `TEST_MATRIX.md` records current Vitest and Playwright ownership and marks uncovered areas as release blockers.

## External Blockers

- Credential rotation and history cleanup require Supabase and GitHub administration.
- A first-party recipe proxy requires a deployed Supabase Edge Function and its operational policy.
- Analytics requires product approval for metrics, retention, and scope.
- Mobile navigation requires a product decision between the existing toolbar and bottom navigation.

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
