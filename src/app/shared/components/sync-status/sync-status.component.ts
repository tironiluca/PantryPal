import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../core/services/auth.service';
import { SyncService } from '../../../core/services/sync.service';

@Component({
  selector: 'pp-sync-status',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatBadgeModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="sync-status">
      @if (isAuthenticated()) {
        <button
          mat-icon-button
          [matTooltip]="tooltipText()"
          (click)="onSyncClick()"
          [disabled]="syncService.isSyncing()"
          class="sync-button"
          [class.syncing]="syncService.isSyncing()"
          [class.error]="syncService.syncStatus() === 'error'"
          [class.offline]="syncService.syncStatus() === 'offline'"
        >
          @if (syncService.isSyncing()) {
            <mat-spinner diameter="24"></mat-spinner>
          } @else {
            <mat-icon
              [matBadge]="unsyncedCount()"
              [matBadgeHidden]="unsyncedCount() === 0"
              matBadgeColor="warn"
              matBadgeSize="small"
            >
              {{ syncIcon() }}
            </mat-icon>
          }
        </button>
      } @else {
        <!-- Sign In Button -->
        <button
          mat-icon-button
          [matTooltip]="'Sign in to sync across devices'"
          routerLink="/auth/login"
          class="signin-button"
        >
          <mat-icon>login</mat-icon>
        </button>
      }
    </div>
  `,
  styles: [`
    .sync-status {
      display: flex;
      align-items: center;
      gap: var(--spacing-xs);
    }

    .sync-button {
      position: relative;

      &.syncing {
        mat-spinner {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        }
      }

      &.error mat-icon {
        color: var(--warn-color, #f44336);
      }

      &.offline mat-icon {
        color: var(--text-secondary, #757575);
      }

      mat-icon {
        transition: color 0.3s ease;
      }

      &:not(.error):not(.offline):not(.syncing) mat-icon {
        color: var(--primary-color, #1976d2);
      }
    }

    .signin-button {
      mat-icon {
        color: var(--text-secondary);
      }

      &:hover mat-icon {
        color: var(--primary-color);
      }
    }
  `],
})
export class SyncStatusComponent {
  auth = inject(AuthService);
  syncService = inject(SyncService);

  isAuthenticated = this.auth.isAuthenticated;

  syncStats = computed(() => this.syncService.getSyncStats());
  unsyncedCount = computed(() => this.syncStats().unsyncedCount);

  syncIcon = computed(() => {
    const status = this.syncService.syncStatus();

    switch (status) {
      case 'syncing':
        return 'sync';
      case 'success':
        return 'cloud_done';
      case 'error':
        return 'cloud_off';
      case 'offline':
        return 'cloud_off';
      default:
        return this.unsyncedCount() > 0 ? 'cloud_upload' : 'cloud_done';
    }
  });

  tooltipText = computed(() => {
    const status = this.syncService.syncStatus();
    const lastSync = this.syncService.lastSyncTime();
    const unsynced = this.unsyncedCount();

    if (this.syncService.isSyncing()) {
      return 'Syncing...';
    }

    switch (status) {
      case 'error':
        return 'Sync failed. Click to retry.';
      case 'offline':
        return 'Offline. Will sync when back online.';
      case 'success':
        if (lastSync) {
          const timeAgo = this.getTimeAgo(lastSync);
          return `Last synced ${timeAgo}`;
        }
        return 'Synced';
      default:
        if (unsynced > 0) {
          return `${unsynced} unsynced change${unsynced > 1 ? 's' : ''}. Click to sync.`;
        }
        return 'Click to sync';
    }
  });

  async onSyncClick(): Promise<void> {
    await this.syncService.syncNow();
  }

  private getTimeAgo(date: Date): string {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

    if (seconds < 60) {
      return 'just now';
    }

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes}m ago`;
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `${hours}h ago`;
    }

    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }
}
