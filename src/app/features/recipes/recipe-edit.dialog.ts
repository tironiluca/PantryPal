import { Component, Inject, inject, signal, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { DbService } from '../../core/services/db.service';
import { SnackbarService } from '../../core/services/snackbar.service';
import { DataEventsService } from '../../core/services/data-events.service';

interface Ingredient {
  id: string;
  name: string;
  category: string;
}

@Component({
  standalone: true,
  selector: 'pp-recipe-edit',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatAutocompleteModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    TranslocoModule,
  ],
  template: `
    <ng-container *transloco="let t">
      <h2 mat-dialog-title>
        <mat-icon>{{ isEditMode() ? 'edit' : 'add' }}</mat-icon>
        {{ isEditMode() ? t('recipes.editRecipe') : t('recipes.addRecipe') }}
      </h2>

      <mat-dialog-content>
        <form [formGroup]="recipeForm" class="recipe-form">
          <mat-form-field appearance="outline">
            <mat-label>{{ t('recipes.recipeName') }}</mat-label>
            <input matInput formControlName="name" [placeholder]="t('recipes.recipeNamePlaceholder')" />
            <mat-icon matPrefix>restaurant_menu</mat-icon>
            @if (recipeForm.get('name')?.hasError('required')) {
              <mat-error>{{ t('recipes.recipeNameRequired') }}</mat-error>
            }
          </mat-form-field>

          <div class="details-row">
            <mat-form-field appearance="outline">
              <mat-label>{{ t('recipes.servings') }}</mat-label>
              <input matInput type="number" formControlName="servings" min="1" />
              <mat-icon matPrefix>people</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>{{ t('recipes.prepTime') }}</mat-label>
              <input matInput type="number" formControlName="prepTime" min="0" />
              <mat-icon matPrefix>schedule</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>{{ t('recipes.cookTime') }}</mat-label>
              <input matInput type="number" formControlName="cookTime" min="0" />
              <mat-icon matPrefix>timer</mat-icon>
            </mat-form-field>
          </div>

          <mat-form-field appearance="outline">
            <mat-label>{{ t('recipes.imageUrl') }}</mat-label>
            <input matInput formControlName="imageUrl" [placeholder]="t('recipes.imageUrlPlaceholder')" />
            <mat-icon matPrefix>image</mat-icon>
          </mat-form-field>

          <!-- Ingredients Section -->
          <div class="section-header">
            <h3><mat-icon>shopping_basket</mat-icon>{{ t('recipes.ingredients') }}</h3>
            <button mat-mini-fab color="primary" type="button" (click)="addIngredient()" [matTooltip]="t('recipes.addIngredient')">
              <mat-icon>add</mat-icon>
            </button>
          </div>

          <div formArrayName="ingredients" class="ingredients-list">
            @if (ingredients.length === 0) {
              <div class="empty-state">
                <mat-icon>info</mat-icon>
                <p>{{ t('recipes.noIngredientsAdded') }}</p>
              </div>
            }
            @for (ingredient of ingredients.controls; track $index) {
              <div [formGroupName]="$index" class="ingredient-row">
                <mat-form-field appearance="outline" class="ingredient-select">
                  <mat-label>{{ t('inventory.ingredient') }}</mat-label>
                  <mat-select formControlName="ingredientId">
                    <mat-option [value]="null">{{ t('recipes.selectIngredient') }}</mat-option>
                    @for (ing of availableIngredients(); track ing.id) {
                      <mat-option [value]="ing.id">
                        {{ ing.name }}
                        <span class="category-badge">{{ ing.category }}</span>
                      </mat-option>
                    }
                  </mat-select>
                  <mat-icon matPrefix>local_dining</mat-icon>
                  <mat-error>{{ t('common.required') }}</mat-error>
                </mat-form-field>

                <mat-form-field appearance="outline" class="quantity-field">
                  <mat-label>{{ t('inventory.quantity') }}</mat-label>
                  <input matInput type="number" formControlName="quantity" min="0" step="0.01" />
                  <mat-error>{{ t('common.required') }}</mat-error>
                </mat-form-field>

                <mat-form-field appearance="outline" class="unit-field">
                  <mat-label>{{ t('inventory.unit') }}</mat-label>
                  <mat-select formControlName="unit">
                    <mat-option value="g">{{ t('units.g') }}</mat-option>
                    <mat-option value="kg">{{ t('units.kg') }}</mat-option>
                    <mat-option value="ml">{{ t('units.ml') }}</mat-option>
                    <mat-option value="l">{{ t('units.l') }}</mat-option>
                    <mat-option value="cup">{{ t('units.cup') }}</mat-option>
                    <mat-option value="tbsp">{{ t('units.tbsp') }}</mat-option>
                    <mat-option value="tsp">{{ t('units.tsp') }}</mat-option>
                    <mat-option value="pcs">{{ t('units.pcs') }}</mat-option>
                    <mat-option value="oz">{{ t('units.oz') }}</mat-option>
                    <mat-option value="lb">{{ t('units.lb') }}</mat-option>
                  </mat-select>
                  <mat-error>{{ t('common.required') }}</mat-error>
                </mat-form-field>

                <button mat-icon-button color="warn" type="button" (click)="removeIngredient($index)" [matTooltip]="t('recipes.removeIngredient')">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            }
          </div>

          <!-- Instructions Section -->
          <div class="section-header">
            <h3><mat-icon>list_alt</mat-icon>{{ t('recipes.instructions') }}</h3>
            <button mat-mini-fab color="primary" type="button" (click)="addStep()" [matTooltip]="t('recipes.addStep')">
              <mat-icon>add</mat-icon>
            </button>
          </div>

          <div formArrayName="steps" class="steps-list">
            @if (steps.length === 0) {
              <div class="empty-state">
                <mat-icon>info</mat-icon>
                <p>{{ t('recipes.noInstructionsAdded') }}</p>
              </div>
            }
            @for (step of steps.controls; track $index) {
              <div class="step-row">
                <div class="step-number">{{ $index + 1 }}</div>
                <mat-form-field appearance="outline" class="step-field">
                  <mat-label>{{ t('recipes.step') }} {{ $index + 1 }}</mat-label>
                  <textarea matInput [formControlName]="$index" rows="2" [placeholder]="t('recipes.describeStep')"></textarea>
                  <mat-error>{{ t('common.required') }}</mat-error>
                </mat-form-field>
                <button mat-icon-button color="warn" type="button" (click)="removeStep($index)" [matTooltip]="t('recipes.removeStep')">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            }
          </div>
        </form>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button (click)="close()">
          <mat-icon>close</mat-icon>
          {{ t('common.cancel') }}
        </button>
        <button mat-raised-button color="primary" (click)="save()" [disabled]="recipeForm.invalid || saving()">
          @if (saving()) {
            <mat-spinner diameter="20"></mat-spinner>
          } @else {
            <mat-icon>save</mat-icon>
          }
          {{ saving() ? t('common.saving') : t('recipes.saveRecipe') }}
        </button>
      </mat-dialog-actions>
    </ng-container>
  `,
  styles: [`
    mat-dialog-content {
      width: 100%;
      max-width: 600px;
      padding: var(--spacing-md);
      box-sizing: border-box;
      overflow-x: hidden;
    }

    h2 {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);

      mat-icon {
        color: var(--primary-color);
      }
    }

    .recipe-form {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-md);
      width: 100%;
      box-sizing: border-box;
    }

    mat-form-field {
      width: 100%;
      box-sizing: border-box;
    }

    .details-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--spacing-sm);
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: var(--spacing-lg);
      margin-bottom: var(--spacing-md);

      h3 {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        color: var(--text-primary);

        mat-icon {
          color: var(--primary-color);
          font-size: 22px;
          width: 22px;
          height: 22px;
        }
      }
    }

    .ingredients-list,
    .steps-list {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-md);
      padding: var(--spacing-sm);
      background-color: var(--surface-color);
      border-radius: 8px;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--spacing-xl);
      color: var(--text-secondary);
      text-align: center;

      mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        opacity: 0.5;
        margin-bottom: var(--spacing-sm);
      }

      p {
        margin: 0;
        font-size: 14px;
      }
    }

    .ingredient-row {
      display: grid;
      grid-template-columns: 2fr 1fr 1.2fr auto;
      gap: var(--spacing-sm);
      align-items: start;

      .ingredient-select {
        .category-badge {
          margin-left: var(--spacing-xs);
          font-size: 11px;
          color: var(--text-secondary);
          background-color: rgba(0, 0, 0, 0.05);
          padding: 2px 6px;
          border-radius: 4px;
        }
      }

      button {
        margin-top: 8px;
      }
    }

    .step-row {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: var(--spacing-sm);
      align-items: start;

      .step-number {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: var(--primary-color);
        color: white;
        border-radius: 50%;
        font-weight: 600;
        font-size: 14px;
        margin-top: 8px;
      }

      .step-field {
        flex: 1;
      }

      button {
        margin-top: 8px;
      }
    }

    mat-dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--spacing-sm);
      padding: var(--spacing-md) var(--spacing-lg);
      border-top: 1px solid var(--divider-color);

      button {
        display: flex;
        align-items: center;
        gap: var(--spacing-xs);

        mat-spinner {
          display: inline-block;
        }
      }
    }

    @media (max-width: 768px) {
      mat-dialog-content {
        min-width: unset;
        width: 100%;
        padding: var(--spacing-md);
      }

      .details-row {
        grid-template-columns: 1fr;
      }

      .ingredient-row {
        grid-template-columns: 1fr;

        button {
          justify-self: end;
        }
      }
    }
  `],
})
export class RecipeEditDialog implements OnInit {
  private fb = inject(FormBuilder);
  private db = inject(DbService);
  private snackbar = inject(SnackbarService);
  private transloco = inject(TranslocoService);
  private dialogRef = inject(MatDialogRef<RecipeEditDialog>);
  private dataEvents = inject(DataEventsService);

