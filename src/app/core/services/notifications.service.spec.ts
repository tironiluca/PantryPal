import { NotificationsService } from './notifications.service';

function bare(): NotificationsService & Record<string, any> {
  return Object.create(NotificationsService.prototype) as NotificationsService & Record<string, any>;
}

describe('NotificationsService', () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('requestPermission', () => {
    it('returns false when the Notification API is unavailable', async () => {
      vi.stubGlobal('Notification', undefined);
      const service = bare();
      await expect(service.requestPermission()).resolves.toBe(false);
    });

    it('returns true without prompting when permission is already granted', async () => {
      const request = vi.fn();
      vi.stubGlobal('Notification', { permission: 'granted', requestPermission: request });
      const service = bare();
      await expect(service.requestPermission()).resolves.toBe(true);
      expect(request).not.toHaveBeenCalled();
    });

    it('prompts and resolves true when the user grants permission', async () => {
      vi.stubGlobal('Notification', {
        permission: 'default',
        requestPermission: vi.fn(async () => 'granted'),
      });
      const service = bare();
      await expect(service.requestPermission()).resolves.toBe(true);
    });

    it('resolves false when the user denies permission', async () => {
      vi.stubGlobal('Notification', {
        permission: 'default',
        requestPermission: vi.fn(async () => 'denied'),
      });
      const service = bare();
      await expect(service.requestPermission()).resolves.toBe(false);
    });
  });

  describe('checkAndNotify', () => {
    function withServiceWorker(showNotification = vi.fn()) {
      vi.stubGlobal('navigator', {
        ...navigator,
        serviceWorker: { getRegistration: vi.fn(async () => ({ showNotification })) },
      });
      return showNotification;
    }

    it('does not notify for an item that has not entered its notify window', async () => {
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      const showNotification = withServiceWorker();
      const service = bare();
      service.db = {
        getExpiringInventory: () => [
          { id: 'inv-1', name: 'Milk', expiry: '2026-01-10', notifyStartDays: 3 },
        ],
      };

      await service.checkAndNotify();

      expect(showNotification).not.toHaveBeenCalled();
    });

    it('notifies once an item enters its notify window and records the timestamp', async () => {
      vi.setSystemTime(new Date('2026-01-08T00:00:00Z'));
      const showNotification = withServiceWorker();
      const service = bare();
      service.db = {
        getExpiringInventory: () => [
          { id: 'inv-1', name: 'Milk', expiry: '2026-01-10', notifyStartDays: 3 },
        ],
      };

      await service.checkAndNotify();

      expect(showNotification).toHaveBeenCalledWith('Expiring soon', {
        body: 'Milk expires on 2026-01-10',
      });
      expect(localStorage.getItem('notified:inv-1')).toBeTruthy();
    });

    it('does not re-notify before the repeat window has elapsed', async () => {
      vi.setSystemTime(new Date('2026-01-08T00:00:00Z'));
      localStorage.setItem('notified:inv-1', String(Date.now() - 1000));
      const showNotification = withServiceWorker();
      const service = bare();
      service.db = {
        getExpiringInventory: () => [
          { id: 'inv-1', name: 'Milk', expiry: '2026-01-10', notifyStartDays: 3, notifyRepeatDays: 1 },
        ],
      };

      await service.checkAndNotify();

      expect(showNotification).not.toHaveBeenCalled();
    });

    it('re-notifies once the repeat window has elapsed', async () => {
      vi.setSystemTime(new Date('2026-01-08T00:00:00Z'));
      localStorage.setItem('notified:inv-1', String(Date.now() - 2 * 864e5));
      const showNotification = withServiceWorker();
      const service = bare();
      service.db = {
        getExpiringInventory: () => [
          { id: 'inv-1', name: 'Milk', expiry: '2026-01-10', notifyStartDays: 3, notifyRepeatDays: 1 },
        ],
      };

      await service.checkAndNotify();

      expect(showNotification).toHaveBeenCalledTimes(1);
    });

    it('skips notification delivery when no service worker is registered', async () => {
      vi.setSystemTime(new Date('2026-01-08T00:00:00Z'));
      const navWithoutServiceWorker: any = { ...navigator };
      delete navWithoutServiceWorker.serviceWorker;
      vi.stubGlobal('navigator', navWithoutServiceWorker);
      const service = bare();
      service.db = {
        getExpiringInventory: () => [
          { id: 'inv-1', name: 'Milk', expiry: '2026-01-10', notifyStartDays: 3 },
        ],
      };

      await expect(service.checkAndNotify()).resolves.toBeUndefined();
      expect(localStorage.getItem('notified:inv-1')).toBeNull();
    });
  });

  describe('polling', () => {
    it('schedules checkAndNotify on the given interval and stops cleanly', () => {
      const intervalHandle = {};
      let scheduled: (() => void) | undefined;
      const setIntervalSpy = vi
        .spyOn(globalThis, 'setInterval')
        .mockImplementation((fn: any) => {
          scheduled = fn;
          return intervalHandle as any;
        });
      const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval').mockImplementation(() => {});

      const service = bare();
      service.pollHandle = null;
      const checkAndNotify = vi.fn();
      service.checkAndNotify = checkAndNotify;

      service.startPolling(5000);
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 5000);
      scheduled?.();
      expect(checkAndNotify).toHaveBeenCalledTimes(1);

      service.stopPolling();
      expect(clearIntervalSpy).toHaveBeenCalledWith(intervalHandle);
    });

    it('ignores a second startPolling call while already polling', () => {
      const setIntervalSpy = vi.spyOn(globalThis, 'setInterval').mockImplementation(() => ({}) as any);

      const service = bare();
      service.pollHandle = null;
      service.checkAndNotify = vi.fn();

      service.startPolling(1000);
      service.startPolling(1000);

      expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    });

    it('is a no-op to stop polling when nothing is scheduled', () => {
      const service = bare();
      service.pollHandle = null;
      expect(() => service.stopPolling()).not.toThrow();
    });
  });
});
