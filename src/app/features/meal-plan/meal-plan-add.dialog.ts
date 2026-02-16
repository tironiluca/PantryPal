import { Component, inject, Inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MealPlanService, MealPlanWithRecipe } from '../../core/services/meal-plan.service';
import { DbService } from '../../core/services/db.service';
import { SnackbarService } from '../../core/services/snackbar.service';

export interface MealPlanDialogData {
  date?: string;
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  mealPlan?: MealPlanWithRecipe; // For editing
}

interface Recipe {
  id: string;
  name: string;
  steps?: string;
}

@Component({
  selector: 'pp-meal-plan-add-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatCheckboxModule,
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>{{ isEditMode ? 'edit' : 'add' }}</mat-icon>
      {{ isEditMode ? 'Edit Meal Plan' : 'Add Meal to Plan' }}
    </h2>

    <mat-dialog-content>
      <form [formGroup]="form" class="meal-plan-form">
        <!-- Date -->
        <mat-form-field appearance="outline">
          <mat-label>Date</mat-label>
          <input
            matInput
            [matDatepicker]="picker"
            formControlName="date"
            required
          />
          <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
          <mat-datepicker #picker></mat-datepicker>
          <mat-error *ngIf="form.get('date')?.hasError('required')">
            Date is required
          </mat-error>
        </mat-form-field>

        <!-- Meal Type -->
        <mat-form-field appearance="outline">
          <mat-label>Meal Type</mat-label>
          <mat-select formControlName="mealType" required>
            <mat-option value="breakfast">
              <mat-icon>free_breakfast</mat-icon>
              Breakfast
            </mat-option>
            <mat-option value="lunch">
              <mat-icon>lunch_dining</mat-icon>
              Lunch
            </mat-option>
            <mat-option value="dinner">
              <mat-icon>dinner_dining</mat-icon>
              Dinner
            </mat-option>
            <mat-option value="snack">
              <mat-icon>cookie</mat-icon>
              Snack
            </mat-option>
          </mat-select>
          <mat-error *ngIf="form.get('mealType')?.hasError('required')">
            Meal type is required
          </mat-error>
        </mat-form-field>

        <!-- Recipe -->
        <mat-form-field appearance="outline">
          <mat-label>Recipe</mat-label>
          <mat-select formControlName="recipeId" required>
            @if (recipes().length === 0) {
              <mat-option disabled>
                No recipes available. Create recipes first.
              </mat-option>
            } @else {
              @for (recipe of recipes(); track recipe.id) {
                <mat-option [value]="recipe.id">
                  {{ recipe.name }}
                </mat-option>
              }
            }
          </mat-select>
          <mat-hint>Select a recipe for this meal</mat-hint>
          <mat-error *ngIf="form.get('recipeId')?.hasError('required')">
            Recipe is required
          </mat-error>
        </mat-form-field>

        <!-- Servings -->
        <mat-form-field appearance="outline">
          <mat-label>Servings</mat-label>
          <input
            matInput
            type="number"
            formControlName="servings"
            min="1"
            max="20"
            required
          />
          <mat-hint>Number of servings</mat-hint>
          <mat-error *ngIf="form.get('servings')?.hasError('required')">
            Servings is required
          </mat-error>
          <mat-error *ngIf="form.get('servings')?.hasError('min')">
            Minimum 1 serving
          </mat-error>
          <mat-error *ngIf="form.get('servings')?.hasError('max')">
            Maximum 20 servings
          </mat-error>
        </mat-form-field>

        <!-- Notes -->
        <mat-form-field appearance="outline">
          <mat-label>Notes (optional)</mat-label>
          <textarea
            matInput
            formControlName="notes"
            rows="3"
            placeholder="Add any notes or special instructions..."
          ></textarea>
        </mat-form-field>

        <!-- Completed (only for edit mode) -->
        @if (isEditMode) {
          <mat-checkbox formControlName="completed">
            Mark as completed
          </mat-checkbox>
        }
      </form>

      <!-- Recipe preview -->
      @if (selectedRecipe(); as recipe) {
        <div class="recipe-preview">
          <h3>Recipe Preview</h3>
          <p class="recipe-name">{{ recipe.name }}</p>
          @if (recipe.steps) {
            <p class="recipe-steps">{{ recipe.steps }}</p>
          }
        </div>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">
        <mat-icon>close</mat-icon>
        Cancel
      </button>
      <button
        mat-raised-button
        color="primary"
        (click)="onSave()"
        [disabled]="form.invalid || recipes().length === 0"
      >
        <mat-icon>{{ isEditMode ? 'save' : 'add' }}</mat-icon>
        {{ isEditMode ? 'Update' : 'Add to Plan' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .meal-plan-form {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-md);
      min-width: 400px;
      padding: var(--spacing-md) 0;
    }

    mat-form-field {
      width: 100%;
    }

    mat-option {
      display: flex;
      align-items: center;
      gap: var(--spacing-xs);

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    .recipe-preview {
      margin-top: var(--spacing-md);
      padding: var(--spacing-md);
      background-color: var(--surface-color);
      border-radius: 8px;
      border-left: 4px solid var(--primary-color);

      h3 {
        margin: 0 0 var(--spacing-sm) 0;
        font-size: 14px;
        color: var(--text-secondary);
        text-transform: uppercase;
      }

      .recipe-name {
        font-weight: 600;
        font-size: 16px;
        margin: 0 0 var(--spacing-xs) 0;
      }

      .recipe-steps {
        font-size: 14px;
        color: var(--text-secondary);
        margin: 0;
        white-space: pre-wrap;
        max-height: 100px;
        overflow-y: auto;
      }
    }

    mat-dialog-actions {
      padding: var(--spacing-md);

      button {
        margin-left: var(--spacing-sm);

        mat-icon {
          margin-right: var(--spacing-xs);
        }
      }
    }

    mat-checkbox {
      margin-top: var(--spacing-sm);
    }
  `],
})
export class MealPlanAddDialog implements OnInit {
  private fb = inject(FormBuilder);
  private mealPlanService = inject(MealPlanService);
  private db = inject(DbService);
  private snackbar = inject(SnackbarService);
  private dialogRef = inject(MatDialogRef<MealPlanAddDialog>);

  form!: FormGroup;
  isEditMode = false;
  recipes = signal<Recipe[]>([]);

  selectedRecipe = signal<Recipe | null>(null);

  constructor(@Inject(MAT_DIALOG_DATA) public data: MealPlanDialogData) {
    this.isEditMode = !!data.mealPlan;
  }

  ngOnInit(): void {
    this.loadRecipes();
    this.initForm();

    // Watch for recipe selection changes
    this.form.get('recipeId')?.valueChanges.subscribe(recipeId => {
      const recipe = this.recipes().find(r => r.id === recipeId);
      this.selectedRecipe.set(recipe || null);
    });
  }

  initForm(): void {
    const mealPlan = this.data.mealPlan;
    const date = mealPlan?.date || this.data.date || this.formatDate(new Date());

    this.form = this.fb.group({
      date: [this.parseDate(date), Validators.required],
      mealType: [mealPlan?.mealType || this.data.mealType || 'dinner', Validators.required],
      recipeId: [mealPlan?.recipeId || '', Validators.required],
      servings: [mealPlan?.servings || 1, [Validators.required, Validators.min(1), Validators.max(20)]],
      notes: [mealPlan?.notes || ''],
      completed: [mealPlan?.completed || false],
    });

    // Set initial selected recipe if editing
    if (mealPlan) {
      const recipe = this.recipes().find(r => r.id === mealPlan.recipeId);
      this.selectedRecipe.set(recipe || null);
    }
  }

  loadRecipes(): void {
    const allRecipes = this.db.queryByUser<Recipe>('recipes');
    this.recipes.set(allRecipes);
  }

  onSave(): void {
    if (this.form.invalid) {
      this.snackbar.error('Please fill in all required fields');
      return;
    }

    const formValue = this.form.value;
    const dateString = this.formatDate(formValue.date);

    try {
      if (this.isEditMode && this.data.mealPlan) {
        // Update existing meal plan
        this.mealPlanService.updateMeal(this.data.mealPlan.id, {
          date: dateString,
          mealType: formValue.mealType,
          recipeId: formValue.recipeId,
          servings: formValue.servings,
          notes: formValue.notes,
          completed: formValue.completed,
        });
      } else {
        // Add new meal plan
        this.mealPlanService.addMeal(
          dateString,
          formValue.mealType,
          formValue.recipeId,
          formValue.servings,
          formValue.notes
        );
      }

      this.dialogRef.close(true);
    } catch (error) {
      console.error('Failed to save meal plan:', error);
      this.snackbar.error('Failed to save meal plan');
    }
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private parseDate(dateString: string): Date {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
}
