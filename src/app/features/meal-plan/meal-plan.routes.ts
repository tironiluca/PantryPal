import { Routes } from '@angular/router';
import { MealPlanCalendarComponent } from './meal-plan-calendar.component';
import { WeeklyShoppingListComponent } from './weekly-shopping-list.component';

export const MEAL_PLAN_ROUTES: Routes = [
  {
    path: '',
    component: MealPlanCalendarComponent,
  },
  {
    path: 'shopping-list',
    component: WeeklyShoppingListComponent,
  },
];