  recipeForm!: FormGroup;
  saving = signal(false);
  availableIngredients = signal<Ingredient[]>([]);
  isEditMode = signal(false);

  constructor(@Inject(MAT_DIALOG_DATA) public data: any) {
    this.isEditMode.set(!!data?.id);
  }

  ngOnInit(): void {
    this.loadIngredients();
    this.initializeForm();
    if (this.data?.id) {
      this.loadRecipeData();
    }
  }

  private initializeForm(): void {
    this.recipeForm = this.fb.group({
      name: ['', Validators.required],
      servings: [4, [Validators.min(1)]],
      prepTime: [null],
      cookTime: [null],
      imageUrl: [''],
      ingredients: this.fb.array([]),
      steps: this.fb.array([]),
    });
  }

  private loadIngredients(): void {
    const userId = this.db.getCurrentUserId();
    // BUG-15: null userId must use IS NULL, not = NULL (SQL NULL comparison)
    const sql = userId
      ? `SELECT i.id, i.name, c.name as category
         FROM ingredients i
         LEFT JOIN ingredient_categories c ON i.categoryId = c.id
         WHERE i.userId = ? AND (i.isDeleted IS NULL OR i.isDeleted = 0)
         ORDER BY i.name`
      : `SELECT i.id, i.name, c.name as category
         FROM ingredients i
         LEFT JOIN ingredient_categories c ON i.categoryId = c.id
         WHERE i.userId IS NULL AND (i.isDeleted IS NULL OR i.isDeleted = 0)
         ORDER BY i.name`;
    const params = userId ? [userId] : [];
    const ingredients = this.db.query<any>(sql, params);
    this.availableIngredients.set(ingredients.map(ing => ({
      id: ing.id,
      name: ing.name,
      category: ing.category || 'Other'
    })));
  }

