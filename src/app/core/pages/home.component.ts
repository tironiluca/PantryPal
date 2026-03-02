import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import { TranslocoModule } from '@jsverse/transloco';
import { SyncService } from '../services/sync.service';
import { AuthService } from '../services/auth.service';
import { NAV_TABS } from '../nav-tabs';

@Component({
  selector: 'pp-home',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    MatTabsModule,
    MatTooltipModule,
    MatIconModule,
    MatButtonModule,
    TranslocoModule,
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent implements OnInit {
  private syncService = inject(SyncService);
  private auth = inject(AuthService);

  readonly tabs = NAV_TABS;

  ngOnInit(): void {
    if (this.auth.isAuthenticated()) {
      this.syncService.startAutoSync(5);
    }
  }
}
