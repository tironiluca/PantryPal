import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 'warn' shows the confirm button in red. Default: 'primary' */
  confirmColor?: 'primary' | 'warn';
  icon?: string;
  /** When set, the user must type this exact text before the confirm button is enabled. */
  requireText?: string;
}

@Component({
  standalone: true,
  selector: 'pp-confirm-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, FormsModule],
  templateUrl: './confirm.dialog.html',
  styleUrls: ['./confirm.dialog.scss'],
})
export class ConfirmDialog {
  data: ConfirmDialogData = inject(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<ConfirmDialog>);

  typedText = '';

  canConfirm(): boolean {
    return !this.data.requireText || this.typedText.trim() === this.data.requireText;
  }

  confirm() {
    if (!this.canConfirm()) return;
    this.ref.close(true);
  }
  cancel() {
    this.ref.close(false);
  }
}
