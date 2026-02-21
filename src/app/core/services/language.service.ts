import { Injectable, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { DbService } from './db.service';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private transloco = inject(TranslocoService);
  private db = inject(DbService);
  private auth = inject(AuthService);

  currentLang = signal<string>('en');

  readonly availableLanguages = [
    { code: 'en', label: 'English' },
    { code: 'it', label: 'Italiano' },
  ];

  init(): void {
    const saved = this.getSavedLanguage();
    if (saved) {
      this.currentLang.set(saved);
      this.transloco.setActiveLang(saved);
    }
  }

  setLanguage(lang: string): void {
    this.currentLang.set(lang);
    this.transloco.setActiveLang(lang);
    this.saveLanguage(lang);
  }

  private getSavedLanguage(): string | null {
    const userId = this.auth.getCurrentUserId();
    if (!userId) {
      // Fall back to localStorage for unauthenticated users
      return localStorage.getItem('pp-language');
    }

    try {
      const rows = this.db.query<{ language: string }>(
        'SELECT language FROM user_settings WHERE userId = ?',
        [userId]
      );
      return rows.length > 0 ? rows[0].language : null;
    } catch {
      return localStorage.getItem('pp-language');
    }
  }

  private saveLanguage(lang: string): void {
    localStorage.setItem('pp-language', lang);

    const userId = this.auth.getCurrentUserId();
    if (!userId) return;

    try {
      const now = new Date().toISOString();
      const existing = this.db.query<any>(
        'SELECT userId FROM user_settings WHERE userId = ?',
        [userId]
      );

      if (existing.length > 0) {
        this.db.exec(
          'UPDATE user_settings SET language = ?, updatedAt = ? WHERE userId = ?',
          [lang, now, userId]
        );
      } else {
        this.db.exec(
          'INSERT INTO user_settings (userId, language, updatedAt) VALUES (?, ?, ?)',
          [userId, lang, now]
        );
      }
    } catch {
      // DB not ready yet, localStorage fallback is already set
    }
  }
}
