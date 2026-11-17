# PantryPal - Implementation Plan

Rewritten 2026-11-17 after a full repository review; status updated the same day after the first implementation pass (see **Status**). This replaces the previous backlog. The plan is in four parts:

1. what is broken now;
2. what is still missing from the original plan;
3. what is worth adding to the architecture;
4. what is worth adding to the features.

Test ownership is tracked in [TEST_MATRIX.md](TEST_MATRIX.md).

## How To Read This Plan

Every finding carries an evidence tag:

- **[Verified]** - confirmed from code, CI logs, or the production deployment.
- **[Inferred - confirm live]** - follows from the checked-in SQL or code but has not been run against the live Supabase project, because this environment cannot reach it. Confirm each one before fixing.
- **[External]** - needs a dashboard, account, or product decision outside the repository.

Every work item says where it can be done:

- **Local** - code-only and testable in the repository.
- **Needs Supabase** - needs access to the Supabase project, either the dashboard or SQL.

## Snapshot

PantryPal is an Angular 21 standalone PWA. It stores data locally in SQLite (sql.js) with OPFS or IndexedDB persistence, and uses Supabase for authentication, cloud sync, and household sharing. It is deployed on Vercel from `main`.

Feature breadth is good. Inventory, ingredients, recipes with import, meal planning, cart, nutrition, voice, barcode/OCR, image recognition, export, i18n (en/it), and PWA support all exist. Unit coverage is wide: 745 tests, about 77% statements, run locally.

The weak points are everything that touches the server: sign-in, sync, sharing, account lifecycle, and the CI gate. These need to be made correct before more features are added.

| Area | State at review | State now |
| --- | --- | --- |
| Production sign-in | **Down** - all methods fail on the production site | Still reported down; needs the dashboard checks in B2. Diagnostics and a smoke check are in place |
| CI | **Has never run a test** - all 12 runs failed within about 15 seconds | Green on every push: lint, unit tests with coverage gate, build, Playwright, SQL/RLS tests |
| Cloud sync | Works on the happy path; several silent data-loss paths | Minimum fixes shipped and tested (B3) |
| Household sharing | Likely non-functional end to end | Fixed in code and migration 004; **works once 004 is applied** |
| Password reset | Broken - the email link has no route | Reset page shipped; needs the redirect URL allowlisted |
| Delete account | Reports success but deletes nothing | Fixed via `delete_my_account()`; **works once 004 is applied** |
| Local features | Broadly complete; covered by unit specs | Three more data bugs found and fixed with real-SQLite tests (see Status) |

## Status (2026-11-17, after the first implementation pass)

### Needs the project owner

These cannot be done from the repository. Until they are, the related features stay broken in production.

1. **Restore sign-in (B2).** In the Supabase dashboard, check whether project `yszsmwuremvxajibydem` is paused, and that Vercel's `SUPABASE_URL`/`SUPABASE_ANON_KEY` belong to it. Then check URL Configuration: Site URL, and `https://pantry-vibe-pal.vercel.app/**` in Redirect URLs, which also covers the new `/auth/reset-password` page. Then check the Google and GitHub providers. The browser console now logs the raw Supabase error (`Supabase auth error {name, status, code}`).
2. **Apply migration 004** (`supabase/migrations/004_household_rpcs_and_account_deletion.sql`) in the Supabase SQL editor. It is one transaction and safe to re-run. Households, invitations and account deletion fail with "needs a database update" until it is applied. Never run 003 after it.
3. **Add repository secrets `PROD_SUPABASE_URL` and `PROD_SUPABASE_ANON_KEY`** to enable the scheduled auth smoke check. Until then it passes by skipping. CI never reads these.
4. **Deploy the recipe fetcher** (optional): `supabase functions deploy recipe-proxy`. Until then, recipe import keeps using third-party proxies.
5. **Before the next schema change:** share a schema dump of the live project (`supabase db dump --schema public`). A2 (`household_id`), nutrition sync and version-checked upserts change the sync payload, so they wait for it.

### Item status

