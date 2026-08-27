import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SnackbarService } from './snackbar.service';

describe('SnackbarService', () => {
  let service: SnackbarService;
  let snackbar: { open: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    snackbar = { open: vi.fn() };
    TestBed.configureTestingModule({
      providers: [SnackbarService, { provide: MatSnackBar, useValue: snackbar }],
    });
    service = TestBed.inject(SnackbarService);
  });

  it.each([
    ['success', 'Saved', 3000, 'success-snackbar'],
    ['error', 'Failed', 5000, 'error-snackbar'],
    ['info', 'Loading', 3000, undefined],
    ['warning', 'Warning', 4000, 'warning-snackbar'],
  ])(
    'opens the %s notification with the expected options',
    (type, message, duration, panelClass) => {
      service[type as 'success' | 'error' | 'info' | 'warning'](message);

      expect(snackbar.open).toHaveBeenCalledWith(
        message,
        'Close',
        expect.objectContaining({
          duration,
          ...(panelClass ? { panelClass } : {}),
          horizontalPosition: 'center',
          verticalPosition: 'bottom',
        })
      );
    }
  );
});
