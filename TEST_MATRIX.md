# PantryPal Test Matrix

This matrix is the release checklist for production areas. A row is complete only when the named Vitest and Playwright workflows exist and pass in CI.

Current measured Vitest coverage is 34.48% statements, 26.86% branches, 38.06% functions, and 34.01% lines across exercised files. The active local gate is 30% statements, 25% branches, 35% functions, and 30% lines; 70%, 80%, and 90% remain staged release gates. Playwright coverage is tracked by workflow and route, not source-line percentage.

| Area                   | Production surface                                           | Vitest coverage                                                                                                               | Playwright coverage                                                                                        | Status    |
| ---------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------- |
| Authentication         | Login, register, forgot password, auth guard                 | `src/app/features/auth/login/login.component.spec.ts`, `src/app/core/guards/auth.guard.spec.ts`                               | `e2e/login.spec.ts`, `e2e/register.spec.ts`, `e2e/forgot-password.spec.ts`, `e2e/protected-routes.spec.ts` | Partial   |
| Persistence            | `DbService`, migrations, fallback storage, product cache     | `src/app/core/services/db.service.spec.ts`, `src/app/core/services/cache.service.spec.ts`                                     | Missing persistence workflow                                                                               | Partial   |
| Inventory              | Inventory list/edit, barcode, OCR                            | `src/app/features/feature-surfaces.spec.ts`, `src/app/features/feature-dialogs.spec.ts`, `src/app/core/services/barcode.service.spec.ts` | `e2e/authenticated-workflows.spec.ts`, `e2e/failure-workflows.spec.ts` | Partial   |
| Ingredients            | Ingredient list/edit, matching                               | `src/app/features/feature-surfaces.spec.ts`, `src/app/features/feature-dialogs.spec.ts`, `src/app/features/ingredients/ingredient-list.component.spec.ts`, `src/app/core/services/ingredient-matching.service.spec.ts` | `e2e/authenticated-workflows.spec.ts` | Partial   |
| Recipes                | Recipe list/edit/import, meal-of-day                         | `src/app/features/feature-surfaces.spec.ts`, `src/app/features/feature-dialogs.spec.ts`, `src/app/core/services/recipe-import.service.spec.ts` | `e2e/authenticated-workflows.spec.ts`, `e2e/failure-workflows.spec.ts` | Partial   |
| Meal planning          | Calendar, add dialog, shopping list                          | `src/app/features/feature-dialogs.spec.ts`                                                                                    | `e2e/authenticated-workflows.spec.ts`, `e2e/failure-workflows.spec.ts` | Partial   |
| Nutrition              | Dashboard, nutrition service                                 | `src/app/features/feature-surfaces.spec.ts`, `src/app/core/services/nutrition.service.spec.ts`                                | `e2e/authenticated-workflows.spec.ts` | Partial   |
| Cart                   | Shopping cart view                                           | `src/app/features/cart/cart-view.component.spec.ts`                                                                           | `e2e/authenticated-workflows.spec.ts` | Partial   |
| Settings               | Profile, language, voice settings                            | `src/app/features/feature-dialogs.spec.ts`, existing language/theme specs                                                      | `e2e/authenticated-workflows.spec.ts`, `e2e/failure-workflows.spec.ts` | Partial   |
| Voice                  | Voice service and overlay, command parser                    | `src/app/features/feature-surfaces.spec.ts`, `src/app/core/services/voice-command.service.spec.ts`                            | `e2e/authenticated-workflows.spec.ts`, `e2e/failure-workflows.spec.ts` | Partial   |
| Household sharing      | Household service and UI                                     | `src/app/features/feature-dialogs.spec.ts`                                                                                    | `e2e/authenticated-workflows.spec.ts`, `e2e/failure-workflows.spec.ts` | Partial   |
| Shared UI              | Confirm, skeleton, snackbar, dialogs                         | `src/app/shared/dialogs/confirm/confirm.dialog.spec.ts`, `src/app/core/services/error-handler.service.spec.ts`                | Missing shared error workflows                                                                             | Partial   |
| Cross-cutting failures | Product lookup, save, scanner, OCR, persistence, permissions | `src/app/core/services/db.service.spec.ts`, `src/app/core/services/barcode.service.spec.ts`, `src/app/features/feature-dialogs.spec.ts` | `e2e/failure-workflows.spec.ts` | Partial   |

## Release Rules

- Every production file under `src/app` must be linked to a focused Vitest spec and a Playwright spec before this matrix is marked complete.
- New production files require a matrix row in the same change.
- CI runs unit tests, coverage, production build, and Playwright tests.
- Uncovered rows remain release blockers.
