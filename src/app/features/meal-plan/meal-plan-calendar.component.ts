import { Component, inject, signal, computed, OnInit, DestroyRef } from '@angular/core';

import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MealPlanService, MealPlanWithRecipe } from '../../core/services/meal-plan.service';
import { AuthService } from '../../core/services/auth.service';
import { SnackbarService } from '../../core/services/snackbar.service';
import { DataEventsService } from '../../core/services/data-events.service';
import { DbService } from '../../core/services/db.service';
import { UnitConverterService, Unit } from '../../core/services/unit-converter.service';
import { ErrorHandlerService } from '../../core/services/error-handler.service';
import { MealPlanAddDialog } from './meal-plan-add.dialog';
import { ConfirmDialog } from '../../shared/dialogs/confirm/confirm.dialog';

interface CalendarDay {
  date: Date;
  dateString: string;
  isToday: boolean;
  isCurrentMonth: boolean;
  meals: {
    breakfast: MealPlanWithRecipe[];
    lunch: MealPlanWithRecipe[];
    dinner: MealPlanWithRecipe[];
    snack: MealPlanWithRecipe[];
  };
}

@Component({
  selector: 'pp-meal-plan-calendar',
  standalone: true,
  imports: [
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatDialogModule,
    MatMenuModule,
    MatChipsModule,
    MatTooltipModule,
    MatDividerModule,
    DragDropModule,
  ],
  templateUrl: './meal-plan-calendar.component.html',
  styleUrls: ['./meal-plan-calendar.component.scss'],
})
export class MealPlanCalendarComponent implements OnInit {
  private mealPlanService = inject(MealPlanService);
  private auth = inject(AuthService);
  private dialog = inject(MatDialog);
  private snackbar = inject(SnackbarService);
  private dataEvents = inject(DataEventsService);
  private destroyRef = inject(DestroyRef);
  private db = inject(DbService);
  private unitConverter = inject(UnitConverterService);
  private errorHandler = inject(ErrorHandlerService);

  weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  mealTypes: Array<'breakfast' | 'lunch' | 'dinner' | 'snack'> = [
    'breakfast',
    'lunch',
    'dinner',
    'snack',
  ];

  currentDate = signal(new Date());
  mealPlans = signal<MealPlanWithRecipe[]>([]);
  viewMode = signal<'calendar' | 'agenda'>('calendar');

  currentMonthYear = computed(() => {
    const date = this.currentDate();
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  });

  calendarDays = computed(() => {
    const date = this.currentDate();
    const year = date.getFullYear();
    const month = date.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay()); // Start from Sunday

    const days: CalendarDay[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Generate 6 weeks (42 days) to ensure full calendar
    for (let i = 0; i < 42; i++) {
      const currentDay = new Date(startDate);
      currentDay.setDate(currentDay.getDate() + i);

      const dateString = this.formatDate(currentDay);
      const dayPlans = this.mealPlans().filter(plan => plan.date === dateString);

      days.push({
        date: currentDay,
        dateString,
        isToday: currentDay.getTime() === today.getTime(),
        isCurrentMonth: currentDay.getMonth() === month,
        meals: {
          breakfast: dayPlans.filter(p => p.mealType === 'breakfast'),
          lunch: dayPlans.filter(p => p.mealType === 'lunch'),
          dinner: dayPlans.filter(p => p.mealType === 'dinner'),
          snack: dayPlans.filter(p => p.mealType === 'snack'),
        },
      });
    }

    return days;
  });

  // Agenda view: all days in current month that have at least one meal
  agendaDays = computed(() =>
    this.calendarDays().filter(
      d =>
        d.isCurrentMonth &&
        d.meals.breakfast.length +
          d.meals.lunch.length +
          d.meals.dinner.length +
          d.meals.snack.length >
          0
    )
  );

