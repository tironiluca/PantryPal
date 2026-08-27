import { Component, inject, signal, DestroyRef, ViewChild, ElementRef } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { DbService } from '../../core/services/db.service';
import { Ingredient } from '../../core/models/ingredient.model';
import { IngredientEditDialog } from './ingredient-edit/ingredient-edit.dialog';
import { BarcodeScannerDialog } from '../inventory/barcode-scanner.dialog';
import { ProductsService } from '../../core/services/products.service';
import { ErrorHandlerService } from '../../core/services/error-handler.service';
import { SnackbarService } from '../../core/services/snackbar.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { DataEventsService } from '../../core/services/data-events.service';
import { TranslocoModule } from '@jsverse/transloco';
import { ConfirmDialog } from '../../shared/dialogs/confirm/confirm.dialog';
import { KeyboardService } from '../../core/services/keyboard.service';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';

@Component({
  standalone: true,
  selector: 'pp-ingredient-list',
  imports: [
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatChipsModule,
    MatTooltipModule,
    TranslocoModule,
    SkeletonComponent,
  ],
  templateUrl: './ingredient-list.component.html',
  styleUrls: ['./ingredient-list.component.scss'],
})
export class IngredientListComponent {
  private db = inject(DbService);
  private dialog = inject(MatDialog);
  private products = inject(ProductsService);
  private errorHandler = inject(ErrorHandlerService);
  private snackbar = inject(SnackbarService);
  private destroyRef = inject(DestroyRef);
  private dataEvents = inject(DataEventsService);
  private keyboard = inject(KeyboardService);

  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

  rows: Ingredient[] = [];
  filteredRows: Ingredient[] = [];
  loading = signal(false);
  categoryNames = new Map<string, string>();

  searchTerm = '';
  sortColumn = 'name';
  sortDirection: 'asc' | 'desc' = 'asc';

  constructor() {
    this.refresh();
    this.dataEvents
      .on('ingredients')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.refresh());

    this.keyboard.addNew$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.add());

    this.keyboard.focusSearch$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.searchInput?.nativeElement.focus());

    this.keyboard.escape$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.searchTerm = '';
      this.applyFilters();
    });
  }

  refresh() {
    this.loading.set(true);
    try {
      this.rows = this.db.queryByUser<Ingredient>('ingredients');
      this.loadCategoryNames();
      this.applyFilters();
    } catch (error) {
      this.errorHandler.handle(error, 'Failed to load ingredients');
      this.rows = [];
      this.filteredRows = [];
    } finally {
      this.loading.set(false);
    }
  }

  private loadCategoryNames() {
    try {
      const categories = this.db.query<{ id: string; name: string }>(
        `SELECT id, name FROM ingredient_categories`
      );
      this.categoryNames = new Map(categories.map(c => [c.id, c.name]));
    } catch {
      this.categoryNames = new Map();
    }
  }

  getCategoryName(id?: string): string {
    if (!id) return '';
    return this.categoryNames.get(id) ?? id;
  }

  applyFilters() {
    let filtered = [...this.rows];

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(
        item =>
          item.name.toLowerCase().includes(term) ||
          this.getCategoryName(item.categoryId).toLowerCase().includes(term)
      );
    }

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

  add() {
    this.dialog
      .open(IngredientEditDialog, { data: null })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(ok => ok && this.refresh());
  }

  scanAndAdd() {
    this.dialog
      .open(BarcodeScannerDialog, { width: '95vw', maxWidth: '450px' })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(code => {
        if (!code) return;
        this.snackbar.info('Looking up product…');
        this.products
          .byBarcode(code)
          .pipe(
            takeUntilDestroyed(this.destroyRef),
            catchError(error => {
              this.errorHandler.handleWithMessage(error, 'Could not look up product', 'Product lookup');
              return of(null);
            })
          )
          .subscribe((res: any) => {
            const name: string =
              res?.status === 1
                ? res?.product?.product_name || res?.product?.generic_name || ''
                : '';
            this.dialog
              .open(IngredientEditDialog, { data: name ? ({ name } as any) : null })
              .afterClosed()
              .pipe(takeUntilDestroyed(this.destroyRef))
              .subscribe(ok => ok && this.refresh());
          });
      });
  }

  edit(row: Ingredient) {
    this.dialog
      .open(IngredientEditDialog, { data: row })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(ok => ok && this.refresh());
  }

  remove(row: any) {
    this.dialog
      .open(ConfirmDialog, {
        data: {
          title: 'Delete Ingredient',
          message: `Delete "${row.name}"?`,
          confirmColor: 'warn',
          icon: 'delete',
        },
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(ok => {
        if (!ok) return;
        try {
          this.db.exec('DELETE FROM ingredients WHERE id = ?', [row.id]);
          this.dataEvents.emit('ingredients', 'delete', row.id);
          this.snackbar.success('Ingredient deleted successfully');
          this.refresh();
        } catch (error) {
          this.errorHandler.handle(error, 'Failed to delete ingredient');
        }
      });
  }
}
