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
  templateUrl: './sync-status.component.html',
  styleUrls: ['./sync-status.component.scss'],
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
