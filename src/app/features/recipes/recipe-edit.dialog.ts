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
  templateUrl: './recipe-edit.dialog.html',
  styleUrls: ['./recipe-edit.dialog.scss'],
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
      notes: [''],
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
      notes: recipe.notes || '',
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
           SET name = ?, steps = ?, servings = ?, prepTime = ?, cookTime = ?, imageUrl = ?, notes = ?,
               updatedAt = ?, version = version + 1
           WHERE id = ?`,
          [
            formValue.name,
            steps,
            formValue.servings,
            formValue.prepTime || null,
            formValue.cookTime || null,
            formValue.imageUrl || null,
            formValue.notes || null,
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
          `INSERT INTO recipes (id, name, steps, servings, prepTime, cookTime, imageUrl, notes, userId, version, isDeleted, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            recipeId,
            formValue.name,
            steps,
            formValue.servings,
            formValue.prepTime || null,
            formValue.cookTime || null,
            formValue.imageUrl || null,
            formValue.notes || null,
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
