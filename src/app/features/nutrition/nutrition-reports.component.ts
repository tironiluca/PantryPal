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
  templateUrl: './nutrition-reports.component.html',
  styleUrls: ['./nutrition-reports.component.scss']
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
