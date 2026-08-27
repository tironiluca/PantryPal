import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { LanguageService } from './language.service';
import { DbService } from './db.service';
import { AuthService } from './auth.service';

describe('LanguageService', () => {
  let service: LanguageService;
  let transloco: { setActiveLang: ReturnType<typeof vi.fn> };
  let db: { query: ReturnType<typeof vi.fn>; exec: ReturnType<typeof vi.fn> };
  let auth: { getCurrentUserId: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    localStorage.clear();
    transloco = { setActiveLang: vi.fn() };
    db = { query: vi.fn(() => []), exec: vi.fn() };
    auth = { getCurrentUserId: vi.fn(() => null) };
    TestBed.configureTestingModule({
      providers: [
        LanguageService,
        { provide: TranslocoService, useValue: transloco },
        { provide: DbService, useValue: db },
        { provide: AuthService, useValue: auth },
      ],
    });
    service = TestBed.inject(LanguageService);
  });

  it('loads an unauthenticated language from local storage', () => {
    localStorage.setItem('pp-language', 'it');

    service.init();

    expect(service.currentLang()).toBe('it');
    expect(transloco.setActiveLang).toHaveBeenCalledWith('it');
  });

  it('saves unauthenticated language locally', () => {
    service.setLanguage('it');

    expect(service.currentLang()).toBe('it');
    expect(localStorage.getItem('pp-language')).toBe('it');
    expect(db.query).not.toHaveBeenCalled();
  });

  it('loads and updates authenticated language settings', () => {
    auth.getCurrentUserId.mockReturnValue('user-1');
    db.query.mockReturnValueOnce([{ language: 'it' }]).mockReturnValueOnce([{ userId: 'user-1' }]);

    service.init();
    service.setLanguage('en');

    expect(service.currentLang()).toBe('en');
    expect(transloco.setActiveLang).toHaveBeenCalledWith('it');
    expect(db.exec).toHaveBeenCalledWith(
      'UPDATE user_settings SET language = ?, updatedAt = ? WHERE userId = ?',
      expect.arrayContaining(['en', 'user-1'])
    );
  });

  it('falls back to local storage when authenticated settings cannot be read', () => {
    localStorage.setItem('pp-language', 'it');
    auth.getCurrentUserId.mockReturnValue('user-1');
    db.query.mockImplementation(() => {
      throw new Error('database unavailable');
    });

    service.init();

    expect(service.currentLang()).toBe('it');
    expect(transloco.setActiveLang).toHaveBeenCalledWith('it');
  });
});
