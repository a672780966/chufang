/**
 * DishCatalog.ts
 * Authoritative Dish Catalog for Stage 5A DishPuzzle Core Authority.
 * Contains only authentic Gold Sample dishes with approved assets and manifests.
 * Dishes without assets are forbidden from being registered or ordered.
 */

export interface DishOrderDefinition {
  dishId: string;
  name: string;
  baseRevenue: number;
  emoji?: string;
  category?: string;
}

export const GOLD_SAMPLE_DISH_CATALOG: Record<string, DishOrderDefinition> = {
  dish_breakfast: {
    dishId: 'dish_breakfast',
    name: '春日早餐盘',
    baseRevenue: 85,
    emoji: '🍳',
    category: 'Breakfast'
  },
  dish_salad: {
    dishId: 'dish_salad',
    name: '田园沙拉',
    baseRevenue: 70,
    emoji: '🥗',
    category: 'Salad'
  },
  dish_ramen: {
    dishId: 'dish_ramen',
    name: '豚骨拉面',
    baseRevenue: 90,
    emoji: '🍜',
    category: 'Ramen'
  }
};

export function getAuthoritativeDish(dishId: string): DishOrderDefinition | undefined {
  return GOLD_SAMPLE_DISH_CATALOG[dishId];
}

export function getAllAuthoritativeDishIds(): string[] {
  return Object.keys(GOLD_SAMPLE_DISH_CATALOG);
}
