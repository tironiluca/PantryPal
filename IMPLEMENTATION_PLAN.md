# PantryPal - Implementation Plan

Updated 2026-08-27. This document tracks remaining product, security, and release work. Completed repository changes are summarized below; detailed test ownership is maintained in [TEST_MATRIX.md](TEST_MATRIX.md).

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

**Status:** Partial

Several dialog and voice flows still have unmanaged subscriptions, and some async operations still use silent catches or lack user feedback.

- Apply `takeUntilDestroyed()` to remaining component subscriptions.
- Route HTTP and database failures through the existing error and snackbar services.
- Replace silent catches with intentional handling and logging.
- Add tests for failed product lookup, save, scanner, and dialog workflows.

#### 4. Make duplicate barcode prevention authoritative

**Status:** Partial - local migration coverage complete; create/edit coverage remains

The inventory dialog and database enforce user-scoped barcode uniqueness, including a shared guest scope. Migration now preserves the first legacy row for each scope and clears duplicate barcode values before recreating the active-row index. SQLite-backed migration and guest/user isolation tests pass; inventory create/edit conflict tests remain.

- Add database migration tests and tests for create, edit, guest, and cross-user cases.

#### 5. Move component database access into services

**Status:** Partial - relationship read extraction complete for targeted services

The targeted relationship reads now use typed `DbService` contracts, including meal plans, nutrition, diet advice, notifications, recipe editing, and recipe lists. Remaining direct SQL is primarily mutation, sync, migration, and non-relationship infrastructure code.

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

**Status:** Partial - mocked workflows added; coverage target remains

The refreshed UI is substantially implemented. The existing mobile toolbar/dropdown is the chosen replacement for fixed bottom navigation; dialog patterns and async list states are not uniformly complete.

- Keep the existing mobile toolbar/dropdown as the navigation pattern.
- Standardize helper text, disabled states, icon affordances, and responsive sections across edit dialogs.
- Fill remaining list loading and empty states where async work is visible.

#### 8. Cover the entire codebase with Vitest and Playwright

**Status:** Partial

The suite now includes mocked authenticated and failure-path workflows, but aggregate Vitest coverage is 34.48% statements, 26.86% branches, 38.06% functions, and 34.01% lines across exercised files. Every production feature and shared service still requires deeper branch coverage and the 70%, 80%, then 90% gates.

- Add Vitest tests for every production TypeScript service, component, guard, model, and utility, including success, failure, loading, empty, and permission branches where applicable.
- Add Playwright coverage for every route and user-facing workflow, including authentication, inventory, ingredients, recipes, meal planning, nutrition, cart, settings, voice, barcode/OCR, household sharing, and error states.
- Link each production area to both a focused Vitest spec and a Playwright spec; new code cannot merge without both.
- CI executes unit tests, coverage, production build, and Playwright and uploads artifacts.
- The latest Vitest report measures 52.28% statements, 39.90% branches, 55.82% functions, and 52.64% lines; 90% remains the release target.
- Protected-route smoke coverage is complete; feature workflow and branch coverage remain listed in `TEST_MATRIX.md`.

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

All partial items have been reviewed against repository evidence. Local query ownership and regression coverage were extended in this pass, and duplicate-barcode enforcement is active locally. The remaining partial work is intentionally retained: error-path cleanup, dialog consistency, the full Vitest/Playwright matrix, and migration isolation tests still need implementation. Recipe privacy and realistic authenticated browser coverage also require external proxy deployment, policy, or test-account decisions. The plan is not release-complete until those acceptance gates pass.

## Next Steps

### Local Implementation Queue

1. Add inventory create/edit conflict tests and deepen component/dialog Vitest behavior coverage beyond the current smoke contracts.
2. Inventory every production file in `src/app` and assign a dedicated Vitest and Playwright owner in `TEST_MATRIX.md`.
3. Raise Vitest coverage incrementally to 70%, then 80%, then 90% for statements, branches, functions, and lines; update `TEST_MATRIX.md` with every new spec.
4. Replace route-level failure smoke checks with UI assertions for save, product lookup, scanner, OCR, persistence fallback, permissions, and household isolation.

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
