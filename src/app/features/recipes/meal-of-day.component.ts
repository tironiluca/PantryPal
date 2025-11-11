import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { DbService } from '../../core/services/db.service';

@Component({
  standalone: true,
  selector: 'pp-meal-of-day',
  imports: [CommonModule, MatCardModule],
  template: `
  <mat-card *ngIf="recipe; else noRec">
    <h2>{{ recipe.name }}</h2>
    <p *ngIf="missing.length===0">All ingredients available ✔</p>
    <p *ngIf="missing.length>0">Missing: {{ missing.join(', ') }}</p>
  </mat-card>
  <ng-template #noRec><p style="padding:1rem">No recipes yet.</p></ng-template>
  `
})
export class MealOfDayComponent {
  private db = inject(DbService);
  recipe: any; missing: string[] = [];
  constructor(){
    const r = this.db.query<any>('SELECT * FROM recipes LIMIT 1')[0];
    if (!r) return;
    this.recipe = r;
    const ings = this.db.query<any>('SELECT ingredientId, quantity FROM recipe_ingredients WHERE recipeId = ?', [r.id]);
    const miss: string[] = [];
    for (const ing of ings) {
      const row = this.db.query<any>('SELECT SUM(quantity) as qty FROM inventory WHERE ingredientId = ?', [ing.ingredientId])[0];
      if ((row?.qty ?? 0) < ing.quantity) miss.push(ing.ingredientId);
    }
    this.missing = miss;
  }
}
