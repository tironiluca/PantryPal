import { Component, inject, signal } from '@angular/core';

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
import {
  RecipeImportService,
  ImportedRecipe,
  ParsedIngredient,
} from '../../core/services/recipe-import.service';
import {
  IngredientMatchingService,
  IngredientMappingResult,
} from '../../core/services/ingredient-matching.service';
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
  templateUrl: './recipe-import.dialog.html',
  styleUrls: ['./recipe-import.dialog.scss'],
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
      const parsedIngredients = this.recipeImportService.parseIngredientsWithQuantities(
        recipe.ingredients
      );
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
          ingredientId = this.ingredientMatcher.createIngredientFromImport(
            mapping.original.ingredientName
          );
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
