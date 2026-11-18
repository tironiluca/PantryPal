import { Injectable, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

/** localStorage key; also read by the boot script in index.html before Angular starts. */
export const THEME_STORAGE_KEY = 'pp-theme';

/**
 * Light/dark theme. Dark is the default (IMPLEMENTATION_PLAN.md, U9); a stored
 * choice wins. The stylesheet is dark unless `light-theme` is on <html>, and
 * `dark-theme` is kept in step for selectors that still use it.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  mode = signal<ThemeMode>(readStoredMode() ?? 'dark');

  constructor() {
    applyMode(this.mode());
  }

  set(mode: ThemeMode) {
    this.mode.set(mode);
    applyMode(mode);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // Storage blocked: the choice lasts for this page only.
    }
  }
}

function readStoredMode(): ThemeMode | null {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : null;
  } catch {
    return null;
  }
}

/** Browser/OS bar colour per theme: the --pp-bar token values in src/styles/_tokens.scss. */
export const THEME_BAR_COLOR: Record<ThemeMode, string> = { dark: '#181818', light: '#f8f8f8' };

function applyMode(mode: ThemeMode): void {
  const root = document.documentElement;
  root.classList.toggle('dark-theme', mode === 'dark');
  root.classList.toggle('light-theme', mode === 'light');
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', THEME_BAR_COLOR[mode]);
}
