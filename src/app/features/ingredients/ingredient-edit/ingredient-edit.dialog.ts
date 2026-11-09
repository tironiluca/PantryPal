import { Component, DestroyRef, Inject, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
  private destroyRef = inject(DestroyRef);
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
      this.categories = this.db.getIngredientCategories();
    } catch {
      this.categories = [];
    }
  }

  canSave(): boolean {
    return !!this.model.name?.trim();
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
    }).afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((nutrition: NutritionData | null) => {
      if (nutrition) {
        // Store for later — will be persisted in save()
        this.pendingNutrition = nutrition;
        Object.assign(this.model, nutrition);
      }
    });
  }

  save() {
    if (!this.canSave()) return;
    const isNew = !this.model.id;
    if (isNew) {
      this.model.id = `ing-${crypto.randomUUID()}`;
      this.db.createIngredient({
        id: this.model.id,
        name: this.model.name,
        categoryId: this.model.categoryId || null,
        defaultShelfLifeDays: this.model.defaultShelfLifeDays ?? null,
        notifyStartDays: this.model.notifyStartDays ?? null,
        notifyRepeatDays: this.model.notifyRepeatDays ?? null,
      });
    } else {
      this.db.updateIngredientDetails(this.model.id, {
        name: this.model.name,
        categoryId: this.model.categoryId || null,
        defaultShelfLifeDays: this.model.defaultShelfLifeDays ?? null,
        notifyStartDays: this.model.notifyStartDays ?? null,
        notifyRepeatDays: this.model.notifyRepeatDays ?? null,
      });
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