  private loadRecipeData(): void {
    const recipe = this.db.query<any>(
      'SELECT * FROM recipes WHERE id = ?',
      [this.data.id]
    )[0];

    if (!recipe) return;

    // Parse steps
    const steps = JSON.parse(recipe.steps || '[]');
    steps.forEach((step: string) => this.addStep(step));

    // Load ingredients
    const recipeIngredients = this.db.query<any>(
      `SELECT ingredientId, quantity, unit
       FROM recipe_ingredients
       WHERE recipeId = ? AND (isDeleted IS NULL OR isDeleted = 0)`,
      [this.data.id]
    );

    recipeIngredients.forEach(ing => {
      this.addIngredient(ing.ingredientId, ing.quantity, ing.unit);
    });

    // Patch form values
    this.recipeForm.patchValue({
      name: recipe.name,
      servings: recipe.servings || 4,
      prepTime: recipe.prepTime,
      cookTime: recipe.cookTime,
      imageUrl: recipe.imageUrl,
    });
  }

  get ingredients(): FormArray {
    return this.recipeForm.get('ingredients') as FormArray;
  }

  get steps(): FormArray {
    return this.recipeForm.get('steps') as FormArray;
  }

  addIngredient(ingredientId: string | null = null, quantity: number = 1, unit: string = 'g'): void {
    const ingredientGroup = this.fb.group({
      ingredientId: [ingredientId, Validators.required],
      quantity: [quantity, [Validators.required, Validators.min(0)]],
      unit: [unit, Validators.required],
    });
    this.ingredients.push(ingredientGroup);
  }

