# PantryPal - Comprehensive Improvement Plan

## Executive Summary

This plan addresses critical technical issues, feature gaps, and UI/UX improvements for the PantryPal food inventory management application. The implementation is organized into 5 phases, prioritized by impact and dependencies.

**Estimated Timeline:** 6-7 weeks
**Total Tasks:** 16 tasks across 5 phases

---

## Current State Analysis

### ✅ What's Working Well
- Angular 20 standalone architecture
- SQLite/WASM database with OPFS persistence
- Barcode scanning with ZXing
- OCR expiry date extraction with Tesseract
- Basic inventory CRUD operations
- Recipe system with ingredient tracking
- Notification system for expiring items
- PWA support with service worker

### ⚠️ Critical Issues
1. **Missing Database Schema** - Recipe tables not created in migrations
2. **Memory Leak** - NotificationsService polling never stops
3. **No Error Handling** - Silent catches, unhandled HTTP errors
4. **Observable Leaks** - Unsubscribed observables in dialogs
5. **No Duplicate Prevention** - Same barcode can be added multiple times
6. **No Product Caching** - Repeated API calls for same barcode
7. **Poor Resource Cleanup** - Media streams not properly cleaned in barcode scanner

### 📉 Feature Gaps
8. **Oversimplified Recipe Logic** - Meal of the Day shows first recipe, not smart selection
9. **No Search/Filtering** - Cannot sort by expiry, filter by location, or search
10. **No Unit Conversions** - Cannot convert kg/g or l/ml for recipe calculations
11. **No Batch Operations** - Individual INSERT/UPDATE/DELETE causing performance issues
12. **No Analytics** - No consumption tracking or waste reports

### 🎨 UI/UX Issues
13. **Overall UI/UX is "very ugly"** - Needs complete design overhaul with modern, clean interface
    - Basic Material components with minimal styling
    - Poor spacing and visual hierarchy
    - Table-based layouts not mobile-friendly
    - No loading states or skeleton screens
    - Inconsistent design patterns

---

## Implementation Roadmap

### Phase 1: Critical Stability Fixes (Week 1) ⚠️ MUST DO FIRST

#### Task 1.1: Fix Missing Recipe Database Schema
**Complexity:** Simple | **Priority:** Critical
**Files:** `src/app/core/services/db.service.ts`

Add recipe tables to migration method:
```typescript
CREATE TABLE IF NOT EXISTS recipes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  steps TEXT,
  createdAt TEXT,
  updatedAt TEXT
);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  recipeId TEXT NOT NULL,
  ingredientId TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit TEXT NOT NULL,
  PRIMARY KEY (recipeId, ingredientId)
);
```

---

#### Task 1.2: Fix NotificationsService Memory Leak
**Complexity:** Simple | **Priority:** Critical
**Files:** `src/app/core/services/notifications.service.ts`

Add cleanup method:
```typescript
stopPolling() {
  if (this.pollHandle !== null) {
    clearInterval(this.pollHandle);
    this.pollHandle = null;
  }
}

ngOnDestroy() {
  this.stopPolling();
}
```

---

#### Task 1.3: Add Comprehensive Error Handling
**Complexity:** Medium | **Priority:** Critical
**Files:**
- Create: `src/app/core/services/error-handler.service.ts`
- Create: `src/app/core/services/snackbar.service.ts`
- Modify: All dialog components, all list components, `products.service.ts`, `barcode.service.ts`, `ocr.service.ts`

**Implementation:**
1. Create ErrorHandlerService to centralize error handling
2. Create SnackbarService for user feedback (wraps MatSnackBar)
3. Add try-catch blocks to all async operations
4. Add error handlers to all HTTP observable subscriptions
5. Add user-friendly error messages via snackbar
6. Replace all silent `catch {}` blocks with proper error logging

---

#### Task 1.4: Fix Observable Memory Leaks in Dialogs
**Complexity:** Simple | **Priority:** Critical
**Files:** All dialog components (`*-edit.dialog.ts`), all list components

Use `takeUntilDestroyed` for automatic cleanup:
```typescript
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

private destroyRef = inject(DestroyRef);

fetchProduct() {
  this.products.byBarcode(this.model.barcode)
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe((res: any) => { /* ... */ });
}
```

---

#### Task 1.5: Fix Barcode Scanner Resource Cleanup
**Complexity:** Medium | **Priority:** High
**Files:** `src/app/core/services/barcode.service.ts`

Ensure media streams are always cleaned up using `finally` block:
```typescript
async scan(videoEl: HTMLVideoElement): Promise<string | null> {
  let stream: MediaStream | null = null;
  try {
    // ... scanning logic
  } finally {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    if (videoEl.srcObject) {
      videoEl.srcObject = null;
    }
  }
}
```

---

### Phase 2: Data Integrity & Performance (Week 2)

