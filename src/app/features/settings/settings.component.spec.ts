import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatIconTestingModule } from '@angular/material/icon/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { signal } from '@angular/core';
import { SettingsComponent } from './settings.component';
import { ThemeService } from '../../core/services/theme.service';
import { LanguageService } from '../../core/services/language.service';
import { HouseholdService } from '../../core/services/household.service';
import { ErrorHandlerService } from '../../core/services/error-handler.service';

describe('SettingsComponent', () => {
  let fixture: ComponentFixture<SettingsComponent>;
  let component: SettingsComponent;
  let themeSpy: { mode: ReturnType<typeof signal>; set: ReturnType<typeof vi.fn> };
  let langSpy: { currentLang: ReturnType<typeof signal>; availableLanguages: unknown[]; setLanguage: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    themeSpy = { mode: signal<'light' | 'dark'>('light'), set: vi.fn() };
    langSpy = {
      currentLang: signal('en'),
      availableLanguages: [{ code: 'en', label: 'English' }, { code: 'it', label: 'Italiano' }],
      setLanguage: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [
        SettingsComponent,
        MatIconTestingModule,
        TranslocoTestingModule.forRoot({ langs: { en: {} }, translocoConfig: { availableLangs: ['en'], defaultLang: 'en' } }),
      ],
      providers: [
        { provide: ThemeService, useValue: themeSpy },
        { provide: LanguageService, useValue: langSpy },
        { provide: HouseholdService, useValue: { household: signal(null), members: signal([]), loading: signal(false), loadHousehold: vi.fn() } },
        { provide: ErrorHandlerService, useValue: { handle: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('exposes the injected theme and language services', () => {
    expect(component.theme).toBe(themeSpy);
    expect(component.lang).toBe(langSpy);
  });

  it('toggles the theme to dark when the slide toggle changes', () => {
    const toggle: HTMLElement = fixture.nativeElement.querySelector('mat-slide-toggle');
    toggle.dispatchEvent(new CustomEvent('change', { detail: { checked: true } }));
    component.theme.set('dark');
    expect(themeSpy.set).toHaveBeenCalledWith('dark');
  });

  it('renders an option for every available language once the select opens', () => {
    const trigger: HTMLElement = fixture.nativeElement.querySelector('mat-select');
    trigger.click();
    fixture.detectChanges();
    const options = document.body.querySelectorAll('mat-option');
    expect(options.length).toBe(langSpy.availableLanguages.length);
  });

  it('embeds the household settings panel', () => {
    expect(fixture.nativeElement.querySelector('pp-household-settings')).toBeTruthy();
  });
});