| Item | Status | Evidence |
| --- | --- | --- |
| B1 CI | **Done, verified** | CI green on every push since `251a4f4`; Vercel installs with `npm ci` |
| B2 Sign-in | Repository part done; outage **open** | Raw error logging, unreachable-service message, `auth-smoke.yml`. `/auth/callback` was deliberately not added while the outage is undiagnosed |
| B3 Sync | **Minimum fixes done, verified** in unit and real-SQLite tests | Soft deletes, per-row dirty tracking, per-table server cursors, paging, batched apply, partial failure reported, sync on sign-in. Clock skew is fixed only once 004's server `updated_at` trigger is live |
| B4 Password reset | **Done**; link handoff not verified live | Page and e2e use a stored session, not a real recovery link |
| B5 Households | **Done in code**, needs 004 applied | 34 SQL checks pass on three schema variants; old policies reproduced as "infinite recursion detected" |
| B6 Delete account | **Done in code**, needs 004 applied | `DELETE FROM auth.users` inside `delete_my_account()` is untested against the live role's privileges |
| B7 Storage fallback | **Done, verified** | Data stays readable when saving fails; a blocking alert when SQLite cannot start |
| B8 Schema source | **Done** | Migrations are the only schema; 001 no longer drops tables; 003 marked superseded |
| B9 Hygiene | **Mostly done** | Logs untracked, README rewritten, ESLint added. Service messages are still English-only |
| A1 Sync redesign | Partly done (B3, server timestamps in 004) | Version-checked upserts and nutrition sync wait for the live schema |
| A2 Household ownership | Read-only sharing done locally | Members' rows are visible and read-only. Shared editing needs `household_id`, which waits for the live schema |
| A3 Supabase as code | Partly done | Migration tests in CI with an auth shim. Generated types and a local Supabase stack need the live schema |
| A4 Edge Functions | `recipe-proxy` written, **not deployed** | `delete-account` is not needed (it is a database function); `send-invitation` is not started |
| A5 Pipeline | Lint and lockfile done | Dependabot not enabled (it opens PRs); staging project and PR flow need the owner |
| A6 Client structure | Coalesced, serialized writes done | Splitting `DbService` is deferred: specs reach into its internals |
| A7 Headers | **Done**; CSP report-only | Enforced CSP is blocked on testing OCR, image models and recipe import |

### Bugs found and fixed during the pass (not in the original review)

- **Items created while signed in were invisible and never synced.** `createInventoryItem()`/`createIngredient()` inserted rows without a `userId`.
- **Nutrition reads failed on a real database.** `queryByUser()` filtered on `isDeleted`, which the nutrition tables lack. Introduced in `2ae7cd9`; mocked specs hid it.
- **Recipe import dropped steps** grouped in schema.org `HowToSection` blocks.
- **Projects created from the old setup guide lacked synced columns** (`ingredients.barcode`, `sugar_g`; `recipe_ingredients.created_at`, `updated_at`), so every push of those tables would fail. Migration 004 adds them.
- **`updateMeal()` could never report "not found"**, because it treated a row as an array.

Rows already stored on devices without a `userId` (from the first bug) stay as guest data. Adopting them automatically could take another person's guest data on a shared device, so it is left as a decision for the owner.

## Part 1 - Broken Now

Ordered by priority. Fix B1 first, because until CI runs, no other fix is verified by the gate.

### B1. CI has never executed tests - P0, Local + [External] secrets

**Status: Done.**

**[Verified]** All 12 runs of `.github/workflows/ci.yml` on `main` failed within 10-16 seconds. The latest is run 42667749268 on `main@39102e9`, and its job log was inspected. It failed in the "Set up Node.js" step with:

> Dependencies lock file is not found ... Supported file patterns: package-lock.json, npm-shrinkwrap.json, yarn.lock

`/package-lock.json` is listed in `.gitignore:17`, yet the workflow uses `cache: npm` and `npm ci`, and both require a lockfile. The same log shows `SUPABASE_URL` and `SUPABASE_ANON_KEY` as empty. So after the lockfile is fixed, `prebuild` (`scripts/generate-environments.mjs`) would fail next.

The previous plan claimed that "CI runs unit tests, coverage, production build, and Playwright" and that the 70% gate is "enforced in CI". Neither holds. Only the latest log was inspected, but every run's 10-16 second duration is consistent with the same setup failure, since the lockfile has never been committed.