#### Task 2.1: Add Duplicate Barcode Prevention
**Complexity:** Simple | **Priority:** High
**Files:**
- `src/app/core/services/db.service.ts`
- `src/app/features/inventory/inventory-edit/inventory-edit.dialog.ts`

**Implementation:**
1. Add validation in save() method to check for duplicate barcodes
2. Show user-friendly error message if barcode exists
3. Optional: Offer to merge/update existing item instead

```typescript
save() {
  if (this.model.barcode) {
    const existing = this.db.query<any>(
      'SELECT id FROM inventory WHERE barcode = ? AND id != ?',
      [this.model.barcode, this.model.id || '']
    );
    if (existing.length > 0) {
      this.snackbar.error('This barcode is already in use');
      return;
    }
  }
  // ... rest of save logic
}
```

---

#### Task 2.2: Implement Product API Caching
**Complexity:** Medium | **Priority:** High
**Files:**
- Create: `src/app/core/services/cache.service.ts`
- Modify: `src/app/core/services/products.service.ts`

**Implementation:**
1. Create CacheService using IndexedDB (idb library)
2. Update ProductsService to check cache before making HTTP requests
3. Set cache expiration (24 hours default)
4. Cache successful product lookups from Open Food Facts API

Benefits:
- Faster user experience for repeated scans
- Reduced API calls
- Offline support for previously scanned products

---

#### Task 2.3: Implement Batch Database Operations
**Complexity:** Medium | **Priority:** Medium
**Files:** `src/app/core/services/db.service.ts`

Add batch methods for improved performance:
```typescript
execBatch(statements: Array<{ sql: string; params: any[] }>): void {
  this.db.run('BEGIN TRANSACTION');
  try {
    statements.forEach(stmt => {
      const prepared = this.db.prepare(stmt.sql);
      prepared.bind(stmt.params);
      prepared.step();
      prepared.free();
    });
    this.db.run('COMMIT');
    this.persist(); // Single persist at end
  } catch (error) {
    this.db.run('ROLLBACK');
    throw error;
  }
}

bulkInsert(table: string, rows: any[], columns: string[]): void {
  // Helper method for common bulk insert scenario
}
```

Benefits:
- N+1 query reduction
- Single OPFS write instead of multiple
- Atomic transactions (all-or-nothing)
- Better performance for batch operations

---

### Phase 3: Feature Enhancements (Weeks 3-4)

#### Task 3.1: Implement Smart Recipe Selection
**Complexity:** Medium | **Priority:** Medium
**Files:** `src/app/features/recipes/meal-of-day.component.ts`

**Algorithm:**
1. Score each recipe based on:
   - Ingredient availability (10 points per fully available ingredient)
   - Ingredient freshness (bonus 0-5 points for using items expiring soon)
   - Variety (penalty for recently suggested recipes)
2. Sort recipes by score
3. Suggest highest-scoring recipe
4. Show score and missing ingredients to user

Benefits:
- Reduces food waste by prioritizing expiring ingredients
- Better user experience with relevant suggestions
- Variety in meal suggestions

---

#### Task 3.2: Add Search, Filtering, and Sorting
**Complexity:** Medium | **Priority:** High
**Files:**
- `src/app/features/inventory/inventory-list.component.ts`
- `src/app/features/inventory/inventory-list.component.html`
- Similar changes for ingredients and recipes

**Features:**
- **Search:** Filter by ingredient name or barcode
- **Location Filter:** Fridge, Freezer, Pantry, Other
- **Expiry Filter:** All, Expired, Expiring This Week, Expiring This Month
- **Sorting:** By expiry date, name, quantity, location (ascending/descending)
- **Filter badges:** Show active filter count
- **Clear filters:** Reset all filters with one click

---

#### Task 3.3: Implement Unit Conversions
**Complexity:** Medium | **Priority:** Medium
**Files:**
- Create: `src/app/core/services/unit-converter.service.ts`
- Modify: `src/app/features/recipes/meal-of-day.component.ts`, `src/app/features/cart/cart-view.component.ts`

**Supported Conversions:**
- Weight: g ↔ kg ↔ oz ↔ lb
- Volume: ml ↔ l ↔ cup ↔ tbsp ↔ tsp
- Count: pcs (no conversion)

**Methods:**
- `convert(quantity, fromUnit, toUnit): number | null`
- `isEnough(available, availableUnit, needed, neededUnit): boolean`
- `displayQuantity(quantity, unit): string` (auto-converts to better units)
- `calculateShortage(available, availableUnit, needed, neededUnit)`

Benefits:
- Accurate recipe ingredient matching across different units
- Better shopping cart calculations
- Improved user experience (no manual conversion needed)

---

