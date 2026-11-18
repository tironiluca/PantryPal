import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  const root = document.documentElement;

  beforeEach(() => {
    localStorage.clear();
    root.classList.remove('dark-theme', 'light-theme');
  });

  it('defaults to dark mode when nothing is stored', () => {
    const service = new ThemeService();

    expect(service.mode()).toBe('dark');
    expect(root.classList.contains('dark-theme')).toBe(true);
    expect(root.classList.contains('light-theme')).toBe(false);
  });

  it('keeps a stored light choice', () => {
    localStorage.setItem('pp-theme', 'light');

    const service = new ThemeService();

    expect(service.mode()).toBe('light');
    expect(root.classList.contains('light-theme')).toBe(true);
    expect(root.classList.contains('dark-theme')).toBe(false);
  });

  it('ignores an unknown stored value and falls back to dark', () => {
    localStorage.setItem('pp-theme', 'sepia');

    expect(new ThemeService().mode()).toBe('dark');
  });

  it('persists mode changes and updates the document classes', () => {
    const service = new ThemeService();

    service.set('light');
    expect(localStorage.getItem('pp-theme')).toBe('light');
    expect(root.classList.contains('light-theme')).toBe(true);
    expect(root.classList.contains('dark-theme')).toBe(false);

    service.set('dark');
    expect(localStorage.getItem('pp-theme')).toBe('dark');
    expect(root.classList.contains('dark-theme')).toBe(true);
    expect(root.classList.contains('light-theme')).toBe(false);
  });

  it('still switches when storage is blocked', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const service = new ThemeService();

    expect(() => service.set('light')).not.toThrow();
    expect(root.classList.contains('light-theme')).toBe(true);
    setItem.mockRestore();
  });
});