The missing lockfile also explains the earlier `idb` build break. Vercel resolves dependencies fresh on every deploy.

**Fix:**
1. Remove `/package-lock.json` from `.gitignore` and commit the lockfile.
2. Add the two repository secrets [External]. Alternatively, let CI build with placeholder values: the build does not need real credentials, and only the Vercel deploy does.
3. Drop the separate `npm test` step. `test:coverage` already runs the suite.
4. Move `actions/*` to their Node 24 releases; the current versions log a deprecation warning.

**Acceptance:** a green CI run on `main` that executes unit tests, the coverage gate, the build, and Playwright.

### B2. Production sign-in is down - P0, [External] first, then Local

**Status: Repository hardening done; the outage needs the dashboard checks below.**

**[Reported by the owner, not reproduced here]** On https://pantry-vibe-pal.vercel.app/auth/login, email/password, Google, and GitHub all fail. This environment cannot reach Supabase.

**[Verified]** The deployment itself is healthy:
- deployment `dpl_4vM263SQ9DqF5XHHKLaJ5WB92Zg6` is READY;
- the bundle carries real values for project `yszsmwuremvxajibydem`;
- no CSP or Vercel header blocks requests to Supabase;
- the client code paths are correct.

The client-side profile check in `AuthService.ensureUserProfile()` (`auth.service.ts:284`) swallows its own errors, so a missing `users` table cannot break sign-in through that path. Neither checked-in schema defines a trigger on `auth.users`. A server-side trigger added outside the repository could still break sign-up and first OAuth sign-in; check for one in the dashboard.

All three methods fail together, which points at the Supabase project. Check these in order [External]:

1. Is project `yszsmwuremvxajibydem` paused or deleted, or is its publishable key disabled? Free-tier projects pause when idle.
2. Do Vercel's production `SUPABASE_URL`/`SUPABASE_ANON_KEY` point at the project that holds the users, after the 2026-08-27 key rotation?
3. In Authentication → URL Configuration:
   - Site URL is `https://pantry-vibe-pal.vercel.app`.
   - The redirect allowlist contains `https://pantry-vibe-pal.vercel.app/**`.
4. Google and GitHub are enabled. Each provider app's callback is `https://yszsmwuremvxajibydem.supabase.co/auth/v1/callback`.
5. If only email/password still fails, check whether the error is "Invalid login credentials" or "Email not confirmed".

Repository hardening (Local):
- Log the raw Supabase error status and code next to the mapped message in `getAuthErrorMessage()` (`auth.service.ts:330`).
- Return OAuth to a dedicated `/auth/callback` route that waits for the session, instead of `/home` (`auth.service.ts:185`).
- Add a scheduled smoke check that calls `GET /auth/v1/settings` with the production key and fails when the project is paused or the key is rejected.

**Acceptance:**
- All three methods sign in on production and land on `/home`.
- Sign-out returns to `/auth/login`.
- The smoke check passes.

### B3. Sync can silently lose or resurrect data - P0, Local + Needs Supabase

**Status: Minimum fixes done; see Status. Remaining items 6-8 are covered by A1/A2.**

All findings below are **[Verified]** in `sync.service.ts` and `db.service.ts`:

1. **Hard deletes never reach the server.**
   - Recipe, inventory, and ingredient lists call `db.hardDelete()`: `recipe-list.component.ts:154`, `inventory-list.component.ts:308`, `ingredient-list.component.ts:204`.
   - Sync only propagates `isDeleted = 1` tombstones (`db.service.ts:1023`).
   - The deleted row therefore stays in Supabase and comes back on every other device and on a fresh install.
   - Only `meal_plans` uses `softDelete()`.
2. **One global cursor on client clocks.**
   - `getChangedRecords()` selects rows by `updatedAt > <global cursor>` rather than by `updatedAt > syncedAt` (`db.service.ts:1023`). After one failed push, a later successful push of another table moves the cursor past rows that were never uploaded, so those rows are never pushed.
   - `lastSyncTime` is `MAX(syncedAt)` across five tables (`db.service.ts:1162`).
   - The push stamps `updated_at` with the device clock (`sync.service.ts:185`), into a `TEXT` column.
   - Remote rows are pulled with `gt('updated_at', lastSyncTime)` (`sync.service.ts:290`).
   - A device whose clock runs behind, or a household member's push stamped earlier than our cursor, is skipped permanently.
