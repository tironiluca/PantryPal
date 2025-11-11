import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

interface OFFResponse { status: number; product?: any; }

@Injectable({ providedIn: 'root' })
export class ProductsService {
  constructor(private http: HttpClient) {}
  byBarcode(barcode: string) {
    return this.http.get<OFFResponse>(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
  }
}
