import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MealPlanService, ShoppingListItem } from '../../core/services/meal-plan.service';
import { ExportService } from '../../core/services/export.service';
import { SnackbarService } from '../../core/services/snackbar.service';

@Component({
  selector: 'pp-weekly-shopping-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatCheckboxModule,
    MatChipsModule,
    MatDividerModule,
    MatTooltipModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatFormFieldModule,
    MatInputModule,
    MatMenuModule,
  ],
  template: `
    <div class="shopping-list-container">
      <mat-card class="header-card">
        <mat-card-header>
          <mat-card-title>
            <div class="title-with-nav">
              <button mat-icon-button routerLink="/home/meal-plan" matTooltip="Back to Calendar">
                <mat-icon>arrow_back</mat-icon>
              </button>
              <div class="title-content">
                <mat-icon>shopping_basket</mat-icon>
                Shopping List from Meal Plan
              </div>
            </div>
          </mat-card-title>
          <mat-card-subtitle>
            Generate a shopping list based on your planned meals
          </mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          <form [formGroup]="dateForm" class="date-range-form">
            <mat-form-field appearance="outline">
              <mat-label>Start Date</mat-label>
              <input
                matInput
                [matDatepicker]="startPicker"
                formControlName="startDate"
                (dateChange)="onDateChange()"
              />
              <mat-datepicker-toggle matIconSuffix [for]="startPicker"></mat-datepicker-toggle>
              <mat-datepicker #startPicker></mat-datepicker>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>End Date</mat-label>
              <input
                matInput
                [matDatepicker]="endPicker"
                formControlName="endDate"
                (dateChange)="onDateChange()"
              />
              <mat-datepicker-toggle matIconSuffix [for]="endPicker"></mat-datepicker-toggle>
              <mat-datepicker #endPicker></mat-datepicker>
            </mat-form-field>

            <div class="quick-select">
              <button mat-button (click)="selectThisWeek()">This Week</button>
              <button mat-button (click)="selectNextWeek()">Next Week</button>
              <button mat-button (click)="selectThisMonth()">This Month</button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>

      @if (shoppingList().length === 0) {
        <mat-card class="empty-state">
          <mat-card-content>
            <mat-icon>event_busy</mat-icon>
            <h3>No Meal Plans Found</h3>
            <p>Add meals to your meal plan calendar to generate a shopping list.</p>
            <button mat-raised-button color="primary" routerLink="/home/meal-plan">
              <mat-icon>event</mat-icon>
              Go to Meal Plan
            </button>
          </mat-card-content>
        </mat-card>
      } @else {
        <mat-card class="summary-card">
          <mat-card-content>
            <div class="summary-stats">
              <div class="stat">
                <mat-icon>shopping_cart</mat-icon>
                <div>
                  <span class="stat-value">{{ totalItems() }}</span>
                  <span class="stat-label">Total Items</span>
                </div>
              </div>
              <div class="stat">
                <mat-icon>inventory_2</mat-icon>
                <div>
                  <span class="stat-value">{{ itemsInStock() }}</span>
                  <span class="stat-label">In Stock</span>
                </div>
              </div>
              <div class="stat">
                <mat-icon>add_shopping_cart</mat-icon>
                <div>
                  <span class="stat-value">{{ itemsNeeded() }}</span>
                  <span class="stat-label">Need to Buy</span>
                </div>
              </div>
              <div class="stat">
                <mat-icon>check_circle</mat-icon>
                <div>
                  <span class="stat-value">{{ checkedItems() }}/{{ totalItems() }}</span>
                  <span class="stat-label">Checked Off</span>
                </div>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="list-card">
          <mat-card-header>
            <mat-card-title>Shopping List</mat-card-title>
            <div class="actions">
              <button mat-button (click)="clearChecked()">
                <mat-icon>clear_all</mat-icon>
                Clear Checked
              </button>
              <button mat-raised-button color="primary" [matMenuTriggerFor]="exportMenu">
                <mat-icon>download</mat-icon>
                Export
                <mat-icon>arrow_drop_down</mat-icon>
              </button>
              <mat-menu #exportMenu="matMenu">
                <button mat-menu-item (click)="exportToPdf()">
                  <mat-icon>picture_as_pdf</mat-icon>
                  <span>Export as PDF</span>
                </button>
                <button mat-menu-item (click)="exportToCsv()">
                  <mat-icon>table_chart</mat-icon>
                  <span>Export as CSV</span>
                </button>
                <button mat-menu-item (click)="print()">
                  <mat-icon>print</mat-icon>
                  <span>Print</span>
                </button>
                <mat-divider></mat-divider>
                <button mat-menu-item (click)="copyToClipboard()">
                  <mat-icon>content_copy</mat-icon>
                  <span>Copy to Clipboard</span>
                </button>
              </mat-menu>
            </div>
          </mat-card-header>

          <mat-card-content>
            <mat-list class="shopping-list">
              @for (item of shoppingList(); track item.ingredientId) {
                <mat-list-item
                  class="list-item"
                  [class.checked]="isChecked(item.ingredientId)"
                  [class.in-stock]="item.needed === 0"
                >
                  <mat-checkbox
                    matListItemMeta
                    [checked]="isChecked(item.ingredientId)"
                    (change)="toggleCheck(item.ingredientId)"
                  ></mat-checkbox>

                  <div class="item-content" matListItemTitle>
                    <div class="item-header">
                      <span class="item-name">{{ item.ingredientName }}</span>
                      @if (item.needed > 0) {
                        <mat-chip class="need-chip" color="warn">
                          Need: {{ formatQuantity(item.needed, item.unit) }}
                        </mat-chip>
                      } @else {
                        <mat-chip class="stock-chip" color="primary">
                          In Stock
                        </mat-chip>
                      }
                    </div>

                    <div class="item-details" matListItemLine>
                      <div class="quantity-info">
                        <span class="label">Total needed:</span>
                        <span class="value">{{ formatQuantity(item.totalQuantity, item.unit) }}</span>
                      </div>
                      @if (item.inventoryQuantity > 0) {
                        <div class="quantity-info">
                          <span class="label">In inventory:</span>
                          <span class="value">{{ formatQuantity(item.inventoryQuantity, item.unit) }}</span>
                        </div>
                      }
                    </div>

                    @if (item.mealPlans.length > 0) {
                      <div class="meal-plans" matListItemLine>
                        <mat-icon class="meal-icon">restaurant</mat-icon>
                        <span class="recipes">{{ item.mealPlans.join(', ') }}</span>
                      </div>
                    }
                  </div>
                </mat-list-item>
                <mat-divider></mat-divider>
              }
            </mat-list>
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
  styles: [`
    .shopping-list-container {
      padding: var(--spacing-lg);
      max-width: 1000px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: var(--spacing-md);
    }

    .header-card {
      mat-card-header {
        mat-card-title {
          .title-with-nav {
            display: flex;
            align-items: center;
            gap: var(--spacing-sm);
            width: 100%;

            .title-content {
              display: flex;
              align-items: center;
              gap: var(--spacing-sm);
              font-size: 24px;

              mat-icon {
                font-size: 28px;
                width: 28px;
                height: 28px;
              }
            }
          }
        }
      }
    }

    .date-range-form {
      display: flex;
      gap: var(--spacing-md);
      align-items: flex-start;
      flex-wrap: wrap;
      margin-top: var(--spacing-md);

      mat-form-field {
        flex: 1;
        min-width: 200px;
      }

      .quick-select {
        display: flex;
        gap: var(--spacing-xs);
        align-items: center;
      }
    }

    .summary-card {
      .summary-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: var(--spacing-md);
      }

      .stat {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        padding: var(--spacing-md);
        background-color: var(--surface-color);
        border-radius: 8px;
        border-left: 4px solid var(--primary-color);

        mat-icon {
          font-size: 32px;
          width: 32px;
          height: 32px;
          color: var(--primary-color);
        }

        div {
          display: flex;
          flex-direction: column;

          .stat-value {
            font-size: 24px;
            font-weight: 700;
            color: var(--text-primary);
          }

          .stat-label {
            font-size: 12px;
            color: var(--text-secondary);
            text-transform: uppercase;
          }
        }
      }
    }

    .list-card {
      mat-card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: var(--spacing-md);

        .actions {
          display: flex;
          gap: var(--spacing-sm);
        }
      }
    }

    .shopping-list {
      padding: 0;

      .list-item {
        padding: var(--spacing-md);
        transition: all 0.2s ease;
        height: auto;
        min-height: 72px;

        &:hover {
          background-color: var(--hover-color);
        }

        &.checked {
          opacity: 0.6;

          .item-name {
            text-decoration: line-through;
          }
        }

        &.in-stock {
          .item-name {
            color: var(--primary-color);
          }
        }

        .item-content {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xs);
        }

        .item-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: var(--spacing-sm);

          .item-name {
            font-size: 16px;
            font-weight: 600;
            flex: 1;
          }

          .need-chip {
            font-size: 12px;
            height: 24px;
          }

          .stock-chip {
            font-size: 12px;
            height: 24px;
          }
        }

        .item-details {
          display: flex;
          gap: var(--spacing-md);
          flex-wrap: wrap;

          .quantity-info {
            display: flex;
            gap: var(--spacing-xs);
            font-size: 14px;

            .label {
              color: var(--text-secondary);
            }

            .value {
              font-weight: 600;
              color: var(--text-primary);
            }
          }
        }

        .meal-plans {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
          font-size: 13px;
          color: var(--text-secondary);
          margin-top: var(--spacing-xs);

          .meal-icon {
            font-size: 16px;
            width: 16px;
            height: 16px;
          }

          .recipes {
            flex: 1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
        }
      }
    }

    .empty-state {
      mat-card-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--spacing-md);
        padding: var(--spacing-xl);
        text-align: center;

        mat-icon {
          font-size: 64px;
          width: 64px;
          height: 64px;
          color: var(--text-secondary);
          opacity: 0.5;
        }

        h3 {
          margin: 0;
          font-size: 20px;
        }

        p {
          margin: 0;
          color: var(--text-secondary);
        }
      }
    }

    @media (max-width: 768px) {
      .shopping-list-container {
        padding: var(--spacing-sm);
      }

      .date-range-form {
        flex-direction: column;

        mat-form-field {
          width: 100%;
        }

        .quick-select {
          width: 100%;
          justify-content: space-between;

          button {
            flex: 1;
          }
        }
      }

      .summary-stats {
        grid-template-columns: repeat(2, 1fr);
      }

      .list-card mat-card-header {
        flex-direction: column;
        align-items: stretch;
        gap: var(--spacing-sm);

        .actions {
          width: 100%;

          button {
            flex: 1;
          }
        }
      }
    }
  `],
})
export class WeeklyShoppingListComponent implements OnInit {
  private fb = inject(FormBuilder);
  private mealPlanService = inject(MealPlanService);
  private exportService = inject(ExportService);
  private snackbar = inject(SnackbarService);

  dateForm!: FormGroup;
  shoppingList = signal<ShoppingListItem[]>([]);
  checkedItemIds = signal<Set<string>>(new Set());

  totalItems = computed(() => this.shoppingList().length);
  itemsInStock = computed(() => this.shoppingList().filter(item => item.needed === 0).length);
  itemsNeeded = computed(() => this.shoppingList().filter(item => item.needed > 0).length);
  checkedItems = computed(() => this.checkedItemIds().size);

  ngOnInit(): void {
    // Initialize form with this week
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Saturday

    this.dateForm = this.fb.group({
      startDate: [startOfWeek],
      endDate: [endOfWeek],
    });

    this.loadShoppingList();
  }

  loadShoppingList(): void {
    const startDate = this.dateForm.value.startDate;
    const endDate = this.dateForm.value.endDate;

    if (!startDate || !endDate) {
      return;
    }

    const startString = this.formatDate(startDate);
    const endString = this.formatDate(endDate);

    const list = this.mealPlanService.getShoppingListForPeriod(startString, endString);
    this.shoppingList.set(list);
  }

  onDateChange(): void {
    this.loadShoppingList();
  }

  selectThisWeek(): void {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    this.dateForm.patchValue({
      startDate: startOfWeek,
      endDate: endOfWeek,
    });
    this.loadShoppingList();
  }

  selectNextWeek(): void {
    const today = new Date();
    const startOfNextWeek = new Date(today);
    startOfNextWeek.setDate(today.getDate() - today.getDay() + 7);
    const endOfNextWeek = new Date(startOfNextWeek);
    endOfNextWeek.setDate(startOfNextWeek.getDate() + 6);

    this.dateForm.patchValue({
      startDate: startOfNextWeek,
      endDate: endOfNextWeek,
    });
    this.loadShoppingList();
  }

  selectThisMonth(): void {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    this.dateForm.patchValue({
      startDate: startOfMonth,
      endDate: endOfMonth,
    });
    this.loadShoppingList();
  }

  toggleCheck(ingredientId: string): void {
    const checked = new Set(this.checkedItemIds());
    if (checked.has(ingredientId)) {
      checked.delete(ingredientId);
    } else {
      checked.add(ingredientId);
    }
    this.checkedItemIds.set(checked);
  }

  isChecked(ingredientId: string): boolean {
    return this.checkedItemIds().has(ingredientId);
  }

  clearChecked(): void {
    this.checkedItemIds.set(new Set());
    this.snackbar.success('Cleared all checked items');
  }

  exportToPdf(): void {
    const items = this.shoppingList();
    if (items.length === 0) {
      this.snackbar.warning('No items to export');
      return;
    }

    const dateRange = this.getDateRangeString();
    this.exportService.exportToPdf(items, {
      title: `Shopping List - ${dateRange}`,
      showInventory: true,
      showRecipes: true,
    });
    this.snackbar.success('PDF downloaded successfully!');
  }

  exportToCsv(): void {
    const items = this.shoppingList();
    if (items.length === 0) {
      this.snackbar.warning('No items to export');
      return;
    }

    const dateRange = this.getDateRangeString();
    this.exportService.exportToCsv(items, {
      title: `Shopping List - ${dateRange}`,
      showInventory: true,
      showRecipes: true,
    });
    this.snackbar.success('CSV downloaded successfully!');
  }

  print(): void {
    const items = this.shoppingList();
    if (items.length === 0) {
      this.snackbar.warning('No items to print');
      return;
    }

    const dateRange = this.getDateRangeString();
    this.exportService.printShoppingList(items, {
      title: `Shopping List - ${dateRange}`,
      showInventory: true,
      showRecipes: true,
    });
  }

  copyToClipboard(): void {
    const items = this.shoppingList();
    if (items.length === 0) {
      this.snackbar.warning('No items to copy');
      return;
    }

    // Generate text version of shopping list
    const list = items
      .filter(item => item.needed > 0)
      .map(item => `☐ ${item.ingredientName} - ${this.formatQuantity(item.needed, item.unit)}`)
      .join('\n');

    // Copy to clipboard
    navigator.clipboard.writeText(list).then(() => {
      this.snackbar.success('Shopping list copied to clipboard!');
    }).catch(() => {
      this.snackbar.error('Failed to copy to clipboard');
    });
  }

  private getDateRangeString(): string {
    const startDate = this.dateForm.value.startDate;
    const endDate = this.dateForm.value.endDate;
    if (startDate && endDate) {
      return `${this.formatDate(startDate)} to ${this.formatDate(endDate)}`;
    }
    return 'Custom Range';
  }

  formatQuantity(quantity: number, unit: string): string {
    return `${quantity.toFixed(2)} ${unit}`;
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
