export interface IngredientCategory { id: string; name: string; }
export interface Ingredient {
  id: string;
  name: string;
  categoryId: string;
  defaultShelfLifeDays?: number;
  notifyStartDays?: number;
  notifyRepeatDays?: number;
}
