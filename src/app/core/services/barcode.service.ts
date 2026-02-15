import { Injectable } from '@angular/core';
import { BrowserCodeReader, BrowserMultiFormatReader } from '@zxing/library';

@Injectable({ providedIn: 'root' })
export class BarcodeService {
  async scan(videoEl: HTMLVideoElement): Promise<string | null> {
    let stream: MediaStream | null = null;

    try {
      // Try native BarcodeDetector API first (if available)
      if ('BarcodeDetector' in window) {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        videoEl.srcObject = stream;
        await videoEl.play();

        const detector = new (window as any).BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'code_128', 'upc_a']
        });

        const end = Date.now() + 8000;
        while (Date.now() < end) {
          const bitmap = await createImageBitmap(videoEl as any);
          try {
            const codes = await detector.detect(bitmap);
            if (codes?.length) {
              return codes[0].rawValue;
            }
          } catch (detectionError) {
            console.warn('Barcode detection frame error:', detectionError);
          }
          await new Promise(r => setTimeout(r, 200));
        }
        return null;
      }

      // Fallback to ZXing library
      const codeReader = new BrowserMultiFormatReader();
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });

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
            console.warn('ZXing decode error:', error);
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
    } finally {
      // Always cleanup resources
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (videoEl.srcObject) {
        videoEl.srcObject = null;
      }
    }
  }
}
