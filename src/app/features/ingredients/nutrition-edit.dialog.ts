import { Component, inject, Inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { TranslocoModule } from '@jsverse/transloco';
import { NutritionData, NutritionService } from '../../core/services/nutrition.service';
import { SnackbarService } from '../../core/services/snackbar.service';

interface SearchResult {
  productName: string;
  energyKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number;
  sugarG?: number;
  sodiumMg?: number;
}

@Component({
  standalone: true,
  selector: 'pp-nutrition-edit-dialog',
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatListModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    TranslocoModule,
  ],
  templateUrl: './nutrition-edit.dialog.html',
  styleUrls: ['./nutrition-edit.dialog.scss']
})
export class NutritionEditDialog {
  private snackbar = inject(SnackbarService);
  private nutritionService = inject(NutritionService);
  private dialogRef = inject(MatDialogRef<NutritionEditDialog>);

  searchQuery = '';
  searching = signal(false);
  searchResults = signal<SearchResult[]>([]);
  noResults = signal(false);
  selected = signal<NutritionData | null>(null);
  activeTab = 0;

  manual: NutritionData = {
    energyKcal: 0, proteinG: 0, carbsG: 0, fatG: 0,
    fiberG: 0, sugarG: 0, sodiumMg: 0,
  };

  constructor(@Inject(MAT_DIALOG_DATA) public data: { ingredientId: string; ingredientName: string; existing?: NutritionData }) {
    this.searchQuery = data.ingredientName;
    if (data.existing) {
      this.manual = { ...data.existing };
    }
  }

  async search(): Promise<void> {
    const q = this.searchQuery.trim();
    if (!q) return;

    this.searching.set(true);
    this.noResults.set(false);
    this.searchResults.set([]);

    try {
      const results = await this.nutritionService.getNutritionByName(q);
      if (results && results.length > 0) {
        this.searchResults.set(results as any);
      } else {
        this.noResults.set(true);
      }
    } catch {
      this.noResults.set(true);
    } finally {
      this.searching.set(false);
    }
  }

  selectResult(r: SearchResult): void {
    this.selected.set({
      energyKcal: r.energyKcal,
      proteinG: r.proteinG,
      carbsG: r.carbsG,
      fatG: r.fatG,
      fiberG: r.fiberG,
      sugarG: r.sugarG,
      sodiumMg: r.sodiumMg,
    });
    // Copy to manual too for reference
    Object.assign(this.manual, this.selected());
  }

  saveSelected(): void {
    const s = this.selected();
    if (!s) return;
    // Return nutrition data to caller — DB persistence happens in IngredientEditDialog.save() (BUG-11)
    this.dialogRef.close(s);
  }

  saveManual(): void {
    // Return nutrition data to caller — DB persistence happens in IngredientEditDialog.save() (BUG-11)
    this.dialogRef.close({ ...this.manual });
  }
}
