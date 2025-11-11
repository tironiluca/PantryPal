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
  createdAt: string;
  updatedAt: string;
}
