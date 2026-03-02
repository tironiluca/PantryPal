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
  templateUrl: './barcode-scanner.dialog.html',
  styleUrls: ['./barcode-scanner.dialog.scss']
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
