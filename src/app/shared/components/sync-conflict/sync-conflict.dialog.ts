import { Component, inject, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';

export interface ConflictData {
  table: string;
  local: any;
  remote: any;
  field?: string;
}

export type ConflictResolution = 'keep-local' | 'keep-remote' | 'merge';

@Component({
  selector: 'pp-sync-conflict-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatDividerModule,
    MatChipsModule,
  ],
  templateUrl: './sync-conflict.dialog.html',
  styleUrls: ['./sync-conflict.dialog.scss'],
})
export class SyncConflictDialog {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: ConflictData,
    private dialogRef: MatDialogRef<SyncConflictDialog>
  ) {}

  getEntityName(): string {
    const names: Record<string, string> = {
      ingredients: 'ingredient',
      inventory: 'inventory item',
      recipes: 'recipe',
      recipe_ingredients: 'recipe ingredient',
    };
    return names[this.data.table] || 'item';
  }

  getDisplayFields(record: any): Array<{ key: string; label: string; value: any }> {
    const excludeFields = ['id', 'userId', 'syncedAt', 'version', 'isDeleted', 'createdAt', 'updatedAt', 'user_id', 'created_at', 'updated_at', 'synced_at'];

    const fieldLabels: Record<string, string> = {
      name: 'Name',
      quantity: 'Quantity',
      unit: 'Unit',
      minRestock: 'Min Restock',
      expiry: 'Expiry Date',
      location: 'Location',
      barcode: 'Barcode',
      categoryId: 'Category',
      ingredientId: 'Ingredient',
      recipeId: 'Recipe',
      steps: 'Steps',
      defaultShelfLifeDays: 'Shelf Life (days)',
      notifyStartDays: 'Notify Start (days)',
      notifyRepeatDays: 'Notify Repeat (days)',
    };

    return Object.keys(record)
      .filter(key => !excludeFields.includes(key))
      .map(key => ({
        key,
        label: fieldLabels[key] || this.formatLabel(key),
        value: this.formatValue(record[key]),
      }));
  }

  formatLabel(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  formatValue(value: any): string {
    if (value === null || value === undefined) {
      return '-';
    }

    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }

    if (typeof value === 'number') {
      return value.toString();
    }

    if (typeof value === 'string') {
      // Check if it's a date string
      if (value.match(/^\d{4}-\d{2}-\d{2}T/)) {
        return this.formatDate(value);
      }

      return value.length > 50 ? value.substring(0, 50) + '...' : value;
    }

    return String(value);
  }

  formatDate(dateString: string | null | undefined): string {
    if (!dateString) {
      return '-';
    }

    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return dateString;
    }
  }

  isFieldChanged(key: string): boolean {
    return this.data.local[key] !== this.data.remote[key];
  }

  onResolve(resolution: ConflictResolution): void {
    this.dialogRef.close(resolution);
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }
}