  ngOnInit(): void {
    this.loadMealPlans();
    this.dataEvents
      .on('meal_plans', 'recipes')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadMealPlans());
  }

  loadMealPlans(): void {
    const date = this.currentDate();
    const plans = this.mealPlanService.getPlanForMonth(date.getFullYear(), date.getMonth());
    this.mealPlans.set(plans);
  }

  previousMonth(): void {
    const date = this.currentDate();
    this.currentDate.set(new Date(date.getFullYear(), date.getMonth() - 1, 1));
    this.loadMealPlans();
  }

  nextMonth(): void {
    const date = this.currentDate();
    this.currentDate.set(new Date(date.getFullYear(), date.getMonth() + 1, 1));
    this.loadMealPlans();
  }

  goToToday(): void {
    this.currentDate.set(new Date());
    this.loadMealPlans();
  }

  openAddDialog(): void {
    this.dialog
      .open(MealPlanAddDialog, {
        maxWidth: '500px',
        width: '95vw',
        data: { date: this.formatDate(new Date()) },
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(result => {
        if (result) this.snackbar.success('Meal added to plan!');
      });
  }

  addMealToSlot(dateString: string, mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'): void {
    this.dialog
      .open(MealPlanAddDialog, {
        maxWidth: '500px',
        width: '95vw',
        data: { date: dateString, mealType },
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(result => {
        if (result) this.snackbar.success('Meal added to plan!');
      });
  }

  editMeal(meal: MealPlanWithRecipe): void {
    this.dialog
      .open(MealPlanAddDialog, {
        maxWidth: '500px',
        width: '95vw',
        data: { mealPlan: meal },
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(result => {
        if (result) this.snackbar.success('Meal updated!');
      });
  }

  toggleCompleted(meal: MealPlanWithRecipe): void {
    const isCompleting = !meal.completed;

    // Marking incomplete: no deduction prompt
    if (!isCompleting) {
      this.mealPlanService.markAsCompleted(meal.id, false);
      this.loadMealPlans();
      this.snackbar.success('Marked as incomplete');
      return;
    }

    // Marking complete: ask to deduct from inventory
    this.dialog
      .open(ConfirmDialog, {
        data: {
          title: 'Deduct Ingredients?',
          message: `Deduct ingredients for "${meal.recipeName}" from your inventory?`,
          confirmLabel: 'Deduct',
          cancelLabel: 'Skip',
          icon: 'remove_shopping_cart',
        },
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(shouldDeduct => {
        this.mealPlanService.markAsCompleted(meal.id, true);
        this.loadMealPlans();
        if (shouldDeduct) {
          this.deductIngredients(meal);
        } else {
          this.snackbar.success('Marked as complete');
        }
      });
  }

  private deductIngredients(meal: MealPlanWithRecipe): void {
    try {
      const recipeIngredients = this.db.getRecipeIngredients(meal.recipeId);

      if (recipeIngredients.length === 0) {
        this.snackbar.success('Marked as complete (no ingredients to deduct)');
        return;
      }

      let deducted = 0;
      let skipped = 0;
      const now = new Date().toISOString();

      for (const ri of recipeIngredients) {
        const servings = meal.servings ?? 1;
        let remaining = ri.quantity * servings;
        const neededUnit = ri.unit as Unit;

        // Fetch inventory rows ordered by earliest expiry first (FIFO)
        const invRows = this.db.getInventoryForIngredient(ri.ingredientId);

        let fullyDeducted = false;

        for (const inv of invRows) {
          if (remaining <= 0) {
            fullyDeducted = true;
            break;
          }

          const invUnit = inv.unit as Unit;
          const invInRecipeUnit = this.unitConverter.convert(inv.quantity, invUnit, neededUnit);
          if (invInRecipeUnit === null) continue; // Incompatible units — skip this row

          if (invInRecipeUnit >= remaining) {
            // This row covers the rest
            const deductInInvUnit = this.unitConverter.convert(remaining, neededUnit, invUnit);
            if (deductInInvUnit === null) continue;
            const newQty = Math.max(0, inv.quantity - deductInInvUnit);
            this.db.exec(
              `UPDATE inventory SET quantity = ?, updatedAt = ?, version = version + 1 WHERE id = ?`,
              [newQty, now, inv.id]
            );
            remaining = 0;
            fullyDeducted = true;
            break;
          } else {
            // Partially deplete this row
            remaining -= invInRecipeUnit;
            this.db.exec(
              `UPDATE inventory SET quantity = 0, updatedAt = ?, version = version + 1 WHERE id = ?`,
              [now, inv.id]
            );
          }
        }

        if (fullyDeducted || remaining <= 0) {
          deducted++;
        } else {
          skipped++;
        }
      }

      this.dataEvents.emit('inventory', 'update');

      if (skipped === 0) {
        this.snackbar.success(`Marked as complete — deducted ${deducted} ingredient(s)`);
      } else {
        this.snackbar.warning(
          `Marked as complete — deducted ${deducted}, skipped ${skipped} (unit mismatch or low stock)`
        );
      }
    } catch (error) {
      this.errorHandler.handle(error, 'Failed to deduct ingredients');
    }
  }

  deleteMeal(meal: MealPlanWithRecipe): void {
    this.dialog
      .open(ConfirmDialog, {
        data: {
          title: 'Remove Meal',
          message: `Remove ${meal.recipeName} from your meal plan?`,
          confirmColor: 'warn',
          icon: 'delete',
        },
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(ok => {
        if (!ok) return;
        this.mealPlanService.removeMeal(meal.id);
        this.dataEvents.emit('meal_plans', 'delete', meal.id);
        this.loadMealPlans();
        this.snackbar.success('Meal removed from plan');
      });
  }

  getMealIcon(mealType: string): string {
    const icons: Record<string, string> = {
      breakfast: 'free_breakfast',
      lunch: 'lunch_dining',
      dinner: 'dinner_dining',
      snack: 'cookie',
    };
    return icons[mealType] || 'restaurant';
  }

  getMealTooltip(meal: MealPlanWithRecipe): string {
    return `${meal.recipeName}${meal.servings > 1 ? ` (${meal.servings} servings)` : ''}${meal.notes ? `\n${meal.notes}` : ''}`;
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
