import { Component, Inject, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { DbService } from '../../../core/services/db.service';
import { Ingredient } from '../../../core/models/ingredient.model';
import { DataEventsService } from '../../../core/services/data-events.service';
import { NutritionEditDialog } from '../nutrition-edit.dialog';

@Component({
  standalone: true,
  selector: 'pp-ingredient-edit',
  imports: [CommonModule, FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatChipsModule],
  template: `
  <h2 mat-dialog-title>{{model?.id ? 'Edit' : 'Add'}} Ingredient</h2>
  <div mat-dialog-content class="form">
    <mat-form-field appearance="outline">
      <mat-label>Name</mat-label>
      <input matInput [(ngModel)]="model.name">
    </mat-form-field>
    <mat-form-field appearance="outline">
      <mat-label>Category ID</mat-label>
      <input matInput [(ngModel)]="model.categoryId">
    </mat-form-field>
    <mat-form-field appearance="outline">
      <mat-label>Default Shelf Life (days)</mat-label>
      <input matInput type="number" [(ngModel)]="model.defaultShelfLifeDays">
    </mat-form-field>
    <mat-form-field appearance="outline">
      <mat-label>Notify Start (days before)</mat-label>
      <input matInput type="number" [(ngModel)]="model.notifyStartDays">
    </mat-form-field>
    <mat-form-field appearance="outline">
      <mat-label>Notify Repeat (days)</mat-label>
      <input matInput type="number" [(ngModel)]="model.notifyRepeatDays">
    </mat-form-field>

    <!-- Nutrition info -->
    <div class="nutrition-row">
      @if (hasNutrition()) {
        <mat-chip-set>
          <mat-chip color="primary" highlighted>
            <mat-icon matChipAvatar>nutrition</mat-icon>
            {{ model.energyKcal | number:'1.0-0' }} kcal / 100g
          </mat-chip>
        </mat-chip-set>
      }
      <button mat-stroked-button (click)="openNutritionEdit()">
        <mat-icon>nutrition</mat-icon>
        {{ hasNutrition() ? 'Edit Nutrition Info' : 'Add Nutrition Info' }}
      </button>
    </div>
  </div>
  <div mat-dialog-actions>
    <button mat-button (click)="close()">Cancel</button>
    <button mat-flat-button color="primary" (click)="save()">Save</button>
  </div>
  `,
  styles: [`
    mat-dialog-content {
      width: 90vw;
      max-width: 450px;
      padding: var(--spacing-md);
    }
    .form {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-md);
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
  model: any = { id: '', name: '', categoryId: '', defaultShelfLifeDays: null, notifyStartDays: 3, notifyRepeatDays: 1 };

  constructor(@Inject(MAT_DIALOG_DATA) public data: Ingredient | null, private ref: MatDialogRef<IngredientEditDialog>) {
    if (data) this.model = { ...data };
  }

  hasNutrition(): boolean {
    return this.model.energyKcal != null && this.model.energyKcal > 0;
  }

  openNutritionEdit(): void {
    // Ensure we have an ID before opening the nutrition dialog
    if (!this.model.id) {
      this.model.id = `ing-${crypto.randomUUID()}`;
      this.db.exec(
        'INSERT INTO ingredients (id, name, categoryId, defaultShelfLifeDays, notifyStartDays, notifyRepeatDays) VALUES (?,?,?,?,?,?)',
        [this.model.id, this.model.name || 'New Ingredient', this.model.categoryId || null,
         this.model.defaultShelfLifeDays ?? null, this.model.notifyStartDays ?? null, this.model.notifyRepeatDays ?? null]
      );
      this.dataEvents.emit('ingredients', 'create', this.model.id);
    }

    this.dialog.open(NutritionEditDialog, {
      data: {
        ingredientId: this.model.id,
        ingredientName: this.model.name || 'ingredient',
        existing: this.hasNutrition() ? {
          energyKcal: this.model.energyKcal,
          proteinG: this.model.proteinG,
          carbsG: this.model.carbsG,
          fatG: this.model.fatG,
          fiberG: this.model.fiberG,
          sugarG: this.model.sugarG,
          sodiumMg: this.model.sodiumMg,
        } : undefined,
      },
      width: '520px',
      maxWidth: '95vw',
    }).afterClosed().subscribe(saved => {
      if (saved) {
        const rows = this.db.query<any>(
          'SELECT energyKcal, proteinG, carbsG, fatG, fiberG, sugarG, sodiumMg FROM ingredients WHERE id = ?',
          [this.model.id]
        );
        if (rows.length > 0) Object.assign(this.model, rows[0]);
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
    this.dataEvents.emit('ingredients', isNew ? 'create' : 'update', this.model.id);
    this.ref.close(true);
  }

  close() { this.ref.close(false); }
}
