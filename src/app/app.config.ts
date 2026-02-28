// app.config.ts
import { ApplicationConfig, APP_INITIALIZER, inject, isDevMode } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideServiceWorker } from '@angular/service-worker';
import { provideTransloco, TranslocoModule } from '@jsverse/transloco';
import { MAT_DIALOG_DEFAULT_OPTIONS } from '@angular/material/dialog';
import { TranslocoHttpLoader } from './transloco-loader';
import { DbService } from './core/services/db.service';
import { NotificationsService } from './core/services/notifications.service';
import { LanguageService } from './core/services/language.service';

function initAppFactory() {
  const db = inject(DbService);
  const notif = inject(NotificationsService);
  const lang = inject(LanguageService);
  return async () => {
    await db.init();
    lang.init();
    try {
      await notif.requestPermission();
      await notif.checkAndNotify();
    } catch {}
    notif.startPolling();
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withFetch()),
    provideRouter(routes, withInMemoryScrolling({ anchorScrolling: 'enabled' })),
    provideAnimations(),
    provideServiceWorker('ngsw-worker.js', { enabled: !isDevMode() }),
    provideTransloco({
      config: {
        availableLangs: ['en', 'it'],
        defaultLang: 'en',
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: TranslocoHttpLoader,
    }),
    { provide: APP_INITIALIZER, multi: true, useFactory: initAppFactory },
    {
      provide: MAT_DIALOG_DEFAULT_OPTIONS,
      useValue: {
        panelClass: 'app-dialog',
        autoFocus: 'first-tabbable',
        restoreFocus: true,
      },
    },
  ]
};
