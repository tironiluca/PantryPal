import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { DbService } from '../../core/services/db.service';
import { RecipeEditDialog } from './recipe-edit.dialog';
import { RouterModule } from '@angular/router';

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
      <button mat-fab color="primary" class="fab" (click)="add()"><mat-icon>add</mat-icon></button>
    </div>
  </div>
  `,
  styles: [`.container{padding:1rem}.fab{position:fixed;right:1rem;bottom:1rem}.actions{margin-top:8px}`]
})
export class RecipeListComponent {
  private db = inject(DbService);
  private dialog = inject(MatDialog);
  rows: any[] = [];
  cols = ['name', 'actions'];
  constructor() { this.refresh(); }
  refresh() { this.rows = this.db.query<any>('SELECT id, name FROM recipes'); }
  add() { this.dialog.open(RecipeEditDialog, { data: null }).afterClosed().subscribe(ok => ok && this.refresh()); }
  edit(r: any) { this.dialog.open(RecipeEditDialog, { data: r }).afterClosed().subscribe(ok => ok && this.refresh()); }
  remove(r: any) {
    this.db.exec('DELETE FROM recipe_ingredients WHERE recipeId = ?', [r.id]);
    this.db.exec('DELETE FROM recipes WHERE id = ?', [r.id]);
    this.refresh();
  }
}
