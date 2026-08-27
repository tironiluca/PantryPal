import { Injectable, inject, effect } from '@angular/core';
import { DbService } from './db.service';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private db = inject(DbService);
  private auth = inject(AuthService);

  private pollHandle: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Automatically stop polling when the user signs out
    effect(() => {
      if (!this.auth.isAuthenticated()) {
        this.stopPolling();
      }
    });
  }

  async requestPermission() {
    if (typeof Notification === 'undefined') return false;
    if (Notification.permission === 'granted') return true;
    const res = await Notification.requestPermission();
    return res === 'granted';
  }

  async checkAndNotify() {
    const items = this.db.getExpiringInventory();
    const today = new Date();
    for (const it of items) {
      const expiry = new Date(it.expiry);
      const start = new Date(expiry); start.setDate(start.getDate() - (it.notifyStartDays ?? 3));
      if (today >= start) {
        const key = `notified:${it.id}`;
        const last = localStorage.getItem(key);
        const repeatDays = it.notifyRepeatDays ?? 1;
        const should = !last || (Date.now() - +last) > repeatDays * 864e5;
        if (should && 'serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.getRegistration();
          reg?.showNotification('Expiring soon', { body: `${it.name} expires on ${it.expiry}` });
          localStorage.setItem(key, String(Date.now()));
        }
      }
    }
  }

  startPolling(intervalMs = 60 * 60 * 1000) {
    if (this.pollHandle !== null) return;
    this.pollHandle = setInterval(() => {
      void this.checkAndNotify();
    }, intervalMs);
  }

  stopPolling() {
    if (this.pollHandle !== null) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
  }
}
