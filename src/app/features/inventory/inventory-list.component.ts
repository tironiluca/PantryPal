import { Component, inject, signal, DestroyRef, ViewChild, ElementRef } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import { MatChipsModule } from "@angular/material/chips";
import { MatTooltipModule } from "@angular/material/tooltip";
import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import { DbService } from "../../core/services/db.service";
import { InventoryItem } from "../../core/models/inventory.model";
import { InventoryEditDialog } from "./inventory-edit/inventory-edit.dialog";
import { BarcodeScannerDialog } from "./barcode-scanner.dialog";
import { OcrService } from "../../core/services/ocr.service";
import { ErrorHandlerService } from "../../core/services/error-handler.service";
import { SnackbarService } from "../../core/services/snackbar.service";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { DataEventsService } from "../../core/services/data-events.service";
import { TranslocoModule } from "@jsverse/transloco";
import { ConfirmDialog } from "../../shared/dialogs/confirm/confirm.dialog";
import { KeyboardService } from "../../core/services/keyboard.service";
import { SkeletonComponent } from "../../shared/components/skeleton/skeleton.component";
import { UseItUpBannerComponent } from "../../shared/components/use-it-up-banner/use-it-up-banner.component";

@Component({
  selector: 'pp-inventory-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatTooltipModule,
    TranslocoModule,
    SkeletonComponent,
    UseItUpBannerComponent,
  ],
  templateUrl: './inventory-list.component.html',
  styleUrls: ['./inventory-list.component.scss']
})
export class InventoryListComponent {
  private db = inject(DbService);
  private dialog = inject(MatDialog);
  private ocr = inject(OcrService);
  private errorHandler = inject(ErrorHandlerService);
  private snackbar = inject(SnackbarService);
  private destroyRef = inject(DestroyRef);
  private dataEvents = inject(DataEventsService);
  private keyboard = inject(KeyboardService);

  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

  rows: InventoryItem[] = [];
  filteredRows: InventoryItem[] = [];
  loading = signal(false);
  ingredientNames = new Map<string, string>();

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

    this.keyboard.addNew$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.add());

    this.keyboard.focusSearch$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.searchInput?.nativeElement.focus());

    this.keyboard.escape$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.clearFilters());
  }

  refresh() {
    this.loading.set(true);
    try {
      this.rows = this.db.queryByUser<InventoryItem>('inventory');
      this.loadIngredientNames();
      this.applyFilters();
    } catch (error) {
      this.errorHandler.handle(error, 'Failed to load inventory');
      this.rows = [];
      this.filteredRows = [];
    } finally {
      this.loading.set(false);
    }
  }

  private loadIngredientNames() {
    const ids = [...new Set(this.rows.map(r => r.ingredientId))];
    if (ids.length === 0) {
      this.ingredientNames = new Map();
      return;
    }
    const placeholders = ids.map(() => '?').join(',');
    try {
      const ingredients = this.db.query<{ id: string; name: string }>(
        `SELECT id, name FROM ingredients WHERE id IN (${placeholders})`,
        ids
      );
      this.ingredientNames = new Map(ingredients.map(i => [i.id, i.name]));
    } catch {
      this.ingredientNames = new Map();
    }
  }

  getIngredientName(id: string): string {
    return this.ingredientNames.get(id) ?? id;
  }

  getExpiryStatus(expiry?: string): 'expired' | 'warning' | 'ok' | null {
    if (!expiry) return null;
    const days = Math.floor((new Date(expiry).getTime() - Date.now()) / 86400000);
    if (days < 0) return 'expired';
    if (days <= 7) return 'warning';
    return 'ok';
  }

  getLocationIcon(location?: string): string {
    const icons: Record<string, string> = {
      fridge: 'kitchen',
      freezer: 'ac_unit',
      pantry: 'shelves',
      other: 'inventory_2',
    };
    return icons[location ?? 'other'] ?? 'inventory_2';
  }

  applyFilters() {
    let filtered = [...this.rows];

    // Search by resolved name or barcode
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        this.getIngredientName(item.ingredientId).toLowerCase().includes(term) ||
        item.barcode?.toLowerCase().includes(term)
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

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

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

  scanAndAdd() {
    this.dialog
      .open(BarcodeScannerDialog, { width: '95vw', maxWidth: '450px' })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(code => {
        if (!code) return;
        this.dialog
          .open(InventoryEditDialog, { data: { barcode: code } as any })
          .afterClosed()
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe(ok => ok && this.refresh());
      });
  }

  async onOcrFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.snackbar.info('Extracting expiry date…');
    try {
      const iso = await this.ocr.extractExpiry(file);
      if (!iso) this.snackbar.warning('No date found — enter it manually');
      this.dialog
        .open(InventoryEditDialog, { data: { expiry: iso ?? '' } as any })
        .afterClosed()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(ok => ok && this.refresh());
    } catch (err) {
      this.errorHandler.handle(err, 'OCR failed');
    }
  }

  edit(row: InventoryItem) {
    this.dialog
      .open(InventoryEditDialog, { data: row })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => ok && this.refresh());
  }

  remove(row: InventoryItem) {
    this.dialog
      .open(ConfirmDialog, {
        data: { title: 'Delete Item', message: 'Are you sure you want to delete this inventory item?', confirmColor: 'warn', icon: 'delete' },
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(ok => {
        if (!ok) return;
        try {
          this.db.exec("DELETE FROM inventory WHERE id = ?", [row.id]);
          this.dataEvents.emit('inventory', 'delete', row.id);
          this.snackbar.success('Inventory item deleted successfully');
          this.refresh();
        } catch (error) {
          this.errorHandler.handle(error, 'Failed to delete inventory item');
        }
      });
  }
}
