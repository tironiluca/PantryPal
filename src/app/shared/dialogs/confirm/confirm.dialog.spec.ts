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

  describe('typed confirmation', () => {
    it('keeps confirm disabled and ignores confirm() until the exact text is typed', () => {
      setup({ title: 'Delete account', message: 'Permanent.', confirmLabel: 'Delete', requireText: 'DELETE' });
      const button = () =>
        Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find(b => b.textContent?.includes('Delete')) as HTMLButtonElement;

      expect((fixture.nativeElement as HTMLElement).querySelector('input[name="requireText"]')).not.toBeNull();
      expect(button().disabled).toBe(true);

      const input = (fixture.nativeElement as HTMLElement).querySelector('input[name="requireText"]') as HTMLInputElement;
      const type = (value: string) => {
        input.value = value;
        input.dispatchEvent(new Event('input'));
        fixture.detectChanges();
      };

      type('delete');
      component.confirm();
      expect(dialogRefSpy.close).not.toHaveBeenCalled();
      expect(button().disabled).toBe(true);

      type(' DELETE ');
      expect(button().disabled).toBe(false);
      component.confirm();
      expect(dialogRefSpy.close).toHaveBeenCalledWith(true);
    });

    it('shows no text field without requireText', () => {
      setup({ title: 'Delete item?', message: 'Sure?' });
      expect((fixture.nativeElement as HTMLElement).querySelector('input[name="requireText"]')).toBeNull();
      expect(component.canConfirm()).toBe(true);
    });
  });
});
