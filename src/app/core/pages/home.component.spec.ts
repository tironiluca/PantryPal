import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MatIconTestingModule } from '@angular/material/icon/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { HomeComponent } from './home.component';
import { SyncService } from '../services/sync.service';
import { AuthService } from '../services/auth.service';
import { NAV_TABS } from '../nav-tabs';

describe('HomeComponent', () => {
  let fixture: ComponentFixture<HomeComponent>;
  let component: HomeComponent;
  let syncSpy: { startAutoSync: ReturnType<typeof vi.fn> };
  let authSpy: { isAuthenticated: ReturnType<typeof vi.fn> };

  async function setup() {
    await TestBed.configureTestingModule({
      imports: [
        HomeComponent,
        MatIconTestingModule,
        TranslocoTestingModule.forRoot({ langs: { en: {} }, translocoConfig: { availableLangs: ['en'], defaultLang: 'en' } }),
      ],
      providers: [
        provideRouter([]),
        { provide: SyncService, useValue: syncSpy },
        { provide: AuthService, useValue: authSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
  }

  it('starts auto-sync when the user is authenticated', async () => {
    syncSpy = { startAutoSync: vi.fn() };
    authSpy = { isAuthenticated: vi.fn().mockReturnValue(true) };
    await setup();
    fixture.detectChanges();

    expect(syncSpy.startAutoSync).toHaveBeenCalledWith(5);
  });

  it('does not start auto-sync for an unauthenticated user', async () => {
    syncSpy = { startAutoSync: vi.fn() };
    authSpy = { isAuthenticated: vi.fn().mockReturnValue(false) };
    await setup();
    fixture.detectChanges();

    expect(syncSpy.startAutoSync).not.toHaveBeenCalled();
  });

  it('exposes every configured navigation tab', async () => {
    syncSpy = { startAutoSync: vi.fn() };
    authSpy = { isAuthenticated: vi.fn().mockReturnValue(false) };
    await setup();
    fixture.detectChanges();

    expect(component.tabs).toBe(NAV_TABS);
    expect(fixture.nativeElement.querySelectorAll('a[mat-tab-link]').length).toBe(NAV_TABS.length);
  });
});
