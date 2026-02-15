import { Component, inject, DestroyRef } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MatTableModule } from "@angular/material/table";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
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
    FormsModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './ingredient-list.component.html',
  styleUrls: ['./ingredient-list.component.scss']
})
export class IngredientListComponent {

  private db = inject(DbService);
  private dialog = inject(MatDialog);
  private errorHandler = inject(ErrorHandlerService);
  private snackbar = inject(SnackbarService);
  private destroyRef = inject(DestroyRef);

  rows: Ingredient[] = [];
  filteredRows: Ingredient[] = [];
  cols = ["name", "categoryId", "notify", "actions"];

  searchTerm = '';
  sortColumn = 'name';
  sortDirection: 'asc' | 'desc' = 'asc';

  constructor() {
    this.refresh();
  }

  refresh() {
    try {
      this.rows = this.db.query<Ingredient>("SELECT * FROM ingredients");
      this.applyFilters();
    } catch (error) {
      this.errorHandler.handle(error, 'Failed to load ingredients');
      this.rows = [];
      this.filteredRows = [];
    }
  }

  applyFilters() {
    let filtered = [...this.rows];

    // Search filter
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(term) ||
        item.categoryId?.toLowerCase().includes(term)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal: any = a[this.sortColumn as keyof Ingredient];
      let bVal: any = b[this.sortColumn as keyof Ingredient];

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return this.sortDirection === 'asc' ? comparison : -comparison;
    });

    this.filteredRows = filtered;
  }

  onSortChange(column: string) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.applyFilters();
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
