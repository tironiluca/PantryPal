import { Component, inject, signal, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';
import { ImageRecognitionService, Prediction } from '../../core/services/image-recognition.service';
import { SnackbarService } from '../../core/services/snackbar.service';

@Component({
  selector: 'pp-image-recognition-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatListModule,
    MatChipsModule,
  ],
  templateUrl: './image-recognition.dialog.html',
  styleUrls: ['./image-recognition.dialog.scss'],
})
export class ImageRecognitionDialog implements OnInit, OnDestroy {
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  private imageRecognition = inject(ImageRecognitionService);
  private snackbar = inject(SnackbarService);
  private dialogRef = inject(MatDialogRef<ImageRecognitionDialog>);

  cameraActive = signal(false);
  imageSource = signal<string>('');
  recognizing = signal(false);
  predictions = signal<Prediction[]>([]);
  selectedPrediction = signal<string | null>(null);
  recognitionAttempted = signal(false);

  private mediaStream: MediaStream | null = null;

  ngOnInit(): void {
    // Preload model in the background
    this.imageRecognition.preloadModel();
  }

  ngOnDestroy(): void {
    this.stopCamera();
  }

  async startCamera(): Promise<void> {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Use back camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      this.cameraActive.set(true);

      // Wait for view to update
      setTimeout(() => {
        if (this.videoElement?.nativeElement) {
          this.videoElement.nativeElement.srcObject = this.mediaStream;
        }
      }, 100);
    } catch (error) {
      console.error('Failed to start camera:', error);
      this.snackbar.error('Failed to access camera. Please check permissions.');
    }
  }

  stopCamera(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    this.cameraActive.set(false);
  }

  async captureImage(): Promise<void> {
    if (!this.videoElement?.nativeElement) return;

    const video = this.videoElement.nativeElement;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    const imageDataUrl = canvas.toDataURL('image/jpeg');

    this.imageSource.set(imageDataUrl);
    this.stopCamera();

    await this.recognizeImage();
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      this.imageSource.set(e.target?.result as string);
      await this.recognizeImage();
    };
    reader.readAsDataURL(file);
  }

  async recognizeImage(): Promise<void> {
    if (!this.imageSource()) return;

    this.recognizing.set(true);
    this.predictions.set([]);
    this.selectedPrediction.set(null);
    this.recognitionAttempted.set(true);

    try {
      const img = new Image();
      img.src = this.imageSource();

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const preds = await this.imageRecognition.recognizeFood(img, 5);
      this.predictions.set(preds);

      // Auto-select first prediction if confidence is high enough
      const threshold = this.imageRecognition.getConfidenceThreshold();
      if (preds.length > 0 && preds[0].probability >= threshold) {
        this.selectedPrediction.set(preds[0].className);
      }

      if (preds.length === 0) {
        this.snackbar.warning('No food items detected in image');
      } else {
        this.snackbar.success(`Detected ${preds.length} possible items`);
      }
    } catch (error) {
      console.error('Failed to recognize image:', error);
      this.snackbar.error('Failed to analyze image');
    } finally {
      this.recognizing.set(false);
    }
  }

  selectPrediction(prediction: Prediction): void {
    this.selectedPrediction.set(prediction.className);
  }

  isFoodRelated(): boolean {
    const selected = this.selectedPrediction();
    if (!selected) return false;
    return this.imageRecognition.isFoodRelated(selected);
  }

  resetCapture(): void {
    this.imageSource.set('');
    this.predictions.set([]);
    this.selectedPrediction.set(null);
    this.recognitionAttempted.set(false);
  }

  onConfirm(): void {
    const selected = this.selectedPrediction();
    if (!selected) return;

    const selectedPred = this.predictions().find(p => p.className === selected);

    // Log the recognition
    this.imageRecognition.logRecognition(
      this.predictions(),
      selected,
      selectedPred?.probability || 0
    );

    this.dialogRef.close(selected);
  }

  onCancel(): void {
    this.stopCamera();
    this.dialogRef.close(null);
  }
}
