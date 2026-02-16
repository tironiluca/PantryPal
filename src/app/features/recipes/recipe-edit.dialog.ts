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
import { DbService } from '../../core/services/db.service';
import { SnackbarService } from '../../core/services/snackbar.service';

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
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>{{ isEditMode() ? 'edit' : 'add' }}</mat-icon>
      {{ isEditMode() ? 'Edit' : 'Add' }} Recipe
    </h2>

    <mat-dialog-content>
      <form [formGroup]="recipeForm" class="recipe-form">
        <!-- Recipe Name -->
        <mat-form-field appearance="outline">
          <mat-label>Recipe Name</mat-label>
          <input matInput formControlName="name" placeholder="e.g., Spaghetti Carbonara" />
          <mat-icon matPrefix>restaurant_menu</mat-icon>
          @if (recipeForm.get('name')?.hasError('required')) {
            <mat-error>Recipe name is required</mat-error>
          }
        </mat-form-field>

        <!-- Recipe Details Row -->
        <div class="details-row">
          <mat-form-field appearance="outline">
            <mat-label>Servings</mat-label>
            <input matInput type="number" formControlName="servings" min="1" />
            <mat-icon matPrefix>people</mat-icon>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Prep Time (min)</mat-label>
            <input matInput type="number" formControlName="prepTime" min="0" />
            <mat-icon matPrefix>schedule</mat-icon>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Cook Time (min)</mat-label>
            <input matInput type="number" formControlName="cookTime" min="0" />
            <mat-icon matPrefix>timer</mat-icon>
          </mat-form-field>
        </div>

        <!-- Image URL -->
        <mat-form-field appearance="outline">
          <mat-label>Image URL (optional)</mat-label>
          <input matInput formControlName="imageUrl" placeholder="https://example.com/image.jpg" />
          <mat-icon matPrefix>image</mat-icon>
        </mat-form-field>

        <!-- Ingredients Section -->
        <div class="section-header">
          <h3>
            <mat-icon>shopping_basket</mat-icon>
            Ingredients
          </h3>
          <button
            mat-mini-fab
            color="primary"
            type="button"
            (click)="addIngredient()"
            matTooltip="Add ingredient"
          >
            <mat-icon>add</mat-icon>
          </button>
        </div>

        <div formArrayName="ingredients" class="ingredients-list">
          @if (ingredients.length === 0) {
            <div class="empty-state">
              <mat-icon>info</mat-icon>
              <p>No ingredients added yet. Click the + button to add ingredients.</p>
            </div>
          }

          @for (ingredient of ingredients.controls; track $index) {
            <div [formGroupName]="$index" class="ingredient-row">
              <mat-form-field appearance="outline" class="ingredient-select">
                <mat-label>Ingredient</mat-label>
                <mat-select formControlName="ingredientId">
                  <mat-option [value]="null">Select an ingredient</mat-option>
                  @for (ing of availableIngredients(); track ing.id) {
                    <mat-option [value]="ing.id">
                      {{ ing.name }}
                      <span class="category-badge">{{ ing.category }}</span>
                    </mat-option>
                  }
                </mat-select>
                <mat-icon matPrefix>local_dining</mat-icon>
                <mat-error>Required</mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline" class="quantity-field">
                <mat-label>Quantity</mat-label>
                <input matInput type="number" formControlName="quantity" min="0" step="0.01" />
                <mat-error>Required</mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline" class="unit-field">
                <mat-label>Unit</mat-label>
                <mat-select formControlName="unit">
                  <mat-option value="g">grams (g)</mat-option>
                  <mat-option value="kg">kilograms (kg)</mat-option>
                  <mat-option value="ml">milliliters (ml)</mat-option>
                  <mat-option value="l">liters (l)</mat-option>
                  <mat-option value="cup">cup</mat-option>
                  <mat-option value="tbsp">tablespoon</mat-option>
                  <mat-option value="tsp">teaspoon</mat-option>
                  <mat-option value="pcs">pieces</mat-option>
                  <mat-option value="oz">ounces (oz)</mat-option>
                  <mat-option value="lb">pounds (lb)</mat-option>
                </mat-select>
                <mat-error>Required</mat-error>
              </mat-form-field>

              <button
                mat-icon-button
                color="warn"
                type="button"
                (click)="removeIngredient($index)"
                matTooltip="Remove ingredient"
              >
                <mat-icon>delete</mat-icon>
              </button>
            </div>
          }
        </div>

        <!-- Instructions Section -->
        <div class="section-header">
          <h3>
            <mat-icon>list_alt</mat-icon>
            Instructions
          </h3>
          <button
            mat-mini-fab
            color="primary"
            type="button"
            (click)="addStep()"
            matTooltip="Add step"
          >
            <mat-icon>add</mat-icon>
          </button>
        </div>

        <div formArrayName="steps" class="steps-list">
          @if (steps.length === 0) {
            <div class="empty-state">
              <mat-icon>info</mat-icon>
              <p>No instructions added yet. Click the + button to add steps.</p>
            </div>
          }

          @for (step of steps.controls; track $index) {
            <div class="step-row">
              <div class="step-number">{{ $index + 1 }}</div>
              <mat-form-field appearance="outline" class="step-field">
                <mat-label>Step {{ $index + 1 }}</mat-label>
                <textarea
                  matInput
                  [formControlName]="$index"
                  rows="2"
                  placeholder="Describe this step..."
                ></textarea>
                <mat-error>Step cannot be empty</mat-error>
              </mat-form-field>
              <button
                mat-icon-button
                color="warn"
                type="button"
                (click)="removeStep($index)"
                matTooltip="Remove step"
              >
                <mat-icon>delete</mat-icon>
              </button>
            </div>
          }
        </div>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions>
      <button mat-button (click)="close()">
        <mat-icon>close</mat-icon>
        Cancel
      </button>
      <button
        mat-raised-button
        color="primary"
        (click)="save()"
        [disabled]="recipeForm.invalid || saving()"
      >
        @if (saving()) {
          <mat-spinner diameter="20"></mat-spinner>
        } @else {
          <mat-icon>save</mat-icon>
        }
        {{ saving() ? 'Saving...' : 'Save Recipe' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content {
      min-width: 700px;
      max-width: 900px;
      max-height: 80vh;
      overflow-y: auto;
      padding: var(--spacing-lg);
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
    }

    .details-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--spacing-md);
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
      padding: var(--spacing-md);
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
  private dialogRef = inject(MatDialogRef<RecipeEditDialog>);

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
    const ingredients = this.db.query<any>(
      `SELECT i.id, i.name, c.name as category
       FROM ingredients i
       LEFT JOIN ingredient_categories c ON i.categoryId = c.id
       WHERE i.userId = ? AND (i.isDeleted IS NULL OR i.isDeleted = 0)
       ORDER BY i.name`,
      [userId]
    );
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
      this.snackbar.error('Please fill in all required fields');
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

      this.snackbar.success(
        `Recipe "${formValue.name}" ${this.isEditMode() ? 'updated' : 'created'} successfully!`
      );
      this.dialogRef.close(recipeId);
    } catch (error) {
      console.error('Failed to save recipe:', error);
      this.snackbar.error('Failed to save recipe');
    } finally {
      this.saving.set(false);
    }
  }

  close(): void {
    this.dialogRef.close(null);
  }
}