3. **A failed table still advances the cursor.**
   - Per-table errors are collected, but `syncNow()` still sets status `success` (`sync.service.ts:112`).
   - The next push moves `MAX(syncedAt)` forward, so the failed table's remote changes are never pulled.
4. **No pagination.** The pull is a single `select('*')`. Supabase caps responses (1000 rows by default), so large tables are truncated without an error.
5. **Conflict detection is unreachable.**
   - The push runs before the pull (`sync.service.ts:98-103`) and upserts with no version check, so local always overwrites remote.
   - By the time the pull compares versions, the remote row is our own write.
   - `SyncConflictDialog` is never opened anywhere.
6. **Pulled household rows are never shown.** The pull inserts other members' rows with their `userId`, but every local read is scoped to `userId = ?` (`db.service.ts:991`).
7. **Edits to shared rows are never pushed.** `getChangedRecords()` selects only `userId = <me>`.
8. **Nutrition data is not synced.** `nutrition_logs` and `nutrition_goals` exist in Supabase (`001_initial_schema.sql:174,203`) but are not in `SYNC_TABLES`.
9. **Sync timing.**
   - Auto-sync starts from `HomeComponent.ngOnInit`, and its first run is 5 minutes later.
   - The only immediate sync on sign-in comes from `MigrationService` (`migration.service.ts:111`). It runs once per user, only when there is unmigrated guest data. A normal sign-in on a new device waits 5 minutes, or for a manual sync from the sync-status button, before any data appears.
   - The household is loaded only by the settings page (`household-settings.component.ts:44`), so sync pulls only your own data until that page is opened.
10. **Performance.** Every `DbService.exec()` re-serialises and persists the whole database (`db.service.ts:777`), so pulling N rows causes N full writes. `sync_log` is never pruned.

**Fix outline:** see A1, the sync redesign. The minimum fixes to ship first:
- Convert list deletes to `softDelete()`.
- Keep a per-table cursor that advances only on success, and report partial failure as an error.
- Paginate the pull.
- Apply each pull inside `execBatch()`.
- Sync immediately on every sign-in.

**Acceptance:** two-device tests, with mocked Supabase, for each of the following:
- delete propagation;
- clock skew;
- one table failing;
- more than 1000 rows;
- concurrent edits resolved by the documented policy.

### B4. Password reset link has no route - P1, Local

**Status: Done; redirect URL must be allowlisted.**

**[Verified]** `resetPassword()` sends users to `/auth/reset-password` (`auth.service.ts:222`). `auth.routes.ts` defines no such route, so the wildcard redirects to `/auth/login`. `updatePassword()` exists (`auth.service.ts:243`), but nothing in `src/app` calls it, so there is no form anywhere to enter a new password. A user who forgot their password cannot recover the account.

**Fix:** add a reset-password page that waits for the `PASSWORD_RECOVERY` session and calls `updatePassword()`. Add `/auth/reset-password` to the Supabase redirect allowlist [External].

**Acceptance:** Playwright covers the request → link → new password → sign-in flow, with mocked auth.

### B5. Household sharing does not work end to end - P1, Needs Supabase

**Status: Done in code; apply migration 004. The [Inferred] recursion was reproduced locally.**

**[Verified]** in code:
- `acceptInvitation()` has no caller, and there is no invitation inbox.
- `inviteMember()` only inserts a row but reports "Invitation sent" (`household.service.ts:116`). No email is sent.
- `loadHousehold()` ignores query errors, so any RLS failure looks like "no household".
- See B3.6 and B3.9: shared rows are never shown, and the household is loaded too late.

