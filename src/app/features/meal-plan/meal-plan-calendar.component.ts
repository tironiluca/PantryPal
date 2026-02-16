import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { MealPlanService, MealPlanWithRecipe } from '../../core/services/meal-plan.service';
import { AuthService } from '../../core/services/auth.service';
import { SnackbarService } from '../../core/services/snackbar.service';
import { MealPlanAddDialog } from './meal-plan-add.dialog';

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
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatMenuModule,
    MatChipsModule,
    MatTooltipModule,
    DragDropModule,
  ],
  template: `
    <div class="meal-plan-container">
      <mat-card class="calendar-card">
        <mat-card-header>
          <mat-card-title>
            <div class="header-content">
              <div class="navigation">
                <button mat-icon-button (click)="previousMonth()">
                  <mat-icon>chevron_left</mat-icon>
                </button>
                <h2>{{ currentMonthYear() }}</h2>
                <button mat-icon-button (click)="nextMonth()">
                  <mat-icon>chevron_right</mat-icon>
                </button>
              </div>
              <div class="actions">
                <button mat-button (click)="goToToday()">
                  <mat-icon>today</mat-icon>
                  Today
                </button>
                <button mat-button routerLink="shopping-list" color="accent">
                  <mat-icon>shopping_basket</mat-icon>
                  Shopping List
                </button>
                <button mat-raised-button color="primary" (click)="openAddDialog()">
                  <mat-icon>add</mat-icon>
                  Add Meal
                </button>
              </div>
            </div>
          </mat-card-title>
        </mat-card-header>

        <mat-card-content>
          <!-- Calendar Grid -->
          <div class="calendar-grid">
            <!-- Day headers -->
            @for (day of weekDays; track day) {
              <div class="day-header">{{ day }}</div>
            }

            <!-- Calendar days -->
            @for (day of calendarDays(); track day.dateString) {
              <div
                class="calendar-day"
                [class.today]="day.isToday"
                [class.other-month]="!day.isCurrentMonth"
              >
                <div class="day-number">
                  {{ day.date.getDate() }}
                  @if (day.isToday) {
                    <mat-icon class="today-indicator">circle</mat-icon>
                  }
                </div>

                <!-- Meal slots -->
                <div class="meal-slots">
                  @for (mealType of mealTypes; track mealType) {
                    <div class="meal-slot" [attr.data-meal-type]="mealType">
                      @if (day.meals[mealType].length > 0) {
                        @for (meal of day.meals[mealType]; track meal.id) {
                          <div
                            class="meal-item"
                            [class.completed]="meal.completed"
                            [matTooltip]="getMealTooltip(meal)"
                            (click)="editMeal(meal)"
                          >
                            <div class="meal-icon">
                              <mat-icon>{{ getMealIcon(mealType) }}</mat-icon>
                            </div>
                            <div class="meal-content">
                              <span class="meal-name">{{ meal.recipeName || 'Unknown' }}</span>
                              @if (meal.servings > 1) {
                                <span class="servings">×{{ meal.servings }}</span>
                              }
                            </div>
                            <button
                              mat-icon-button
                              class="meal-menu-btn"
                              [matMenuTriggerFor]="mealMenu"
                              (click)="$event.stopPropagation()"
                            >
                              <mat-icon>more_vert</mat-icon>
                            </button>

                            <mat-menu #mealMenu="matMenu">
                              <button mat-menu-item (click)="toggleCompleted(meal)">
                                <mat-icon>{{ meal.completed ? 'radio_button_unchecked' : 'check_circle' }}</mat-icon>
                                <span>{{ meal.completed ? 'Mark Incomplete' : 'Mark Complete' }}</span>
                              </button>
                              <button mat-menu-item (click)="editMeal(meal)">
                                <mat-icon>edit</mat-icon>
                                <span>Edit</span>
                              </button>
                              <button mat-menu-item (click)="deleteMeal(meal)">
                                <mat-icon color="warn">delete</mat-icon>
                                <span>Delete</span>
                              </button>
                            </mat-menu>
                          </div>
                        }
                      } @else {
                        <div class="empty-slot" (click)="addMealToSlot(day.dateString, mealType)">
                          <mat-icon>{{ getMealIcon(mealType) }}</mat-icon>
                          <span class="add-hint">Add {{ mealType }}</span>
                        </div>
                      }
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Legend -->
      <mat-card class="legend-card">
        <mat-card-content>
          <div class="legend">
            <div class="legend-item">
              <mat-icon>restaurant</mat-icon>
              <span>Click empty slots to add meals</span>
            </div>
            <div class="legend-item">
              <mat-icon>check_circle</mat-icon>
              <span>Completed meals</span>
            </div>
            <div class="legend-item">
              <mat-icon class="today-indicator">circle</mat-icon>
              <span>Today</span>
            </div>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .meal-plan-container {
      padding: var(--spacing-lg);
      max-width: 1400px;
      margin: 0 auto;
    }

    .calendar-card {
      margin-bottom: var(--spacing-md);
    }

    .header-content {
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--spacing-md);
    }

    .navigation {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);

      h2 {
        margin: 0;
        min-width: 200px;
        text-align: center;
      }
    }

    .actions {
      display: flex;
      gap: var(--spacing-sm);
      align-items: center;
    }

    .calendar-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 1px;
      background-color: var(--divider-color);
      border: 1px solid var(--divider-color);
    }

    .day-header {
      background-color: var(--primary-color);
      color: white;
      padding: var(--spacing-sm);
      text-align: center;
      font-weight: 600;
      font-size: 14px;
    }

    .calendar-day {
      background-color: var(--background-color);
      min-height: 150px;
      padding: var(--spacing-xs);
      display: flex;
      flex-direction: column;
      position: relative;

      &.today {
        background-color: rgba(67, 160, 71, 0.05);
        border: 2px solid var(--primary-color);
      }

      &.other-month {
        opacity: 0.5;
        background-color: var(--surface-color);
      }
    }

    .day-number {
      font-weight: 600;
      font-size: 14px;
      margin-bottom: var(--spacing-xs);
      display: flex;
      align-items: center;
      gap: var(--spacing-xs);

      .today-indicator {
        font-size: 8px;
        width: 8px;
        height: 8px;
        color: var(--primary-color);
      }
    }

    .meal-slots {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
    }

    .meal-slot {
      flex: 1;
      min-height: 24px;
    }

    .meal-item {
      background-color: var(--surface-color);
      border: 1px solid var(--divider-color);
      border-left: 3px solid var(--primary-color);
      border-radius: 4px;
      padding: 4px 6px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      margin-bottom: 4px;

      &:hover {
        background-color: var(--hover-color);
        transform: translateX(2px);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }

      &.completed {
        opacity: 0.6;
        text-decoration: line-through;
        border-left-color: var(--accent-color);
      }

      .meal-icon {
        mat-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
          color: var(--text-secondary);
        }
      }

      .meal-content {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 4px;
        overflow: hidden;

        .meal-name {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-weight: 500;
        }

        .servings {
          font-size: 10px;
          color: var(--text-secondary);
        }
      }

      .meal-menu-btn {
        width: 20px;
        height: 20px;
        padding: 0;
        opacity: 0;
        transition: opacity 0.2s;

        mat-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
        }
      }

      &:hover .meal-menu-btn {
        opacity: 1;
      }
    }

    .empty-slot {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 6px;
      border: 1px dashed var(--divider-color);
      border-radius: 4px;
      cursor: pointer;
      opacity: 0;
      transition: all 0.2s ease;
      font-size: 11px;
      color: var(--text-secondary);

      mat-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
      }

      .add-hint {
        display: none;
      }

      &:hover {
        opacity: 1;
        background-color: rgba(67, 160, 71, 0.05);
        border-color: var(--primary-color);

        .add-hint {
          display: inline;
        }
      }
    }

    .calendar-day:hover .empty-slot {
      opacity: 0.6;
    }

    .legend-card {
      mat-card-content {
        padding: var(--spacing-md);
      }
    }

    .legend {
      display: flex;
      gap: var(--spacing-lg);
      justify-content: center;
      flex-wrap: wrap;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: var(--spacing-xs);
      font-size: 14px;
      color: var(--text-secondary);

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: var(--primary-color);
      }
    }

    @media (max-width: 768px) {
      .meal-plan-container {
        padding: var(--spacing-sm);
      }

      .header-content {
        flex-direction: column;
        align-items: stretch;
      }

      .navigation h2 {
        font-size: 18px;
        min-width: 150px;
      }

      .calendar-day {
        min-height: 100px;
        font-size: 11px;
      }

      .meal-item {
        font-size: 10px;
        padding: 2px 4px;

        .meal-icon mat-icon {
          font-size: 14px;
          width: 14px;
          height: 14px;
        }
      }
    }
  `],
})
export class MealPlanCalendarComponent implements OnInit {
  private mealPlanService = inject(MealPlanService);
  private auth = inject(AuthService);
  private dialog = inject(MatDialog);
  private snackbar = inject(SnackbarService);

  weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  mealTypes: Array<'breakfast' | 'lunch' | 'dinner' | 'snack'> = ['breakfast', 'lunch', 'dinner', 'snack'];

  currentDate = signal(new Date());
  mealPlans = signal<MealPlanWithRecipe[]>([]);

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

  ngOnInit(): void {
    this.loadMealPlans();
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
    const dialogRef = this.dialog.open(MealPlanAddDialog, {
      width: '600px',
      data: { date: this.formatDate(new Date()) },
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadMealPlans();
        this.snackbar.success('Meal added to plan!');
      }
    });
  }

  addMealToSlot(dateString: string, mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'): void {
    const dialogRef = this.dialog.open(MealPlanAddDialog, {
      width: '600px',
      data: { date: dateString, mealType },
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadMealPlans();
        this.snackbar.success('Meal added to plan!');
      }
    });
  }

  editMeal(meal: MealPlanWithRecipe): void {
    const dialogRef = this.dialog.open(MealPlanAddDialog, {
      width: '600px',
      data: { mealPlan: meal },
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadMealPlans();
        this.snackbar.success('Meal updated!');
      }
    });
  }

  toggleCompleted(meal: MealPlanWithRecipe): void {
    this.mealPlanService.markAsCompleted(meal.id, !meal.completed);
    this.loadMealPlans();
    this.snackbar.success(meal.completed ? 'Marked as incomplete' : 'Marked as complete');
  }

  deleteMeal(meal: MealPlanWithRecipe): void {
    if (confirm(`Delete ${meal.recipeName} from your meal plan?`)) {
      this.mealPlanService.removeMeal(meal.id);
      this.loadMealPlans();
      this.snackbar.success('Meal removed from plan');
    }
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
