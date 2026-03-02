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
  templateUrl: './meal-plan-add.dialog.html',
  styleUrls: ['./meal-plan-add.dialog.scss'],
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