**[Inferred - confirm live]** in `002_family_sharing.sql` and `003_fix_rls.sql`:
- **Creating a household is blocked.** `households` has a `FOR ALL` policy that requires the user to already be a member, and no separate `WITH CHECK` (`002:43`). The creator is not a member yet, so the insert is rejected.
- **The creator cannot add the owner row.** The `household_members` insert depends on reading `households`, which needs membership.
- **RLS recursion.** "Members can read household" on `household_members` queries `household_members` (`003:39`). `households` and `household_members` also query each other. Expect Postgres error 42P17 (infinite recursion in policy).
- **The invitation policy fails or leaks.**
  - It reads `auth.users` (`002:66`), which the `authenticated` role cannot select, so expect "permission denied".
  - The unqualified `household_id` in `hm.household_id = household_id` resolves to `hm.household_id`. The condition is therefore always true for any member of any household.
- **Invitees cannot join.** Only owners may insert into `household_members` (`003:53`).
- **Sharing is read-only and partial.**
  - Shared SELECT policies exist only for `inventory` and `ingredients`.
  - Recipes, recipe ingredients, meal plans, and categories are not shared at all.

**Fix:** see A2, the household ownership model:
- SECURITY DEFINER RPCs (`create_household`, `invite_member`, `accept_invitation`);
- non-recursive membership helpers;
- `auth.jwt() ->> 'email'` in place of `auth.users`;
- an invitation inbox.

**Acceptance:** RLS tests prove each of the following:
- the owner creates a household;
- an invitee sees only their own invitations and can accept;
- members read and edit shared rows;
- outsiders see nothing.

### B6. Delete account deletes nothing - P1, Needs Supabase

**Status: Done in code; apply migration 004.**

**[Inferred - confirm live]** `UserProfileService.deleteAccount()` deletes from `users` (`user-profile.service.ts:230`). Neither migration 003 nor `SUPABASE_SETUP.md` defines a DELETE policy on `users`. RLS therefore filters the row out, the call returns no error, and the app shows "Account deleted successfully".

The comment "cascade will delete all related data" depends on which schema is live (B8):
- Under `SUPABASE_SETUP.md`, data tables reference `users` with `ON DELETE CASCADE`, so a successful delete would cascade. The delete itself is still blocked.
- Under `001_initial_schema.sql`, data tables hold `user_id TEXT` with no foreign key, so nothing would cascade.

The auth user is never removed under either schema, and the client cannot remove it.

**[Verified]** `ProfileComponent` also uses the native `prompt()` for the typed confirmation (`profile.component.ts:166`).

**Fix:**
- A `delete-account` Edge Function that uses the service role and removes all user rows, household memberships, and the auth user.
- Offer a data export first.
- Replace `prompt()` with a typed-confirmation dialog.

**Acceptance:** after deletion, every table holds zero rows for that user id, sign-in fails, and local data is cleared.

### B7. Memory-only persistence fallback is wrong - P2, Local

**Status: Done.**

**[Verified]** When sql.js cannot load, `DbService` falls back to an in-memory map that holds only three tables (`db.service.ts:116`).

The `UPDATE inventory` handler reads the id from `params[9]` (`db.service.ts:751`). The details update passes nine parameters (`db.service.ts:635`), so its id is at index 8. `setInventoryQuantity()` (`:646`) passes three. Editing in fallback mode therefore silently does nothing. Recipes, meal plans, and nutrition simply do not work in fallback mode.

**Fix:**
- Either make the fallback a real in-memory sql.js database, which needs the WASM to load at all,
- or show a blocking "storage unavailable" state instead of a half-working app.

**Acceptance:** the fallback path either round-trips every CRUD operation or is replaced by a tested error state.

### B8. Schema has no single source of truth - P1, Needs Supabase

**Status: Done in the repository; a live schema dump is still needed (Status, item 5).**

**[Verified]**
- `SUPABASE_SETUP.md:52` defines `users` and `UUID` foreign keys to `auth.users`.
- `001_initial_schema.sql` defines `user_id TEXT` with no foreign keys. It also starts with `DROP TABLE ... CASCADE` (`001:9-16`), so re-running it wipes production data.
- No migration creates `users`, although `003` alters it and the app reads it.
- `updated_at` is `TEXT` everywhere and is set by the client.
- It is unknown which schema the live project actually has.

**Fix:** see A3. Pull the live schema with the Supabase CLI, commit it as the baseline migration, and delete the contradicting SQL from `SUPABASE_SETUP.md`.

### B9. Repository hygiene - P3, Local

