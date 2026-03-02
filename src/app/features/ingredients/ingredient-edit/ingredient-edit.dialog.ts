import { Component, Inject, inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { TranslocoModule } from '@jsverse/transloco';
import { DbService } from '../../../core/services/db.service';
import { Ingredient } from '../../../core/models/ingredient.model';
import { DataEventsService } from '../../../core/services/data-events.service';
import { NutritionEditDialog } from '../nutrition-edit.dialog';
import { NutritionService, NutritionData } from '../../../core/services/nutrition.service';

@Component({
  standalone: true,
  selector: 'pp-ingredient-edit',
  imports: [CommonModule, FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatIconModule, MatChipsModule, MatDividerModule, TranslocoModule],
  templateUrl: './ingredient-edit.dialog.html',
  styleUrls: ['./ingredient-edit.dialog.scss']
})
export class IngredientEditDialog implements OnInit {
  private db = inject(DbService);
  private dialog = inject(MatDialog);
  private dataEvents = inject(DataEventsService);
  private nutritionService = inject(NutritionService);

  model: any = { id: '', name: '', categoryId: '', defaultShelfLifeDays: null, notifyStartDays: 3, notifyRepeatDays: 1 };
  categories: { id: string; name: string }[] = [];

  // Pending nutrition to be saved together with the ingredient in save() (BUG-11)
  private pendingNutrition: NutritionData | null = null;

  constructor(@Inject(MAT_DIALOG_DATA) public data: Ingredient | null, private ref: MatDialogRef<IngredientEditDialog>) {
    if (data) this.model = { ...data };
  }

  ngOnInit(): void {
    try {
      this.categories = this.db.query<{ id: string; name: string }>(
        'SELECT id, name FROM ingredient_categories ORDER BY name'
      );
    } catch {
      this.categories = [];
    }
  }

  hasNutrition(): boolean {
    return this.model.energyKcal != null && this.model.energyKcal > 0;
  }

  openNutritionEdit(): void {
    // Assign a temporary ID for keying purposes — no DB insert yet (BUG-11)
    if (!this.model.id) {
      this.model.id = `ing-${crypto.randomUUID()}`;
    }

    const existing: NutritionData | undefined = this.hasNutrition() ? {
      energyKcal: this.model.energyKcal,
      proteinG: this.model.proteinG,
      carbsG: this.model.carbsG,
      fatG: this.model.fatG,
      fiberG: this.model.fiberG,
      sugarG: this.model.sugarG,
      sodiumMg: this.model.sodiumMg,
    } : this.pendingNutrition ?? undefined;

    this.dialog.open(NutritionEditDialog, {
      data: {
        ingredientId: this.model.id,
        ingredientName: this.model.name || 'ingredient',
        existing,
      },
      width: '520px',
      maxWidth: '95vw',
    }).afterClosed().subscribe((nutrition: NutritionData | null) => {
      if (nutrition) {
        // Store for later — will be persisted in save()
        this.pendingNutrition = nutrition;
        Object.assign(this.model, nutrition);
      }
    });
  }

  save() {
    const isNew = !this.model.id;
    if (isNew) {
      this.model.id = `ing-${crypto.randomUUID()}`;
      this.db.exec(
        'INSERT INTO ingredients (id, name, categoryId, defaultShelfLifeDays, notifyStartDays, notifyRepeatDays) VALUES (?,?,?,?,?,?)',
        [this.model.id, this.model.name, this.model.categoryId || null,
         this.model.defaultShelfLifeDays ?? null, this.model.notifyStartDays ?? null, this.model.notifyRepeatDays ?? null]
      );
    } else {
      this.db.exec(
        'UPDATE ingredients SET name=?, categoryId=?, defaultShelfLifeDays=?, notifyStartDays=?, notifyRepeatDays=? WHERE id=?',
        [this.model.name, this.model.categoryId || null,
         this.model.defaultShelfLifeDays ?? null, this.model.notifyStartDays ?? null, this.model.notifyRepeatDays ?? null, this.model.id]
      );
    }

    // Persist pending nutrition now that the ingredient row exists (BUG-11)
    if (this.pendingNutrition) {
      this.nutritionService.updateIngredientNutrition(this.model.id, this.pendingNutrition);
    }

    this.dataEvents.emit('ingredients', isNew ? 'create' : 'update', this.model.id);
    this.ref.close(true);
  }

  close() { this.ref.close(false); }
}
