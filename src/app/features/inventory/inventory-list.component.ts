import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { DbService } from '../../core/services/db.service';
import { InventoryItem } from '../../core/models/inventory.model';
import { InventoryEditDialog } from './inventory-edit.dialog';

@Component({
  standalone: true,
  selector: 'pp-inventory-list',
  imports: [CommonModule, MatTableModule, MatButtonModule, MatIconModule, MatDialogModule],
  template: `
  <div class="container">
    <table mat-table [dataSource]="rows" class="mat-elevation-z1" *ngIf="rows">
      <ng-container matColumnDef="ingredientId">
        <th mat-header-cell *matHeaderCellDef>Ingredient</th>
        <td mat-cell *matCellDef="let r">{{r.ingredientId}}</td>
      </ng-container>
      <ng-container matColumnDef="quantity">
        <th mat-header-cell *matHeaderCellDef>Qty</th>
        <td mat-cell *matCellDef="let r">{{r.quantity}} {{r.unit}}</td>
      </ng-container>
      <ng-container matColumnDef="expiry">
        <th mat-header-cell *matHeaderCellDef>Expiry</th>
        <td mat-cell *matCellDef="let r">{{r.expiry || '-'}}</td>
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
    <p *ngIf="rows.length===0">No items yet.</p>
    <button mat-fab color="primary" class="fab" (click)="add()"><mat-icon>add</mat-icon></button>
  </div>
  `,
  styles: [`.container{padding:1rem}.fab{position:fixed;right:1rem;bottom:1rem}`]
})
export class InventoryListComponent {
  private db = inject(DbService);
  private dialog = inject(MatDialog);
  rows: InventoryItem[] = [];
  cols = ['ingredientId','quantity','expiry','actions'];

  constructor() {
    this.refresh();
  }

  refresh() { this.rows = this.db.query<InventoryItem>('SELECT * FROM inventory'); }

  add() {
    this.dialog.open(InventoryEditDialog, { data: null }).afterClosed().subscribe(ok => ok && this.refresh());
  }

  edit(row: InventoryItem) {
    this.dialog.open(InventoryEditDialog, { data: row }).afterClosed().subscribe(ok => ok && this.refresh());
  }

  remove(row: InventoryItem) {
    this.db.exec('DELETE FROM inventory WHERE id = ?', [row.id]);
    this.refresh();
  }
}