#### Task 3.4: Add Analytics and Reporting
**Complexity:** Complex | **Priority:** Low
**Files:**
- Create: `src/app/core/models/analytics.model.ts`
- Create: `src/app/core/services/analytics.service.ts`
- Create: `src/app/features/analytics/analytics.component.ts`
- Modify: `src/app/core/services/db.service.ts` (add tables)

**New Database Tables:**
```sql
CREATE TABLE IF NOT EXISTS consumption_log (
  id TEXT PRIMARY KEY,
  ingredientId TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit TEXT NOT NULL,
  consumedAt TEXT NOT NULL,
  reason TEXT
);

CREATE TABLE IF NOT EXISTS waste_log (
  id TEXT PRIMARY KEY,
  ingredientId TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit TEXT NOT NULL,
  reason TEXT NOT NULL,
  wastedAt TEXT NOT NULL
);
```

**Features:**
- Track consumption when items are used or removed
- Track waste when items expire or spoil
- Dashboard with charts:
  - Waste percentage
  - Most consumed items
  - Expiration trends over time
  - Savings estimate (based on waste reduction)
- Monthly/yearly reports

---

### Phase 4: UI/UX Overhaul (Weeks 5-6) 🎨

#### Design Philosophy
- Keep Material Design 3 (modern, accessible, well-maintained)
- Enhance with custom color palette, spacing, and typography
- Card-based layouts for mobile-friendliness
- Smooth animations and transitions
- Clear visual hierarchy
- Loading states and skeleton screens

