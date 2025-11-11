import { Routes } from '@angular/router';
import { RecipeListComponent } from './recipe-list.component';
import { MealOfDayComponent } from './meal-of-day.component';
export const RECIPE_ROUTES: Routes = [
  { path: '', component: RecipeListComponent },
  { path: 'meal', component: MealOfDayComponent },
];
