import { Injectable, inject, signal } from '@angular/core';
import * as tf from '@tensorflow/tfjs';
import * as mobilenet from '@tensorflow-models/mobilenet';
import { DbService } from './db.service';
import { AuthService } from './auth.service';

export interface Prediction {
  className: string;
  probability: number;
}

export interface RecognitionResult {
  predictions: Prediction[];
  selectedLabel: string | null;
  confidence: number;
  imagePath?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ImageRecognitionService {
  private db = inject(DbService);
  private auth = inject(AuthService);

  private model: mobilenet.MobileNet | null = null;
  private modelLoading = signal(false);
  private modelLoaded = signal(false);

  isModelLoading = this.modelLoading.asReadonly();
  isModelLoaded = this.modelLoaded.asReadonly();

  /**
   * Load the MobileNet model
   */
  async loadModel(): Promise<void> {
    if (this.model || this.modelLoading()) {
      return; // Already loaded or loading
    }

    this.modelLoading.set(true);

    try {
      // Set TensorFlow.js backend (WebGL for better performance)
      await tf.setBackend('webgl');
      await tf.ready();

      // Load MobileNet model
      this.model = await mobilenet.load({
        version: 2,
        alpha: 1.0, // Model accuracy (0.25, 0.5, 0.75, 1.0)
      });

      this.modelLoaded.set(true);
      console.log('MobileNet model loaded successfully');
    } catch (error) {
      console.error('Failed to load MobileNet model:', error);
      this.modelLoaded.set(false);
      throw new Error('Failed to load image recognition model');
    } finally {
      this.modelLoading.set(false);
    }
  }

  /**
   * Recognize food items from an image
   */
  async recognizeFood(
    imageSource: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | File,
    topK: number = 5
  ): Promise<Prediction[]> {
    if (!this.model) {
      await this.loadModel();
    }

    if (!this.model) {
      throw new Error('Model not loaded');
    }

    try {
      let imageElement: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement;

      if (imageSource instanceof File) {
        imageElement = await this.fileToImage(imageSource);
      } else {
        imageElement = imageSource;
      }

      // Classify the image
      const predictions = await this.model.classify(imageElement, topK);

      return predictions.map(pred => ({
        className: this.cleanClassName(pred.className),
        probability: pred.probability,
      }));
    } catch (error) {
      console.error('Failed to recognize image:', error);
      throw new Error('Failed to recognize food in image');
    }
  }

  /**
   * Recognize from camera stream
   */
  async recognizeFromCamera(
    videoElement: HTMLVideoElement,
    topK: number = 5
  ): Promise<Prediction[]> {
    if (!this.model) {
      await this.loadModel();
    }

    if (!this.model) {
      throw new Error('Model not loaded');
    }

    try {
      const predictions = await this.model.classify(videoElement, topK);

      return predictions.map(pred => ({
        className: this.cleanClassName(pred.className),
        probability: pred.probability,
      }));
    } catch (error) {
      console.error('Failed to recognize from camera:', error);
      throw new Error('Failed to recognize food from camera');
    }
  }

  /**
   * Log a recognition result
   */
  logRecognition(
    predictions: Prediction[],
    selectedLabel: string | null,
    confidence: number,
    userCorrected: boolean = false,
    imagePath?: string
  ): void {
    const userId = this.auth.getCurrentUserId();
    if (!userId) return;

    const id = `img-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const timestamp = new Date().toISOString();

    this.db.exec(
      `INSERT INTO image_recognition_log (id, userId, imagePath, predictions, selectedLabel, confidence, userCorrected, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId,
        imagePath || null,
        JSON.stringify(predictions),
        selectedLabel,
        confidence,
        userCorrected ? 1 : 0,
        timestamp,
      ]
    );
  }

  /**
   * Get recognition history
   */
  getRecognitionHistory(limit: number = 50): RecognitionResult[] {
    const userId = this.auth.getCurrentUserId();
    if (!userId) return [];

    const records = this.db.query<any>(
      `SELECT * FROM image_recognition_log
       WHERE userId = ?
       ORDER BY timestamp DESC
       LIMIT ?`,
      [userId, limit]
    );

    return records.map(record => ({
      predictions: JSON.parse(record.predictions || '[]'),
      selectedLabel: record.selectedLabel,
      confidence: record.confidence,
      imagePath: record.imagePath,
    }));
  }

  /**
   * Clean up class name from MobileNet
   */
  private cleanClassName(className: string): string {
    // MobileNet returns labels like "banana, 123" or "apple, fruit"
    // Extract just the main label
    const parts = className.split(',');
    return parts[0].trim();
  }

  /**
   * Convert File to HTMLImageElement
   */
  private fileToImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const img = new Image();

        img.onload = () => {
          resolve(img);
        };

        img.onerror = () => {
          reject(new Error('Failed to load image'));
        };

        img.src = e.target?.result as string;
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };

      reader.readAsDataURL(file);
    });
  }

  /**
   * Preload model in the background
   */
  async preloadModel(): Promise<void> {
    try {
      await this.loadModel();
    } catch (error) {
      console.warn('Failed to preload model:', error);
    }
  }

  /**
   * Check if a prediction is likely food-related
   */
  isFoodRelated(className: string): boolean {
    const foodKeywords = [
      'food', 'fruit', 'vegetable', 'meat', 'bread', 'cheese', 'milk',
      'egg', 'fish', 'chicken', 'beef', 'pork', 'pasta', 'rice', 'bean',
      'tomato', 'potato', 'carrot', 'apple', 'banana', 'orange', 'lemon',
      'strawberry', 'grape', 'watermelon', 'pizza', 'burger', 'sandwich',
      'salad', 'soup', 'cake', 'cookie', 'chocolate', 'coffee', 'tea',
    ];

    const lowerClassName = className.toLowerCase();
    return foodKeywords.some(keyword => lowerClassName.includes(keyword));
  }

  /**
   * Get confidence threshold for auto-selection
   */
  getConfidenceThreshold(): number {
    return 0.6; // 60% confidence threshold
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
      this.modelLoaded.set(false);
    }
  }
}
