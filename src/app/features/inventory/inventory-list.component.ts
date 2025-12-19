import { Component, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatTableModule } from "@angular/material/table";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import { DbService } from "../../core/services/db.service";
import { InventoryItem } from "../../core/models/inventory.model";
import { InventoryEditDialog } from "./inventory-edit/inventory-edit.dialog";

@Component({
  selector:'pp-inventory-list',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
  ],
  templateUrl: './inventory-list.component.html'
})
export class InventoryListComponent {
  private db = inject(DbService);
  private dialog = inject(MatDialog);

  rows: InventoryItem[] = [];

  cols = ["ingredientId", "quantity", "expiry", "actions"];

  constructor() {
    this.refresh();
  }

  refresh() {
    this.rows = this.db.query<InventoryItem>("SELECT * FROM inventory");
  }

  add() {
    this.dialog
      .open(InventoryEditDialog, { data: null })
      .afterClosed()
      .subscribe((ok) => ok && this.refresh());
  }

  edit(row: InventoryItem) {
    this.dialog
      .open(InventoryEditDialog, { data: row })
      .afterClosed()
      .subscribe((ok) => ok && this.refresh());
  }

  remove(row: InventoryItem) {
    this.db.exec("DELETE FROM inventory WHERE id = ?", [row.id]);
    this.refresh();
  }
}
