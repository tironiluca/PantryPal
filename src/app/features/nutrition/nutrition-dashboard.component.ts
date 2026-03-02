import { Component, inject, signal, OnInit, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { TranslocoModule } from '@jsverse/transloco';
import { NutritionService, DailyNutritionSummary } from '../../core/services/nutrition.service';
import { SnackbarService } from '../../core/services/snackbar.service';
import { NutritionReportsComponent } from './nutrition-reports.component';
import { DietAdviceComponent } from './diet-advice.component';
import { NutritionGoalsDialog } from './nutrition-goals.dialog';

@Component({
  selector: 'pp-nutrition-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatChipsModule,
    MatListModule,
    MatDividerModule,
    MatTooltipModule,
    MatDialogModule,
    MatTabsModule,
    TranslocoModule,
    NutritionReportsComponent,
    DietAdviceComponent,
  ],
  templateUrl: './nutrition-dashboard.component.html',
  styleUrls: ['./nutrition-dashboard.component.scss'],
})
export class NutritionDashboardComponent implements OnInit {
  private nutritionService = inject(NutritionService);
  private snackbar = inject(SnackbarService);
  private dialog = inject(MatDialog);
  private destroyRef = inject(DestroyRef);

  summary = signal<DailyNutritionSummary | null>(null);
  hasGoals = signal(false);

  ngOnInit(): void { this.loadTodayNutrition(); }

  loadTodayNutrition(): void {
    const today = this.formatDate(new Date());
    const daily = this.nutritionService.getDailyNutrition(today);
    this.summary.set(daily);
    this.hasGoals.set(daily.goals !== undefined && daily.goals !== null);
  }

  setGoals(): void {
    const currentGoals = this.nutritionService.getGoals();
    const defaultGoals = this.nutritionService.getDefaultGoals();
    const goals = currentGoals || defaultGoals;

    const ref = this.dialog.open(NutritionGoalsDialog, {
      data: { goals, isEdit: !!currentGoals },
      width: '420px',
      maxWidth: '95vw',
    });

    ref.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(result => {
      if (result) {
        this.nutritionService.setGoals(result);
        this.loadTodayNutrition();
        this.snackbar.success('Nutrition goals saved!');
      }
    });
  }

  getProgressColor(percent: number): 'primary' | 'accent' | 'warn' {
    if (percent >= 90 && percent <= 110) return 'primary';
    if (percent < 70 || percent > 130) return 'warn';
    return 'accent';
  }

  getCaloriePercent(grams: number, caloriesPerGram: number): number {
    const total = this.summary()?.totalKcal || 0;
    if (total === 0) return 0;
    return ((grams * caloriesPerGram) / total) * 100;
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
