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
import { NutritionService, NutritionData } from '../../core/services/nutrition.service';
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
  template: `
    <div *transloco="let t">
      <h2 mat-dialog-title>
        <mat-icon>nutrition</mat-icon>
        {{ t('ingredients.nutritionInfo') }} — {{ data.ingredientName }}
      </h2>

      <mat-dialog-content>
        <mat-tab-group>
          <!-- Search Tab -->
          <mat-tab [label]="t('common.search')">
            <div class="tab-content">
              <div class="search-row">
                <mat-form-field appearance="outline" class="search-field">
                  <mat-label>{{ t('common.search') }}</mat-label>
                  <input matInput [(ngModel)]="searchQuery" (keyup.enter)="search()" [placeholder]="data.ingredientName" />
                  <mat-icon matSuffix>search</mat-icon>
                </mat-form-field>
                <button mat-raised-button color="primary" (click)="search()" [disabled]="searching()">
                  @if (searching()) { <mat-spinner diameter="18"></mat-spinner> }
                  @else { <mat-icon>search</mat-icon> }
                </button>
              </div>

              @if (searchResults().length > 0) {
                <p class="hint">{{ t('nutrition.per100g') }}</p>
                <mat-list>
                  @for (r of searchResults(); track r.productName) {
                    <mat-list-item class="result-item" (click)="selectResult(r)">
                      <span matListItemTitle>{{ r.productName }}</span>
                      <span matListItemLine>
                        {{ r.energyKcal | number:'1.0-0' }} kcal · {{ r.proteinG | number:'1.0-1' }}g protein · {{ r.carbsG | number:'1.0-1' }}g carbs · {{ r.fatG | number:'1.0-1' }}g fat
                      </span>
                    </mat-list-item>
                  }
                </mat-list>
              }

              @if (noResults()) {
                <div class="empty">
                  <mat-icon>search_off</mat-icon>
                  <p>{{ t('common.noResults') }}</p>
                </div>
              }
            </div>
          </mat-tab>

          <!-- Manual Input Tab -->
          <mat-tab label="Manual">
            <div class="tab-content manual-form">
              <p class="hint">{{ t('nutrition.per100g') }}</p>
              <div class="form-grid">
                <mat-form-field appearance="outline">
                  <mat-label>{{ t('nutrition.calories') }} (kcal)</mat-label>
                  <input matInput type="number" [(ngModel)]="manual.energyKcal" min="0" />
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>{{ t('nutrition.protein') }} (g)</mat-label>
                  <input matInput type="number" [(ngModel)]="manual.proteinG" min="0" />
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>{{ t('nutrition.carbs') }} (g)</mat-label>
                  <input matInput type="number" [(ngModel)]="manual.carbsG" min="0" />
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>{{ t('nutrition.fat') }} (g)</mat-label>
                  <input matInput type="number" [(ngModel)]="manual.fatG" min="0" />
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>{{ t('nutrition.fiber') }} (g)</mat-label>
                  <input matInput type="number" [(ngModel)]="manual.fiberG" min="0" />
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>{{ t('nutrition.sugar') }} (g)</mat-label>
                  <input matInput type="number" [(ngModel)]="manual.sugarG" min="0" />
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>{{ t('nutrition.sodium') }} (mg)</mat-label>
                  <input matInput type="number" [(ngModel)]="manual.sodiumMg" min="0" />
                </mat-form-field>
              </div>
            </div>
          </mat-tab>
        </mat-tab-group>

        <!-- Selected Preview -->
        @if (selected()) {
          <div class="selected-preview">
            <mat-chip-set>
              <mat-chip color="primary" highlighted>
                <mat-icon matChipAvatar>check</mat-icon>
                {{ selected()!.energyKcal | number:'1.0-0' }} kcal
              </mat-chip>
              <mat-chip>{{ selected()!.proteinG | number:'1.0-1' }}g {{ t('nutrition.protein') }}</mat-chip>
              <mat-chip>{{ selected()!.carbsG | number:'1.0-1' }}g {{ t('nutrition.carbs') }}</mat-chip>
              <mat-chip>{{ selected()!.fatG | number:'1.0-1' }}g {{ t('nutrition.fat') }}</mat-chip>
            </mat-chip-set>
          </div>
        }
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>{{ t('common.cancel') }}</button>
        <button mat-raised-button color="primary" (click)="saveManual()" *ngIf="activeTab === 1">
          <mat-icon>save</mat-icon>
          {{ t('common.save') }}
        </button>
        <button mat-raised-button color="primary" (click)="saveSelected()" [disabled]="!selected()" *ngIf="activeTab === 0">
          <mat-icon>save</mat-icon>
          {{ t('common.save') }}
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    h2 { display: flex; align-items: center; gap: 8px; }

    mat-dialog-content {
      min-width: 320px;
      max-width: 500px;
      width: 90vw;
    }

    .tab-content { padding: var(--spacing-md) 0; }

    .search-row {
      display: flex;
      gap: var(--spacing-sm);
      align-items: center;
    }

    .search-field { flex: 1; }

    .result-item {
      cursor: pointer;
      border-radius: 8px;
      margin-bottom: 4px;

      &:hover { background: var(--surface-color); }
    }

    .manual-form .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--spacing-sm);

      mat-form-field { width: 100%; }
    }

    .hint {
      font-size: 12px;
      color: var(--text-secondary);
      margin: 0 0 var(--spacing-sm);
    }

    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: var(--spacing-xl);
      color: var(--text-secondary);

      mat-icon { font-size: 40px; width: 40px; height: 40px; opacity: 0.4; }
    }

    .selected-preview {
      padding: var(--spacing-md) 0 0;
      border-top: 1px solid var(--divider-color);
      margin-top: var(--spacing-sm);
    }
  `]
})
export class NutritionEditDialog {
  private nutritionService = inject(NutritionService);
  private snackbar = inject(SnackbarService);
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
    this.nutritionService.updateIngredientNutrition(this.data.ingredientId, s);
    this.snackbar.success('Nutrition info saved!');
    this.dialogRef.close(true);
  }

  saveManual(): void {
    this.nutritionService.updateIngredientNutrition(this.data.ingredientId, this.manual);
    this.snackbar.success('Nutrition info saved!');
    this.dialogRef.close(true);
  }
}
