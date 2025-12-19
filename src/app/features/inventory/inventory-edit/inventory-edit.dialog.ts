import { Component, Inject, inject } from "@angular/core";
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
import { MatIconModule } from "@angular/material/icon";
import { InventoryItem } from "../../../core/models/inventory.model";

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
          null,
          null,
          now,
          now,
        ]
      );
    } else {
      this.db.exec(
        "UPDATE inventory SET ingredientId=?, quantity=?, unit=?, minRestock=?, expiry=?, location=?, barcode=?, updatedAt=? WHERE id=?",
        [
          this.model.ingredientId,
          +this.model.quantity,
          this.model.unit,
          +this.model.minRestock,
          this.model.expiry || null,
          null,
          null,
          now,
          this.model.id,
        ]
      );
    }
    this.ref.close(true);
  }

  close() {
    this.ref.close(false);
  }

  async onFile(ev: any) {
    const f = ev.target?.files?.[0];
    if (!f) return;
    const iso = await this.ocr.extractExpiry(f);
    if (iso) this.model.expiry = iso;
  }

  async scanBarcode() {
    try {
      const v = document.createElement("video");
      const code = await this.barcode.scan(v);
      if (code) this.model.barcode = code;
    } catch (e) {
      console.warn(e);
    }
  }

  async fetchProduct() {
    if (!this.model.barcode) return;
    this.products.byBarcode(this.model.barcode).subscribe((res: any) => {
      const name = res?.product?.product_name || res?.product?.generic_name;
      if (name && !this.model.ingredientId)
        this.model.ingredientId = name
          .toLowerCase()
          .replace(/\s+/g, "-")
          .slice(0, 30);
    });
  }
}
