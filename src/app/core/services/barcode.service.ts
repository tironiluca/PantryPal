import { Injectable } from '@angular/core';
import { BrowserMultiFormatReader } from '@zxing/library';

@Injectable({ providedIn: 'root' })
export class BarcodeService {
  async scan(videoEl: HTMLVideoElement): Promise<string | null> {
    // Ensure mobile-compatible attributes
    videoEl.setAttribute('playsinline', 'true');
    videoEl.setAttribute('autoplay', 'true');
    videoEl.setAttribute('muted', 'true');
    videoEl.muted = true;

    const videoConstraints: MediaTrackConstraints = {
      facingMode: 'environment',
      width: { ideal: 1280 },
      height: { ideal: 720 },
    };

    try {
      // Try native BarcodeDetector API first (if available)
      if ('BarcodeDetector' in window) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
        // Wrap in try/finally so the stream is always stopped, even if an exception occurs (BUG-23)
        try {
          videoEl.srcObject = stream;

          try {
            await videoEl.play();
          } catch (playError) {
            console.warn('Video play failed, retrying with muted:', playError);
            videoEl.muted = true;
            await videoEl.play();
          }

          const detector = new (window as any).BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'code_128', 'upc_a']
          });

          const end = Date.now() + 8000;
          while (Date.now() < end) {
            try {
              const bitmap = await createImageBitmap(videoEl as any);
              const codes = await detector.detect(bitmap);
              if (codes?.length) {
                return codes[0].rawValue;
              }
            } catch (detectionError) {
              // Frame not ready yet, continue
            }
            await new Promise(r => setTimeout(r, 200));
          }
          return null;
        } finally {
          // Stop all tracks so the camera light turns off (stream cleanup for BarcodeDetector path)
          stream.getTracks().forEach(t => t.stop());
        }
      }

      // Fallback to ZXing library
      const codeReader = new BrowserMultiFormatReader();

      return new Promise<string | null>((resolve, reject) => {
        const timeout = setTimeout(() => {
          codeReader.reset();
          resolve(null);
        }, 10000);

        codeReader.decodeFromVideoDevice(null, videoEl, (result, error) => {
          if (result) {
            clearTimeout(timeout);
            codeReader.reset();
            resolve(result.getText());
          } else if (error) {
            // Not found yet, keep scanning
          }
        }).catch(err => {
          clearTimeout(timeout);
          console.error('ZXing initialization error:', err);
          reject(new Error('Failed to initialize barcode scanner'));
        });
      });
    } catch (error) {
      console.error('Barcode scan failed:', error);
      throw new Error('Failed to access camera. Please check camera permissions.');
    }
    // Note: stream cleanup is handled by the caller (BarcodeScannerDialog)
  }
}
