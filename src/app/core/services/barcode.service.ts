import { Injectable } from '@angular/core';
import { BrowserCodeReader, BrowserMultiFormatReader } from '@zxing/library';

@Injectable({ providedIn: 'root' })
export class BarcodeService {
  async scan(videoEl: HTMLVideoElement): Promise<string | null> {
    if ('BarcodeDetector' in window) {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      videoEl.srcObject = stream;
      await videoEl.play();
      const detector = new (window as any).BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'upc_a'] });
      const end = Date.now() + 8000;
      while (Date.now() < end) {
        const bitmap = await createImageBitmap(videoEl as any);
        try {
          const codes = await detector.detect(bitmap);
          if (codes?.length) { (stream as MediaStream).getTracks().forEach(t => t.stop()); return codes[0].rawValue; }
        } catch { }
        await new Promise(r => setTimeout(r, 200));
      }
      (stream as MediaStream).getTracks().forEach(t => t.stop());
      return null;
    }
    
    const codeReader = new BrowserMultiFormatReader();

    return new Promise(async resolve => {

      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });

      const controls = await codeReader.decodeFromVideoDevice(null, videoEl, result => {
        if (result) {
          stream.getTracks().forEach(t => t.stop());
          resolve(result.getText());
        }
      });
      setTimeout(() => {
        stream.getTracks().forEach(t => t.stop());
        resolve(null);
      }
        , 10000);
    });
  }
}
