import { Component, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { DbService } from '../../core/services/db.service';
import { RecipeEditDialog } from './recipe-edit.dialog';
import { RecipeImportDialog } from './recipe-import.dialog';
import { RouterModule } from '@angular/router';
import { ErrorHandlerService } from '../../core/services/error-handler.service';
import { SnackbarService } from '../../core/services/snackbar.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DataEventsService } from '../../core/services/data-events.service';
import { ConfirmDialog } from '../../shared/dialogs/confirm/confirm.dialog';

@Component({
  standalone: true,
  selector: 'pp-recipe-list',
  imports: [CommonModule, RouterModule, MatTableModule, MatButtonModule, MatIconModule, MatDialogModule],
  templateUrl: './recipe-list.component.html',
  styleUrls: ['./recipe-list.component.scss'],
})
export class RecipeListComponent {
  private db = inject(DbService);
  private dialog = inject(MatDialog);
  private errorHandler = inject(ErrorHandlerService);
  private snackbar = inject(SnackbarService);
  private destroyRef = inject(DestroyRef);
  private dataEvents = inject(DataEventsService);

  rows: any[] = [];
  cols = ['name', 'actions'];

  constructor() {
    this.refresh();
    this.dataEvents.on('recipes', 'recipe_ingredients')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.refresh());
  }

  refresh() {
    try {
      const userId = this.db.getCurrentUserId();
      this.rows = userId
        ? this.db.query<any>('SELECT id, name FROM recipes WHERE userId = ? AND (isDeleted IS NULL OR isDeleted = 0)', [userId])
        : this.db.query<any>('SELECT id, name FROM recipes WHERE userId IS NULL AND (isDeleted IS NULL OR isDeleted = 0)');
    } catch (error) {
      this.errorHandler.handle(error, 'Failed to load recipes');
      this.rows = [];
    }
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
      .subscribe(recipeId => {
        if (recipeId) {
          this.refresh();
        }
      });
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
