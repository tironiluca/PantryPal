import { Component, inject, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoModule } from '@jsverse/transloco';
import { BarcodeService } from '../../core/services/barcode.service';

@Component({
  standalone: true,
  selector: 'pp-barcode-scanner-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, TranslocoModule],
  template: `
    <ng-container *transloco="let t">
      <h2 mat-dialog-title>
        <mat-icon>qr_code_scanner</mat-icon>
        {{ t('inventory.scanBarcode') }}
      </h2>
      <mat-dialog-content>
        <div class="scanner-container">
          <video #videoEl autoplay playsinline muted></video>
          @if (scanning) {
            <div class="scanner-overlay">
              <div class="scan-line"></div>
            </div>
          }
          @if (error) {
            <div class="error-overlay">
              <mat-icon>error_outline</mat-icon>
              <p>{{ error }}</p>
            </div>
          }
        </div>
        @if (scanning) {
          <p class="hint">{{ t('inventory.pointCameraAtBarcode') }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button (click)="cancel()">
          <mat-icon>close</mat-icon>
          {{ t('common.cancel') }}
        </button>
      </mat-dialog-actions>
    </ng-container>
  `,
  styles: [`
    h2 {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .scanner-container {
      position: relative;
      width: 100%;
      max-width: 400px;
      aspect-ratio: 4 / 3;
      margin: 0 auto;
      background: #000;
      border-radius: 8px;
      overflow: hidden;
    }

    video {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .scanner-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      border: 2px solid rgba(76, 175, 80, 0.6);
      border-radius: 8px;
      pointer-events: none;
    }

    .scan-line {
      position: absolute;
      left: 10%;
      right: 10%;
      height: 2px;
      background: #4caf50;
      box-shadow: 0 0 8px rgba(76, 175, 80, 0.8);
      animation: scan 2s ease-in-out infinite;
    }

    @keyframes scan {
      0%, 100% { top: 20%; }
      50% { top: 80%; }
    }

    .error-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      text-align: center;
      padding: 16px;

      mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: #f44336;
        margin-bottom: 8px;
      }
    }

    .hint {
      text-align: center;
      color: var(--text-secondary);
      margin: 8px 0 0;
      font-size: 14px;
    }

    mat-dialog-content {
      min-width: 280px;
    }
  `]
})
export class BarcodeScannerDialog implements AfterViewInit, OnDestroy {
  @ViewChild('videoEl') videoRef!: ElementRef<HTMLVideoElement>;

  private barcode = inject(BarcodeService);
  private dialogRef = inject(MatDialogRef<BarcodeScannerDialog>);
  private stream: MediaStream | null = null;

  scanning = true;
  error = '';

  async ngAfterViewInit(): Promise<void> {
    try {
      const video = this.videoRef.nativeElement;
      const code = await this.barcode.scan(video);
      this.stream = video.srcObject as MediaStream;
      this.dialogRef.close(code);
    } catch (err: any) {
      this.scanning = false;
      this.error = err?.message || 'Failed to access camera';
    }
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  cancel(): void {
    this.cleanup();
    this.dialogRef.close(null);
  }

  private cleanup(): void {
    const video = this.videoRef?.nativeElement;
    if (video?.srcObject) {
      const stream = video.srcObject as MediaStream;
      stream.getTracks().forEach(t => t.stop());
      video.srcObject = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
  }
}
