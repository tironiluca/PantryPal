import { Component, OnInit, inject, signal, computed, DestroyRef } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
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
    TranslocoModule,
    SkeletonComponent,
  ],
  template: `
    <div class="container" *transloco="let t">
      <div class="header">
        <h2>{{ t('cart.title') }}</h2>
        <span class="stat">{{ items().length }} {{ t('inventory.items') }}</span>
      </div>

      @if (loading()) {
        <pp-skeleton [count]="4" />
      } @else if (items().length === 0) {
        <div class="empty-state">
          <mat-icon>shopping_cart</mat-icon>
          <h3>{{ t('cart.nothingToBuy') }} 🎉</h3>
        </div>
      } @else {
        @if (minRestockItems().length > 0) {
          <div class="group-header">
            <mat-icon>inventory_2</mat-icon>
            <span>{{ t('cart.lowStock') }}</span>
          </div>
          <div class="list-card-grid">
            @for (item of minRestockItems(); track item.ingredientId) {
              <div class="list-card">
                <div class="list-card__title">{{ item.ingredientName }}</div>
                <div class="list-card__meta">
                  <mat-chip-set>
                    <mat-chip>{{ item.suggestedQty | number:'1.0-2' }} {{ item.unit }}</mat-chip>
                  </mat-chip-set>
                </div>
              </div>
            }
          </div>
        }

        @if (expiredItems().length > 0) {
          <div class="group-header">
            <mat-icon>event_busy</mat-icon>
            <span>{{ t('cart.expiredReplacements') }}</span>
          </div>
          <div class="list-card-grid">
            @for (item of expiredItems(); track item.ingredientId) {
              <div class="list-card">
                <div class="list-card__title">{{ item.ingredientName }}</div>
                <div class="list-card__meta">
                  <mat-chip-set>
                    <mat-chip class="expiry-expired">{{ t('inventory.expired') }}</mat-chip>
                  </mat-chip-set>
                </div>
              </div>
            }
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 1rem;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 2px solid rgba(230, 74, 25, 0.2);

      h2 {
        margin: 0;
        font-size: 28px;
        font-weight: 700;
        background: linear-gradient(135deg, #e64a19 0%, #ff7043 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .stat {
        padding: 6px 16px;
        border-radius: 20px;
        font-size: 0.875rem;
        font-weight: 600;
        background: rgba(230, 74, 25, 0.1);
        color: #b03a14;
      }
    }

    .group-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 15px;
      font-weight: 600;
      color: var(--mat-sys-on-surface-variant);
      margin: 1.5rem 0 0.75rem;

      mat-icon { font-size: 20px; width: 20px; height: 20px; }
    }

    .empty-state {
      text-align: center;
      padding: 4rem 2rem;

      mat-icon {
        font-size: 96px;
        width: 96px;
        height: 96px;
        color: rgba(0, 0, 0, 0.2);
        margin-bottom: 1rem;
      }

      h3 {
        margin: 0;
        font-size: 1.5rem;
        font-weight: 600;
        color: var(--mat-sys-on-surface);
      }
    }

    .expiry-expired {
      --mdc-chip-elevated-container-color: rgba(198, 40, 40, 0.15);
      color: var(--color-error);
    }

    :host-context(.dark-theme) .header {
      border-bottom: 2px solid rgba(255, 112, 67, 0.3);
      .stat { background: rgba(255, 112, 67, 0.15); color: #ff8a65; }
    }

    :host-context(.dark-theme) .empty-state mat-icon {
      color: rgba(255, 255, 255, 0.2);
    }
  `],
})
export class CartViewComponent implements OnInit {
  private db = inject(DbService);
  private dataEvents = inject(DataEventsService);
  private destroyRef = inject(DestroyRef);

  items = signal<CartItem[]>([]);
  loading = signal(false);

  minRestockItems = computed(() => this.items().filter(i => i.reason === 'min-restock'));
  expiredItems    = computed(() => this.items().filter(i => i.reason === 'expired-replacement'));

  ngOnInit(): void {
    this.loadItems();
    this.dataEvents.on('inventory', 'ingredients')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadItems());
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
    } finally {
      this.loading.set(false);
    }
  }
}
