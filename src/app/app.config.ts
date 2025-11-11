import { ApplicationConfig, APP_INITIALIZER, inject } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideServiceWorker } from '@angular/service-worker';

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: APP_INITIALIZER, multi: true, useFactory: initApp },
    provideHttpClient(withFetch()),
    provideRouter(routes, withInMemoryScrolling({ anchorScrolling: 'enabled' })),
    provideAnimations(),
    provideServiceWorker('ngsw-worker.js', { enabled: true }),
  ]
};


function initApp() {
  const db = inject(import('./core/services/db.service').then(m => m.DbService)) as any;
  const notif = inject(import('./core/services/notifications.service').then(m => m.NotificationsService)) as any;
  return async () => {
    const DbService = (await import('./core/services/db.service')).DbService;
    const NotificationsService = (await import('./core/services/notifications.service')).NotificationsService;
    const dbSvc = new DbService();
    await dbSvc.init();
    const notifSvc = new NotificationsService(dbSvc as any);
    await notifSvc.requestPermission();
    await notifSvc.checkAndNotify();
  };
}
