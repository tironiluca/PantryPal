import { Component, inject, signal, OnInit, Inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslocoModule } from '@jsverse/transloco';
import { NutritionService, DailyNutritionSummary, NutritionGoals } from '../../core/services/nutrition.service';
import { SnackbarService } from '../../core/services/snackbar.service';
import { NutritionReportsComponent } from './nutrition-reports.component';
import { DietAdviceComponent } from './diet-advice.component';

// ── Nutrition Goals Dialog ────────────────────────────────────────────────────
@Component({
  selector: 'pp-nutrition-goals-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatSelectModule, MatSlideToggleModule, TranslocoModule],
  template: `
    <div *transloco="let t">
      <h2 mat-dialog-title>
        <mat-icon>tune</mat-icon>
        {{ data.isEdit ? t('nutrition.updateNutritionGoals') : t('nutrition.setNutritionGoals') }}
      </h2>
      <mat-dialog-content>
        <div class="goals-form">
          <mat-form-field appearance="outline">
            <mat-label>{{ t('nutrition.goalPreset') }}</mat-label>
            <mat-select [(value)]="goals.goalType" (selectionChange)="onPresetChange($event.value)">
              <mat-option value="custom">{{ t('nutrition.custom') }}</mat-option>
              <mat-option value="weight_loss">{{ t('nutrition.weightLoss') }}</mat-option>
              <mat-option value="muscle_gain">{{ t('nutrition.muscleGain') }}</mat-option>
              <mat-option value="maintenance">{{ t('nutrition.maintenance') }}</mat-option>
            </mat-select>
            <mat-icon matSuffix>auto_fix_high</mat-icon>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>{{ t('nutrition.dailyCalories') }}</mat-label>
            <input matInput type="number" [(ngModel)]="goals.dailyKcalGoal" min="500" max="10000" />
            <mat-icon matSuffix>local_fire_department</mat-icon>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ t('nutrition.proteinG') }}</mat-label>
            <input matInput type="number" [(ngModel)]="goals.proteinGoal" min="0" max="500" />
            <mat-icon matSuffix>fitness_center</mat-icon>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ t('nutrition.carbohydratesG') }}</mat-label>
            <input matInput type="number" [(ngModel)]="goals.carbsGoal" min="0" max="1000" />
            <mat-icon matSuffix>grain</mat-icon>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ t('nutrition.fatG') }}</mat-label>
            <input matInput type="number" [(ngModel)]="goals.fatGoal" min="0" max="500" />
            <mat-icon matSuffix>opacity</mat-icon>
          </mat-form-field>

          <div class="optional-section">
            <mat-slide-toggle [(ngModel)]="goals.trackFiber">{{ t('nutrition.trackFiber') }}</mat-slide-toggle>
            @if (goals.trackFiber) {
              <mat-form-field appearance="outline">
                <mat-label>{{ t('nutrition.fiberG') }}</mat-label>
                <input matInput type="number" [(ngModel)]="goals.fiberGoal" min="0" max="100" />
              </mat-form-field>
            }
            <mat-slide-toggle [(ngModel)]="goals.trackSugar">{{ t('nutrition.trackSugar') }}</mat-slide-toggle>
            @if (goals.trackSugar) {
              <mat-form-field appearance="outline">
                <mat-label>{{ t('nutrition.sugarG') }}</mat-label>
                <input matInput type="number" [(ngModel)]="goals.sugarGoal" min="0" max="200" />
              </mat-form-field>
            }
            <mat-slide-toggle [(ngModel)]="goals.trackSodium">{{ t('nutrition.trackSodium') }}</mat-slide-toggle>
            @if (goals.trackSodium) {
              <mat-form-field appearance="outline">
                <mat-label>{{ t('nutrition.sodiumMg') }}</mat-label>
                <input matInput type="number" [(ngModel)]="goals.sodiumGoal" min="0" max="5000" />
              </mat-form-field>
            }
          </div>
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>{{ t('common.cancel') }}</button>
        <button mat-raised-button color="primary" (click)="save()">
          <mat-icon>save</mat-icon>
          {{ t('nutrition.saveGoals') }}
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .goals-form {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-md);
      padding: var(--spacing-sm) 0;
      min-width: 300px;
    }
    mat-form-field { width: 100%; }
    h2 { display: flex; align-items: center; gap: var(--spacing-sm); }
    .optional-section {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-sm);
      padding-top: var(--spacing-sm);
      border-top: 1px solid var(--divider-color);
    }
  `]
})
export class NutritionGoalsDialog {
  private dialogRef = inject(MatDialogRef<NutritionGoalsDialog>);
  private nutritionService = inject(NutritionService);
  goals: any;

