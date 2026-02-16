import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  mode = signal<'light'|'dark'>( (localStorage.getItem('pp-theme') as 'light'|'dark') || 'light' );

  constructor() {
    document.documentElement.classList.toggle('dark-theme', this.mode() === 'dark');
  }

  set(mode: 'light'|'dark') {
    this.mode.set(mode);
    document.documentElement.classList.toggle('dark-theme', mode === 'dark');
    localStorage.setItem('pp-theme', mode);
  }
}
