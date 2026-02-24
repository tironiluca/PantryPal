import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 'warn' shows the confirm button in red. Default: 'primary' */
  confirmColor?: 'primary' | 'warn';
  icon?: string;
}

@Component({
  standalone: true,
  selector: 'pp-confirm-dialog',
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="confirm-dialog">
      <h2 mat-dialog-title class="title">
        @if (data.icon) {
          <mat-icon [class]="'icon-' + (data.confirmColor ?? 'primary')">{{ data.icon }}</mat-icon>
        }
        {{ data.title }}
      </h2>
      <div mat-dialog-content>
        <p>{{ data.message }}</p>
      </div>
      <div mat-dialog-actions align="end">
        <button mat-button (click)="cancel()">
          {{ data.cancelLabel ?? 'Cancel' }}
        </button>
        <button mat-flat-button [color]="data.confirmColor ?? 'primary'" (click)="confirm()">
          {{ data.confirmLabel ?? 'Confirm' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .confirm-dialog { min-width: 280px; max-width: 400px; }

    .title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 18px;
    }

    .icon-warn  { color: var(--mat-warn-color, #f44336); }
    .icon-primary { color: var(--mat-primary-color, #43a047); }

    [mat-dialog-content] p {
      margin: 0;
      color: var(--text-secondary);
      line-height: 1.5;
    }
  `]
})
export class ConfirmDialog {
  data: ConfirmDialogData = inject(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<ConfirmDialog>);

  confirm() { this.ref.close(true); }
  cancel()  { this.ref.close(false); }
}
