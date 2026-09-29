/**
 * DishCatalog.ts
 * Authoritative Dish Catalog for Stage 5B Multi-Dish Progression.
 * Contains only authentic dishes with approved assets and manifests.
 * Dishes without assets are forbidden from being registered or ordered.
 */

export interface DishOrderDefinition {
  dishId: string;
  name: string;
  baseRevenue: number;
  emoji?: string;
  category?: string;
  visualDifficulty?: 'EASY' | 'MEDIUM' | 'HARD';
}

export const DISH_CATALOG: Record<string, DishOrderDefinition> = {
  dish_breakfast: {
    dishId: 'dish_breakfast',
    name: '春日早餐盘',
    baseRevenue: 85,
    emoji: '🍳',
    category: 'Breakfast',
    visualDifficulty: 'MEDIUM'
  },
  dish_salad: {
    dishId: 'dish_salad',
    name: '田园沙拉',
    baseRevenue: 70,
    emoji: '🥗',
    category: 'Salad',
    visualDifficulty: 'MEDIUM'
  },
  dish_ramen: {
    dishId: 'dish_ramen',
    name: '豚骨拉面',
    baseRevenue: 90,
    emoji: '🍜',
    category: 'Ramen',
    visualDifficulty: 'EASY'
  },
  dish_curry_rice: {
    dishId: 'dish_curry_rice',
    name: '金黄咖喱饭',
    baseRevenue: 80,
    emoji: '🍛',
    category: 'Curry',
    visualDifficulty: 'MEDIUM'
  },
  dish_tomato_pasta: {
    dishId: 'dish_tomato_pasta',
    name: '番茄肉酱意面',
    baseRevenue: 85,
    emoji: '🍝',
    category: 'Pasta',
    visualDifficulty: 'EASY'
  },
  dish_avocado_chicken_bowl: {
    dishId: 'dish_avocado_chicken_bowl',
    name: '牛油果鸡肉碗',
    baseRevenue: 95,
    emoji: '🥑',
    category: 'Healthy',
    visualDifficulty: 'HARD'
  },
  dish_shrimp_fried_rice: {
    dishId: 'dish_shrimp_fried_rice',
    name: '鲜虾蛋炒饭',
    baseRevenue: 75,
    emoji: '🍤',
    category: 'Rice',
    visualDifficulty: 'HARD'
  },
  dish_grilled_steak: {
    dishId: 'dish_grilled_steak',
    name: '炭烤牛排拼盘',
    baseRevenue: 110,
    emoji: '🥩',
    category: 'Steak',
    visualDifficulty: 'MEDIUM'
  }
};

/**
 * Backward compatibility alias for Stage 5A test suites and references.
 * Preserves the exact 3 Gold Sample dishes.
 */
export const GOLD_SAMPLE_DISH_CATALOG: Record<string, DishOrderDefinition> = {
  dish_breakfast: DISH_CATALOG.dish_breakfast,
  dish_salad: DISH_CATALOG.dish_salad,
  dish_ramen: DISH_CATALOG.dish_ramen
};

export function getAuthoritativeDish(dishId: string): DishOrderDefinition | undefined {
  return DISH_CATALOG[dishId];
}

export function getAllAuthoritativeDishIds(): string[] {
  return Object.keys(DISH_CATALOG);
}