#### Color Scheme
- **Primary:** Green (#4caf50) - Fresh, food-related
- **Accent:** Orange (#ff9800) - Warm, attention-grabbing
- **Warn:** Red (#f44336) - Errors and expired items
- **Light/Dark themes** - Full support with custom palettes

---

#### Task 4.1: Redesign Global Styles and Theme
**Complexity:** Medium | **Priority:** High
**Files:**
- `src/styles.scss`
- `src/app/core/services/theme.service.ts`

**Implementation:**
1. Define custom Material 3 theme with green/orange palette
2. Add CSS custom properties for spacing, border-radius, shadows, transitions
3. Improve typography with system fonts
4. Add utility classes (container, card, fab, etc.)
5. Style Material components globally (tables, forms, dialogs, snackbars)
6. Add smooth animations (fadeIn, etc.)
7. Dark theme support

---

#### Task 4.2: Redesign Home Component and Navigation
**Complexity:** Medium | **Priority:** High
**Files:**
- `src/app/core/pages/home.component.html`
- `src/app/core/pages/home.component.scss`
- `src/app/core/pages/home.component.ts`

**Improvements:**
- Fixed bottom navigation with icons and labels
- Better tab styling with active states
- Smooth transitions between routes
- Responsive design (mobile-first)
- Tooltips for accessibility
- Clean layout with proper spacing

---

#### Task 4.3: Redesign Inventory List with Cards
**Complexity:** Medium | **Priority:** High
**Files:**
- `src/app/features/inventory/inventory-list.component.html`
- `src/app/features/inventory/inventory-list.component.scss`
- `src/app/features/inventory/inventory-list.component.ts`

**Key Changes:**
1. Replace table with card grid layout
2. Add header with title and stats (total items, expiring soon count)
3. Improve filter bar:
   - Search field with icon
   - Filter menu with location and expiry filters
   - Sort menu with multiple options
   - Active filter badges
4. Card design:
   - Location icon avatar
   - Ingredient name as title
   - Detail rows with icons (quantity, expiry, barcode, min stock)
   - Color-coded expiry status (expired = red, expiring soon = orange)
   - Expiry badges
   - Action buttons (Edit, Remove)
   - Hover effects and animations
5. Empty state with illustration and call-to-action
6. FAB (Floating Action Button) for adding items
7. Responsive grid (1 column on mobile, auto-fill on desktop)

---

#### Task 4.4: Redesign Dialogs
**Complexity:** Medium | **Priority:** Medium
**Files:**
- `src/app/features/inventory/inventory-edit/inventory-edit.dialog.html`
- `src/app/features/inventory/inventory-edit/inventory-edit.dialog.scss`
- Similar changes for ingredient and recipe dialogs

**Improvements:**
1. Organized into sections:
   - Basic Information (ingredient, quantity, unit)
   - Storage (location, expiry date)
   - Tracking (barcode, min restock)
2. Section titles with clear visual hierarchy
3. Icon prefixes for all inputs
4. Icon suffix buttons for scanner and OCR
5. Helper text and tooltips
6. Better form layout (multi-column where appropriate)
7. Validation and disabled states
8. Improved header with icon
9. Better action buttons layout

---

#### Task 4.5: Add Loading States and Skeletons
**Complexity:** Simple | **Priority:** Low
**Files:**
- Create: `src/app/shared/components/skeleton/skeleton.component.ts`
- Modify: All list components

**Implementation:**
1. Create reusable SkeletonComponent with shimmer animation
2. Add loading states to all async operations
3. Show skeleton cards while data is loading
4. Smooth transition from skeleton to actual content

---

### Phase 5: Testing and Polish (Week 7)

#### Task 5.1: Add Confirmation Dialogs
**Complexity:** Simple | **Priority:** Medium
**Files:**
- Create: `src/app/shared/dialogs/confirm/confirm.dialog.ts`
- Modify: All components with delete actions

Prevent accidental deletions with confirmation dialogs.

---

#### Task 5.2: Add Keyboard Shortcuts
**Complexity:** Simple | **Priority:** Low
**Files:**
- Create: `src/app/core/services/keyboard.service.ts`
- Modify: List components to register shortcuts

**Shortcuts:**
- `Ctrl+N` - Add new item
- `Ctrl+F` or `/` - Focus search
- `Escape` - Clear search/filters

---

## Implementation Dependencies

```
Phase 1 (Critical Stability)
    ↓
Phase 2 (Data Integrity & Performance)
    ↓
    ├─→ Phase 3 (Feature Enhancements)
    │
    └─→ Phase 4 (UI/UX Overhaul)
    ↓
Phase 5 (Testing and Polish)
```

**Specific Dependencies:**
- Error handling (1.3) must be done before all async operations
- Caching (2.2) should be done before smart recipes (3.1)
- Unit converter (3.3) needed for smart recipes (3.1) and analytics (3.4)
- Theme system (4.1) needed before component redesigns (4.2-4.4)

---

## Complexity Breakdown

| Complexity | Count | Tasks |
|------------|-------|-------|
| **Simple** | 7 | 1.1, 1.2, 1.4, 2.1, 4.5, 5.1, 5.2 |
| **Medium** | 8 | 1.3, 1.5, 2.2, 2.3, 3.1, 3.2, 3.3, all of Phase 4 |
| **Complex** | 1 | 3.4 (Analytics) |

**Total:** 16 tasks

---

## Critical Files for Implementation

1. **`src/app/core/services/db.service.ts`** - Core database; schema fixes, batch operations, migrations
2. **`src/app/features/inventory/inventory-list.component.*`** - Primary UI; search/filter/sort, card layout
3. **`src/styles.scss`** - Global styling; foundation for entire UI/UX overhaul
4. **`src/app/features/inventory/inventory-edit/inventory-edit.dialog.*`** - Critical interaction; error handling, validation
5. **`src/app/core/services/products.service.ts`** - External API; caching, error handling

---

## Testing Strategy

For each phase:
1. **Unit tests** for services (error handling, caching, unit conversion, etc.)
2. **Integration tests** for database operations (transactions, batch operations)
3. **E2E tests** for critical user flows (add item, scan barcode, create recipe)
4. **Manual testing** for UI/UX improvements (responsiveness, animations, accessibility)
5. **Performance testing** for batch operations and caching

---

## Success Criteria

### Phase 1: Critical Stability
- ✅ No console errors
- ✅ No memory leaks (tested with Chrome DevTools)
- ✅ All errors show user-friendly messages
- ✅ Resources cleaned up properly

### Phase 2: Data Integrity
- ✅ No duplicate barcodes allowed
- ✅ Product lookups cached (second scan instant)
- ✅ Batch operations 5x faster than individual

### Phase 3: Features
- ✅ Smart recipe suggestions change daily and prioritize expiring items
- ✅ Search/filter returns results in <100ms
- ✅ Unit conversions accurate across all supported units

### Phase 4: UI/UX
- ✅ Users describe UI as "modern", "clean", "easy to use"
- ✅ Mobile-friendly (tested on multiple screen sizes)
- ✅ Loading states prevent perceived slowness
- ✅ Animations smooth (60fps)

### Phase 5: Polish
- ✅ No accidental deletions
- ✅ Power users can navigate without mouse
- ✅ All features tested and working

---

## Post-Implementation Considerations

### Future Enhancements (Not in this plan)
- **Multi-user support** with authentication
- **Cloud sync** across devices
- **Barcode generation** for homemade items
- **Recipe import** from websites
- **Meal planning calendar**
- **Shopping list export** (PDF, print)
- **Nutrition tracking** from Open Food Facts data
- **Voice input** for hands-free operation
- **Image recognition** for items without barcodes

### Maintenance
- **Regular dependency updates** (Angular, Material, etc.)
- **Database migrations** for schema changes
- **Performance monitoring** (bundle size, load time)
- **User feedback collection** for continuous improvement

---

## Conclusion

This comprehensive plan addresses all identified issues and provides a clear roadmap for transforming PantryPal into a production-ready, user-friendly application. The phased approach ensures stability first, then performance, features, and finally polish.

**Estimated effort:** 6-7 weeks for complete implementation
**Risk level:** Low (well-defined tasks, clear dependencies)
**Impact:** High (addresses critical bugs, adds valuable features, dramatically improves UX)

Ready to proceed with implementation! 🚀

---

---

# Phase 0: Security Audit & Critical Bug Fixes

> **Must be completed before any feature work.** These issues were found during a full codebase audit (2026-02-23). They cover data isolation failures, authorization gaps, SQL-injection vectors, XSS, and memory/resource leaks.

---

## Severity Summary

| Severity | Security | Bug | Total |
|----------|----------|-----|-------|
| HIGH     | 6        | 6   | 12    |
| MEDIUM   | 2        | 8   | 10    |
| LOW      | 2        | 5   | 7     |
| **Total**| **10**   | **19** | **29** |

---

## 0-A — HIGH Security Issues

### SEC-01 — Hardcoded Supabase Credentials in Source
**Files:** `src/environments/environment.ts:4-5`, `src/environments/environment.prod.ts:4-5`

Both dev and prod environment files contain the same Supabase URL and anon key — committed to git history and bundled into the build output.

**Fix:**
- Rotate the current anon key from the Supabase dashboard immediately.
- Add `src/environments/environment*.ts` to `.gitignore` and replace with a placeholder template (`environment.template.ts`).
- Supply values at build time via CI environment variables (`--define` or `angular.json` `fileReplacements` pointing to a generated file).
- Keep a separate key for dev vs prod so future rotation only affects one environment.

---

### SEC-02 — SQL Injection via Interpolated Table/Column Names from Remote Data
**File:** `src/app/core/services/db.service.ts` — lines 290, 438, 456, 477, 553, 571, 594, 612, 625, 672–701
**File:** `src/app/core/services/sync.service.ts` — lines 356–382

Table names and column names from Supabase responses (pulled via `pullChanges()`) are interpolated directly into SQL strings. A compromised Supabase account or schema change could inject malicious identifiers.

**Fix:**
- Define a `ALLOWED_TABLES` constant (allowlist) in `db.service.ts`; validate `table` param at the start of every dynamic-SQL method.
- Define per-table column allowlists and validate `Object.keys(record)` against them in `sync.service.ts` `pullChanges()` before building `setClause`.
- Example guard:
```typescript
const ALLOWED_TABLES = new Set(['inventory', 'ingredients', 'recipes', ...]);
if (!ALLOWED_TABLES.has(table)) throw new Error(`Invalid table: ${table}`);
```

---

### SEC-03 / BUG-21 — XSS via Unescaped Title in Print Window
**File:** `src/app/core/services/export.service.ts` — lines 207–208, 308, 373–375

`generatePrintHtml()` already has an `escapeHtml()` helper but forgets to apply it to the `title` parameter before writing it into `<title>` and `<h1>` tags of the `document.write()` call. A recipe named `<img src=x onerror=alert(1)>` would execute in the print window.

**Fix:**
```typescript
// In generatePrintHtml(), change:
`<title>${title}</title>`
`<h1>${title}</h1>`
// to:
`<title>${this.escapeHtml(title)}</title>`
`<h1>${this.escapeHtml(title)}</h1>`
```

---

### SEC-06 — Household Member RLS Allows Any Member to Delete Others
**File:** `supabase/migrations/002_family_sharing.sql` — lines 54–63

The `household_members` RLS policy is `FOR ALL` for any member, meaning any member can delete any other member row — including the owner.

**Fix (SQL migration to add):**
```sql
-- Drop the overly-permissive policy
DROP POLICY IF EXISTS "Members can manage household" ON household_members;

-- Owners can do everything; members can only read + delete themselves
CREATE POLICY "Members can read household" ON household_members
  FOR SELECT USING (
    user_id = auth.uid()::text
    OR household_id IN (
      SELECT id FROM households WHERE owner_id = auth.uid()::text
    )
  );

CREATE POLICY "Owners can manage members" ON household_members
  FOR ALL USING (
    household_id IN (
      SELECT id FROM households WHERE owner_id = auth.uid()::text
    )
  );

CREATE POLICY "Members can remove themselves" ON household_members
  FOR DELETE USING (user_id = auth.uid()::text);
```

---

### SEC-07 — No Owner Check in `removeMember()`
**File:** `src/app/core/services/household.service.ts` — lines 164–176

Any authenticated member can call `removeMember()` to delete any other member including the owner, with no client-side or server-side ownership check.

**Fix:**
```typescript
async removeMember(memberId: string): Promise<void> {
  const hh = this.household();
  const currentUser = this.auth.user();
  if (!hh || !currentUser) return;
  // Only the owner can remove others; members can only remove themselves
  if (hh.ownerId !== currentUser.id && memberId !== currentUser.id) {
    throw new Error('Only the household owner can remove other members');
  }
  const { error } = await this.supabase.from('household_members').delete()
    .eq('household_id', hh.id).eq('user_id', memberId);
  if (error) throw error;
}
```

---

### SEC-10 — `users` Table Has No RLS in Migration
**File:** `supabase/migrations/001_initial_schema.sql`

The `users` table (read/written by `auth.service.ts` and `user-profile.service.ts`) has no `ENABLE ROW LEVEL SECURITY` statement in either migration. Without RLS, any authenticated user can query all rows via the Supabase REST API.

**Fix (add to a new migration `003_fix_rls.sql`):**
```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile" ON users
  FOR SELECT USING (id = auth.uid()::text);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (id = auth.uid()::text);

CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT WITH CHECK (id = auth.uid()::text);
```

---

## 0-B — HIGH Functional Bugs

### BUG-06 — Inventory List Shows All Users' Data
**File:** `src/app/features/inventory/inventory-list.component.ts` — line 65

```typescript
// WRONG — no userId, no isDeleted filter:
this.rows = this.db.query<InventoryItem>("SELECT * FROM inventory");

// FIX — use the existing queryByUser helper:
this.rows = this.db.queryByUser<InventoryItem>('inventory');
```

---

### BUG-07 — Ingredient List Shows All Users' Data
**File:** `src/app/features/ingredients/ingredient-list.component.ts` — line 60

```typescript
// WRONG:
this.rows = this.db.query<Ingredient>("SELECT * FROM ingredients");

// FIX:
this.rows = this.db.queryByUser<Ingredient>('ingredients');
```

---

### BUG-08 — Recipe List Shows All Users' Data
**File:** `src/app/features/recipes/recipe-list.component.ts` — line 74

```typescript
// WRONG:
this.rows = this.db.query<any>('SELECT id, name FROM recipes');

// FIX:
const userId = this.db.getCurrentUserId();
this.rows = this.db.query<any>(
  'SELECT id, name FROM recipes WHERE userId = ? AND (isDeleted IS NULL OR isDeleted = 0)',
  [userId]
);
```

---

### BUG-11 — `openNutritionEdit()` Pre-Inserts Ghost Ingredient Records
**File:** `src/app/features/ingredients/ingredient-edit/ingredient-edit.dialog.ts` — lines 101–148

When the user clicks "Edit Nutrition" on a **new, unsaved** ingredient, `openNutritionEdit()` assigns a UUID to `this.model.id` and immediately inserts a record to the DB. If the user then closes the main dialog without saving, the incomplete record persists forever.

**Fix:** Remove the pre-insert from `openNutritionEdit()`. Instead, open the nutrition dialog with the in-memory model data. Persist everything (ingredient + nutrition) only in `save()`.

```typescript
async openNutritionEdit(): Promise<void> {
  // Ensure the model has an id for keying purposes only (no DB insert yet)
  if (!this.model.id) this.model.id = uuidv4();

  const ref = this.dialog.open(NutritionEditDialog, {
    data: { ingredientId: this.model.id, saveImmediately: false }
  });
  const result = await ref.afterClosed().toPromise();
  if (result) {
    // Store nutrition data on the model for later saving in save()
    this.pendingNutrition = result;
  }
}
```
Then in `save()`, after inserting/updating the ingredient, also save `this.pendingNutrition` if set.

---

### BUG-12 — Sync Pull Uses Unchecked Remote Column Names in SQL
**File:** `src/app/core/services/sync.service.ts` — lines 356–382

`Object.keys(safeRecords[0])` is used to build `INSERT` and `UPDATE` SQL. Column names come from the Supabase response without any validation.

**Fix:** Maintain a `TABLE_COLUMNS` map in `sync.service.ts` and filter keys against it:
```typescript
const TABLE_COLUMNS: Record<string, string[]> = {
  inventory: ['id', 'ingredientId', 'quantity', 'unit', 'location', 'expiry', 'userId', ...],
  ingredients: ['id', 'name', 'categoryId', 'userId', ...],
  // ... etc
};

// In pullChanges():
const allowedCols = TABLE_COLUMNS[table] ?? [];
const columns = Object.keys(safeRecords[0]).filter(c => allowedCols.includes(c));
```

---

## 0-C — MEDIUM Security Issues

### SEC-05 — Full Database Stored in localStorage (OPFS Fallback)
**File:** `src/app/core/services/db.service.ts` — lines 516–518

When OPFS is unavailable the entire SQLite database is persisted to `localStorage` as a base64 string — accessible to any same-origin script (XSS risk amplifier).

**Fix:** In browsers that support IndexedDB but not OPFS, use IndexedDB as the fallback instead of `localStorage`. The `idb` library provides a Promise-based API. If neither OPFS nor IndexedDB is available, fall back to memory-only and display a warning banner to the user rather than silently writing sensitive data to `localStorage`.

---

### SEC-09 — CORS Proxy Leaks User URLs; One URL Not Encoded
**File:** `src/app/core/services/recipe-import.service.ts` — lines 326–329

Three third-party CORS proxies are tried in sequence. Every recipe URL the user imports is sent to these external services. The `cors-anywhere` entry is not URL-encoded.

**Fix:**
1. URL-encode all three proxy URLs: `` `https://cors-anywhere.herokuapp.com/${encodeURIComponent(url)}` ``.
2. Add basic SSRF protection — reject `localhost`, `127.*`, `10.*`, `192.168.*`, `169.254.*` targets before proxying.
3. Add a privacy notice in the import UI that URLs are forwarded to a third-party proxy.
4. Long-term: consider a backend proxy route in Supabase Edge Functions to avoid leaking URLs.

---

## 0-D — MEDIUM Functional Bugs

### BUG-02 — `db.init()` Sets `initialized = true` Before Async Work Completes
**File:** `src/app/core/services/db.service.ts` — lines 22–41

If `initSqlJs()` throws, `initialized` is already `true` so retries are silently no-ops and the app runs in broken memory-only mode with no way to recover.

**Fix:** Set `initialized = true` only after successful completion; use a separate flag for "init in progress" to prevent concurrent calls:
```typescript
private initPromise: Promise<void> | null = null;

async init(): Promise<void> {
  if (this.initialized) return;
  if (this.initPromise) return this.initPromise;
  this.initPromise = this._doInit().finally(() => { this.initPromise = null; });
  return this.initPromise;
}

private async _doInit(): Promise<void> {
  this.SQL = await initSqlJs(...);
  // ... rest of init
  this.initialized = true;
}
```

---

### BUG-03 — `window.online` Event Listener Accumulates on Every `startAutoSync()` Call
**File:** `src/app/core/services/sync.service.ts` — lines 440–444

`startAutoSync()` adds a new listener on every call without removing the previous one.

**Fix:**
```typescript
private onlineHandler = () => {
  if (this.auth.isAuthenticated() && !this.isSyncingSignal()) this.syncNow();
};

startAutoSync() {
  this.stopAutoSync(); // always clean up first
  window.addEventListener('online', this.onlineHandler);
  // ... setInterval
}

stopAutoSync() {
  window.removeEventListener('online', this.onlineHandler);
  // ... clearInterval
}
```

---

### BUG-09 — `NotificationsService` Queries Without userId; `ngOnDestroy` Never Fires
**File:** `src/app/core/services/notifications.service.ts` — lines 18–19, 52

The inventory query has no `userId` filter. Also, `ngOnDestroy` is declared but `providedIn: 'root'` services are never destroyed, so the polling interval never stops.

**Fix:**
1. Add user filter: `WHERE i.expiry IS NOT NULL AND i.userId = ?` with `[this.db.getCurrentUserId()]`.
2. Remove `ngOnDestroy`; instead call `stopPolling()` from `AuthService` logout flow.

---

### BUG-17 — `VoiceService.destroy()` Permanently Breaks the Service
**File:** `src/app/core/services/voice.service.ts` — lines 296–298

`this.transcriptSubject.complete()` makes the Subject permanently deaf — it can never emit again.

**Fix:** Instead of completing, just stop the recognition session. Re-create the Subjects only if the service needs to be truly reset:
```typescript
destroy() {
  this.recognition?.stop();
  this.recognition = null;
  // DON'T complete subjects — just stop emitting
}
```

---

### BUG-19 — Nutrition Calculation Ignores Unit (Always Treats Quantity as Grams)
**File:** `src/app/core/services/nutrition.service.ts` — lines 165–167

`scaleFactor = quantity / 100` assumes grams. Any ingredient with unit `cup`, `pcs`, `oz`, etc. gets wildly wrong nutrition values.

**Fix:** Implement unit conversion before computing `scaleFactor`. Until a `UnitConverterService` (Task 3.3) exists, add an inline conversion table:
```typescript
const GRAMS: Record<string, number> = {
  g: 1, kg: 1000, oz: 28.35, lb: 453.59,
  ml: 1, l: 1000,           // approximate water density
  cup: 240, tbsp: 15, tsp: 5,
  pcs: null                  // cannot convert — skip
};

function toGrams(qty: number, unit: string): number | null {
  const factor = GRAMS[unit.toLowerCase()];
  return factor != null ? qty * factor : null;
}
```

---

### BUG-20 — Sync Ignores Household Members' `recipe_ingredients`
**File:** `src/app/core/services/sync.service.ts` — lines 295–298

`pullChanges()` for `recipe_ingredients` only fetches rows where the recipe belongs to the current user, never pulling household members' recipe ingredients.

**Fix:** Widen the filter to include household member recipe IDs:
```typescript
const allUserIds = [userId, ...householdMemberIds];
const sharedRecipeIds = this.db.query<{id: string}>(
  `SELECT id FROM recipes WHERE userId IN (${allUserIds.map(() => '?').join(',')})`,
  allUserIds
).map(r => r.id);
if (sharedRecipeIds.length > 0) {
  query = query.in('recipe_id', sharedRecipeIds);
}
```

---

### BUG-13 — `deleteLog()` Has No User Ownership Check
**File:** `src/app/core/services/nutrition.service.ts` — line 370

```typescript
// FIX — add userId filter:
deleteLog(logId: string): void {
  const userId = this.db.getCurrentUserId();
  this.db.exec('DELETE FROM nutrition_logs WHERE id = ? AND userId = ?', [logId, userId]);
}
```

---

### BUG-14 — `updateMeal()` Has No User Ownership Check
**File:** `src/app/core/services/meal-plan.service.ts` — line 152

```typescript
// FIX — include userId in the SELECT and subsequent UPDATE:
const existing = this.db.query<MealPlan>(
  'SELECT * FROM meal_plans WHERE id = ? AND userId = ?',
  [id, this.db.getCurrentUserId()]
);
```

---

### BUG-15 — Guest User Sees Empty Ingredient List (NULL vs IS NULL)
**File:** `src/app/features/recipes/recipe-edit.dialog.ts` — lines 461–469

`WHERE i.userId = ?` with a `null` userId produces `WHERE i.userId = NULL` (never matches in SQL). Use `IS NULL` for unauthenticated users.

**Fix:**
```typescript
const userId = this.db.getCurrentUserId();
const where = userId
  ? `WHERE i.userId = '${userId}' AND ...`
  : `WHERE i.userId IS NULL AND ...`;
// better: use queryByUser helper
```

---

### BUG-23 — Camera Stream Leaks if BarcodeDetector Path Throws
**File:** `src/app/core/services/barcode.service.ts` — lines 22–50

The `while` loop in the `BarcodeDetector` path does not have a `finally` block. If an exception occurs after `getUserMedia()` succeeds, the `MediaStream` is never stopped.

**Fix:** Wrap the entire `BarcodeDetector` code path in `try/finally`:
```typescript
const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
try {
  videoEl.srcObject = stream;
  // ... detection loop
} finally {
  // caller or finally block: stream.getTracks().forEach(t => t.stop());
}
```

---

## 0-E — LOW Issues (Deferred / Nice-to-Have)

| ID | File | Description |
|----|------|-------------|
| SEC-04 | `app.component.ts:177` | `bypassSecurityTrustHtml` on hardcoded SVG — no active risk, but establish policy that this pattern requires code review. |
| SEC-08 | `household-settings.component.ts:69` | Add email regex validation before sending household invitation. |
| BUG-04 | `sync.service.ts:423` | Move sync interval from `window.__pantrypal_sync_interval` to a typed class field. |
| BUG-05 | `auth.guard.ts:14` | Replace polling interval/timeout with a proper reactive pattern (`toObservable(auth.loading)`). |
| BUG-16 | `nutrition-dashboard.component.ts:436` | Add `takeUntilDestroyed` to `afterClosed()` subscriptions for consistency. |
| BUG-18 | `migration.service.ts:111` | Wrap `setTimeout` async callback in `try/catch`; check `auth.isAuthenticated()` before calling `syncNow()`. |
| BUG-22 | `db.service.ts:389` | `execBatch` memOnly path is a no-op for persistence — add a warning comment. |
| BUG-24 | `recipe-import.service.ts:329` | URL-encode the `cors-anywhere` proxy entry. |
| BUG-25 | `db.service.ts:290` | Add comment noting PRAGMA cannot be parameterized; table name must always be a literal. |

---

## Phase 0 — Recommended Execution Order

```
Step 1 (immediate, before any deployment):
  SEC-01 → Rotate Supabase key, add environments to .gitignore

Step 2 (data integrity — fix before adding new data):
  BUG-06 → Add userId filter to inventory list
  BUG-07 → Add userId filter to ingredient list
  BUG-08 → Add userId filter to recipe list
  BUG-09 → Add userId filter to notifications query

Step 3 (security hardening):
  SEC-03/BUG-21 → Escape title in export.service
  SEC-07 → Add owner check to removeMember()
  SEC-06 → Apply household RLS migration (003_fix_rls.sql)
  SEC-10 → Apply users table RLS (same migration)

Step 4 (sync correctness):
  BUG-12 → Whitelist columns in sync pull
  BUG-20 → Fix household recipe_ingredients pull

Step 5 (stability):
  BUG-02 → Fix db.init() race condition
  BUG-03 → Fix online listener leak
  BUG-11 → Fix ghost ingredient pre-insert
  BUG-17 → Fix VoiceService Subject.complete()
  BUG-19 → Fix nutrition unit conversion
  BUG-23 → Fix camera stream leak in BarcodeDetector path

Step 6 (polish — Low severity):
  All 0-E items
```
