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
  templateUrl: './diet-advice.component.html',
  styleUrls: ['./diet-advice.component.scss']
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
