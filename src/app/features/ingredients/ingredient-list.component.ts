import { Component, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatTableModule } from "@angular/material/table";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import { DbService } from "../../core/services/db.service";
import { Ingredient } from "../../core/models/ingredient.model";
import { IngredientEditDialog } from "./ingredient-edit/ingredient-edit.dialog";

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

  rows: Ingredient[] = [];
  cols = ["name", "categoryId", "notify", "actions"];

  constructor() {
    this.refresh();
  }

  refresh() {
    this.rows = this.db.query<Ingredient>("SELECT * FROM ingredients");
  }

  add() {
    this.dialog
      .open(IngredientEditDialog, { data: null })
      .afterClosed()
      .subscribe((ok) => ok && this.refresh());
  }

  edit(row: Ingredient) {
    this.dialog
      .open(IngredientEditDialog, { data: row })
      .afterClosed()
      .subscribe((ok) => ok && this.refresh());
  }
  
  remove(row: any) {
    this.db.exec("DELETE FROM ingredients WHERE id = ?", [row.id]);
    this.refresh();
  }
}
