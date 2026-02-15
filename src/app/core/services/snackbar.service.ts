import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({ providedIn: 'root' })
export class SnackbarService {
  constructor(private snackbar: MatSnackBar) {}

  success(message: string) {
    this.snackbar.open(message, 'Close', {
      duration: 3000,
      panelClass: 'success-snackbar',
      horizontalPosition: 'center',
      verticalPosition: 'bottom'
    });
  }

  error(message: string) {
    this.snackbar.open(message, 'Close', {
      duration: 5000,
      panelClass: 'error-snackbar',
      horizontalPosition: 'center',
      verticalPosition: 'bottom'
    });
  }

  info(message: string) {
    this.snackbar.open(message, 'Close', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom'
    });
  }

  warning(message: string) {
    this.snackbar.open(message, 'Close', {
      duration: 4000,
      panelClass: 'warning-snackbar',
      horizontalPosition: 'center',
      verticalPosition: 'bottom'
    });
  }
}
