import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ConfirmDialog, ConfirmDialogData } from './confirm.dialog';

describe('ConfirmDialog', () => {
  let fixture: ComponentFixture<ConfirmDialog>;
  let component: ConfirmDialog;
  let dialogRefSpy: { close: ReturnType<typeof vi.fn> };

  function setup(data: ConfirmDialogData) {
    dialogRefSpy = { close: vi.fn() };

    TestBed.configureTestingModule({
      imports: [ConfirmDialog],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: dialogRefSpy },
      ],
    });

    fixture = TestBed.createComponent(ConfirmDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('renders the provided title and message', () => {
    setup({ title: 'Delete item?', message: 'This cannot be undone.' });

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Delete item?');
    expect(text).toContain('This cannot be undone.');
  });

  it('closes the dialog with true when confirm() is called', () => {
    setup({ title: 'Delete item?', message: 'Are you sure?' });

    component.confirm();

    expect(dialogRefSpy.close).toHaveBeenCalledWith(true);
  });

  it('closes the dialog with false when cancel() is called', () => {
    setup({ title: 'Delete item?', message: 'Are you sure?' });

    component.cancel();

    expect(dialogRefSpy.close).toHaveBeenCalledWith(false);
  });

  it('wires the cancel and confirm buttons to the corresponding handlers', () => {
    setup({ title: 'Delete item?', message: 'Are you sure?', confirmLabel: 'Yes, delete' });

    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll('button');
    const confirmButton = Array.from(buttons).find(b => b.textContent?.includes('Yes, delete'));
    const cancelButton = Array.from(buttons).find(b => b.textContent?.trim() === 'Cancel');

    confirmButton?.dispatchEvent(new Event('click'));
    fixture.detectChanges();
    expect(dialogRefSpy.close).toHaveBeenCalledWith(true);

    cancelButton?.dispatchEvent(new Event('click'));
    fixture.detectChanges();
    expect(dialogRefSpy.close).toHaveBeenCalledWith(false);
  });
});
