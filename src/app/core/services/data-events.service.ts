import { Injectable } from '@angular/core';
import { Subject, filter, Observable } from 'rxjs';

export type DataTable =
  | 'ingredients'
  | 'ingredient_categories'
  | 'inventory'
  | 'recipes'
  | 'recipe_ingredients'
  | 'meal_plans'
  | 'nutrition_logs'
  | 'nutrition_goals';

export type DataOperation = 'create' | 'update' | 'delete';

export interface DataEvent {
  table: DataTable;
  operation: DataOperation;
  id?: string;
}

/**
 * Lightweight event bus for data changes.
 * Components emit after any CRUD operation; list components
 * subscribe to relevant tables and reload their data automatically.
 */
@Injectable({ providedIn: 'root' })
export class DataEventsService {
  private events$ = new Subject<DataEvent>();

  /** Emit after a successful CRUD operation */
  emit(table: DataTable, operation: DataOperation, id?: string): void {
    this.events$.next({ table, operation, id });
  }

  /** Subscribe to all changes on one or more tables */
  on(...tables: DataTable[]): Observable<DataEvent> {
    return this.events$.pipe(
      filter(e => tables.includes(e.table))
    );
  }
}
