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
  template: `
    <h2 mat-dialog-title>
      <mat-icon>photo_camera</mat-icon>
      Recognize Food Item
    </h2>

    <mat-dialog-content>
      <div class="recognition-container">
        <!-- Camera/Upload Options -->
        @if (!imageSource() && !cameraActive()) {
          <div class="capture-options">
            <button
              mat-raised-button
              color="primary"
              (click)="startCamera()"
              class="option-button"
            >
              <mat-icon>photo_camera</mat-icon>
              Use Camera
            </button>

            <button
              mat-raised-button
              color="accent"
              (click)="fileInput.click()"
              class="option-button"
            >
              <mat-icon>upload_file</mat-icon>
              Upload Image
            </button>

            <input
              #fileInput
              type="file"
              accept="image/*"
              (change)="onFileSelected($event)"
              hidden
            />
          </div>
        }

        <!-- Camera View -->
        @if (cameraActive()) {
          <div class="camera-container">
            <video
              #videoElement
              class="camera-preview"
              autoplay
              playsinline
            ></video>

            <div class="camera-controls">
              <button
                mat-fab
                color="primary"
                (click)="captureImage()"
                [disabled]="recognizing()"
              >
                <mat-icon>camera</mat-icon>
              </button>
              <button
                mat-icon-button
                (click)="stopCamera()"
              >
                <mat-icon>close</mat-icon>
              </button>
            </div>
          </div>
        }

        <!-- Image Preview -->
        @if (imageSource() && !cameraActive()) {
          <div class="image-preview">
            <img [src]="imageSource()" alt="Captured image" />
          </div>
        }

        <!-- Recognition Status -->
        @if (recognizing()) {
          <div class="recognition-status">
            <mat-spinner diameter="40"></mat-spinner>
            <p>Analyzing image...</p>
          </div>
        }

        <!-- Predictions -->
        @if (predictions().length > 0 && !recognizing()) {
          <div class="predictions-container">
            <h3>Detected Items:</h3>

            <mat-list>
              @for (pred of predictions(); track $index) {
                <mat-list-item
                  class="prediction-item"
                  [class.selected]="selectedPrediction() === pred.className"
                  (click)="selectPrediction(pred)"
                >
                  <mat-icon matListItemIcon>
                    {{ selectedPrediction() === pred.className ? 'check_circle' : 'radio_button_unchecked' }}
                  </mat-icon>
                  <div matListItemTitle class="prediction-name">
                    {{ pred.className }}
                  </div>
                  <div matListItemLine class="prediction-confidence">
                    {{ (pred.probability * 100).toFixed(1) }}% confidence
                  </div>
                </mat-list-item>
              }
            </mat-list>

            @if (predictions().length > 0 && !isFoodRelated()) {
              <div class="warning-message">
                <mat-icon>warning</mat-icon>
                <span>These items don't seem to be food-related. You can still add them manually.</span>
              </div>
            }
          </div>
        }

        <!-- No Results -->
        @if (!recognizing() && imageSource() && predictions().length === 0 && recognitionAttempted()) {
          <div class="no-results">
            <mat-icon>search_off</mat-icon>
            <p>Could not recognize any food items in this image.</p>
            <p class="hint">Try taking a clearer photo or upload a different image.</p>
          </div>
        }
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">
        <mat-icon>close</mat-icon>
        Cancel
      </button>

      @if (imageSource() && !cameraActive()) {
        <button
          mat-button
          (click)="resetCapture()"
        >
          <mat-icon>refresh</mat-icon>
          Try Again
        </button>
      }

      @if (selectedPrediction()) {
        <button
          mat-raised-button
          color="primary"
          (click)="onConfirm()"
        >
          <mat-icon>check</mat-icon>
          Use "{{ selectedPrediction() }}"
        </button>
      }
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content {
      width: 90vw;
      max-width: 600px;
      min-height: 400px;
      padding: var(--spacing-md);
    }

    h2 {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);

      mat-icon {
        color: var(--primary-color);
      }
    }

    .recognition-container {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-lg);
    }

    .capture-options {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-md);
      padding: var(--spacing-xl);

      .option-button {
        padding: var(--spacing-lg);
        font-size: 16px;

        mat-icon {
          margin-right: var(--spacing-sm);
        }
      }
    }

    .camera-container {
      position: relative;
      width: 100%;
      background: #000;
      border-radius: 8px;
      overflow: hidden;

      .camera-preview {
        width: 100%;
        display: block;
      }

      .camera-controls {
        position: absolute;
        bottom: var(--spacing-md);
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        gap: var(--spacing-md);
        align-items: center;
      }
    }

    .image-preview {
      width: 100%;
      max-height: 400px;
      display: flex;
      justify-content: center;
      background: #f5f5f5;
      border-radius: 8px;
      overflow: hidden;

      img {
        max-width: 100%;
        max-height: 400px;
        object-fit: contain;
      }
    }

    .recognition-status {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--spacing-md);
      padding: var(--spacing-xl);

      p {
        margin: 0;
        color: var(--text-secondary);
        font-size: 16px;
      }
    }

    .predictions-container {
      h3 {
        margin: 0 0 var(--spacing-md) 0;
        font-size: 16px;
        font-weight: 600;
      }

      mat-list {
        padding: 0;
      }

      .prediction-item {
        cursor: pointer;
        border: 2px solid transparent;
        border-radius: 8px;
        margin-bottom: var(--spacing-xs);
        transition: all 0.2s ease;

        &:hover {
          background-color: rgba(0, 0, 0, 0.05);
        }

        &.selected {
          border-color: var(--primary-color);
          background-color: rgba(67, 160, 71, 0.1);

          mat-icon {
            color: var(--primary-color);
          }
        }

        .prediction-name {
          font-weight: 500;
          text-transform: capitalize;
        }

        .prediction-confidence {
          font-size: 14px;
          color: var(--text-secondary);
        }
      }
    }

    .warning-message {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      padding: var(--spacing-md);
      background: rgba(255, 152, 0, 0.1);
      border-left: 4px solid #ff9800;
      border-radius: 4px;
      margin-top: var(--spacing-md);

      mat-icon {
        color: #ff9800;
        font-size: 20px;
        width: 20px;
        height: 20px;
      }

      span {
        font-size: 14px;
        color: var(--text-secondary);
      }
    }

    .no-results {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--spacing-sm);
      padding: var(--spacing-xl);
      text-align: center;

      mat-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        opacity: 0.3;
      }

      p {
        margin: 0;
        color: var(--text-secondary);

        &.hint {
          font-size: 14px;
        }
      }
    }

    mat-dialog-actions {
      padding: var(--spacing-md);
      border-top: 1px solid var(--divider-color);

      button {
        margin-left: var(--spacing-sm);

        mat-icon {
          margin-right: var(--spacing-xs);
        }
      }
    }

    @media (max-width: 768px) {
      mat-dialog-content {
        width: 95vw;
        max-width: 95vw;
      }
    }
  `],
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
