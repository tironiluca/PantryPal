import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatStepperModule } from '@angular/material/stepper';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RecipeImportService, ImportedRecipe, ParsedIngredient } from '../../core/services/recipe-import.service';
import { IngredientMatchingService, IngredientMappingResult } from '../../core/services/ingredient-matching.service';
import { DbService } from '../../core/services/db.service';
import { SnackbarService } from '../../core/services/snackbar.service';

interface IngredientMapping {
  original: ParsedIngredient;
  matchResult: IngredientMappingResult;
  selectedIngredientId: string | null;
  createNew: boolean;
}

@Component({
  selector: 'pp-recipe-import-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatStepperModule,
    MatCardModule,
    MatListModule,
    MatSelectModule,
    MatChipsModule,
    MatTooltipModule,
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>download</mat-icon>
      Import Recipe from Website
    </h2>

    <mat-dialog-content>
      <mat-stepper [linear]="true" #stepper>
        <!-- Step 1: Enter URL -->
        <mat-step [stepControl]="urlForm">
          <ng-template matStepLabel>Enter Recipe URL</ng-template>
          <form [formGroup]="urlForm" class="url-form">
            <mat-form-field appearance="outline">
              <mat-label>Recipe URL</mat-label>
              <input
                matInput
                formControlName="url"
                placeholder="https://example.com/recipe"
                (keyup.enter)="fetchRecipe()"
              />
              <mat-icon matPrefix>link</mat-icon>
              <mat-hint>Paste a link to a recipe from popular cooking websites</mat-hint>
              <mat-error *ngIf="urlForm.get('url')?.hasError('required')">
                URL is required
              </mat-error>
              <mat-error *ngIf="urlForm.get('url')?.hasError('pattern')">
                Please enter a valid URL
              </mat-error>
            </mat-form-field>

            <div class="actions">
              <button mat-raised-button color="primary" (click)="fetchRecipe()" [disabled]="loading() || urlForm.invalid">
                @if (loading()) {
                  <mat-spinner diameter="20"></mat-spinner>
                } @else {
                  <mat-icon>search</mat-icon>
                }
                {{ loading() ? 'Fetching...' : 'Fetch Recipe' }}
              </button>
            </div>

            @if (error()) {
              <div class="error-message">
                <mat-icon>error</mat-icon>
                <span>{{ error() }}</span>
              </div>
            }
          </form>
        </mat-step>

        <!-- Step 2: Review Recipe -->
        <mat-step>
          <ng-template matStepLabel>Review Recipe</ng-template>
          @if (importedRecipe(); as recipe) {
            <div class="recipe-preview">
              @if (recipe.imageUrl) {
                <img [src]="recipe.imageUrl" [alt]="recipe.name" class="recipe-image" />
              }

              <h3>{{ recipe.name }}</h3>

              @if (recipe.description) {
                <p class="description">{{ recipe.description }}</p>
              }

              <div class="recipe-meta">
                @if (recipe.servings) {
                  <mat-chip>
                    <mat-icon>restaurant</mat-icon>
                    {{ recipe.servings }} servings
                  </mat-chip>
                }
                @if (recipe.prepTime) {
                  <mat-chip>
                    <mat-icon>schedule</mat-icon>
                    Prep: {{ recipe.prepTime }} min
                  </mat-chip>
                }
                @if (recipe.cookTime) {
                  <mat-chip>
                    <mat-icon>timer</mat-icon>
                    Cook: {{ recipe.cookTime }} min
                  </mat-chip>
                }
              </div>

              <div class="recipe-source">
                <mat-icon>public</mat-icon>
                <span>Source: {{ recipe.sourceName }}</span>
              </div>

              <h4>Ingredients ({{ recipe.ingredients.length }})</h4>
              <mat-list class="ingredient-list">
                @for (ingredient of recipe.ingredients; track $index) {
                  <mat-list-item>
                    <mat-icon matListItemIcon>check_circle_outline</mat-icon>
                    <span matListItemTitle>{{ ingredient }}</span>
                  </mat-list-item>
                }
              </mat-list>

              <h4>Instructions</h4>
              <div class="instructions">
                {{ recipe.instructions }}
              </div>
            </div>

            <div class="actions">
              <button mat-button (click)="stepper.previous()">
                <mat-icon>arrow_back</mat-icon>
                Back
              </button>
              <button mat-raised-button color="primary" (click)="stepper.next()">
                Next: Map Ingredients
                <mat-icon>arrow_forward</mat-icon>
              </button>
            </div>
          }
        </mat-step>

        <!-- Step 3: Map Ingredients -->
        <mat-step>
          <ng-template matStepLabel>Map Ingredients</ng-template>
          <div class="ingredient-mapping">
            <p class="mapping-hint">
              <mat-icon>info</mat-icon>
              Match imported ingredients to your existing ingredients, or create new ones.
            </p>

            @for (mapping of ingredientMappings(); track $index) {
              <mat-card class="mapping-card" [class.needs-review]="mapping.matchResult.needsReview">
                <mat-card-content>
                  <div class="mapping-header">
                    <span class="original-ingredient">{{ mapping.original.original }}</span>
                    @if (!mapping.matchResult.needsReview && mapping.matchResult.bestMatch) {
                      <mat-chip color="primary">
                        <mat-icon>check</mat-icon>
                        Auto-matched
                      </mat-chip>
                    } @else {
                      <mat-chip color="warn">
                        <mat-icon>warning</mat-icon>
                        Needs Review
                      </mat-chip>
                    }
                  </div>

                  <div class="mapping-details">
                    <span class="quantity-unit">
                      {{ mapping.original.quantity }} {{ mapping.original.unit }}
                    </span>
                    <span class="ingredient-name">{{ mapping.original.ingredientName }}</span>
                  </div>

                  <mat-form-field appearance="outline" class="ingredient-select">
                    <mat-label>Map to Ingredient</mat-label>
                    <mat-select [(value)]="mapping.selectedIngredientId">
                      <mat-option [value]="null">
                        <mat-icon>add</mat-icon>
                        Create New Ingredient
                      </mat-option>
                      @for (match of mapping.matchResult.matches; track match.ingredientId) {
                        <mat-option [value]="match.ingredientId">
                          {{ match.name }}
                          <span class="match-score">({{ match.score }}% match)</span>
                        </mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                </mat-card-content>
              </mat-card>
            }
          </div>

          <div class="actions">
            <button mat-button (click)="stepper.previous()">
              <mat-icon>arrow_back</mat-icon>
              Back
            </button>
            <button mat-raised-button color="primary" (click)="saveRecipe()" [disabled]="saving()">
              @if (saving()) {
                <mat-spinner diameter="20"></mat-spinner>
              } @else {
                <mat-icon>save</mat-icon>
              }
              {{ saving() ? 'Saving...' : 'Save Recipe' }}
            </button>
          </div>
        </mat-step>
      </mat-stepper>
    </mat-dialog-content>
  `,
  styles: [`
    mat-dialog-content {
      width: 90vw;
      max-width: 650px;
      padding: 0;
    }

    .url-form {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-md);
      padding: var(--spacing-md);

      mat-form-field {
        width: 100%;
      }
    }

    .actions {
      display: flex;
      gap: var(--spacing-sm);
      justify-content: flex-end;
      margin-top: var(--spacing-md);
      padding: var(--spacing-md);

      button {
        display: flex;
        align-items: center;
        gap: var(--spacing-xs);

        mat-spinner {
          display: inline-block;
        }
      }
    }

    .error-message {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      padding: var(--spacing-md);
      background-color: rgba(244, 67, 54, 0.1);
      border-left: 4px solid #f44336;
      border-radius: 4px;
      color: #f44336;

      mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
      }
    }

    .recipe-preview {
      padding: var(--spacing-md);

      .recipe-image {
        width: 100%;
        max-height: 300px;
        object-fit: cover;
        border-radius: 8px;
        margin-bottom: var(--spacing-md);
      }

      h3 {
        margin: 0 0 var(--spacing-sm) 0;
        font-size: 24px;
      }

      .description {
        color: var(--text-secondary);
        margin-bottom: var(--spacing-md);
      }

      .recipe-meta {
        display: flex;
        gap: var(--spacing-sm);
        flex-wrap: wrap;
        margin-bottom: var(--spacing-md);

        mat-chip {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);

          mat-icon {
            font-size: 16px;
            width: 16px;
            height: 16px;
          }
        }
      }

      .recipe-source {
        display: flex;
        align-items: center;
        gap: var(--spacing-xs);
        color: var(--text-secondary);
        font-size: 14px;
        margin-bottom: var(--spacing-md);

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
        }
      }

      h4 {
        margin: var(--spacing-lg) 0 var(--spacing-sm) 0;
        font-size: 18px;
        font-weight: 600;
      }

      .ingredient-list {
        padding: 0;
        margin-bottom: var(--spacing-md);

        mat-list-item {
          height: auto;
          min-height: 36px;
          padding: var(--spacing-xs) 0;
        }
      }

      .instructions {
        white-space: pre-wrap;
        padding: var(--spacing-md);
        background-color: var(--surface-color);
        border-radius: 8px;
        line-height: 1.6;
      }
    }

    .ingredient-mapping {
      padding: var(--spacing-md);

      .mapping-hint {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        padding: var(--spacing-md);
        background-color: rgba(33, 150, 243, 0.1);
        border-radius: 4px;
        margin-bottom: var(--spacing-md);
        color: var(--text-secondary);

        mat-icon {
          color: #2196f3;
        }
      }
    }

    .mapping-card {
      margin-bottom: var(--spacing-md);

      &.needs-review {
        border-left: 4px solid #ff9800;
      }

      .mapping-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: var(--spacing-sm);

        .original-ingredient {
          font-weight: 600;
          font-size: 16px;
        }

        mat-chip {
          height: 24px;
          font-size: 12px;

          mat-icon {
            font-size: 14px;
            width: 14px;
            height: 14px;
          }
        }
      }

      .mapping-details {
        display: flex;
        gap: var(--spacing-md);
        margin-bottom: var(--spacing-md);
        font-size: 14px;
        color: var(--text-secondary);

        .quantity-unit {
          font-weight: 600;
        }

        .ingredient-name {
          font-style: italic;
        }
      }

      .ingredient-select {
        width: 100%;

        .match-score {
          margin-left: var(--spacing-xs);
          font-size: 12px;
          color: var(--text-secondary);
        }
      }
    }

    @media (max-width: 768px) {
      mat-dialog-content {
        width: 95vw;
        max-width: 95vw;
      }
    }
  `],
})
export class RecipeImportDialog {
  private fb = inject(FormBuilder);
  private recipeImportService = inject(RecipeImportService);
  private ingredientMatcher = inject(IngredientMatchingService);
  private db = inject(DbService);
  private snackbar = inject(SnackbarService);
  private dialogRef = inject(MatDialogRef<RecipeImportDialog>);

  urlForm!: FormGroup;
  loading = signal(false);
  saving = signal(false);
  error = signal<string | null>(null);
  importedRecipe = signal<ImportedRecipe | null>(null);
  ingredientMappings = signal<IngredientMapping[]>([]);

  constructor() {
    this.urlForm = this.fb.group({
      url: ['', [Validators.required, Validators.pattern(/^https?:\/\/.+/)]],
    });
  }

  async fetchRecipe(): Promise<void> {
    if (this.urlForm.invalid) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const url = this.urlForm.value.url;
      const recipe = await this.recipeImportService.importFromUrl(url);
      this.importedRecipe.set(recipe);

      // Parse ingredients and create mappings
      const parsedIngredients = this.recipeImportService.parseIngredientsWithQuantities(recipe.ingredients);
      const ingredientNames = parsedIngredients.map(p => p.ingredientName);
      const mappingResults = this.ingredientMatcher.mapIngredients(ingredientNames);

      const mappings: IngredientMapping[] = parsedIngredients.map((parsed, index) => ({
        original: parsed,
        matchResult: mappingResults[index],
        selectedIngredientId: mappingResults[index].bestMatch?.ingredientId || null,
        createNew: !mappingResults[index].bestMatch,
      }));

      this.ingredientMappings.set(mappings);
      this.snackbar.success('Recipe fetched successfully!');
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to fetch recipe');
      this.snackbar.error('Failed to fetch recipe');
    } finally {
      this.loading.set(false);
    }
  }

  async saveRecipe(): Promise<void> {
    const recipe = this.importedRecipe();
    if (!recipe) return;

    this.saving.set(true);

    try {
      const userId = this.db.getCurrentUserId();
      if (!userId) {
        throw new Error('User must be authenticated');
      }

      // Create recipe
      const recipeId = `rec-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      const now = new Date().toISOString();

      this.db.exec(
        `INSERT INTO recipes (id, name, steps, userId, sourceUrl, sourceName, importedAt, imageUrl, prepTime, cookTime, servings, version, isDeleted, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          recipeId,
          recipe.name,
          recipe.instructions,
          userId,
          recipe.sourceUrl,
          recipe.sourceName || null,
          now,
          recipe.imageUrl || null,
          recipe.prepTime || null,
          recipe.cookTime || null,
          recipe.servings || null,
          1,
          0,
          now,
          now,
        ]
      );

      // Create or map ingredients
      for (const mapping of this.ingredientMappings()) {
        let ingredientId = mapping.selectedIngredientId;

        // Create new ingredient if needed
        if (!ingredientId) {
          ingredientId = this.ingredientMatcher.createIngredientFromImport(mapping.original.ingredientName);
        }

        // Add to recipe_ingredients
        this.db.exec(
          `INSERT INTO recipe_ingredients (recipeId, ingredientId, quantity, unit, userId, version, isDeleted, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            recipeId,
            ingredientId,
            mapping.original.quantity,
            mapping.original.unit,
            userId,
            1,
            0,
            now,
            now,
          ]
        );
      }

      this.snackbar.success(`Recipe "${recipe.name}" imported successfully!`);
      this.dialogRef.close(recipeId);
    } catch (err) {
      console.error('Failed to save recipe:', err);
      this.snackbar.error('Failed to save recipe');
    } finally {
      this.saving.set(false);
    }
  }
}
