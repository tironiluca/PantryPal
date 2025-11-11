// app.config.ts
import { ApplicationConfig, APP_INITIALIZER, inject } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideServiceWorker } from '@angular/service-worker';
import { DbService } from './core/services/db.service';
import { NotificationsService } from './core/services/notifications.service';

function initAppFactory() {
  const db = inject(DbService);
  const notif = inject(NotificationsService);
  return async () => {
    await db.init();
    try {
      await notif.requestPermission();
      await notif.checkAndNotify();
    } catch {}
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withFetch()),
    provideRouter(routes, withInMemoryScrolling({ anchorScrolling: 'enabled' })),
    provideAnimations(),
    provideServiceWorker('ngsw-worker.js', { enabled: true }),
    { provide: APP_INITIALIZER, multi: true, useFactory: initAppFactory },
  ]
};
