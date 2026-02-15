import { Injectable, OnDestroy } from '@angular/core';
import { DbService } from './db.service';

@Injectable({ providedIn: 'root' })
export class NotificationsService implements OnDestroy {
  private pollHandle: ReturnType<typeof setInterval> | null = null;

  constructor(private db: DbService) {}

  async requestPermission() {
    if (typeof Notification === 'undefined') return false;
    if (Notification.permission === 'granted') return true;
    const res = await Notification.requestPermission();
    return res === 'granted';
  }

  async checkAndNotify() {
    const items = this.db.query<any>(`SELECT i.id, i.expiry, ing.name, ing.notifyStartDays, ing.notifyRepeatDays
      FROM inventory i JOIN ingredients ing ON ing.id = i.ingredientId WHERE i.expiry IS NOT NULL`);
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

  ngOnDestroy() {
    this.stopPolling();
  }
}
