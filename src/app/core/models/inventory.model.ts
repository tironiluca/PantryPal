export type Unit = 'g' | 'kg' | 'ml' | 'l' | 'pcs';
export interface InventoryItem {
  id: string;
  ingredientId: string;
  quantity: number;
  unit: Unit;
  minRestock: number;
  expiry?: string;
  location?: 'fridge' | 'freezer' | 'pantry' | 'other';
  barcode?: string;
  /** Owner; rows from other household members are read-only. NULL for guest data. */
  userId?: string | null;
  createdAt: string;
  updatedAt: string;
}
