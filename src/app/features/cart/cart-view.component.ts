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
  template: `
    <div class="container" *transloco="let t">
      <div class="header">
        <h2>{{ t('cart.title') }}</h2>
        <div class="header-right">
          <span class="stat">
            {{ uncheckedCount() }} / {{ items().length }} {{ t('inventory.items') }}
          </span>
          @if (checkedIds().size > 0) {
            <button mat-stroked-button class="clear-btn" (click)="clearChecked()">
              <mat-icon>delete_sweep</mat-icon>
              {{ t('cart.clearBought') }}
            </button>
          }
        </div>
      </div>

      @if (loading()) {
        <pp-skeleton [count]="4" />
      } @else if (items().length === 0) {
        <div class="empty-state">
          <mat-icon>shopping_cart</mat-icon>
          <h3>{{ t('cart.nothingToBuy') }} 🎉</h3>
          <p>{{ t('cart.allStocked') }}</p>
        </div>
      } @else {

        @if (uncheckedMinRestock().length > 0) {
          <div class="group-header">
            <mat-icon>inventory_2</mat-icon>
            <span>{{ t('cart.lowStock') }}</span>
          </div>
          <div class="list-card-grid">
            @for (item of uncheckedMinRestock(); track item.ingredientId) {
              <div class="list-card cart-card" (click)="toggleChecked(item.ingredientId)">
                <div class="cart-card__check">
                  <mat-icon>radio_button_unchecked</mat-icon>
                </div>
                <div class="cart-card__body">
                  <div class="list-card__title">{{ item.ingredientName }}</div>
                  <mat-chip-set>
                    <mat-chip>{{ item.suggestedQty | number:'1.0-2' }} {{ item.unit }}</mat-chip>
                  </mat-chip-set>
                </div>
              </div>
            }
          </div>
        }

        @if (uncheckedExpired().length > 0) {
          <div class="group-header">
            <mat-icon>event_busy</mat-icon>
            <span>{{ t('cart.expiredReplacements') }}</span>
          </div>
          <div class="list-card-grid">
            @for (item of uncheckedExpired(); track item.ingredientId) {
              <div class="list-card cart-card" (click)="toggleChecked(item.ingredientId)">
                <div class="cart-card__check">
                  <mat-icon>radio_button_unchecked</mat-icon>
                </div>
                <div class="cart-card__body">
                  <div class="list-card__title">{{ item.ingredientName }}</div>
                  <mat-chip-set>
                    <mat-chip class="expiry-expired">{{ t('inventory.expired') }}</mat-chip>
                  </mat-chip-set>
                </div>
              </div>
            }
          </div>
        }

        @if (checkedIds().size > 0) {
          <mat-divider />
          <div class="group-header bought-header">
            <mat-icon>check_circle</mat-icon>
            <span>{{ t('cart.bought') }} ({{ checkedIds().size }})</span>
          </div>
          <div class="list-card-grid">
            @for (item of checkedItems(); track item.ingredientId) {
              <div class="list-card cart-card checked" (click)="toggleChecked(item.ingredientId)">
                <div class="cart-card__check">
                  <mat-icon>check_circle</mat-icon>
                </div>
                <div class="cart-card__body">
                  <div class="list-card__title">{{ item.ingredientName }}</div>
                  <mat-chip-set>
                    <mat-chip>
                      {{ item.reason === 'min-restock'
                          ? (item.suggestedQty | number:'1.0-2') + ' ' + item.unit
                          : t('inventory.expired') }}
                    </mat-chip>
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
      flex-wrap: wrap;
      gap: 8px;

      h2 {
        margin: 0;
        font-size: 28px;
        font-weight: 700;
        background: linear-gradient(135deg, #e64a19 0%, #ff7043 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .header-right {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }

      .stat {
        padding: 6px 16px;
        border-radius: 20px;
        font-size: 0.875rem;
        font-weight: 600;
        background: rgba(230, 74, 25, 0.1);
        color: #b03a14;
      }

      .clear-btn {
        font-size: 0.8rem;
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

      &.bought-header {
        color: #558b2f;
        margin-top: 1.5rem;
      }
    }

    mat-divider {
      margin-top: 1.5rem;
    }

    .cart-card {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      cursor: pointer;
      user-select: none;

      .cart-card__check {
        flex-shrink: 0;
        padding-top: 2px;

        mat-icon {
          font-size: 22px;
          width: 22px;
          height: 22px;
          color: var(--mat-sys-on-surface-variant);
          transition: color 0.2s ease, transform 0.2s ease;
        }
      }

      .cart-card__body {
        flex: 1;
        min-width: 0;
      }

      &:hover .cart-card__check mat-icon {
        color: #e64a19;
        transform: scale(1.15);
      }

      &.checked {
        opacity: 0.5;

        .list-card__title {
          text-decoration: line-through;
        }

        .cart-card__check mat-icon {
          color: #558b2f;
        }
      }
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
        margin: 0 0 0.5rem;
        font-size: 1.5rem;
        font-weight: 600;
        color: var(--mat-sys-on-surface);
      }

      p {
        margin: 0;
        color: var(--mat-sys-on-surface-variant);
      }
    }

    .expiry-expired {
      --mdc-chip-elevated-container-color: rgba(198, 40, 40, 0.15);
      color: var(--color-error);
    }

    :host-context(.dark-theme) {
      .header {
        border-bottom: 2px solid rgba(255, 112, 67, 0.3);
        .stat { background: rgba(255, 112, 67, 0.15); color: #ff8a65; }
      }

      .empty-state mat-icon { color: rgba(255, 255, 255, 0.2); }

      .cart-card:hover .cart-card__check mat-icon { color: #ff7043; }

      .group-header.bought-header { color: #8bc34a; }

      .cart-card.checked .cart-card__check mat-icon { color: #8bc34a; }
    }
  `],
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
