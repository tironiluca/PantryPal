import { Component, OnInit, inject, signal, computed, DestroyRef } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { TranslocoModule } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DbService } from '../../core/services/db.service';
import { DataEventsService } from '../../core/services/data-events.service';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';

interface CartItem {
  ingredientName: string;
  ingredientId: string;
  suggestedQty: number;
  unit: string;
  reason: 'min-restock' | 'expired-replacement';
}

@Component({
  standalone: true,
  selector: 'pp-cart-view',
  imports: [
    DecimalPipe,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule,
    MatDividerModule,
    TranslocoModule,
    SkeletonComponent,
  ],
  templateUrl: './cart-view.component.html',
  styleUrls: ['./cart-view.component.scss'],
})
export class CartViewComponent implements OnInit {
  private db = inject(DbService);
  private dataEvents = inject(DataEventsService);
  private destroyRef = inject(DestroyRef);

  items = signal<CartItem[]>([]);
  loading = signal(false);
  checkedIds = signal(new Set<string>());

  uncheckedMinRestock = computed(() =>
    this.items().filter(i => i.reason === 'min-restock' && !this.checkedIds().has(i.ingredientId))
  );
  uncheckedExpired = computed(() =>
    this.items().filter(i => i.reason === 'expired-replacement' && !this.checkedIds().has(i.ingredientId))
  );
  checkedItems = computed(() =>
    this.items().filter(i => this.checkedIds().has(i.ingredientId))
  );
  uncheckedCount = computed(() =>
    this.items().filter(i => !this.checkedIds().has(i.ingredientId)).length
  );

  ngOnInit(): void {
    this.loadItems();
    this.dataEvents.on('inventory', 'ingredients')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadItems());
  }

  toggleChecked(ingredientId: string) {
    const next = new Set(this.checkedIds());
    if (next.has(ingredientId)) next.delete(ingredientId);
    else next.add(ingredientId);
    this.checkedIds.set(next);
  }

  clearChecked() {
    this.checkedIds.set(new Set());
  }

  loadItems(): void {
    this.loading.set(true);
    try {
      const low = this.db.query<any>(`
        SELECT ing.id AS ingredientId,
               ing.name AS ingredientName,
               SUM(inv.quantity) AS qty,
               MIN(inv.minRestock) AS minRestock,
               inv.unit
        FROM ingredients ing
        LEFT JOIN inventory inv ON inv.ingredientId = ing.id
          AND (inv.isDeleted IS NULL OR inv.isDeleted = 0)
        WHERE inv.minRestock IS NOT NULL AND inv.minRestock > 0
        GROUP BY ing.id, inv.unit
        HAVING (SUM(inv.quantity) IS NULL OR SUM(inv.quantity) < MIN(inv.minRestock))
      `);

      const expired = this.db.query<any>(`
        SELECT inv.ingredientId,
               ing.name AS ingredientName,
               inv.unit
        FROM inventory inv
        JOIN ingredients ing ON ing.id = inv.ingredientId
        WHERE inv.expiry IS NOT NULL
          AND DATE(inv.expiry) <= DATE('now')
          AND (inv.isDeleted IS NULL OR inv.isDeleted = 0)
      `);

      const out: CartItem[] = [];

      for (const l of low) {
        out.push({
          ingredientId: l.ingredientId,
          ingredientName: l.ingredientName ?? l.ingredientId,
          suggestedQty: Math.max(0, (l.minRestock ?? 0) - (l.qty ?? 0)),
          unit: l.unit || 'pcs',
          reason: 'min-restock',
        });
      }

      for (const e of expired) {
        out.push({
          ingredientId: e.ingredientId,
          ingredientName: e.ingredientName ?? e.ingredientId,
          suggestedQty: 1,
          unit: e.unit || 'pcs',
          reason: 'expired-replacement',
        });
      }

      this.items.set(out);
      // Remove stale checked items that are no longer in the list
      const ids = new Set(out.map(i => i.ingredientId));
      const cleaned = new Set([...this.checkedIds()].filter(id => ids.has(id)));
      this.checkedIds.set(cleaned);
    } finally {
      this.loading.set(false);
    }
  }
}