  removeIngredient(index: number): void {
    this.ingredients.removeAt(index);
  }

  addStep(stepText: string = ''): void {
    this.steps.push(this.fb.control(stepText, Validators.required));
  }

  removeStep(index: number): void {
    this.steps.removeAt(index);
  }

  async save(): Promise<void> {
    if (this.recipeForm.invalid) {
      this.snackbar.error(this.transloco.translate('recipes.fillRequiredFields'));
      return;
    }

    this.saving.set(true);

    try {
      const userId = this.db.getCurrentUserId();
      if (!userId) {
        throw new Error('User must be authenticated');
      }

      const formValue = this.recipeForm.value;
      const now = new Date().toISOString();
      const recipeId = this.data?.id || `rec-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

      // Prepare steps
      const steps = JSON.stringify(formValue.steps.filter((s: string) => s.trim()));

      if (this.isEditMode()) {
        // Update existing recipe
        this.db.exec(
          `UPDATE recipes
           SET name = ?, steps = ?, servings = ?, prepTime = ?, cookTime = ?, imageUrl = ?,
               updatedAt = ?, version = version + 1
           WHERE id = ?`,
          [
            formValue.name,
            steps,
            formValue.servings,
            formValue.prepTime || null,
            formValue.cookTime || null,
            formValue.imageUrl || null,
            now,
            recipeId,
          ]
        );

        // Delete existing recipe ingredients
        this.db.exec(
          'UPDATE recipe_ingredients SET isDeleted = 1, updatedAt = ? WHERE recipeId = ?',
          [now, recipeId]
        );
      } else {
        // Create new recipe
        this.db.exec(
          `INSERT INTO recipes (id, name, steps, servings, prepTime, cookTime, imageUrl, userId, version, isDeleted, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            recipeId,
            formValue.name,
            steps,
            formValue.servings,
            formValue.prepTime || null,
            formValue.cookTime || null,
            formValue.imageUrl || null,
            userId,
            1,
            0,
            now,
            now,
          ]
        );
      }

      // Insert recipe ingredients
      for (const ing of formValue.ingredients) {
        this.db.exec(
          `INSERT INTO recipe_ingredients (recipeId, ingredientId, quantity, unit, userId, version, isDeleted, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            recipeId,
            ing.ingredientId,
            ing.quantity,
            ing.unit,
            userId,
            1,
            0,
            now,
            now,
          ]
        );
      }

      const msgKey = this.isEditMode() ? 'recipes.recipeUpdated' : 'recipes.recipeCreated';
      this.snackbar.success(this.transloco.translate(msgKey, { name: formValue.name }));
      this.dataEvents.emit('recipes', this.isEditMode() ? 'update' : 'create', recipeId);
      this.dataEvents.emit('recipe_ingredients', this.isEditMode() ? 'update' : 'create');
      this.dialogRef.close(recipeId);
    } catch (error) {
      console.error('Failed to save recipe:', error);
      this.snackbar.error(this.transloco.translate('recipes.failedSave'));
    } finally {
      this.saving.set(false);
    }
  }

  close(): void {
    this.dialogRef.close(null);
  }
}