  constructor(@Inject(MAT_DIALOG_DATA) public data: { goals: any; isEdit: boolean }) {
    this.goals = { ...data.goals };
  }

  onPresetChange(type: string): void {
    if (type !== 'custom') {
      const preset = this.nutritionService.getPresetGoals(type);
      Object.assign(this.goals, preset);
    }
  }

  save() { this.dialogRef.close(this.goals); }
}
// ─────────────────────────────────────────────────────────────────────────────

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
  template: `
    <div class="nutrition-container" *transloco="let t">
      <mat-card class="header-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>restaurant</mat-icon>
            {{ t('nutrition.dashboard') }}
          </mat-card-title>
          <mat-card-subtitle>{{ t('nutrition.trackDaily') }}</mat-card-subtitle>
        </mat-card-header>
        <mat-card-actions>
          <button mat-raised-button color="primary" (click)="setGoals()">
            <mat-icon>tune</mat-icon>
            {{ hasGoals() ? t('nutrition.updateGoals') : t('nutrition.setGoals') }}
          </button>
        </mat-card-actions>
      </mat-card>

      <mat-tab-group>
        <mat-tab [label]="t('common.today')">
          @if (summary(); as daily) {
            <div class="stats-grid">
              <mat-card class="stat-card calories">
                <mat-card-content>
                  <div class="stat-header">
                    <mat-icon>local_fire_department</mat-icon>
                    <span class="stat-label">{{ t('nutrition.calories') }}</span>
                  </div>
                  <div class="stat-value">
                    {{ daily.totalKcal | number:'1.0-0' }}
                    @if (daily.goals) { <span class="stat-goal">/ {{ daily.goals.dailyKcalGoal }}</span> }
                    <span class="stat-unit">{{ t('nutrition.kcal') }}</span>
                  </div>
                  @if (daily.percentKcal !== undefined) {
                    <mat-progress-bar mode="determinate" [value]="daily.percentKcal" [color]="getProgressColor(daily.percentKcal)"></mat-progress-bar>
                    <div class="stat-percent">{{ daily.percentKcal | number:'1.0-0' }}{{ t('nutrition.ofGoal') }}</div>
                  }
                </mat-card-content>
              </mat-card>

              <mat-card class="stat-card protein">
                <mat-card-content>
                  <div class="stat-header">
                    <mat-icon>fitness_center</mat-icon>
                    <span class="stat-label">{{ t('nutrition.protein') }}</span>
                  </div>
                  <div class="stat-value">
                    {{ daily.totalProtein | number:'1.0-1' }}
                    @if (daily.goals) { <span class="stat-goal">/ {{ daily.goals.proteinGoal }}</span> }
                    <span class="stat-unit">{{ t('nutrition.g') }}</span>
                  </div>
                  @if (daily.percentProtein !== undefined) {
                    <mat-progress-bar mode="determinate" [value]="daily.percentProtein" [color]="getProgressColor(daily.percentProtein)"></mat-progress-bar>
                    <div class="stat-percent">{{ daily.percentProtein | number:'1.0-0' }}{{ t('nutrition.ofGoal') }}</div>
                  }
                </mat-card-content>
              </mat-card>

              <mat-card class="stat-card carbs">
                <mat-card-content>
                  <div class="stat-header">
                    <mat-icon>grain</mat-icon>
                    <span class="stat-label">{{ t('nutrition.carbs') }}</span>
                  </div>
                  <div class="stat-value">
                    {{ daily.totalCarbs | number:'1.0-1' }}
                    @if (daily.goals) { <span class="stat-goal">/ {{ daily.goals.carbsGoal }}</span> }
                    <span class="stat-unit">{{ t('nutrition.g') }}</span>
                  </div>
                  @if (daily.percentCarbs !== undefined) {
                    <mat-progress-bar mode="determinate" [value]="daily.percentCarbs" [color]="getProgressColor(daily.percentCarbs)"></mat-progress-bar>
                    <div class="stat-percent">{{ daily.percentCarbs | number:'1.0-0' }}{{ t('nutrition.ofGoal') }}</div>
                  }
                </mat-card-content>
              </mat-card>

              <mat-card class="stat-card fat">
                <mat-card-content>
                  <div class="stat-header">
                    <mat-icon>opacity</mat-icon>
                    <span class="stat-label">{{ t('nutrition.fat') }}</span>
                  </div>
                  <div class="stat-value">
                    {{ daily.totalFat | number:'1.0-1' }}
                    @if (daily.goals) { <span class="stat-goal">/ {{ daily.goals.fatGoal }}</span> }
                    <span class="stat-unit">{{ t('nutrition.g') }}</span>
                  </div>
                  @if (daily.percentFat !== undefined) {
                    <mat-progress-bar mode="determinate" [value]="daily.percentFat" [color]="getProgressColor(daily.percentFat)"></mat-progress-bar>
                    <div class="stat-percent">{{ daily.percentFat | number:'1.0-0' }}{{ t('nutrition.ofGoal') }}</div>
                  }
                </mat-card-content>
              </mat-card>
            </div>

            <mat-card class="details-card">
              <mat-card-header><mat-card-title>{{ t('nutrition.additionalNutrients') }}</mat-card-title></mat-card-header>
              <mat-card-content>
                <div class="nutrients-grid">
                  <div class="nutrient-item">
                    <mat-icon>eco</mat-icon>
                    <span class="nutrient-label">{{ t('nutrition.fiber') }}</span>
                    <span class="nutrient-value">{{ daily.totalFiber | number:'1.0-1' }} {{ t('nutrition.g') }}</span>
                  </div>
                  <div class="nutrient-item">
                    <mat-icon>cake</mat-icon>
                    <span class="nutrient-label">{{ t('nutrition.sugar') }}</span>
                    <span class="nutrient-value">{{ daily.totalSugar | number:'1.0-1' }} {{ t('nutrition.g') }}</span>
                  </div>
                  <div class="nutrient-item">
                    <mat-icon>water_drop</mat-icon>
                    <span class="nutrient-label">{{ t('nutrition.sodium') }}</span>
                    <span class="nutrient-value">{{ daily.totalSodium | number:'1.0-0' }} {{ t('nutrition.mg') }}</span>
                  </div>
                </div>
              </mat-card-content>
            </mat-card>

            @if (daily.totalKcal > 0) {
              <mat-card class="breakdown-card">
                <mat-card-header><mat-card-title>{{ t('nutrition.calorieBreakdown') }}</mat-card-title></mat-card-header>
                <mat-card-content>
                  <div class="breakdown-chart">
                    <div class="breakdown-bar">
                      <div class="breakdown-segment protein" [style.width.%]="getCaloriePercent(daily.totalProtein, 4)"></div>
                      <div class="breakdown-segment carbs" [style.width.%]="getCaloriePercent(daily.totalCarbs, 4)"></div>
                      <div class="breakdown-segment fat" [style.width.%]="getCaloriePercent(daily.totalFat, 9)"></div>
                    </div>
                    <div class="breakdown-legend">
                      <div class="legend-item"><span class="legend-color protein"></span><span>{{ t('nutrition.protein') }} ({{ (daily.totalProtein * 4) | number:'1.0-0' }} {{ t('nutrition.kcal') }})</span></div>
                      <div class="legend-item"><span class="legend-color carbs"></span><span>{{ t('nutrition.carbs') }} ({{ (daily.totalCarbs * 4) | number:'1.0-0' }} {{ t('nutrition.kcal') }})</span></div>
                      <div class="legend-item"><span class="legend-color fat"></span><span>{{ t('nutrition.fat') }} ({{ (daily.totalFat * 9) | number:'1.0-0' }} {{ t('nutrition.kcal') }})</span></div>
                    </div>
                  </div>
                </mat-card-content>
              </mat-card>
            }
          } @else {
            <mat-card class="empty-state">
              <mat-card-content>
                <mat-icon>restaurant_menu</mat-icon>
                <h3>{{ t('nutrition.noDataYet') }}</h3>
                <p>{{ t('nutrition.startTracking') }}</p>
                <button mat-raised-button color="primary" (click)="setGoals()">
                  <mat-icon>tune</mat-icon>
                  {{ t('nutrition.setYourGoals') }}
                </button>
              </mat-card-content>
            </mat-card>
          }
        </mat-tab>

        <mat-tab [label]="t('nutrition.reports')">
          <pp-nutrition-reports></pp-nutrition-reports>
        </mat-tab>

        <mat-tab [label]="t('nutrition.advice')">
          <pp-diet-advice></pp-diet-advice>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: [`
    .nutrition-container {
      padding: 0;
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: var(--spacing-md);
    }
    .header-card {
      mat-card-header mat-card-title {
        display: flex; align-items: center; gap: var(--spacing-sm); font-size: 24px;
        mat-icon { font-size: 28px; width: 28px; height: 28px; }
      }
      mat-card-actions { padding: 0 var(--spacing-md) var(--spacing-md); }
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: var(--spacing-md);
      margin-top: var(--spacing-md);
    }
    .stat-card {
      &.calories { border-left: 4px solid #ff5722; }
      &.protein { border-left: 4px solid #2196f3; }
      &.carbs { border-left: 4px solid #4caf50; }
      &.fat { border-left: 4px solid #ff9800; }
      mat-card-content { padding: var(--spacing-md); }
      .stat-header {
        display: flex; align-items: center; gap: var(--spacing-xs); margin-bottom: var(--spacing-sm);
        mat-icon { font-size: 20px; width: 20px; height: 20px; color: var(--text-secondary); }
        .stat-label { font-size: 14px; color: var(--text-secondary); text-transform: uppercase; font-weight: 600; }
      }
      .stat-value {
        font-size: 32px; font-weight: 700; color: var(--text-primary); margin-bottom: var(--spacing-sm);
        .stat-goal { font-size: 18px; color: var(--text-secondary); font-weight: 400; }
        .stat-unit { font-size: 16px; color: var(--text-secondary); font-weight: 400; margin-left: var(--spacing-xs); }
      }
      mat-progress-bar { margin-bottom: var(--spacing-xs); }
      .stat-percent { font-size: 12px; color: var(--text-secondary); text-align: right; }
    }
    .details-card {
      mat-card-content { padding: var(--spacing-md); }
      .nutrients-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: var(--spacing-md); }
      .nutrient-item {
        display: flex; align-items: center; gap: var(--spacing-sm); padding: var(--spacing-md);
        background-color: var(--surface-color); border-radius: 8px;
        mat-icon { font-size: 24px; width: 24px; height: 24px; color: var(--primary-color); }
        .nutrient-label { flex: 1; font-weight: 500; }
        .nutrient-value { font-weight: 700; color: var(--primary-color); }
      }
    }
    .breakdown-card {
      .breakdown-chart { padding: var(--spacing-md); }
      .breakdown-bar { display: flex; height: 40px; border-radius: 8px; overflow: hidden; margin-bottom: var(--spacing-md); }
      .breakdown-segment {
        transition: all 0.3s ease;
        &.protein { background-color: #2196f3; }
        &.carbs { background-color: #4caf50; }
        &.fat { background-color: #ff9800; }
      }
      .breakdown-legend { display: flex; justify-content: center; gap: var(--spacing-lg); flex-wrap: wrap; }
      .legend-item {
        display: flex; align-items: center; gap: var(--spacing-xs); font-size: 14px;
        .legend-color {
          width: 16px; height: 16px; border-radius: 4px;
          &.protein { background-color: #2196f3; }
          &.carbs { background-color: #4caf50; }
          &.fat { background-color: #ff9800; }
        }
      }
    }
    .empty-state mat-card-content {
      display: flex; flex-direction: column; align-items: center; gap: var(--spacing-md);
      padding: var(--spacing-xl); text-align: center;
      mat-icon { font-size: 64px; width: 64px; height: 64px; color: var(--text-secondary); opacity: 0.5; }
      h3 { margin: 0; font-size: 20px; }
      p { margin: 0; color: var(--text-secondary); }
    }
    @media (max-width: 768px) {
      .stats-grid { grid-template-columns: 1fr 1fr; } // 2-col on tablet/large phone
      .breakdown-legend { flex-direction: column; align-items: flex-start; gap: var(--spacing-sm); }
      .stat-value { font-size: 26px; }
    }
    @media (max-width: 480px) {
      .stats-grid { grid-template-columns: 1fr; } // 1-col on small phones
      .stat-value { font-size: 22px; }
      .stat-percent { text-align: left; }
      .nutrients-grid { grid-template-columns: 1fr; }
    }
  `],
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
