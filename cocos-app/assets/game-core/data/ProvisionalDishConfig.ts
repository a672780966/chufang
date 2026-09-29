/**
 * ProvisionalDishConfig.ts
 * PROVISIONAL day configurations for DishPuzzle mode across Day 1 to Day 12.
 * In Stage 5B, this delegates directly to DISH_CAMPAIGN_CANDIDATE_V1 and getDishCampaignDayConfig
 * to ensure a Single Source of Truth for the DishPuzzle Campaign.
 */

import { DishPuzzleDayConfig } from '../model/Types';
import { DISH_CAMPAIGN_CANDIDATE_V1, getDishCampaignDayConfig } from './DishCampaignConfig';

export const PROVISIONAL_DISH_PUZZLE_DAYS: DishPuzzleDayConfig[] = DISH_CAMPAIGN_CANDIDATE_V1;

export function getProvisionalDishConfig(dayNumber: number): DishPuzzleDayConfig {
  return getDishCampaignDayConfig(dayNumber);
}
