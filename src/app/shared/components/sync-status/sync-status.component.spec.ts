import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MatIconTestingModule } from '@angular/material/icon/testing';
import { signal } from '@angular/core';
import { SyncStatusComponent } from './sync-status.component';
import { AuthService } from '../../../core/services/auth.service';
import { SyncService, SyncStatus } from '../../../core/services/sync.service';

describe('SyncStatusComponent', () => {
  let fixture: ComponentFixture<SyncStatusComponent>;
  let component: SyncStatusComponent;
  let authSpy: { isAuthenticated: ReturnType<typeof signal> };
  let syncSpy: {
    getSyncStats: ReturnType<typeof vi.fn>;
    syncStatus: ReturnType<typeof signal>;
    lastSyncTime: ReturnType<typeof signal>;
    isSyncing: ReturnType<typeof signal>;
    syncNow: ReturnType<typeof vi.fn>;
  };

  async function setup() {
    await TestBed.configureTestingModule({
      imports: [SyncStatusComponent, MatIconTestingModule],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authSpy },
        { provide: SyncService, useValue: syncSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SyncStatusComponent);
    component = fixture.componentInstance;
  }

  beforeEach(() => {
    authSpy = { isAuthenticated: signal(true) };
    syncSpy = {
      getSyncStats: vi.fn().mockReturnValue({ unsyncedCount: 0 }),
      syncStatus: signal<SyncStatus>('idle'),
      lastSyncTime: signal<Date | null>(null),
      isSyncing: signal(false),
      syncNow: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('shows a sign-in button when the user is not authenticated', async () => {
    authSpy.isAuthenticated.set(false);
    await setup();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.signin-button')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.sync-button')).toBeNull();
  });

  it('shows the sync button for an authenticated user', async () => {
    await setup();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.sync-button')).toBeTruthy();
  });

  describe('unsyncedCount', () => {
    it('reflects the database sync stats', async () => {
      syncSpy.getSyncStats.mockReturnValue({ unsyncedCount: 4 });
      await setup();
      expect(component.unsyncedCount()).toBe(4);
    });
  });

  describe('syncIcon', () => {
    it('shows sync while syncing', async () => {
      await setup();
      syncSpy.syncStatus.set('syncing');
      expect(component.syncIcon()).toBe('sync');
    });

    it('shows cloud_done on success', async () => {
      await setup();
      syncSpy.syncStatus.set('success');
      expect(component.syncIcon()).toBe('cloud_done');
    });

    it('shows cloud_off on error', async () => {
      await setup();
      syncSpy.syncStatus.set('error');
      expect(component.syncIcon()).toBe('cloud_off');
    });

    it('shows cloud_off when offline', async () => {
      await setup();
      syncSpy.syncStatus.set('offline');
      expect(component.syncIcon()).toBe('cloud_off');
    });

    it('shows cloud_upload when idle with unsynced changes', async () => {
      syncSpy.getSyncStats.mockReturnValue({ unsyncedCount: 2 });
      await setup();
      expect(component.syncIcon()).toBe('cloud_upload');
    });

    it('shows cloud_done when idle with nothing unsynced', async () => {
      await setup();
      expect(component.syncIcon()).toBe('cloud_done');
    });
  });

  describe('tooltipText', () => {
    it('shows a syncing message while a sync is in progress', async () => {
      await setup();
      syncSpy.isSyncing.set(true);
      expect(component.tooltipText()).toBe('Syncing...');
    });

    it('shows a retry message on error', async () => {
      await setup();
      syncSpy.syncStatus.set('error');
      expect(component.tooltipText()).toBe('Sync failed. Click to retry.');
    });

    it('shows an offline message when offline', async () => {
      await setup();
      syncSpy.syncStatus.set('offline');
      expect(component.tooltipText()).toBe('Offline. Will sync when back online.');
    });

    it('shows "Synced" with no last sync time recorded', async () => {
      await setup();
      syncSpy.syncStatus.set('success');
      expect(component.tooltipText()).toBe('Synced');
    });

    it('shows how long ago the last sync completed', async () => {
      await setup();
      syncSpy.syncStatus.set('success');
      syncSpy.lastSyncTime.set(new Date(Date.now() - 5 * 60 * 1000));
      expect(component.tooltipText()).toBe('Last synced 5m ago');
    });

    it('shows a prompt to sync when there are unsynced changes and nothing else is reported', async () => {
      syncSpy.getSyncStats.mockReturnValue({ unsyncedCount: 1 });
      await setup();
      expect(component.tooltipText()).toBe('1 unsynced change. Click to sync.');
    });

    it('pluralizes multiple unsynced changes', async () => {
      syncSpy.getSyncStats.mockReturnValue({ unsyncedCount: 3 });
      await setup();
      expect(component.tooltipText()).toBe('3 unsynced changes. Click to sync.');
    });

    it('prompts to sync when idle with nothing unsynced', async () => {
      await setup();
      expect(component.tooltipText()).toBe('Click to sync');
    });
  });

  describe('onSyncClick', () => {
    it('delegates to the sync service', async () => {
      await setup();
      await component.onSyncClick();
      expect(syncSpy.syncNow).toHaveBeenCalled();
    });
  });
});
