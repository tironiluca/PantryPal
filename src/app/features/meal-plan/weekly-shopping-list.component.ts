import { Component, inject, signal, computed, OnInit } from '@angular/core';

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
  templateUrl: './weekly-shopping-list.component.html',
  styleUrls: ['./weekly-shopping-list.component.scss'],
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
    navigator.clipboard
      .writeText(list)
      .then(() => {
        this.snackbar.success('Shopping list copied to clipboard!');
      })
      .catch(() => {
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
