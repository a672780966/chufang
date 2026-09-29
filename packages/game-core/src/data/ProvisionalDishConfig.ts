/**
 * ProvisionalDishConfig.ts
 * PROVISIONAL day configurations for DishPuzzle mode across Day 1 to Day 12.
 * NOTE: These values are strictly provisional for engineering verification and gameplay authority closure,
 * NOT frozen or final balance numbers.
 */

import { DishPuzzleDayConfig } from '../model/Types';

export const PROVISIONAL_DISH_PUZZLE_DAYS: DishPuzzleDayConfig[] = [
  // Day 1: Salad primary, Breakfast/Ramen active in pool
  {
    dayNumber: 1,
    activeDishIds: ['dish_salad', 'dish_breakfast', 'dish_ramen'],
    businessGoal: 200,
    orderWeights: {
      dish_salad: 10,
      dish_breakfast: 0,
      dish_ramen: 0
    },
    initialPieceCount: 15,
    comfortablePieceCount: 16,
    maxPieceCount: 24,
    supplyPerAction: 1,
    currentOrderWeight: 60,
    nearCompleteWeight: 25,
    starvationWeight: 15,
    dangerThreshold: 0.65,
    nextOrderPreviewDay: 7,
    useDay1GoldSample: true
  },
  // Day 2: Salad + Breakfast
  {
    dayNumber: 2,
    activeDishIds: ['dish_salad', 'dish_breakfast', 'dish_ramen'],
    businessGoal: 250,
    orderWeights: {
      dish_salad: 6,
      dish_breakfast: 4,
      dish_ramen: 0
    },
    initialPieceCount: 14,
    comfortablePieceCount: 16,
    maxPieceCount: 24,
    supplyPerAction: 1,
    currentOrderWeight: 55,
    nearCompleteWeight: 25,
    starvationWeight: 20,
    dangerThreshold: 0.65,
    nextOrderPreviewDay: 7
  },
  // Day 3..12: Full active 3 dishes with balanced weights and rising goals
  ...Array.from({ length: 10 }, (_, i) => {
    const day = i + 3;
    return {
      dayNumber: day,
      activeDishIds: ['dish_salad', 'dish_breakfast', 'dish_ramen'],
      businessGoal: 250 + (day - 2) * 50,
      orderWeights: {
        dish_salad: 4,
        dish_breakfast: 4,
        dish_ramen: 4
      },
      initialPieceCount: 14,
      comfortablePieceCount: 16,
      maxPieceCount: 24,
      supplyPerAction: 1,
      currentOrderWeight: 50,
      nearCompleteWeight: 30,
      starvationWeight: 20,
      dangerThreshold: 0.65,
      nextOrderPreviewDay: 7
    };
  })
];

export function getProvisionalDishConfig(dayNumber: number): DishPuzzleDayConfig {
  const cfg = PROVISIONAL_DISH_PUZZLE_DAYS.find(d => d.dayNumber === dayNumber);
  return cfg || PROVISIONAL_DISH_PUZZLE_DAYS[0];
}
