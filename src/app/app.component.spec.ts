import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MatIconTestingModule } from '@angular/material/icon/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { signal } from '@angular/core';
import { of, Subject } from 'rxjs';
import { AppComponent } from './app.component';
import { ThemeService } from './core/services/theme.service';
import { AuthService } from './core/services/auth.service';
import { MigrationService } from './core/services/migration.service';
import { VoiceService } from './core/services/voice.service';
import { VoiceCommandService } from './core/services/voice-command.service';
import { SnackbarService } from './core/services/snackbar.service';
import { SyncService } from './core/services/sync.service';

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;
  let component: AppComponent;
  let themeSpy: { mode: ReturnType<typeof signal>; set: ReturnType<typeof vi.fn> };
  let authSpy: { isAuthenticated: ReturnType<typeof signal>; loading: ReturnType<typeof signal>; signOut: ReturnType<typeof vi.fn> };
  let migrationSpy: { checkAndMigrate: ReturnType<typeof vi.fn> };
  let voiceSpy: {
    isSupported: ReturnType<typeof vi.fn>;
    listening: ReturnType<typeof signal>;
    transcript$: Subject<any>;
    error$: Subject<string>;
    toggleListening: ReturnType<typeof vi.fn>;
    stopListening: ReturnType<typeof vi.fn>;
    logCommand: ReturnType<typeof vi.fn>;
  };
  let snackbarSpy: { warning: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> };

  async function setup(voiceSupported: boolean) {
    themeSpy = { mode: signal<'light' | 'dark'>('light'), set: vi.fn() };
    authSpy = { isAuthenticated: signal(false), loading: signal(false), signOut: vi.fn().mockResolvedValue(undefined) };
    migrationSpy = { checkAndMigrate: vi.fn() };
    voiceSpy = {
      isSupported: vi.fn().mockReturnValue(voiceSupported),
      listening: signal(false),
      transcript$: new Subject(),
      error$: new Subject(),
      toggleListening: vi.fn(),
      stopListening: vi.fn(),
      logCommand: vi.fn(),
    };
    snackbarSpy = { warning: vi.fn(), error: vi.fn(), info: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [
        AppComponent,
        MatIconTestingModule,
        TranslocoTestingModule.forRoot({ langs: { en: {} }, translocoConfig: { availableLangs: ['en'], defaultLang: 'en' } }),
      ],
      providers: [
        provideRouter([]),
        { provide: ThemeService, useValue: themeSpy },
        { provide: AuthService, useValue: authSpy },
        { provide: MigrationService, useValue: migrationSpy },
        { provide: VoiceService, useValue: voiceSpy },
        { provide: VoiceCommandService, useValue: { parseCommand: vi.fn(), executeCommand: vi.fn(), getSupportedCommands: vi.fn().mockReturnValue([]) } },
        { provide: SnackbarService, useValue: snackbarSpy },
        {
          provide: SyncService,
          useValue: {
            getSyncStats: vi.fn().mockReturnValue({ unsyncedCount: 0 }),
            syncStatus: signal('idle'),
            lastSyncTime: signal(null),
            isSyncing: signal(false),
            syncNow: vi.fn(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
  }

  it('reads voice support from the voice service at construction', async () => {
    await setup(true);
    expect(component.voiceSupported).toBe(true);
    expect(() => fixture.detectChanges()).not.toThrow();
  });

  it('toggles the theme between light and dark', async () => {
    await setup(false);
    fixture.detectChanges();

    component.toggleTheme();
    expect(themeSpy.set).toHaveBeenCalledWith('dark');
  });

  it('warns instead of starting voice control when unsupported', async () => {
    await setup(false);
    fixture.detectChanges();

    component.toggleVoiceControl();
    expect(voiceSpy.toggleListening).not.toHaveBeenCalled();
    expect(snackbarSpy.warning).toHaveBeenCalledWith('Voice commands are not supported in this browser');
  });

  it('toggles listening when voice control is supported', async () => {
    await setup(true);
    fixture.detectChanges();

    component.toggleVoiceControl();
    expect(voiceSpy.toggleListening).toHaveBeenCalled();
  });

  it('shows an error snackbar when toggling voice control throws', async () => {
    await setup(true);
    voiceSpy.toggleListening.mockImplementation(() => { throw new Error('mic busy'); });
    fixture.detectChanges();

    component.toggleVoiceControl();
    expect(snackbarSpy.error).toHaveBeenCalledWith('Failed to start voice control');
  });

  it('signs the user out on logout', async () => {
    await setup(false);
    fixture.detectChanges();

    await component.logout();
    expect(authSpy.signOut).toHaveBeenCalled();
  });

  it('runs migration once the user is authenticated and loading has finished', async () => {
    await setup(false);
    fixture.detectChanges();
    expect(migrationSpy.checkAndMigrate).not.toHaveBeenCalled();

    authSpy.isAuthenticated.set(true);
    fixture.detectChanges();

    expect(migrationSpy.checkAndMigrate).toHaveBeenCalled();
  });

  it('does not render the sync status widget for a signed-out user', async () => {
    await setup(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('pp-sync-status')).toBeNull();
  });

  it('renders the sync status widget once authenticated', async () => {
    await setup(false);
    authSpy.isAuthenticated.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('pp-sync-status')).toBeTruthy();
  });
});
