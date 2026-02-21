import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TranslocoModule } from '@jsverse/transloco';
import { DietAdviceService, DietAdvice } from '../../core/services/diet-advice.service';
import { NutritionService } from '../../core/services/nutrition.service';

@Component({
  selector: 'pp-diet-advice',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule, MatChipsModule, MatProgressBarModule, TranslocoModule],
  template: `
    <div class="advice-container" *transloco="let t">
      <mat-card>
        <mat-card-header>
          <mat-card-title>
            <mat-icon>tips_and_updates</mat-icon>
            {{ t('nutrition.advice') }}
          </mat-card-title>
        </mat-card-header>

        @if (!hasGoals()) {
          <mat-card-content class="no-goals">
            <mat-icon>flag</mat-icon>
            <p>{{ t('nutrition.noGoalsSet') }}</p>
          </mat-card-content>
        } @else if (advice(); as a) {
          <mat-card-content>
            <!-- Remaining today -->
            <div class="remaining-section">
              <h4>{{ t('nutrition.remainingToday') }}</h4>
              <div class="remaining-grid">
                <div class="remaining-item">
                  <mat-icon>local_fire_department</mat-icon>
                  <span class="remaining-value">{{ a.remainingKcal | number:'1.0-0' }}</span>
                  <span class="remaining-label">{{ t('nutrition.kcal') }}</span>
                </div>
                <div class="remaining-item">
                  <mat-icon>fitness_center</mat-icon>
                  <span class="remaining-value">{{ a.remainingProtein | number:'1.0-1' }}</span>
                  <span class="remaining-label">{{ t('nutrition.protein') }}</span>
                </div>
                <div class="remaining-item">
                  <mat-icon>grain</mat-icon>
                  <span class="remaining-value">{{ a.remainingCarbs | number:'1.0-1' }}</span>
                  <span class="remaining-label">{{ t('nutrition.carbs') }}</span>
                </div>
                <div class="remaining-item">
                  <mat-icon>opacity</mat-icon>
                  <span class="remaining-value">{{ a.remainingFat | number:'1.0-1' }}</span>
                  <span class="remaining-label">{{ t('nutrition.fat') }}</span>
                </div>
              </div>
            </div>

            <!-- Insights -->
            @if (a.insights.length > 0) {
              <div class="insights-section">
                <h4>{{ t('nutrition.insights') }}</h4>
                @for (insight of a.insights; track $index) {
                  <div class="insight-item">
                    <mat-icon>info_outline</mat-icon>
                    <span>{{ insight }}</span>
                  </div>
                }
              </div>
            }

            <!-- Suggested Recipes -->
            @if (a.suggestedRecipes.length > 0) {
              <div class="recipes-section">
                <h4>{{ t('nutrition.suggestedRecipes') }}</h4>
                @for (recipe of a.suggestedRecipes; track recipe.recipeId) {
                  <div class="recipe-card">
                    <div class="recipe-header">
                      <span class="recipe-name">{{ recipe.recipeName }}</span>
                      <mat-chip [class]="getFitClass(recipe.fitScore)">{{ recipe.fitScore }}%</mat-chip>
                    </div>
                    <div class="recipe-nutrition">
                      <span>{{ recipe.energyKcal | number:'1.0-0' }} kcal</span>
                      <span>{{ recipe.proteinG | number:'1.0-1' }}g P</span>
                      <span>{{ recipe.carbsG | number:'1.0-1' }}g C</span>
                      <span>{{ recipe.fatG | number:'1.0-1' }}g F</span>
                    </div>
                    <div class="pantry-row">
                      <mat-progress-bar mode="determinate" [value]="recipe.pantryPercent" [color]="recipe.pantryPercent === 100 ? 'primary' : 'accent'"></mat-progress-bar>
                      <span class="pantry-label">{{ recipe.pantryPercent }}% in pantry</span>
                    </div>
                  </div>
                }
              </div>
            }
          </mat-card-content>
        }
      </mat-card>
    </div>
  `,
  styles: [`
    .advice-container mat-card-title {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .no-goals {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: var(--spacing-xl);
      text-align: center;
      color: var(--text-secondary);

      mat-icon { font-size: 40px; width: 40px; height: 40px; opacity: 0.4; margin-bottom: 8px; }
    }

    mat-card-content { padding: var(--spacing-md); }

    h4 {
      margin: 0 0 var(--spacing-sm);
      font-size: 14px;
      text-transform: uppercase;
      font-weight: 600;
      color: var(--text-secondary);
      letter-spacing: 0.05em;
    }

    .remaining-section { margin-bottom: var(--spacing-md); }

    .remaining-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: var(--spacing-sm);
    }

    .remaining-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: var(--spacing-sm);
      background: var(--surface-color);
      border-radius: 8px;
      text-align: center;

      mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--primary-color); margin-bottom: 4px; }

      .remaining-value { font-size: 18px; font-weight: 700; }
      .remaining-label { font-size: 11px; color: var(--text-secondary); }
    }

    .insights-section {
      margin-bottom: var(--spacing-md);

      .insight-item {
        display: flex;
        align-items: flex-start;
        gap: var(--spacing-xs);
        padding: var(--spacing-xs) 0;
        font-size: 14px;

        mat-icon { font-size: 18px; width: 18px; height: 18px; color: #2196f3; flex-shrink: 0; margin-top: 2px; }
      }
    }

    .recipe-card {
      padding: var(--spacing-sm);
      background: var(--surface-color);
      border-radius: 8px;
      margin-bottom: var(--spacing-sm);

      .recipe-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 4px;

        .recipe-name { font-weight: 600; font-size: 14px; }
      }

      .recipe-nutrition {
        display: flex;
        gap: var(--spacing-sm);
        font-size: 12px;
        color: var(--text-secondary);
        margin-bottom: 6px;
      }

      .pantry-row {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);

        mat-progress-bar { flex: 1; }
        .pantry-label { font-size: 11px; color: var(--text-secondary); white-space: nowrap; }
      }
    }

    mat-chip {
      &.fit-high { --mdc-chip-label-text-color: white; background: #4caf50; }
      &.fit-mid { --mdc-chip-label-text-color: white; background: #ff9800; }
      &.fit-low { --mdc-chip-label-text-color: white; background: #9e9e9e; }
    }

    @media (max-width: 480px) {
      .remaining-grid { grid-template-columns: repeat(2, 1fr); }
    }
  `]
})
export class DietAdviceComponent implements OnInit {
  private adviceService = inject(DietAdviceService);
  private nutritionService = inject(NutritionService);

  advice = signal<DietAdvice | null>(null);
  hasGoals = signal(false);

  ngOnInit(): void {
    const goals = this.nutritionService.getGoals();
    this.hasGoals.set(!!goals);
    if (goals) {
      const today = this.formatDate(new Date());
      const summary = this.nutritionService.getDailyNutrition(today);
      this.advice.set(this.adviceService.generateAdvice(summary, goals));
    }
  }

  getFitClass(score: number): string {
    if (score >= 70) return 'fit-high';
    if (score >= 40) return 'fit-mid';
    return 'fit-low';
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
