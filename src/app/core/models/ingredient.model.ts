export interface IngredientCategory { id: string; name: string; }
export interface Ingredient {
  id: string;
  name: string;
  categoryId: string;
  defaultShelfLifeDays?: number;
  notifyStartDays?: number;
  notifyRepeatDays?: number;
  /** Owner; rows from other household members are read-only. NULL for guest data. */
  userId?: string | null;
}
