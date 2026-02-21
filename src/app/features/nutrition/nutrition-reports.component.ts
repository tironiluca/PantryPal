import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { TranslocoModule } from '@jsverse/transloco';
import { NutritionService, WeeklyNutritionReport } from '../../core/services/nutrition.service';

@Component({
  selector: 'pp-nutrition-reports',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule, MatButtonToggleModule, TranslocoModule],
  template: `
    <div class="reports-container" *transloco="let t">
      <div class="period-selector">
        <mat-button-toggle-group [value]="period()" (change)="setPeriod($event.value)">
          <mat-button-toggle value="thisWeek">{{ t('nutrition.thisWeek') }}</mat-button-toggle>
          <mat-button-toggle value="lastWeek">{{ t('nutrition.lastWeek') }}</mat-button-toggle>
        </mat-button-toggle-group>
      </div>

      @if (report(); as r) {
        <!-- Summary Cards -->
        <div class="summary-grid">
          <mat-card class="summary-card">
            <mat-card-content>
              <mat-icon>local_fire_department</mat-icon>
              <div class="summary-value">{{ r.avgKcal }}</div>
              <div class="summary-label">{{ t('nutrition.avgCalories') }}</div>
            </mat-card-content>
          </mat-card>
          <mat-card class="summary-card">
            <mat-card-content>
              <mat-icon>fitness_center</mat-icon>
              <div class="summary-value">{{ r.avgProtein }}g</div>
              <div class="summary-label">{{ t('nutrition.avgProtein') }}</div>
            </mat-card-content>
          </mat-card>
          <mat-card class="summary-card">
            <mat-card-content>
              <mat-icon>grain</mat-icon>
              <div class="summary-value">{{ r.avgCarbs }}g</div>
              <div class="summary-label">{{ t('nutrition.avgCarbs') }}</div>
            </mat-card-content>
          </mat-card>
          <mat-card class="summary-card">
            <mat-card-content>
              <mat-icon>opacity</mat-icon>
              <div class="summary-value">{{ r.avgFat }}g</div>
              <div class="summary-label">{{ t('nutrition.avgFat') }}</div>
            </mat-card-content>
          </mat-card>
        </div>

        <!-- Goal Adherence & Days Tracked -->
        <mat-card>
          <mat-card-content class="adherence-row">
            <div class="adherence-item">
              <mat-icon>check_circle</mat-icon>
              <span>{{ t('nutrition.goalAdherence') }}: <strong>{{ r.goalAdherencePercent }}%</strong></span>
            </div>
            <div class="adherence-item">
              <mat-icon>event_available</mat-icon>
              <span>{{ t('nutrition.daysTracked') }}: <strong>{{ r.daysTracked }}/7</strong></span>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Daily Calorie Chart -->
        <mat-card>
          <mat-card-header>
            <mat-card-title>{{ t('nutrition.calories') }}</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="chart">
              @for (day of r.dailySummaries; track day.date; let i = $index) {
                <div class="chart-bar-container">
                  <div class="chart-bar"
                    [style.height.%]="getBarHeight(day.totalKcal, r)"
                    [class.has-data]="day.totalKcal > 0">
                  </div>
                  <div class="chart-label">{{ dayLabels[i] }}</div>
                  <div class="chart-value">{{ day.totalKcal | number:'1.0-0' }}</div>
                </div>
              }
            </div>
          </mat-card-content>
        </mat-card>
      } @else {
        <mat-card class="empty-state">
          <mat-card-content>
            <mat-icon>bar_chart</mat-icon>
            <p>{{ t('nutrition.noReportData') }}</p>
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
  styles: [`
    .reports-container {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-md);
    }

    .period-selector {
      display: flex;
      justify-content: center;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: var(--spacing-sm);
    }

    .summary-card mat-card-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: var(--spacing-md);
      text-align: center;

      mat-icon {
        font-size: 28px;
        width: 28px;
        height: 28px;
        color: var(--primary-color);
        margin-bottom: var(--spacing-xs);
      }

      .summary-value {
        font-size: 24px;
        font-weight: 700;
      }

      .summary-label {
        font-size: 12px;
        color: var(--text-secondary);
        text-transform: uppercase;
      }
    }

    .adherence-row {
      display: flex;
      justify-content: space-around;
      padding: var(--spacing-md);
    }

    .adherence-item {
      display: flex;
      align-items: center;
      gap: var(--spacing-xs);

      mat-icon {
        color: var(--primary-color);
      }
    }

    .chart {
      display: flex;
      align-items: flex-end;
      justify-content: space-around;
      height: 200px;
      padding: var(--spacing-md) 0;
      gap: 4px;
    }

    .chart-bar-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      flex: 1;
      height: 100%;
      justify-content: flex-end;
    }

    .chart-bar {
      width: 100%;
      max-width: 40px;
      min-height: 4px;
      background: var(--divider-color);
      border-radius: 4px 4px 0 0;
      transition: height 0.3s ease;

      &.has-data {
        background: linear-gradient(180deg, #ff5722, #e64a19);
      }
    }

    .chart-label {
      font-size: 11px;
      color: var(--text-secondary);
      margin-top: 4px;
      font-weight: 600;
    }

    .chart-value {
      font-size: 10px;
      color: var(--text-secondary);
    }

    .empty-state mat-card-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: var(--spacing-xl);
      text-align: center;

      mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: var(--text-secondary);
        opacity: 0.5;
      }
    }
  `]
})
export class NutritionReportsComponent {
  private nutritionService = inject(NutritionService);

  period = signal<string>('thisWeek');
  report = signal<WeeklyNutritionReport | null>(null);
  dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  constructor() {
    this.loadReport();
  }

  setPeriod(p: string): void {
    this.period.set(p);
    this.loadReport();
  }

  getBarHeight(kcal: number, report: WeeklyNutritionReport): number {
    const max = Math.max(...report.dailySummaries.map(d => d.totalKcal), 1);
    return (kcal / max) * 100;
  }

  private loadReport(): void {
    const start = this.getStartDate();
    const report = this.nutritionService.getWeeklySummary(start);
    this.report.set(report);
  }

  private getStartDate(): string {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    if (this.period() === 'lastWeek') {
      now.setDate(now.getDate() + mondayOffset - 7);
    } else {
      now.setDate(now.getDate() + mondayOffset);
    }

    return this.formatDate(now);
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
