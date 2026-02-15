import { Component, inject, DestroyRef } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatTableModule } from "@angular/material/table";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import { DbService } from "../../core/services/db.service";
import { Ingredient } from "../../core/models/ingredient.model";
import { IngredientEditDialog } from "./ingredient-edit/ingredient-edit.dialog";
import { ErrorHandlerService } from "../../core/services/error-handler.service";
import { SnackbarService } from "../../core/services/snackbar.service";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";

@Component({
  standalone: true,
  selector: "pp-ingredient-list",
  imports: [
    CommonModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
  ],
  templateUrl: './ingredient-list.component.html',
})
export class IngredientListComponent {

  private db = inject(DbService);
  private dialog = inject(MatDialog);
  private errorHandler = inject(ErrorHandlerService);
  private snackbar = inject(SnackbarService);
  private destroyRef = inject(DestroyRef);

  rows: Ingredient[] = [];
  cols = ["name", "categoryId", "notify", "actions"];

  constructor() {
    this.refresh();
  }

  refresh() {
    try {
      this.rows = this.db.query<Ingredient>("SELECT * FROM ingredients");
    } catch (error) {
      this.errorHandler.handle(error, 'Failed to load ingredients');
      this.rows = [];
    }
  }

  add() {
    this.dialog
      .open(IngredientEditDialog, { data: null })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => ok && this.refresh());
  }

  edit(row: Ingredient) {
    this.dialog
      .open(IngredientEditDialog, { data: row })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => ok && this.refresh());
  }

  remove(row: any) {
    try {
      if (confirm(`Are you sure you want to delete "${row.name}"?`)) {
        this.db.exec("DELETE FROM ingredients WHERE id = ?", [row.id]);
        this.snackbar.success('Ingredient deleted successfully');
        this.refresh();
      }
    } catch (error) {
      this.errorHandler.handle(error, 'Failed to delete ingredient');
    }
  }
}
