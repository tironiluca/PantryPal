export type FeatureTab = {
  labelKey: string;
  descKey: string;
  route: string;
  icon: string;
};

export const NAV_TABS: FeatureTab[] = [
  { labelKey: 'home.inventory',   route: 'inventory',   icon: 'inventory_2',     descKey: 'home.inventoryDesc'   },
  { labelKey: 'home.ingredients', route: 'ingredients', icon: 'category',         descKey: 'home.ingredientsDesc' },
  { labelKey: 'home.recipes',     route: 'recipes',     icon: 'restaurant_menu',  descKey: 'home.recipesDesc'     },
  { labelKey: 'home.mealPlan',    route: 'meal-plan',   icon: 'event',            descKey: 'home.mealPlanDesc'    },
  { labelKey: 'home.nutrition',   route: 'nutrition',   icon: 'restaurant',       descKey: 'home.nutritionDesc'   },
  { labelKey: 'home.cart',        route: 'cart',        icon: 'shopping_cart',    descKey: 'home.cartDesc'        },
];
