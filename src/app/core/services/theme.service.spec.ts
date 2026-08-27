import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark-theme');
  });

  it('defaults to light mode and clears the dark class', () => {
    const service = new ThemeService();

    expect(service.mode()).toBe('light');
    expect(document.documentElement.classList.contains('dark-theme')).toBe(false);
  });

  it('restores and applies a saved dark mode', () => {
    localStorage.setItem('pp-theme', 'dark');

    const service = new ThemeService();

    expect(service.mode()).toBe('dark');
    expect(document.documentElement.classList.contains('dark-theme')).toBe(true);
  });

  it('persists mode changes and updates the document class', () => {
    const service = new ThemeService();

    service.set('dark');
    expect(localStorage.getItem('pp-theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark-theme')).toBe(true);

    service.set('light');
    expect(localStorage.getItem('pp-theme')).toBe('light');
    expect(document.documentElement.classList.contains('dark-theme')).toBe(false);
  });
});
