import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NutritionService, DailyNutritionSummary, NutritionGoals } from '../../core/services/nutrition.service';
import { SnackbarService } from '../../core/services/snackbar.service';

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
  ],
  template: `
    <div class="nutrition-container">
      <mat-card class="header-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>restaurant</mat-icon>
            Nutrition Dashboard
          </mat-card-title>
          <mat-card-subtitle>
            Track your daily nutrition and macronutrient goals
          </mat-card-subtitle>
        </mat-card-header>
        <mat-card-actions>
          <button mat-raised-button color="primary" (click)="setGoals()">
            <mat-icon>tune</mat-icon>
            {{ hasGoals() ? 'Update Goals' : 'Set Goals' }}
          </button>
        </mat-card-actions>
      </mat-card>

      @if (summary(); as daily) {
        <!-- Main Stats Cards -->
        <div class="stats-grid">
          <!-- Calories -->
          <mat-card class="stat-card calories">
            <mat-card-content>
              <div class="stat-header">
                <mat-icon>local_fire_department</mat-icon>
                <span class="stat-label">Calories</span>
              </div>
              <div class="stat-value">
                {{ daily.totalKcal | number:'1.0-0' }}
                @if (daily.goals) {
                  <span class="stat-goal">/ {{ daily.goals.dailyKcalGoal }}</span>
                }
                <span class="stat-unit">kcal</span>
              </div>
              @if (daily.percentKcal !== undefined) {
                <mat-progress-bar
                  mode="determinate"
                  [value]="daily.percentKcal"
                  [color]="getProgressColor(daily.percentKcal)"
                ></mat-progress-bar>
                <div class="stat-percent">{{ daily.percentKcal | number:'1.0-0' }}% of goal</div>
              }
            </mat-card-content>
          </mat-card>

          <!-- Protein -->
          <mat-card class="stat-card protein">
            <mat-card-content>
              <div class="stat-header">
                <mat-icon>fitness_center</mat-icon>
                <span class="stat-label">Protein</span>
              </div>
              <div class="stat-value">
                {{ daily.totalProtein | number:'1.0-1' }}
                @if (daily.goals) {
                  <span class="stat-goal">/ {{ daily.goals.proteinGoal }}</span>
                }
                <span class="stat-unit">g</span>
              </div>
              @if (daily.percentProtein !== undefined) {
                <mat-progress-bar
                  mode="determinate"
                  [value]="daily.percentProtein"
                  [color]="getProgressColor(daily.percentProtein)"
                ></mat-progress-bar>
                <div class="stat-percent">{{ daily.percentProtein | number:'1.0-0' }}% of goal</div>
              }
            </mat-card-content>
          </mat-card>

          <!-- Carbs -->
          <mat-card class="stat-card carbs">
            <mat-card-content>
              <div class="stat-header">
                <mat-icon>grain</mat-icon>
                <span class="stat-label">Carbs</span>
              </div>
              <div class="stat-value">
                {{ daily.totalCarbs | number:'1.0-1' }}
                @if (daily.goals) {
                  <span class="stat-goal">/ {{ daily.goals.carbsGoal }}</span>
                }
                <span class="stat-unit">g</span>
              </div>
              @if (daily.percentCarbs !== undefined) {
                <mat-progress-bar
                  mode="determinate"
                  [value]="daily.percentCarbs"
                  [color]="getProgressColor(daily.percentCarbs)"
                ></mat-progress-bar>
                <div class="stat-percent">{{ daily.percentCarbs | number:'1.0-0' }}% of goal</div>
              }
            </mat-card-content>
          </mat-card>

          <!-- Fat -->
          <mat-card class="stat-card fat">
            <mat-card-content>
              <div class="stat-header">
                <mat-icon>opacity</mat-icon>
                <span class="stat-label">Fat</span>
              </div>
              <div class="stat-value">
                {{ daily.totalFat | number:'1.0-1' }}
                @if (daily.goals) {
                  <span class="stat-goal">/ {{ daily.goals.fatGoal }}</span>
                }
                <span class="stat-unit">g</span>
              </div>
              @if (daily.percentFat !== undefined) {
                <mat-progress-bar
                  mode="determinate"
                  [value]="daily.percentFat"
                  [color]="getProgressColor(daily.percentFat)"
                ></mat-progress-bar>
                <div class="stat-percent">{{ daily.percentFat | number:'1.0-0' }}% of goal</div>
              }
            </mat-card-content>
          </mat-card>
        </div>

        <!-- Additional Nutrients -->
        <mat-card class="details-card">
          <mat-card-header>
            <mat-card-title>Additional Nutrients</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="nutrients-grid">
              <div class="nutrient-item">
                <mat-icon>eco</mat-icon>
                <span class="nutrient-label">Fiber</span>
                <span class="nutrient-value">{{ daily.totalFiber | number:'1.0-1' }} g</span>
              </div>
              <div class="nutrient-item">
                <mat-icon>cake</mat-icon>
                <span class="nutrient-label">Sugar</span>
                <span class="nutrient-value">{{ daily.totalSugar | number:'1.0-1' }} g</span>
              </div>
              <div class="nutrient-item">
                <mat-icon>water_drop</mat-icon>
                <span class="nutrient-label">Sodium</span>
                <span class="nutrient-value">{{ daily.totalSodium | number:'1.0-0' }} mg</span>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Macronutrient Breakdown -->
        @if (daily.totalKcal > 0) {
          <mat-card class="breakdown-card">
            <mat-card-header>
              <mat-card-title>Calorie Breakdown</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <div class="breakdown-chart">
                <div class="breakdown-bar">
                  <div
                    class="breakdown-segment protein"
                    [style.width.%]="getCaloriePercent(daily.totalProtein, 4)"
                    matTooltip="Protein: {{ getCaloriePercent(daily.totalProtein, 4) | number:'1.0-0' }}%"
                  ></div>
                  <div
                    class="breakdown-segment carbs"
                    [style.width.%]="getCaloriePercent(daily.totalCarbs, 4)"
                    matTooltip="Carbs: {{ getCaloriePercent(daily.totalCarbs, 4) | number:'1.0-0' }}%"
                  ></div>
                  <div
                    class="breakdown-segment fat"
                    [style.width.%]="getCaloriePercent(daily.totalFat, 9)"
                    matTooltip="Fat: {{ getCaloriePercent(daily.totalFat, 9) | number:'1.0-0' }}%"
                  ></div>
                </div>
                <div class="breakdown-legend">
                  <div class="legend-item">
                    <span class="legend-color protein"></span>
                    <span>Protein ({{ (daily.totalProtein * 4) | number:'1.0-0' }} kcal)</span>
                  </div>
                  <div class="legend-item">
                    <span class="legend-color carbs"></span>
                    <span>Carbs ({{ (daily.totalCarbs * 4) | number:'1.0-0' }} kcal)</span>
                  </div>
                  <div class="legend-item">
                    <span class="legend-color fat"></span>
                    <span>Fat ({{ (daily.totalFat * 9) | number:'1.0-0' }} kcal)</span>
                  </div>
                </div>
              </div>
            </mat-card-content>
          </mat-card>
        }
      } @else {
        <mat-card class="empty-state">
          <mat-card-content>
            <mat-icon>restaurant_menu</mat-icon>
            <h3>No Nutrition Data Yet</h3>
            <p>Start tracking your meals to see nutrition insights</p>
            <button mat-raised-button color="primary" (click)="setGoals()">
              <mat-icon>tune</mat-icon>
              Set Your Goals
            </button>
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
  styles: [`
    .nutrition-container {
      padding: var(--spacing-lg);
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: var(--spacing-md);
    }

    .header-card {
      mat-card-header {
        mat-card-title {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          font-size: 24px;

          mat-icon {
            font-size: 28px;
            width: 28px;
            height: 28px;
          }
        }
      }

      mat-card-actions {
        padding: 0 var(--spacing-md) var(--spacing-md);
      }
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: var(--spacing-md);
    }

    .stat-card {
      &.calories {
        border-left: 4px solid #ff5722;
      }

      &.protein {
        border-left: 4px solid #2196f3;
      }

      &.carbs {
        border-left: 4px solid #4caf50;
      }

      &.fat {
        border-left: 4px solid #ff9800;
      }

      mat-card-content {
        padding: var(--spacing-md);
      }

      .stat-header {
        display: flex;
        align-items: center;
        gap: var(--spacing-xs);
        margin-bottom: var(--spacing-sm);

        mat-icon {
          font-size: 20px;
          width: 20px;
          height: 20px;
          color: var(--text-secondary);
        }

        .stat-label {
          font-size: 14px;
          color: var(--text-secondary);
          text-transform: uppercase;
          font-weight: 600;
        }
      }

      .stat-value {
        font-size: 32px;
        font-weight: 700;
        color: var(--text-primary);
        margin-bottom: var(--spacing-sm);

        .stat-goal {
          font-size: 18px;
          color: var(--text-secondary);
          font-weight: 400;
        }

        .stat-unit {
          font-size: 16px;
          color: var(--text-secondary);
          font-weight: 400;
          margin-left: var(--spacing-xs);
        }
      }

      mat-progress-bar {
        margin-bottom: var(--spacing-xs);
      }

      .stat-percent {
        font-size: 12px;
        color: var(--text-secondary);
        text-align: right;
      }
    }

    .details-card {
      mat-card-content {
        padding: var(--spacing-md);
      }

      .nutrients-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: var(--spacing-md);
      }

      .nutrient-item {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        padding: var(--spacing-md);
        background-color: var(--surface-color);
        border-radius: 8px;

        mat-icon {
          font-size: 24px;
          width: 24px;
          height: 24px;
          color: var(--primary-color);
        }

        .nutrient-label {
          flex: 1;
          font-weight: 500;
        }

        .nutrient-value {
          font-weight: 700;
          color: var(--primary-color);
        }
      }
    }

    .breakdown-card {
      .breakdown-chart {
        padding: var(--spacing-md);
      }

      .breakdown-bar {
        display: flex;
        height: 40px;
        border-radius: 8px;
        overflow: hidden;
        margin-bottom: var(--spacing-md);
      }

      .breakdown-segment {
        transition: all 0.3s ease;

        &.protein {
          background-color: #2196f3;
        }

        &.carbs {
          background-color: #4caf50;
        }

        &.fat {
          background-color: #ff9800;
        }
      }

      .breakdown-legend {
        display: flex;
        justify-content: center;
        gap: var(--spacing-lg);
        flex-wrap: wrap;
      }

      .legend-item {
        display: flex;
        align-items: center;
        gap: var(--spacing-xs);
        font-size: 14px;

        .legend-color {
          width: 16px;
          height: 16px;
          border-radius: 4px;

          &.protein {
            background-color: #2196f3;
          }

          &.carbs {
            background-color: #4caf50;
          }

          &.fat {
            background-color: #ff9800;
          }
        }
      }
    }

    .empty-state {
      mat-card-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--spacing-md);
        padding: var(--spacing-xl);
        text-align: center;

        mat-icon {
          font-size: 64px;
          width: 64px;
          height: 64px;
          color: var(--text-secondary);
          opacity: 0.5;
        }

        h3 {
          margin: 0;
          font-size: 20px;
        }

        p {
          margin: 0;
          color: var(--text-secondary);
        }
      }
    }

    @media (max-width: 768px) {
      .nutrition-container {
        padding: var(--spacing-sm);
      }

      .stats-grid {
        grid-template-columns: 1fr;
      }

      .breakdown-legend {
        flex-direction: column;
        align-items: flex-start;
      }
    }
  `],
})
export class NutritionDashboardComponent implements OnInit {
  private nutritionService = inject(NutritionService);
  private snackbar = inject(SnackbarService);

  summary = signal<DailyNutritionSummary | null>(null);
  hasGoals = signal(false);

  ngOnInit(): void {
    this.loadTodayNutrition();
  }

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

    // For now, use default values - in a full implementation, open a dialog
    const confirmed = confirm(
      `Set nutrition goals?\n\n` +
      `Daily Calories: ${goals.dailyKcalGoal} kcal\n` +
      `Protein: ${goals.proteinGoal}g\n` +
      `Carbs: ${goals.carbsGoal}g\n` +
      `Fat: ${goals.fatGoal}g`
    );

    if (confirmed) {
      this.nutritionService.setGoals(goals);
      this.loadTodayNutrition();
      this.snackbar.success('Nutrition goals set successfully!');
    }
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
