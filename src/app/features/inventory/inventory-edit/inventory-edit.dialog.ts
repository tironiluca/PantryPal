import { Component, Inject, inject, DestroyRef, OnInit } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';

import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { DbService } from '../../../core/services/db.service';
import { DataEventsService } from '../../../core/services/data-events.service';
import { OcrService } from '../../../core/services/ocr.service';
import { ProductsService } from '../../../core/services/products.service';
import { NutritionService } from '../../../core/services/nutrition.service';
import { ErrorHandlerService } from '../../../core/services/error-handler.service';
import { SnackbarService } from '../../../core/services/snackbar.service';
import { InventoryItem } from '../../../core/models/inventory.model';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { BarcodeScannerDialog } from '../barcode-scanner.dialog';

@Component({
  standalone: true,
  selector: 'pp-inventory-edit-dialog',
  imports: [
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    TranslocoModule,
  ],
  templateUrl: './inventory-edit.dialog.html',
  styleUrls: ['./inventory-edit.dialog.scss'],
})
export class InventoryEditDialog implements OnInit {
  private ocr = inject(OcrService);
  private dialog = inject(MatDialog);
  private products = inject(ProductsService);
  private db = inject(DbService);
  private dataEvents = inject(DataEventsService);
  private errorHandler = inject(ErrorHandlerService);
  private snackbar = inject(SnackbarService);
  private transloco = inject(TranslocoService);
  private nutritionService = inject(NutritionService);
  private destroyRef = inject(DestroyRef);

  model: any = {
    id: '',
    ingredientId: '',
    quantity: 1,
    unit: 'pcs',
    minRestock: 1,
    expiry: '',
  };

