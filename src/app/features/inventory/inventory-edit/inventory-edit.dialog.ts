import { Component, Inject, inject, DestroyRef } from "@angular/core";
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from "@angular/material/dialog";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatButtonModule } from "@angular/material/button";
import { DbService } from "../../../core/services/db.service";
import { OcrService } from "../../../core/services/ocr.service";
import { BarcodeService } from "../../../core/services/barcode.service";
import { ProductsService } from "../../../core/services/products.service";
import { ErrorHandlerService } from "../../../core/services/error-handler.service";
import { SnackbarService } from "../../../core/services/snackbar.service";
import { MatIconModule } from "@angular/material/icon";
import { InventoryItem } from "../../../core/models/inventory.model";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { catchError, of } from "rxjs";

@Component({
  standalone: true,
  selector: "pp-inventory-edit-dialog",
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './inventory-edit.dialog.html'
})
export class InventoryEditDialog {

  private ocr = inject(OcrService);
  private barcode = inject(BarcodeService);
  private products = inject(ProductsService);
  private db = inject(DbService);
  private errorHandler = inject(ErrorHandlerService);
  private snackbar = inject(SnackbarService);
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
      // Validation
      if (!this.model.ingredientId || !this.model.ingredientId.trim()) {
        this.snackbar.error('Please enter an ingredient name');
        return;
      }

      if (this.model.quantity <= 0) {
        this.snackbar.error('Quantity must be greater than 0');
        return;
      }

      if (this.model.minRestock < 0) {
        this.snackbar.error('Minimum restock cannot be negative');
        return;
      }

      // Check for duplicate barcode
      if (this.model.barcode) {
        const existing = this.db.query<any>(
          'SELECT id FROM inventory WHERE barcode = ? AND id != ?',
          [this.model.barcode, this.model.id || '']
        );
        if (existing.length > 0) {
          this.snackbar.error('This barcode is already in use');
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
        this.snackbar.success('Item added successfully');
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
        this.snackbar.success('Item updated successfully');
      }
      this.ref.close(true);
    } catch (error) {
      this.errorHandler.handle(error, 'Failed to save inventory item');
    }
  }

  close() {
    this.ref.close(false);
  }

  async onFile(ev: any) {
    try {
      const f = ev.target?.files?.[0];
      if (!f) return;

      this.snackbar.info('Extracting expiry date from image...');
      const iso = await this.ocr.extractExpiry(f);

      if (iso) {
        this.model.expiry = iso;
        this.snackbar.success('Expiry date extracted successfully');
      } else {
        this.snackbar.warning('Could not detect expiry date in image');
      }
    } catch (error) {
      this.errorHandler.handleWithMessage(
        error,
        'Failed to extract expiry date from image',
        'OCR'
      );
    }
  }

  async scanBarcode() {
    try {
      const v = document.createElement("video");
      this.snackbar.info('Starting barcode scanner...');
      const code = await this.barcode.scan(v);

      if (code) {
        this.model.barcode = code;
        this.snackbar.success(`Barcode scanned: ${code}`);
      } else {
        this.snackbar.info('No barcode detected. Please try again.');
      }
    } catch (error) {
      this.errorHandler.handle(error, 'Barcode scan');
    }
  }

  async fetchProduct() {
    if (!this.model.barcode) {
      this.snackbar.warning('Please enter or scan a barcode first');
      return;
    }

    this.snackbar.info('Fetching product information...');
    this.products.byBarcode(this.model.barcode)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          this.errorHandler.handleWithMessage(
            error,
            'Failed to fetch product information',
            'Product fetch'
          );
          return of(null);
        })
      )
      .subscribe((res: any) => {
        if (!res || res.status !== 1) {
          this.snackbar.info('Product not found in database');
          return;
        }

        const name = res?.product?.product_name || res?.product?.generic_name;
        if (name && !this.model.ingredientId) {
          this.model.ingredientId = name
            .toLowerCase()
            .replace(/\s+/g, "-")
            .slice(0, 30);
          this.snackbar.success('Product information loaded');
        } else if (name) {
          this.snackbar.info('Product found, but ingredient already set');
        } else {
          this.snackbar.warning('Product found but no name available');
        }
      });
  }
}