**Status: Mostly done; service strings are still English-only.**

**[Verified]**
- `ng-serve.err`, `ng-serve.log`, and `ng-watch.log` are tracked.
- `README.md` still describes the "Angular 20 Starter" and manual WASM copying, which `postinstall` now does.
- There is no lint script or ESLint config.
- There are 126 `any` annotations or casts in production code.
- The 21 snackbar literals in services are hard-coded English, despite en/it i18n.

## Part 2 - Missing Against The Original Plan

The original plan (commit `a03aa5e`, 16 tasks) and the security audit (`ee70179`, SEC-01 to SEC-10 and BUG-02 to BUG-25) are mostly delivered.

| Original task | Status | Notes |
| --- | --- | --- |
| 1.1 Recipe schema | Done | |
| 1.2 Notification polling leak | Done | `stopPolling()` |
| 1.3 Error handling | Done | Service messages not localized (B9) |
| 1.4 Observable leaks | Done | `takeUntilDestroyed()` everywhere |
| 1.5 Scanner stream cleanup | Done | |
| 2.1 Duplicate barcode prevention | Done | User-scoped unique index |
| 2.2 Product API cache | Done | IndexedDB via `idb` |
| 2.3 Batch DB operations | Done | Sync applies each table in one transaction; file writes are coalesced (A6) |
| 3.1 Smart meal of the day | Done | Expiry/availability scoring |
| 3.2 Search, filter, sort | Done | Inventory search, location/expiry filters, sort column and direction |
| 3.3 Unit conversions | Done | Used by cart, meal plan, nutrition |
| 3.4 Analytics and waste reports | **Not started** | Needs a product decision (F7) |
| 4.1-4.4 UI redesign | Done | Card grid, theme, bottom sheets; phone-width visual review outstanding |
| 4.5 Loading skeletons | Done | `pp-skeleton` in inventory, recipes, cart |
| 5.1 Confirmation dialogs | Done | Delete account now uses a typed confirmation |
| 5.2 Keyboard shortcuts | Done | |

The original plan's "Future enhancements" list is also mostly built:
- authentication;
- cloud sync;
- recipe import;
- meal calendar;
- shopping list export;
- nutrition;
- voice;
- image recognition.

Two are not. **Barcode generation for homemade items** was never built. **Multi-user/household** is built but broken (B5).

Security audit items were closed in `ee70179`. Spot checks this review found them still in place:
- SEC-03: `escapeHtml` in the export print window;
- SEC-09: encoded proxy URLs;
- BUG-03 and BUG-04: sync listener and interval handling.

The 2026-08-27 plan (`145251f`) also listed four items. Three were confirmed fixed in this review:
- the database fallback now uses IndexedDB, not localStorage;
- `ProductsService` awaits cache readiness before lookups;
- the cart converts units through `UnitConverterService`, and inventory has visible sort controls.

The fourth, meal-of-day missing-ingredient labels showing ids instead of names, was not re-verified.

Items carried over from the previous plan that are still open:
- the third-party recipe CORS proxy (A4);
- the analytics scope decision (F7);
- verifying that git history and the production bundle hold no active credentials after the 2026-08-27 rotation [External];
- a test account, or an approved Supabase mock strategy, for authenticated Playwright workflows [External]. A3's local Supabase stack can satisfy this.

## Part 3 - Worth Having: Architecture

### A1. Sync redesign - High value, Local + Needs Supabase

Replace timestamp-diff sync with an explicit protocol:
- **Server-owned time.**
  - `updated_at timestamptz` is set by a trigger.
  - A per-table monotonic cursor is taken from the server's response, not the client clock.
- **Tombstones everywhere.** Use soft delete only, with a purge job after a retention window.
- **Ordering.** Pull, then push. Each push upserts with `version` as an optimistic check, so a stale write fails and becomes a conflict.
- **One documented conflict policy.** For example, last-writer-wins per row for most tables, with `SyncConflictDialog` reserved for inventory quantity. Wire the dialog or delete it.
- **Efficient apply.** Paginate pulls (`range()`), apply each page in one `execBatch()`, and persist once per sync.
- **Error handling.** Partial failure is reported as an error with a retry, and the cursor never advances past a failed table.
- **Scope.** Add `nutrition_logs`, `nutrition_goals`, and user settings to the synced set.
- **Later.** Optionally use Supabase Realtime for live household updates once the above is correct.

