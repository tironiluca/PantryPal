import { Component, inject, signal, DestroyRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { RouterModule } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { DbService } from '../../core/services/db.service';
import { DietAdviceService } from '../../core/services/diet-advice.service';
import { RecipeEditDialog } from './recipe-edit.dialog';
import { RecipeImportDialog } from './recipe-import.dialog';
import { ErrorHandlerService } from '../../core/services/error-handler.service';
import { SnackbarService } from '../../core/services/snackbar.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DataEventsService } from '../../core/services/data-events.service';
import { ConfirmDialog } from '../../shared/dialogs/confirm/confirm.dialog';
import { KeyboardService } from '../../core/services/keyboard.service';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';

@Component({
  standalone: true,
  selector: 'pp-recipe-list',
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatChipsModule,
    MatTooltipModule,
    TranslocoModule,
    SkeletonComponent,
  ],
  templateUrl: './recipe-list.component.html',
  styleUrls: ['./recipe-list.component.scss'],
})
export class RecipeListComponent {
  private db = inject(DbService);
  private dietAdvice = inject(DietAdviceService);
  private dialog = inject(MatDialog);
  private errorHandler = inject(ErrorHandlerService);
  private snackbar = inject(SnackbarService);
  private destroyRef = inject(DestroyRef);
  private dataEvents = inject(DataEventsService);
  private keyboard = inject(KeyboardService);

  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

  rows: any[] = [];
  filteredRows: any[] = [];
  loading = signal(false);
  canCookMap = new Map<string, boolean>();
  searchTerm = '';

  constructor() {
    this.refresh();
    this.dataEvents.on('recipes', 'recipe_ingredients', 'inventory')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.refresh());

    this.keyboard.addNew$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.add());

    this.keyboard.focusSearch$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.searchInput?.nativeElement.focus());

    this.keyboard.escape$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => { this.searchTerm = ''; this.applyFilters(); });
  }

  refresh() {
    this.loading.set(true);
    try {
      const userId = this.db.getCurrentUserId();
      this.rows = userId
        ? this.db.query<any>(
            `SELECT r.id, r.name, r.imageUrl, r.servings,
               (SELECT COUNT(*) FROM recipe_ingredients ri
                WHERE ri.recipeId = r.id AND (ri.isDeleted IS NULL OR ri.isDeleted = 0)) AS ingredientCount
             FROM recipes r
             WHERE r.userId = ? AND (r.isDeleted IS NULL OR r.isDeleted = 0)`,
            [userId]
          )
        : this.db.query<any>(
            `SELECT r.id, r.name, r.imageUrl, r.servings,
               (SELECT COUNT(*) FROM recipe_ingredients ri
                WHERE ri.recipeId = r.id AND (ri.isDeleted IS NULL OR ri.isDeleted = 0)) AS ingredientCount
             FROM recipes r
             WHERE r.userId IS NULL AND (r.isDeleted IS NULL OR r.isDeleted = 0)`
          );

      this.computeCanCook(userId);
      this.applyFilters();
    } catch (error) {
      this.errorHandler.handle(error, 'Failed to load recipes');
      this.rows = [];
      this.filteredRows = [];
    } finally {
      this.loading.set(false);
    }
  }

  private computeCanCook(userId: string | null) {
    this.canCookMap.clear();
    if (!userId) return;
    for (const r of this.rows) {
      const pct = this.dietAdvice.getIngredientAvailability(r.id, userId);
      this.canCookMap.set(r.id, pct === 100);
    }
  }

  applyFilters() {
    const term = this.searchTerm.toLowerCase();
    this.filteredRows = term
      ? this.rows.filter(r => r.name.toLowerCase().includes(term))
      : [...this.rows];
  }

  add() {
    this.dialog
      .open(RecipeEditDialog, { data: null })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(ok => ok && this.refresh());
  }

  importRecipe() {
    this.dialog
      .open(RecipeImportDialog, { maxWidth: '600px', width: '95vw', maxHeight: '90vh' })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(recipeId => recipeId && this.refresh());
  }

  edit(r: any) {
    this.dialog
      .open(RecipeEditDialog, { data: r })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(ok => ok && this.refresh());
  }

  remove(r: any) {
    this.dialog
      .open(ConfirmDialog, {
        data: { title: 'Delete Recipe', message: `Delete "${r.name}"?`, confirmColor: 'warn', icon: 'delete' },
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(ok => {
        if (!ok) return;
        try {
          this.db.exec('DELETE FROM recipe_ingredients WHERE recipeId = ?', [r.id]);
          this.db.exec('DELETE FROM recipes WHERE id = ?', [r.id]);
          this.dataEvents.emit('recipes', 'delete', r.id);
          this.snackbar.success('Recipe deleted successfully');
          this.refresh();
        } catch (error) {
          this.errorHandler.handle(error, 'Failed to delete recipe');
        }
      });
  }
}
