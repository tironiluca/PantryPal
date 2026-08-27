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
import { Unit, UnitConverterService } from '../../core/services/unit-converter.service';
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
  private unitConverter = inject(UnitConverterService);

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
      const inventory = this.db.queryByUser<any>('inventory');
      const ingredients = new Map(
        this.db.queryByUser<{ id: string; name: string }>('ingredients').map(ingredient => [ingredient.id, ingredient.name])
      );
      const out: CartItem[] = [];

      const byIngredient = new Map<string, any[]>();
      for (const row of inventory) {
        const rows = byIngredient.get(row.ingredientId) ?? [];
        rows.push(row);
        byIngredient.set(row.ingredientId, rows);
      }

      for (const [ingredientId, rows] of byIngredient) {
        const unitGroups = new Map<string, any[]>();
        for (const row of rows) {
          const unit = row.unit as Unit;
          const groupKey = this.unitConverter.getUnitType(unit) ?? unit;
          const group = unitGroups.get(groupKey) ?? [];
          group.push(row);
          unitGroups.set(groupKey, group);
        }

        for (const group of unitGroups.values()) {
          const targetUnit = (group[0].unit || 'pcs') as Unit;
          const needed = group.reduce((maximum, row) => {
            const restock = this.unitConverter.convert(row.minRestock ?? 0, row.unit as Unit, targetUnit);
            return restock === null ? maximum : Math.max(maximum, restock);
          }, 0);
          const available = this.unitConverter.sumQuantities(
            group.map(row => ({ quantity: row.quantity ?? 0, unit: row.unit as Unit })),
            targetUnit
          );

          const shortage = available === null
            ? null
            : this.unitConverter.calculateShortage(available, targetUnit, needed, targetUnit);

          if (shortage && shortage.shortage > 0) {
            out.push({
              ingredientId,
              ingredientName: ingredients.get(ingredientId) ?? ingredientId,
              suggestedQty: shortage.shortage,
              unit: shortage.unit,
              reason: 'min-restock',
            });
          }
        }

        for (const row of rows) {
          if (row.expiry && new Date(row.expiry).getTime() <= Date.now()) {
            out.push({
              ingredientId,
              ingredientName: ingredients.get(ingredientId) ?? ingredientId,
              suggestedQty: 1,
              unit: row.unit || 'pcs',
              reason: 'expired-replacement',
            });
          }
        }
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
