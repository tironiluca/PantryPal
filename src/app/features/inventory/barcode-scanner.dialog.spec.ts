import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { MatIconTestingModule } from '@angular/material/icon/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { BarcodeScannerDialog } from './barcode-scanner.dialog';
import { BarcodeService } from '../../core/services/barcode.service';

describe('BarcodeScannerDialog', () => {
  let fixture: ComponentFixture<BarcodeScannerDialog>;
  let component: BarcodeScannerDialog;
  let dialogRefSpy: { close: ReturnType<typeof vi.fn> };
  let barcodeSpy: { scan: ReturnType<typeof vi.fn>; cancel: ReturnType<typeof vi.fn> };

  async function setup(scan: () => Promise<string | null>) {
    dialogRefSpy = { close: vi.fn() };
    barcodeSpy = { scan: vi.fn(scan), cancel: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [
        BarcodeScannerDialog,
        MatIconTestingModule,
        TranslocoTestingModule.forRoot({ langs: { en: {} }, translocoConfig: { availableLangs: ['en'], defaultLang: 'en' } }),
      ],
      providers: [
        { provide: MatDialogRef, useValue: dialogRefSpy },
        { provide: BarcodeService, useValue: barcodeSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BarcodeScannerDialog);
    component = fixture.componentInstance;
  }

  it('closes the dialog with the scanned code on success', async () => {
    await setup(() => Promise.resolve('0123456789'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(barcodeSpy.scan).toHaveBeenCalledWith(component.videoRef.nativeElement);
    expect(dialogRefSpy.close).toHaveBeenCalledWith('0123456789');
    expect(component.scanning).toBe(true);
  });

  it('shows an error and stops scanning when the camera cannot be accessed', async () => {
    await setup(() => Promise.reject(new Error('Camera permission denied')));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.scanning).toBe(false);
    expect(component.error).toBe('Camera permission denied');
    expect(dialogRefSpy.close).not.toHaveBeenCalled();
  });

  it('falls back to a generic error message when none is provided', async () => {
    await setup(() => Promise.reject({}));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.error).toBe('Failed to access camera');
  });

  it('cancels the scan and closes the dialog with null', async () => {
    await setup(() => new Promise(() => {}));
    fixture.detectChanges();

    component.cancel();

    expect(barcodeSpy.cancel).toHaveBeenCalled();
    expect(dialogRefSpy.close).toHaveBeenCalledWith(null);
  });

  it('stops active media tracks on destroy', async () => {
    await setup(() => new Promise(() => {}));
    fixture.detectChanges();

    const track = { stop: vi.fn() };
    const stream = { getTracks: () => [track] } as unknown as MediaStream;
    let srcObject: MediaStream | null = stream;
    Object.defineProperty(component.videoRef.nativeElement, 'srcObject', {
      configurable: true,
      get: () => srcObject,
      set: (value) => { srcObject = value; },
    });

    component.ngOnDestroy();

    expect(barcodeSpy.cancel).toHaveBeenCalled();
    expect(track.stop).toHaveBeenCalled();
  });
});