  // Autocomplete state for ingredient picker
  allIngredients: { id: string; name: string }[] = [];
  filteredIngredients: { id: string; name: string }[] = [];
  ingredientSearch = '';

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: InventoryItem | null,
    private ref: MatDialogRef<InventoryEditDialog>
  ) {
    if (data) this.model = { ...data };
  }

  ngOnInit(): void {
    // Load ingredient list for autocomplete
    try {
      this.allIngredients = this.db.getAvailableIngredients()
        .map(({ id, name }) => ({ id, name }));
    } catch {
      this.allIngredients = [];
    }

    // Pre-populate display value from current ingredientId
    if (this.model.ingredientId) {
      const found = this.allIngredients.find(i => i.id === this.model.ingredientId);
      this.ingredientSearch = found?.name ?? this.model.ingredientId;
    }
    this.filteredIngredients = this.allIngredients.slice(0, 8);

    // Auto-fetch product info when dialog is opened with a pre-scanned barcode
    if (this.model.barcode && !this.model.id) {
      this.snackbar.info(this.transloco.translate('inventory.fetchingProduct'));
      this.doFetchProduct();
    }
  }

  filterIngredients(search: string) {
    const term = search.toLowerCase();
    this.filteredIngredients = this.allIngredients
      .filter(i => i.name.toLowerCase().includes(term))
      .slice(0, 8);
    // Treat free-form text as ingredientId fallback
    const exact = this.allIngredients.find(i => i.name.toLowerCase() === term);
    this.model.ingredientId = exact ? exact.id : search;
  }

  onIngredientSelected(event: MatAutocompleteSelectedEvent) {
    const ing = event.option.value as { id: string; name: string };
    this.model.ingredientId = ing.id;
    this.ingredientSearch = ing.name;
  }

  displayIngredient = (ing: { id: string; name: string } | string): string => {
    if (!ing) return '';
    if (typeof ing === 'string') return ing;
    return ing.name;
  };

  save() {
    try {
      if (!this.model.ingredientId || !this.model.ingredientId.trim()) {
        this.snackbar.error(this.transloco.translate('inventory.enterIngredientName'));
        return;
      }

      if (this.model.quantity <= 0) {
        this.snackbar.error(this.transloco.translate('inventory.quantityMustBePositive'));
        return;
      }

      if (this.model.minRestock < 0) {
        this.snackbar.error(this.transloco.translate('inventory.minRestockNegative'));
        return;
      }

      if (this.model.barcode) {
        const existing = this.db.queryByUser<any>(
          'inventory',
          'barcode = ? AND id != ?',
          [this.model.barcode, this.model.id || '']
        );
        if (existing.length > 0) {
          this.snackbar.error(this.transloco.translate('inventory.barcodeAlreadyInUse'));
          return;
        }
      }

      const now = new Date().toISOString();

      if (!this.model.id) {
        this.model.id = `inv-${crypto.randomUUID()}`;
        this.db.exec(
          'INSERT INTO inventory (id, ingredientId, quantity, unit, minRestock, expiry, location, barcode, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)',
          [
            this.model.id,
            this.model.ingredientId,
            +this.model.quantity,
            this.model.unit,
            +this.model.minRestock,
            this.model.expiry || null,
            this.model.location || null,
            this.model.barcode || null,
            now,
            now,
          ]
        );
        this.snackbar.success(this.transloco.translate('inventory.itemAdded'));
        this.dataEvents.emit('inventory', 'create', this.model.id);
      } else {
        this.db.exec(
          'UPDATE inventory SET ingredientId=?, quantity=?, unit=?, minRestock=?, expiry=?, location=?, barcode=?, updatedAt=? WHERE id=?',
          [
            this.model.ingredientId,
            +this.model.quantity,
            this.model.unit,
            +this.model.minRestock,
            this.model.expiry || null,
            this.model.location || null,
            this.model.barcode || null,
            now,
            this.model.id,
          ]
        );
        this.snackbar.success(this.transloco.translate('inventory.itemUpdated'));
        this.dataEvents.emit('inventory', 'update', this.model.id);
      }
      this.ref.close(true);
    } catch (error) {
      if (String(error).toLowerCase().includes('unique')) {
        this.snackbar.error(this.transloco.translate('inventory.barcodeAlreadyInUse'));
        return;
      }
      this.errorHandler.handle(error, this.transloco.translate('inventory.failedSaveItem'));
    }
  }

  close() {
    this.ref.close(false);
  }

  async onFile(ev: any) {
    try {
      const f = ev.target?.files?.[0];
      if (!f) return;

      this.snackbar.info(this.transloco.translate('inventory.extractingExpiry'));
      const iso = await this.ocr.extractExpiry(f);

      if (iso) {
        this.model.expiry = iso;
        this.snackbar.success(this.transloco.translate('inventory.expiryExtracted'));
      } else {
        this.snackbar.warning(this.transloco.translate('inventory.expiryNotDetected'));
      }
    } catch (error) {
      this.errorHandler.handleWithMessage(
        error,
        this.transloco.translate('inventory.failedExtractExpiry'),
        'OCR'
      );
    }
  }

  scanBarcode() {
    const ref = this.dialog.open(BarcodeScannerDialog, {
      width: '95vw',
      maxWidth: '450px',
    });

    ref.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(code => {
      if (code) {
        this.model.barcode = code;
        this.snackbar.info(this.transloco.translate('inventory.fetchingProduct'));
        this.doFetchProduct();
      }
    });
  }

  async fetchProduct() {
    if (!this.model.barcode) {
      this.snackbar.warning(this.transloco.translate('inventory.enterOrScanBarcode'));
      return;
    }
    this.snackbar.info(this.transloco.translate('inventory.fetchingProduct'));
    this.doFetchProduct();
  }

  private doFetchProduct() {
    this.products
      .byBarcode(this.model.barcode)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          this.errorHandler.handleWithMessage(
            error,
            this.transloco.translate('inventory.failedFetchProduct'),
            'Product fetch'
          );
          return of(null);
        })
      )
      .subscribe((res: any) => {
        if (!res || res.status !== 1) {
          this.snackbar.info(this.transloco.translate('inventory.productNotFound'));
          return;
        }

        const product = res.product;
        const name = product?.product_name || product?.generic_name;

        // Only fill ingredientId if currently empty
        if (name && !this.model.ingredientId) {
          // Try to match existing ingredient by name
          const term = name.toLowerCase();
          const match = this.allIngredients.find(i => i.name.toLowerCase() === term);
          if (match) {
            this.model.ingredientId = match.id;
            this.ingredientSearch = match.name;
          } else {
            const slug = name.toLowerCase().replace(/\s+/g, '-').slice(0, 30);
            this.model.ingredientId = slug;
            this.ingredientSearch = name;
          }
          this.snackbar.success(this.transloco.translate('inventory.productLoaded'));
        } else if (name) {
          this.snackbar.info(this.transloco.translate('inventory.productFoundIngredientSet'));
        } else {
          this.snackbar.warning(this.transloco.translate('inventory.productFoundNoName'));
        }

        // Autofill nutrition data if available from Open Food Facts
        if (this.model.ingredientId && product?.nutriments) {
          const n = product.nutriments;
          const kcal = n['energy-kcal_100g'] || n['energy-kcal'] || 0;
          if (kcal > 0) {
            try {
              this.nutritionService.updateIngredientNutrition(this.model.ingredientId, {
                energyKcal: kcal,
                proteinG: n.proteins_100g || n.proteins || 0,
                carbsG: n.carbohydrates_100g || n.carbohydrates || 0,
                fatG: n.fat_100g || n.fat || 0,
                fiberG: n.fiber_100g || n.fiber,
                sugarG: n.sugars_100g || n.sugars,
                sodiumMg: (n.sodium_100g || n.sodium || 0) * 1000,
              });
            } catch {
              // Ingredient may not exist in DB yet; nutrition will be set when ingredient is created
            }
          }
        }
      });
  }
}
