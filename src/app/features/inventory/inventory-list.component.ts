import { Component, inject, DestroyRef } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MatTableModule } from "@angular/material/table";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import { DbService } from "../../core/services/db.service";
import { InventoryItem } from "../../core/models/inventory.model";
import { InventoryEditDialog } from "./inventory-edit/inventory-edit.dialog";
import { ErrorHandlerService } from "../../core/services/error-handler.service";
import { SnackbarService } from "../../core/services/snackbar.service";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { DataEventsService } from "../../core/services/data-events.service";
import { TranslocoModule } from "@jsverse/transloco";

@Component({
  selector:'pp-inventory-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    TranslocoModule,
  ],
  templateUrl: './inventory-list.component.html',
  styleUrls: ['./inventory-list.component.scss']
})
export class InventoryListComponent {
  private db = inject(DbService);
  private dialog = inject(MatDialog);
  private errorHandler = inject(ErrorHandlerService);
  private snackbar = inject(SnackbarService);
  private destroyRef = inject(DestroyRef);
  private dataEvents = inject(DataEventsService);

  rows: InventoryItem[] = [];
  filteredRows: InventoryItem[] = [];

  cols = ["ingredientId", "quantity", "expiry", "location", "actions"];

  // Filter/sort state
  searchTerm = '';
  sortColumn = 'expiry';
  sortDirection: 'asc' | 'desc' = 'asc';
  locationFilter: string | null = null;
  expiringFilter: 'all' | 'week' | 'month' | 'expired' = 'all';

  constructor() {
    this.refresh();
    this.dataEvents.on('inventory', 'ingredients')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.refresh());
  }

  refresh() {
    try {
      this.rows = this.db.queryByUser<InventoryItem>('inventory');
      this.applyFilters();
    } catch (error) {
      this.errorHandler.handle(error, 'Failed to load inventory');
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
        item.ingredientId.toLowerCase().includes(term) ||
        item.barcode?.includes(term)
      );
    }

    // Location filter
    if (this.locationFilter) {
      filtered = filtered.filter(item => item.location === this.locationFilter);
    }

    // Expiry filter
    if (this.expiringFilter !== 'all') {
      const now = new Date();
      filtered = filtered.filter(item => {
        if (!item.expiry) return false;
        const expiry = new Date(item.expiry);
        const daysUntil = Math.floor((expiry.getTime() - now.getTime()) / 86400000);

        switch (this.expiringFilter) {
          case 'expired': return daysUntil < 0;
          case 'week': return daysUntil >= 0 && daysUntil <= 7;
          case 'month': return daysUntil >= 0 && daysUntil <= 30;
          default: return true;
        }
      });
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal: any = a[this.sortColumn as keyof InventoryItem];
      let bVal: any = b[this.sortColumn as keyof InventoryItem];

      // Handle null/undefined
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      // Date comparison
      if (this.sortColumn === 'expiry') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }

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

  clearFilters() {
    this.searchTerm = '';
    this.locationFilter = null;
    this.expiringFilter = 'all';
    this.applyFilters();
  }

  isExpired(expiry?: string): boolean {
    if (!expiry) return false;
    return new Date(expiry) < new Date();
  }

  get expiringCount(): number {
    return this.rows.filter(item => {
      if (!item.expiry) return false;
      const expiry = new Date(item.expiry);
      const weekFromNow = new Date();
      weekFromNow.setDate(weekFromNow.getDate() + 7);
      return expiry > new Date() && expiry <= weekFromNow;
    }).length;
  }

  get activeFilterCount(): number {
    let count = 0;
    if (this.locationFilter) count++;
    if (this.expiringFilter !== 'all') count++;
    return count;
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
        this.dataEvents.emit('inventory', 'delete', row.id);
        this.snackbar.success('Inventory item deleted successfully');
        this.refresh();
      }
    } catch (error) {
      this.errorHandler.handle(error, 'Failed to delete inventory item');
    }
  }
}
