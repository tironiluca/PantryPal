import { Component, Inject, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { TranslocoModule } from '@jsverse/transloco';
import { DbService } from '../../../core/services/db.service';
import { Ingredient } from '../../../core/models/ingredient.model';
import { DataEventsService } from '../../../core/services/data-events.service';
import { NutritionEditDialog } from '../nutrition-edit.dialog';
import { NutritionService, NutritionData } from '../../../core/services/nutrition.service';

@Component({
  standalone: true,
  selector: 'pp-ingredient-edit',
  imports: [CommonModule, FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatChipsModule, TranslocoModule],
  template: `
  <ng-container *transloco="let t">
    <h2 mat-dialog-title>{{ model?.id ? t('ingredients.editIngredient') : t('ingredients.addIngredient') }}</h2>
    <div mat-dialog-content class="form">
      <mat-form-field appearance="outline">
        <mat-label>{{ t('ingredients.name') }}</mat-label>
        <input matInput [(ngModel)]="model.name">
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>{{ t('ingredients.categoryId') }}</mat-label>
        <input matInput [(ngModel)]="model.categoryId">
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>{{ t('ingredients.defaultShelfLife') }}</mat-label>
        <input matInput type="number" [(ngModel)]="model.defaultShelfLifeDays">
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>{{ t('ingredients.notifyStart') }}</mat-label>
        <input matInput type="number" [(ngModel)]="model.notifyStartDays">
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>{{ t('ingredients.notifyRepeat') }}</mat-label>
        <input matInput type="number" [(ngModel)]="model.notifyRepeatDays">
      </mat-form-field>

      <!-- Nutrition info -->
      <div class="nutrition-row">
        @if (hasNutrition()) {
          <mat-chip-set>
            <mat-chip color="primary" highlighted>
              <mat-icon matChipAvatar>nutrition</mat-icon>
              {{ model.energyKcal | number:'1.0-0' }} {{ t('ingredients.kcalPer100g') }}
            </mat-chip>
          </mat-chip-set>
        }
        <button mat-stroked-button (click)="openNutritionEdit()">
          <mat-icon>nutrition</mat-icon>
          {{ hasNutrition() ? t('ingredients.editNutritionInfo') : t('ingredients.addNutritionInfo') }}
        </button>
      </div>
    </div>
    <div mat-dialog-actions align="end">
      <button mat-button (click)="close()">{{ t('common.cancel') }}</button>
      <button mat-flat-button color="primary" (click)="save()">{{ t('common.save') }}</button>
    </div>
  </ng-container>
  `,
  styles: [`
    mat-dialog-content {
      width: 90vw;
      max-width: 450px;
      padding: var(--spacing-md);
      padding-top: calc(var(--spacing-md) + 8px);
      overflow-x: hidden;
      box-sizing: border-box;
    }
    .form {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-sm);
    }
    mat-form-field { width: 100%; }
    .nutrition-row {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      flex-wrap: wrap;
    }
    @media (max-width: 768px) {
      mat-dialog-content { width: 95vw; max-width: 95vw; }
    }
  `]
})
export class IngredientEditDialog {
  private db = inject(DbService);
  private dialog = inject(MatDialog);
  private dataEvents = inject(DataEventsService);
  private nutritionService = inject(NutritionService);

  model: any = { id: '', name: '', categoryId: '', defaultShelfLifeDays: null, notifyStartDays: 3, notifyRepeatDays: 1 };

  // Pending nutrition to be saved together with the ingredient in save() (BUG-11)
  private pendingNutrition: NutritionData | null = null;

  constructor(@Inject(MAT_DIALOG_DATA) public data: Ingredient | null, private ref: MatDialogRef<IngredientEditDialog>) {
    if (data) this.model = { ...data };
  }

  hasNutrition(): boolean {
    return this.model.energyKcal != null && this.model.energyKcal > 0;
  }

  openNutritionEdit(): void {
    // Assign a temporary ID for keying purposes — no DB insert yet (BUG-11)
    if (!this.model.id) {
      this.model.id = `ing-${crypto.randomUUID()}`;
    }

    const existing: NutritionData | undefined = this.hasNutrition() ? {
      energyKcal: this.model.energyKcal,
      proteinG: this.model.proteinG,
      carbsG: this.model.carbsG,
      fatG: this.model.fatG,
      fiberG: this.model.fiberG,
      sugarG: this.model.sugarG,
      sodiumMg: this.model.sodiumMg,
    } : this.pendingNutrition ?? undefined;

    this.dialog.open(NutritionEditDialog, {
      data: {
        ingredientId: this.model.id,
        ingredientName: this.model.name || 'ingredient',
        existing,
      },
      width: '520px',
      maxWidth: '95vw',
    }).afterClosed().subscribe((nutrition: NutritionData | null) => {
      if (nutrition) {
        // Store for later — will be persisted in save()
        this.pendingNutrition = nutrition;
        Object.assign(this.model, nutrition);
      }
    });
  }

  save() {
    const isNew = !this.model.id;
    if (isNew) {
      this.model.id = `ing-${crypto.randomUUID()}`;
      this.db.exec(
        'INSERT INTO ingredients (id, name, categoryId, defaultShelfLifeDays, notifyStartDays, notifyRepeatDays) VALUES (?,?,?,?,?,?)',
        [this.model.id, this.model.name, this.model.categoryId || null,
         this.model.defaultShelfLifeDays ?? null, this.model.notifyStartDays ?? null, this.model.notifyRepeatDays ?? null]
      );
    } else {
      this.db.exec(
        'UPDATE ingredients SET name=?, categoryId=?, defaultShelfLifeDays=?, notifyStartDays=?, notifyRepeatDays=? WHERE id=?',
        [this.model.name, this.model.categoryId || null,
         this.model.defaultShelfLifeDays ?? null, this.model.notifyStartDays ?? null, this.model.notifyRepeatDays ?? null, this.model.id]
      );
    }

    // Persist pending nutrition now that the ingredient row exists (BUG-11)
    if (this.pendingNutrition) {
      this.nutritionService.updateIngredientNutrition(this.model.id, this.pendingNutrition);
    }

    this.dataEvents.emit('ingredients', isNew ? 'create' : 'update', this.model.id);
    this.ref.close(true);
  }

  close() { this.ref.close(false); }
}
