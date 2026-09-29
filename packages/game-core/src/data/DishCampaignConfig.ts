/**
 * DishCampaignConfig.ts
 * Stage 5B Candidate Campaign Progression V1.
 * Authoritative 12-day curriculum for DishPuzzle / Jigsaw Drop.
 *
 * Each day defines an explicit learning goal, tailored board parameters,
 * and pedagogical weighting without inheriting legacy Ingredient numbers.
 */

import { DishPuzzleDayConfig } from '../model/Types';
import { InitialLayoutPresetType } from '../puzzle/InitialLayoutPreset';

export interface DishCampaignDayConfig extends DishPuzzleDayConfig {
  learningGoal: string;
  initialLayoutPreset?: InitialLayoutPresetType;
  orderSequencePreset?: string[];
}

export const DISH_CAMPAIGN_CANDIDATE_V1: DishCampaignDayConfig[] = [
  // Day 1: 极简上手 (学会拼合)
  {
    dayNumber: 1,
    learningGoal: '极简上手：理解碎片互相拼接与基础消除',
    activeDishIds: ['dish_salad', 'dish_breakfast', 'dish_ramen'],
    orderWeights: { dish_salad: 10, dish_breakfast: 0, dish_ramen: 0 },
    businessGoal: 200, // 3 Salads (70 + 70 + 70 = 210 >= 200)
    initialPieceCount: 17,
    comfortablePieceCount: 18,
    maxPieceCount: 24,
    supplyPerAction: 1,
    completionRefillCount: 2,
    currentOrderWeight: 80,
    nearCompleteWeight: 25,
    starvationWeight: 15,
    dangerThreshold: 0.70,
    nextOrderPreviewDay: 7,
    initialLayoutPreset: 'DAY1_GUIDED',
    useDay1GoldSample: true
  },

  // Day 2: 理解“不同图片” (分类意识)
  {
    dayNumber: 2,
    learningGoal: '理解不同图片：开始识别多图混杂并产生分类意识',
    activeDishIds: ['dish_salad', 'dish_breakfast', 'dish_ramen'],
    orderWeights: { dish_salad: 6, dish_breakfast: 4, dish_ramen: 0 },
    businessGoal: 250, // 3 dishes (Salad 70, Breakfast 85)
    initialPieceCount: 14,
    comfortablePieceCount: 16,
    maxPieceCount: 24,
    supplyPerAction: 1,
    completionRefillCount: 2,
    currentOrderWeight: 60,
    nearCompleteWeight: 25,
    starvationWeight: 20,
    dangerThreshold: 0.68,
    nextOrderPreviewDay: 7,
    initialLayoutPreset: 'DAY2_CLASSIFICATION'
  },

  // Day 3: 理解营业目标 (完成不是唯一目标，营业额累加)
  {
    dayNumber: 3,
    learningGoal: '理解营业目标：三图均入单，体验完整出餐与营业额累加',
    activeDishIds: ['dish_salad', 'dish_breakfast', 'dish_ramen'],
    orderWeights: { dish_salad: 4, dish_breakfast: 3, dish_ramen: 3 },
    businessGoal: 320, // 4 dishes (~80 avg)
    initialPieceCount: 12,
    comfortablePieceCount: 16,
    maxPieceCount: 24,
    supplyPerAction: 1,
    completionRefillCount: 2,
    currentOrderWeight: 50,
    nearCompleteWeight: 25,
    starvationWeight: 25,
    dangerThreshold: 0.68,
    nextOrderPreviewDay: 7,
    initialLayoutPreset: 'DEFAULT_PROCEDURAL'
  },

  // Day 4: 多图切换 (Switch Frequency)
  {
    dayNumber: 4,
    learningGoal: '多图切换：在多图缺件时主动放下当前图，整理其他可行料理',
    activeDishIds: ['dish_salad', 'dish_breakfast', 'dish_ramen'],
    orderWeights: { dish_salad: 4, dish_breakfast: 4, dish_ramen: 4 },
    businessGoal: 400, // 5 dishes
    initialPieceCount: 13,
    comfortablePieceCount: 15,
    maxPieceCount: 24,
    supplyPerAction: 1,
    completionRefillCount: 2,
    currentOrderWeight: 40,
    nearCompleteWeight: 35,
    starvationWeight: 25,
    dangerThreshold: 0.65,
    nextOrderPreviewDay: 7,
    initialLayoutPreset: 'DEFAULT_PROCEDURAL'
  },

  // Day 5: 第一次真正的空间压力 (空间挤压与大面积清格爽点)
  {
    dayNumber: 5,
    learningGoal: '空间压力与腾挪：棋盘紧凑，第一次体验大面积消除带来的空间释放爽点',
    activeDishIds: ['dish_salad', 'dish_breakfast', 'dish_ramen'],
    orderWeights: { dish_salad: 4, dish_breakfast: 4, dish_ramen: 4 },
    businessGoal: 480, // 6 dishes
    initialPieceCount: 16,
    comfortablePieceCount: 14,
    maxPieceCount: 22,
    supplyPerAction: 1,
    completionRefillCount: 1,
    currentOrderWeight: 45,
    nearCompleteWeight: 35,
    starvationWeight: 20,
    dangerThreshold: 0.60,
    nextOrderPreviewDay: 7,
    initialLayoutPreset: 'DEFAULT_PROCEDURAL'
  },

  // Day 6: 当前订单优先级 (空间容易度 vs 订单收益权衡)
  {
    dayNumber: 6,
    learningGoal: '订单优先级：权衡当前最值钱订单与棋盘易拼度之间的供给选择',
    activeDishIds: ['dish_salad', 'dish_breakfast', 'dish_ramen'],
    orderWeights: { dish_salad: 3, dish_breakfast: 4, dish_ramen: 5 },
    businessGoal: 560, // 7 dishes
    initialPieceCount: 14,
    comfortablePieceCount: 15,
    maxPieceCount: 24,
    supplyPerAction: 1,
    completionRefillCount: 2,
    currentOrderWeight: 65,
    nearCompleteWeight: 25,
    starvationWeight: 20,
    dangerThreshold: 0.62,
    nextOrderPreviewDay: 7,
    initialLayoutPreset: 'DEFAULT_PROCEDURAL'
  },

  // Day 7: 下一单预告 (NEXT Order 解锁)
  {
    dayNumber: 7,
    learningGoal: '下一单解锁：首次获得 NEXT 小票预告，信息前瞻',
    activeDishIds: ['dish_salad', 'dish_breakfast', 'dish_ramen'],
    orderWeights: { dish_salad: 4, dish_breakfast: 4, dish_ramen: 4 },
    businessGoal: 640, // 8 dishes
    initialPieceCount: 14,
    comfortablePieceCount: 15,
    maxPieceCount: 24,
    supplyPerAction: 1,
    completionRefillCount: 2,
    currentOrderWeight: 50,
    nearCompleteWeight: 30,
    starvationWeight: 20,
    dangerThreshold: 0.62,
    nextOrderPreviewDay: 7,
    initialLayoutPreset: 'DEFAULT_PROCEDURAL'
  },

  // Day 8: 提前备餐 (自然利用 Prepared Dish Buffer)
  {
    dayNumber: 8,
    learningGoal: '提前备餐：利用保温台暂存即将到来的 NEXT 订单料理',
    activeDishIds: ['dish_salad', 'dish_breakfast', 'dish_ramen'],
    orderWeights: { dish_salad: 4, dish_breakfast: 4, dish_ramen: 4 },
    businessGoal: 720, // 9 dishes
    initialPieceCount: 14,
    comfortablePieceCount: 15,
    maxPieceCount: 24,
    supplyPerAction: 1,
    completionRefillCount: 2,
    currentOrderWeight: 40,
    nearCompleteWeight: 45,
    starvationWeight: 20,
    dangerThreshold: 0.62,
    nextOrderPreviewDay: 7,
    initialLayoutPreset: 'DEFAULT_PROCEDURAL'
  },

  // Day 9: Production Cascade (连续出餐连锁奖励)
  {
    dayNumber: 9,
    learningGoal: '连锁出餐：主动制造保温台出餐连击（Cascade ×1.1 / ×1.2 / ×1.3）',
    activeDishIds: ['dish_salad', 'dish_breakfast', 'dish_ramen'],
    orderWeights: { dish_salad: 5, dish_breakfast: 5, dish_ramen: 5 },
    businessGoal: 800, // 10 dishes
    initialPieceCount: 14,
    comfortablePieceCount: 16,
    maxPieceCount: 24,
    supplyPerAction: 1,
    completionRefillCount: 3,
    currentOrderWeight: 35,
    nearCompleteWeight: 50,
    starvationWeight: 20,
    dangerThreshold: 0.65,
    nextOrderPreviewDay: 7,
    initialLayoutPreset: 'DEFAULT_PROCEDURAL'
  },

  // Day 10: 综合压力 (多决策并行)
  {
    dayNumber: 10,
    learningGoal: '多决策压力：三图混杂、空间占用、NEXT预判与保温台调度的综合决策',
    activeDishIds: ['dish_salad', 'dish_breakfast', 'dish_ramen'],
    orderWeights: { dish_salad: 4, dish_breakfast: 4, dish_ramen: 4 },
    businessGoal: 880,
    initialPieceCount: 15,
    comfortablePieceCount: 14,
    maxPieceCount: 22,
    supplyPerAction: 1,
    completionRefillCount: 2,
    currentOrderWeight: 45,
    nearCompleteWeight: 35,
    starvationWeight: 25,
    dangerThreshold: 0.60,
    nextOrderPreviewDay: 7,
    initialLayoutPreset: 'DEFAULT_PROCEDURAL'
  },

  // Day 11: 高压营业日 (低容错，高频 Danger & Recovery)
  {
    dayNumber: 11,
    learningGoal: '高压营业日：低空间容错，频繁进入与解除 Danger 警报的高手挑战',
    activeDishIds: ['dish_salad', 'dish_breakfast', 'dish_ramen'],
    orderWeights: { dish_salad: 4, dish_breakfast: 4, dish_ramen: 4 },
    businessGoal: 960,
    initialPieceCount: 16,
    comfortablePieceCount: 13,
    maxPieceCount: 21,
    supplyPerAction: 1,
    completionRefillCount: 2,
    currentOrderWeight: 45,
    nearCompleteWeight: 35,
    starvationWeight: 25,
    dangerThreshold: 0.58,
    nextOrderPreviewDay: 7,
    initialLayoutPreset: 'DEFAULT_PROCEDURAL'
  },

  // Day 12: 综合考试 (大师掌握)
  {
    dayNumber: 12,
    learningGoal: '综合考试：融汇全部 11 天核心技巧（整理/切换/NEXT/保温台/Cascade/脱险）',
    activeDishIds: ['dish_salad', 'dish_breakfast', 'dish_ramen'],
    orderWeights: { dish_salad: 4, dish_breakfast: 4, dish_ramen: 4 },
    businessGoal: 1040,
    initialPieceCount: 15,
    comfortablePieceCount: 14,
    maxPieceCount: 22,
    supplyPerAction: 1,
    completionRefillCount: 2,
    currentOrderWeight: 40,
    nearCompleteWeight: 40,
    starvationWeight: 25,
    dangerThreshold: 0.60,
    nextOrderPreviewDay: 7,
    initialLayoutPreset: 'DEFAULT_PROCEDURAL'
  }
];

export function getDishCampaignDayConfig(dayNumber: number): DishCampaignDayConfig {
  const cfg = DISH_CAMPAIGN_CANDIDATE_V1.find(d => d.dayNumber === dayNumber);
  if (!cfg) {
    throw new Error(`[DishCampaignConfig] No config found for dayNumber: ${dayNumber}`);
  }
  return { ...cfg };
}
