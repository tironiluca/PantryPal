import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { TranslocoModule } from '@jsverse/transloco';
import { DietAdviceService, UseItUpSuggestion } from '../../../core/services/diet-advice.service';

@Component({
  selector: 'pp-use-it-up-banner',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatChipsModule, RouterLink, TranslocoModule],
  templateUrl: './use-it-up-banner.component.html',
  styleUrl: './use-it-up-banner.component.scss',
})
export class UseItUpBannerComponent implements OnInit {
  private dietAdvice = inject(DietAdviceService);

  suggestion = signal<UseItUpSuggestion | null>(null);
  dismissed = signal(false);

  ngOnInit(): void {
    try {
      const data = this.dietAdvice.getUseItUpSuggestions(3);
      if (data.expiringItems.length > 0) {
        this.suggestion.set(data);
      }
    } catch {
      // Non-critical: silently skip if DB not ready
    }
  }

  dismiss(): void {
    this.dismissed.set(true);
  }
}
