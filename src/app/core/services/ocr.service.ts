import { Injectable } from '@angular/core';
import Tesseract from 'tesseract.js';

@Injectable({ providedIn: 'root' })
export class OcrService {
  async extractExpiry(file: File): Promise<string | null> {
    const { data } = await Tesseract.recognize(file, 'eng+ita');
    const text = data.text.replace(/\n/g, ' ');
    const m = text.match(/(\b\d{2}[\/.-]\d{2}[\/.-]\d{4}\b|\b\d{4}-\d{2}-\d{2}\b)/);
    if (!m) return null;
    const raw = m[0].replace(/[.-]/g, '/');
    const [a,b,c] = raw.split('/');
    const iso = a.length === 4 ? `${a}-${b}-${c}` : `${c}-${a}-${b}`;
    const d = new Date(iso);
    if (isNaN(+d)) return null;
    const now = new Date();
    const max = new Date(); max.setFullYear(now.getFullYear() + 5);
    if (d < now || d > max) return null;
    return iso;
  }
}
