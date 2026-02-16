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

@Component({
  standalone: true,
  selector: 'pp-recipe-list',
  imports: [CommonModule, RouterModule, MatTableModule, MatButtonModule, MatIconModule, MatDialogModule],
  template: `
  <div class="container">
    <h2>Recipes</h2>
    <table mat-table [dataSource]="rows" class="mat-elevation-z1" *ngIf="rows">
      <ng-container matColumnDef="name">
        <th mat-header-cell *matHeaderCellDef>Name</th>
        <td mat-cell *matCellDef="let r">{{r.name}}</td>
      </ng-container>
      <ng-container matColumnDef="actions">
        <th mat-header-cell *matHeaderCellDef></th>
        <td mat-cell *matCellDef="let r">
          <button mat-icon-button (click)="edit(r)"><mat-icon>edit</mat-icon></button>
          <button mat-icon-button color="warn" (click)="remove(r)"><mat-icon>delete</mat-icon></button>
        </td>
      </ng-container>
      <tr mat-header-row *matHeaderRowDef="cols"></tr>
      <tr mat-row *matRowDef="let row; columns: cols;"></tr>
    </table>
    <p *ngIf="rows.length===0">No recipes yet.</p>
    <div class="actions">
      <button mat-stroked-button [routerLink]="['/recipes/meal']">Meal of the Day</button>
      <button mat-stroked-button (click)="importRecipe()">
        <mat-icon>download</mat-icon>
        Import Recipe
      </button>
      <button mat-fab color="primary" class="fab" (click)="add()"><mat-icon>add</mat-icon></button>
    </div>
  </div>
  `,
  styleUrls: ['./recipe-list.component.scss']
})
export class RecipeListComponent {
  private db = inject(DbService);
  private dialog = inject(MatDialog);
  private errorHandler = inject(ErrorHandlerService);
  private snackbar = inject(SnackbarService);
  private destroyRef = inject(DestroyRef);

  rows: any[] = [];
  cols = ['name', 'actions'];

  constructor() {
    this.refresh();
  }

  refresh() {
    try {
      this.rows = this.db.query<any>('SELECT id, name FROM recipes');
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
      .open(RecipeImportDialog, { width: '800px', maxHeight: '90vh' })
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
    try {
      if (confirm(`Are you sure you want to delete recipe "${r.name}"?`)) {
        this.db.exec('DELETE FROM recipe_ingredients WHERE recipeId = ?', [r.id]);
        this.db.exec('DELETE FROM recipes WHERE id = ?', [r.id]);
        this.snackbar.success('Recipe deleted successfully');
        this.refresh();
      }
    } catch (error) {
      this.errorHandler.handle(error, 'Failed to delete recipe');
    }
  }
}
