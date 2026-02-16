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
  template: `
    <h2 mat-dialog-title>
      <mat-icon class="conflict-icon">warning</mat-icon>
      Sync Conflict Detected
    </h2>

    <mat-dialog-content>
      <p class="conflict-description">
        The same {{ getEntityName() }} was modified on this device and another device.
        Please choose which version to keep:
      </p>

      <div class="versions-container">
        <!-- Local Version -->
        <mat-card class="version-card local">
          <mat-card-header>
            <mat-card-title>
              <mat-icon>devices</mat-icon>
              Your Changes (This Device)
            </mat-card-title>
            <mat-card-subtitle>
              Modified: {{ formatDate(data.local.updatedAt) }}
            </mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div class="field-list">
              @for (field of getDisplayFields(data.local); track field.key) {
                <div class="field-item">
                  <span class="field-label">{{ field.label }}:</span>
                  <span class="field-value">{{ field.value }}</span>
                </div>
              }
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Remote Version -->
        <mat-card class="version-card remote">
          <mat-card-header>
            <mat-card-title>
              <mat-icon>cloud</mat-icon>
              Cloud Changes (Other Device)
            </mat-card-title>
            <mat-card-subtitle>
              Modified: {{ formatDate(data.remote.updatedAt) }}
            </mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div class="field-list">
              @for (field of getDisplayFields(data.remote); track field.key) {
                <div class="field-item" [class.changed]="isFieldChanged(field.key)">
                  <span class="field-label">{{ field.label }}:</span>
                  <span class="field-value">{{ field.value }}</span>
                  @if (isFieldChanged(field.key)) {
                    <mat-icon class="change-indicator">edit</mat-icon>
                  }
                </div>
              }
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <mat-divider></mat-divider>

      <div class="resolution-hint">
        <mat-icon>info</mat-icon>
        <p>Choose which version to keep. The other version will be discarded.</p>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">
        <mat-icon>close</mat-icon>
        Cancel
      </button>
      <button mat-raised-button color="accent" (click)="onResolve('keep-remote')">
        <mat-icon>cloud_download</mat-icon>
        Keep Cloud Version
      </button>
      <button mat-raised-button color="primary" (click)="onResolve('keep-local')">
        <mat-icon>devices</mat-icon>
        Keep My Changes
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .conflict-icon {
      color: #ff9800;
      vertical-align: middle;
      margin-right: 8px;
    }

    .conflict-description {
      margin-bottom: var(--spacing-lg);
      color: var(--text-secondary);
    }

    .versions-container {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--spacing-md);
      margin-bottom: var(--spacing-lg);
    }

    .version-card {
      &.local {
        border-left: 4px solid var(--primary-color);
      }

      &.remote {
        border-left: 4px solid var(--accent-color);
      }

      mat-card-header {
        mat-card-title {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
          font-size: 16px;
        }

        mat-card-subtitle {
          margin-top: var(--spacing-xs);
          font-size: 12px;
        }
      }
    }

    .field-list {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-sm);
    }

    .field-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--spacing-xs);
      border-radius: 4px;

      &.changed {
        background-color: rgba(255, 152, 0, 0.1);
        border-left: 2px solid #ff9800;
        padding-left: calc(var(--spacing-xs) - 2px);
      }

      .field-label {
        font-weight: 500;
        color: var(--text-secondary);
        min-width: 100px;
      }

      .field-value {
        flex: 1;
        text-align: right;
        color: var(--text-primary);
      }

      .change-indicator {
        font-size: 16px;
        width: 16px;
        height: 16px;
        color: #ff9800;
        margin-left: var(--spacing-xs);
      }
    }

    .resolution-hint {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      padding: var(--spacing-md);
      background-color: rgba(33, 150, 243, 0.1);
      border-radius: 4px;
      margin-top: var(--spacing-md);

      mat-icon {
        color: #2196f3;
      }

      p {
        margin: 0;
        color: var(--text-secondary);
        font-size: 14px;
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

    @media (max-width: 768px) {
      .versions-container {
        grid-template-columns: 1fr;
      }
    }
  `],
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
