import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

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
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './confirm.dialog.html',
  styleUrls: ['./confirm.dialog.scss'],
})
export class ConfirmDialog {
  data: ConfirmDialogData = inject(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<ConfirmDialog>);

  confirm() {
    this.ref.close(true);
  }
  cancel() {
    this.ref.close(false);
  }
}
