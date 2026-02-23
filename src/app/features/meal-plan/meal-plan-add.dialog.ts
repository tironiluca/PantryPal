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
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { MealPlanService, MealPlanWithRecipe } from '../../core/services/meal-plan.service';
import { DbService } from '../../core/services/db.service';
import { SnackbarService } from '../../core/services/snackbar.service';
import { DataEventsService } from '../../core/services/data-events.service';

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
    TranslocoModule,
  ],
  template: `
    <ng-container *transloco="let t">
      <h2 mat-dialog-title>
        <mat-icon>{{ isEditMode ? 'edit' : 'add' }}</mat-icon>
        {{ isEditMode ? t('mealPlan.editMealPlan') : t('mealPlan.addMealToPlan') }}
      </h2>

      <mat-dialog-content>
        <form [formGroup]="form" class="meal-plan-form">
          <mat-form-field appearance="outline">
            <mat-label>{{ t('mealPlan.date') }}</mat-label>
            <input matInput [matDatepicker]="picker" formControlName="date" required />
            <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
            <mat-datepicker #picker></mat-datepicker>
            @if (form.get('date')?.hasError('required')) {
              <mat-error>{{ t('mealPlan.dateRequired') }}</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>{{ t('mealPlan.mealType') }}</mat-label>
            <mat-select formControlName="mealType" required>
              <mat-option value="breakfast">{{ t('mealPlan.breakfast') }}</mat-option>
              <mat-option value="lunch">{{ t('mealPlan.lunch') }}</mat-option>
              <mat-option value="dinner">{{ t('mealPlan.dinner') }}</mat-option>
              <mat-option value="snack">{{ t('mealPlan.snack') }}</mat-option>
            </mat-select>
            @if (form.get('mealType')?.hasError('required')) {
              <mat-error>{{ t('mealPlan.mealTypeRequired') }}</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>{{ t('mealPlan.recipe') }}</mat-label>
            <mat-select formControlName="recipeId" required>
              @if (recipes().length === 0) {
                <mat-option disabled>{{ t('mealPlan.noRecipesAvailable') }}</mat-option>
              } @else {
                @for (recipe of recipes(); track recipe.id) {
                  <mat-option [value]="recipe.id">{{ recipe.name }}</mat-option>
                }
              }
            </mat-select>
            <mat-hint>{{ t('mealPlan.selectRecipe') }}</mat-hint>
            @if (form.get('recipeId')?.hasError('required')) {
              <mat-error>{{ t('mealPlan.recipeRequired') }}</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>{{ t('mealPlan.servings') }}</mat-label>
            <input matInput type="number" formControlName="servings" min="1" max="20" required />
            <mat-hint>{{ t('mealPlan.numberOfServings') }}</mat-hint>
            @if (form.get('servings')?.hasError('required')) {
              <mat-error>{{ t('mealPlan.servingsRequired') }}</mat-error>
            }
            @if (form.get('servings')?.hasError('min')) {
              <mat-error>{{ t('mealPlan.minServing') }}</mat-error>
            }
            @if (form.get('servings')?.hasError('max')) {
              <mat-error>{{ t('mealPlan.maxServing') }}</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>{{ t('mealPlan.notesOptional') }}</mat-label>
            <textarea matInput formControlName="notes" rows="3" [placeholder]="t('mealPlan.notesPlaceholder')"></textarea>
          </mat-form-field>

          @if (isEditMode) {
            <mat-checkbox formControlName="completed">
              {{ t('mealPlan.markAsCompleted') }}
            </mat-checkbox>
          }
        </form>

        @if (selectedRecipe(); as recipe) {
          <div class="recipe-preview">
            <h3>{{ t('mealPlan.recipePreview') }}</h3>
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
          {{ t('common.cancel') }}
        </button>
        <button mat-raised-button color="primary" (click)="onSave()" [disabled]="form.invalid || recipes().length === 0">
          <mat-icon>{{ isEditMode ? 'save' : 'add' }}</mat-icon>
          {{ isEditMode ? t('mealPlan.update') : t('mealPlan.addToPlan') }}
        </button>
      </mat-dialog-actions>
    </ng-container>
  `,
  styles: [`
    mat-dialog-content {
      width: 90vw;
      max-width: 500px;
      padding: var(--spacing-md);
    }

    .meal-plan-form {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-md);
      padding: var(--spacing-sm) 0;
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
        line-height: 1.6;
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

    @media (max-width: 768px) {
      mat-dialog-content {
        width: 95vw;
        max-width: 95vw;
      }
    }
  `],
})
export class MealPlanAddDialog implements OnInit {
  private fb = inject(FormBuilder);
  private mealPlanService = inject(MealPlanService);
  private db = inject(DbService);
  private snackbar = inject(SnackbarService);
  private transloco = inject(TranslocoService);
  private dialogRef = inject(MatDialogRef<MealPlanAddDialog>);
  private dataEvents = inject(DataEventsService);

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
      this.snackbar.error(this.transloco.translate('common.fillRequiredFields'));
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

      this.dataEvents.emit('meal_plans', this.isEditMode ? 'update' : 'create');
      this.dialogRef.close(true);
    } catch (error) {
      console.error('Failed to save meal plan:', error);
      this.snackbar.error(this.transloco.translate('mealPlan.failedSave') || 'Failed to save meal plan');
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
