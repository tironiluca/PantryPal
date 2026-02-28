import { Component, Inject, inject, DestroyRef } from "@angular/core";
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from "@angular/material/dialog";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatDividerModule } from "@angular/material/divider";
import { TranslocoModule, TranslocoService } from "@jsverse/transloco";
import { DbService } from "../../../core/services/db.service";
import { DataEventsService } from "../../../core/services/data-events.service";
import { OcrService } from "../../../core/services/ocr.service";
import { ProductsService } from "../../../core/services/products.service";
import { NutritionService } from "../../../core/services/nutrition.service";
import { ErrorHandlerService } from "../../../core/services/error-handler.service";
import { SnackbarService } from "../../../core/services/snackbar.service";
import { InventoryItem } from "../../../core/models/inventory.model";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { catchError, of } from "rxjs";
import { BarcodeScannerDialog } from "../barcode-scanner.dialog";

@Component({
  standalone: true,
  selector: "pp-inventory-edit-dialog",
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    TranslocoModule,
  ],
  templateUrl: './inventory-edit.dialog.html',
  styles: [`
    mat-dialog-content {
      width: 90vw;
      max-width: 500px;
      padding: var(--spacing-md);
      padding-top: calc(var(--spacing-md) + 8px);
      overflow-x: hidden;
      box-sizing: border-box;
    }

    .inventory-form {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-sm);
    }

    .section-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--mat-sys-on-surface-variant);
      margin: var(--spacing-xs) 0 0;

      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        opacity: 0.7;
      }
    }

    mat-divider {
      margin: var(--spacing-xs) 0;
    }

    mat-form-field {
      width: 100%;
    }

    .two-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--spacing-md);
    }

    .action-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: var(--spacing-sm);
      margin-top: var(--spacing-xs);

      button {
        flex: 1 1 auto;
        min-width: 120px;

        mat-icon {
          margin-right: var(--spacing-xs);
        }
      }
    }

    mat-dialog-actions {
      padding: var(--spacing-sm) var(--spacing-md);
      border-top: 1px solid var(--divider-color);

      button {
        margin-left: var(--spacing-sm);

        mat-icon {
          margin-right: var(--spacing-xs);
        }
      }
    }

    @media (max-width: 480px) {
      mat-dialog-content {
        width: 95vw;
        max-width: 95vw;
      }

      .two-col {
        grid-template-columns: 1fr;
      }

      .action-buttons button {
        flex: 1 1 100%;
      }
    }
  `]
})
export class InventoryEditDialog {

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
    id: "",
    ingredientId: "",
    quantity: 1,
    unit: "pcs",
    minRestock: 1,
    expiry: "",
  };

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: InventoryItem | null,
    private ref: MatDialogRef<InventoryEditDialog>
  ) {
    if (data)
      this.model = { ...data };
  }

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
        const existing = this.db.query<any>(
          'SELECT id FROM inventory WHERE barcode = ? AND id != ?',
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
          "INSERT INTO inventory (id, ingredientId, quantity, unit, minRestock, expiry, location, barcode, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)",
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
          "UPDATE inventory SET ingredientId=?, quantity=?, unit=?, minRestock=?, expiry=?, location=?, barcode=?, updatedAt=? WHERE id=?",
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

    ref.afterClosed().subscribe(code => {
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
    this.products.byBarcode(this.model.barcode)
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
          this.model.ingredientId = name
            .toLowerCase()
            .replace(/\s+/g, "-")
            .slice(0, 30);
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
