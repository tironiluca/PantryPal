import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { DbService } from '../../core/services/db.service';
import { Ingredient } from '../../core/models/ingredient.model';
import { IngredientEditDialog } from './ingredient-edit.dialog';

@Component({
  standalone: true,
  selector: 'pp-ingredient-list',
  imports: [CommonModule, MatTableModule, MatButtonModule, MatIconModule, MatDialogModule],
  template: `
  <div class="container">
    <h2>Ingredients</h2>
    <table mat-table [dataSource]="rows" class="mat-elevation-z1" *ngIf="rows">
      <ng-container matColumnDef="name">
        <th mat-header-cell *matHeaderCellDef>Name</th>
        <td mat-cell *matCellDef="let r">{{r.name}}</td>
      </ng-container>
      <ng-container matColumnDef="categoryId">
        <th mat-header-cell *matHeaderCellDef>Category</th>
        <td mat-cell *matCellDef="let r">{{r.categoryId || '-'}}</td>
      </ng-container>
      <ng-container matColumnDef="notify">
        <th mat-header-cell *matHeaderCellDef>Notify</th>
        <td mat-cell *matCellDef="let r">start: {{r.notifyStartDays ?? 3}}d, repeat: {{r.notifyRepeatDays ?? 1}}d</td>
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
    <p *ngIf="rows.length===0">No ingredients yet.</p>
    <button mat-fab color="primary" class="fab" (click)="add()"><mat-icon>add</mat-icon></button>
  </div>
  `,
  styles: [`.container{padding:1rem}.fab{position:fixed;right:1rem;bottom:1rem}`]
})
export class IngredientListComponent {
  private db = inject(DbService);
  private dialog = inject(MatDialog);
  rows: Ingredient[] = [];
  cols = ['name','categoryId','notify','actions'];
  constructor(){ this.refresh(); }
  refresh(){ this.rows = this.db.query<Ingredient>('SELECT * FROM ingredients'); }
  add(){ this.dialog.open(IngredientEditDialog, { data: null }).afterClosed().subscribe(ok => ok && this.refresh()); }
  edit(row: Ingredient){ this.dialog.open(IngredientEditDialog, { data: row }).afterClosed().subscribe(ok => ok && this.refresh()); }
  remove(row: any){ this.db.exec('DELETE FROM ingredients WHERE id = ?', [row.id]); this.refresh(); }
}
