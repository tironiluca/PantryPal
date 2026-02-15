import { Component, inject, DestroyRef } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatTableModule } from "@angular/material/table";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import { DbService } from "../../core/services/db.service";
import { InventoryItem } from "../../core/models/inventory.model";
import { InventoryEditDialog } from "./inventory-edit/inventory-edit.dialog";
import { ErrorHandlerService } from "../../core/services/error-handler.service";
import { SnackbarService } from "../../core/services/snackbar.service";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";

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
  private errorHandler = inject(ErrorHandlerService);
  private snackbar = inject(SnackbarService);
  private destroyRef = inject(DestroyRef);

  rows: InventoryItem[] = [];

  cols = ["ingredientId", "quantity", "expiry", "actions"];

  constructor() {
    this.refresh();
  }

  refresh() {
    try {
      this.rows = this.db.query<InventoryItem>("SELECT * FROM inventory");
    } catch (error) {
      this.errorHandler.handle(error, 'Failed to load inventory');
      this.rows = [];
    }
  }

  add() {
    this.dialog
      .open(InventoryEditDialog, { data: null })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => ok && this.refresh());
  }

  edit(row: InventoryItem) {
    this.dialog
      .open(InventoryEditDialog, { data: row })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => ok && this.refresh());
  }

  remove(row: InventoryItem) {
    try {
      if (confirm(`Are you sure you want to delete this inventory item?`)) {
        this.db.exec("DELETE FROM inventory WHERE id = ?", [row.id]);
        this.snackbar.success('Inventory item deleted successfully');
        this.refresh();
      }
    } catch (error) {
      this.errorHandler.handle(error, 'Failed to delete inventory item');
    }
  }
}