### A2. Household ownership model - High value, Needs Supabase

Add `household_id` to shareable rows instead of inferring sharing from `user_id` joins. With that column:
- RLS becomes simply "a member of this row's household";
- local reads filter by `userId = me OR householdId = myHousehold`;
- edits by any member push under the row's household.

All membership changes go through SECURITY DEFINER RPCs with explicit checks. A helper `is_household_member(hh)` function avoids policy recursion.

### A3. Supabase as code - High value, Needs Supabase

- Initialise the Supabase CLI.
- Pull the live schema as a baseline migration.
- Make migrations additive only, with no `DROP TABLE`.
- Add a seed file and run a local stack for development and Playwright.
- Test RLS with pgTAP, or with SQL tests in CI against a local stack: owner, member, outsider, and invitee for every table.
- Generate TypeScript types (`supabase gen types`) and use them in `SyncService` and `HouseholdService` in place of `any`.

### A4. Edge Functions for server-side duties - Medium-High value, Needs Supabase

- `recipe-proxy`: replaces the third-party CORS proxies (`recipe-import.service.ts:344`). It takes validated public URLs only, with a timeout and a size cap.
- `delete-account`: see B6.
- `send-invitation`: sends a real email with a signed accept link.

### A5. Delivery pipeline and environments - Medium-High value, Local + [External]

- Commit the lockfile and fix CI (B1). Add `ng lint` with ESLint and a `tsc --noEmit` check.
- Add Dependabot or Renovate for dependency updates.
- Make CI a required check on `main` and use PRs, with Vercel preview deploys.
- Add a separate staging Supabase project for previews, so previews never touch production data.
- Add a post-deploy smoke test (B2) and an uptime probe.

### A6. Client structure - Medium value, Local

- Split `DbService` (1,197 lines) into:
  - a connection/persistence layer (OPFS/IndexedDB);
  - schema migrations;
  - per-domain repositories (inventory, recipes, meal plans, nutrition, sync metadata).
- Debounce persistence: write once per transaction or idle tick, not per statement.
- Reduce `any` usage, starting with sync and household code, and use the generated types.
- Move hard-coded service strings to Transloco keys.

### A7. Security headers and observability - Medium value, Local

- Add CSP, `Referrer-Policy`, `Permissions-Policy` (camera and microphone for self only), and `X-Content-Type-Options` in `vercel.json`. Allow only the Supabase, Open Food Facts, and analytics origins.
- Add client error reporting, such as Sentry or a Vercel log drain. Today production failures, including the B2 outage, are invisible until a user reports them.
- Show sync and auth failures in a user-visible status, not only in `console.error`.

## Part 4 - Worth Having: Functional

| # | Feature | Why | Depends on |
| --- | --- | --- | --- |
| F1 | Invitation inbox and join-by-link | Sharing is unusable without it | B5, A2, A4 |
| F2 | Sync status panel: last sync, pending count, errors, retry, conflict review | Users cannot tell whether data is safe | A1 |
| F3 | Shared shopping list with live check-off | Strongest household use case | A1, A2 |
| F4 | Expiry reminders via Web Push, not only while the app is open | Core pantry value; polling only runs in an open tab | A4 |
| F5 | Data export and import (JSON backup), offered before account deletion | Trust, portability, GDPR-style deletion | B6 |
| F6 | First-run onboarding and sample data | Empty app after sign-up; the seed adds one stray "Eggs" row | - |
| F7 | Waste and consumption analytics | Original task 3.4; needs a product decision on metrics and retention | A1 |
| F8 | Barcode/label generation for homemade or bulk items | Original future enhancement, never built | - |
| F9 | Accessibility pass (keyboard, screen reader, contrast) and phone-width visual review | Outstanding from the dialog consistency work | - |
| F10 | Recipe scaling by servings and "cook this" inventory deduction preview | Builds on unit conversions | - |

## Roadmap

1. **Phase 0: unblock** (days)
   - B1: CI green.
   - B2: sign-in restored, plus hardening.
   - B4: reset-password page.
   - B9: hygiene quick wins.
