import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatListModule } from '@angular/material/list';
import { DbService } from '../../core/services/db.service';

@Component({
  standalone: true,
  selector: 'pp-cart-view',
  imports: [CommonModule, MatListModule],
  template: `
  <div class="container">
    <h2>Shopping Cart (suggested)</h2>
    <mat-nav-list>
      <a mat-list-item *ngFor="let it of items">
        <span matListItemTitle>{{it.ingredientId}}</span>
        <span matListItemLine>{{it.suggestedQty}} {{it.unit}} — {{it.reason}}</span>
      </a>
    </mat-nav-list>
    <p *ngIf="items.length===0">Nothing to buy 🎉</p>
  </div>
  `,
  styles: [`.container{padding:1rem}`]
})
export class CartViewComponent {
  private db = inject(DbService);
  items: any[] = [];
  constructor(){
    const low = this.db.query<any>(`SELECT ing.id as ingredientId, SUM(inv.quantity) as qty, MIN(inv.minRestock) as min, inv.unit
      FROM ingredients ing LEFT JOIN inventory inv ON inv.ingredientId = ing.id GROUP BY ing.id, inv.unit`);
    const expired = this.db.query<any>(`SELECT ingredientId, unit FROM inventory WHERE expiry IS NOT NULL AND DATE(expiry) <= DATE('now')`);
    const out: any[] = [];
    for (const l of low) {
      if ((l.qty ?? 0) < (l.min ?? 0)) out.push({ ingredientId: l.ingredientId, suggestedQty: (l.min ?? 0) - (l.qty ?? 0), unit: l.unit || 'pcs', reason: 'min-restock' });
    }
    for (const e of expired) out.push({ ingredientId: e.ingredientId, suggestedQty: 1, unit: e.unit || 'pcs', reason: 'expired-replacement' });
    this.items = out;
  }
}