2. **Phase 1: data correctness**
   - A3: Supabase as code, starting from the live schema.
   - B8: single schema source of truth.
   - B3 minimum fixes: soft deletes, per-table cursor, pagination, sync on sign-in.
   - B6: delete-account function.
   - B7: storage fallback decision.
3. **Phase 2: sharing**
   - A2: household ownership model with RPCs and RLS tests.
   - B5 fixes.
   - F1: invitation inbox.
   - A4: `send-invitation`.
4. **Phase 3: platform**
   - A1: full sync redesign, including nutrition sync.
   - A6: `DbService` split and debounced persistence.
   - A7: headers and observability.
   - A4: `recipe-proxy`.
   - A5: staging project and PR flow.
5. **Phase 4: features**
   - F2 to F10, in table order, unless product priorities say otherwise.

## Test Strategy And Coverage

- Unit suite: 824 tests in 65 spec files, run in CI on every push. The latest `npm run test:coverage` measured:

  | Metric | Coverage |
  | --- | --- |
  | Statements | 81.34% |
  | Branches | 73.28% |
  | Functions | 79.33% |
  | Lines | 82% |

  The gate in `vitest.config.mts` is now 78/70/76/78 (statements/branches/functions/lines).
- SQL: `scripts/test-supabase-sql.sh` runs 34 RLS and function checks for migration 004 on three schema starting points, in CI.
- Lowest-covered files, next in line for the 80% stage:

  | File | Statement coverage |
  | --- | --- |
  | `inventory-edit.dialog.ts` | 29% |
  | `db.service.ts` | 32% before this pass; now has a real sql.js harness covering sync, sharing, persistence and nutrition reads |
  | `nutrition.service.ts` | 51% |
  | `products.service.ts` | 58% |
  | `cache.service.ts` | 58% |
  | `ingredient-list.component.ts` | 58% |

- Add tests where current mocks hide real failures:
  - **sync:** two-device scenarios against a local Supabase stack (B3 is covered with mocks and real SQLite so far);
  - **RLS:** done for 004 with an auth shim on plain PostgreSQL; a full local Supabase stack remains (A3);
  - **auth flows** in Playwright: OAuth callback, a real recovery link, sign-out.
- Replace route-level Playwright smoke checks with UI assertions for:
  - save;
  - product lookup;
  - the scanner;
  - OCR;
  - the persistence fallback;
  - permissions;
  - household isolation.
- Keep `TEST_MATRIX.md` current, so that every production file maps to a Vitest spec and a Playwright workflow.
- Targets: 80%, then 90% on all four metrics.

## Acceptance Gate

The project is release-ready when all of the following hold:

1. CI is green on `main` and is a required check.
2. All supported sign-in methods, password reset, and sign-out work on production.
3. Two-device sync tests pass for deletes, skew, partial failure, and more than 1000 rows.
4. RLS tests pass for every table and role.
5. A household can be created, joined, and shared end to end.
6. Account deletion removes all server data and the auth user.
7. The live schema matches the committed migrations.
8. Vitest reaches 90% on all four metrics.
9. The production bundle contains no secret keys. The publishable anon key is expected.

## Verification Commands

```text
npm run lint
npm run test:coverage
npm run build
npm run e2e
node --test supabase/functions/recipe-proxy/validate.test.ts
PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres ./scripts/test-supabase-sql.sh
```

## Appendix - Completed Work (Summary)

- Environment files hold placeholders. Supabase values are generated at build time, and keys were rotated on 2026-08-27.
- Typed, user-scoped `DbService` methods replace all component SQL, and dynamic SQL identifiers are allowlisted.
- User-scoped barcode uniqueness has migration and isolation tests.
- Error handling and subscription cleanup were audited, and failure paths are tested.
- Recipe URL validation rejects private and local network targets, and a proxy privacy notice is shown.
- Every component, dialog, and service has a co-located spec, and the coverage gate was raised to the 70% stage.
- Dialog Save buttons are disabled until required input is valid.
- Fixes for Vercel build and deploy: the `idb` type import, Node 26 engines, and environment variables scoped to every target.
