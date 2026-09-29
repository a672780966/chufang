/**
 * InitialLayoutPreset.ts
 * Stage 5B Campaign Initial Layout Presets.
 * Replaces hardcoded Day 1 Gold Sample layout with configurable, extensible presets.
 */

import { DishPuzzleManager } from './DishPuzzleManager';
import { DishPuzzlePiece } from './DishPuzzleModel';
import { SeededRandom } from '../random/SeededRandom';

export type InitialLayoutPresetType = 'DAY1_GUIDED' | 'DAY2_CLASSIFICATION' | 'DEFAULT_PROCEDURAL';

export class InitialLayoutPresets {
  /**
   * Applies the selected layout preset to the DishPuzzleManager.
   */
  static apply(
    manager: DishPuzzleManager,
    preset: InitialLayoutPresetType,
    seed: string | number = 'preset_seed'
  ): DishPuzzlePiece[] {
    switch (preset) {
      case 'DAY1_GUIDED':
        return this.applyDay1Guided(manager);
      case 'DAY2_CLASSIFICATION':
        return this.applyDay2Classification(manager, seed);
      case 'DEFAULT_PROCEDURAL':
      default:
        return this.applyProcedural(manager, seed);
    }
  }

  /**
   * Day 1 Guided: Gold Sample layout with 17 pieces.
   * Salad primary with visible 4-piece base group and clear merge paths.
   */
  private static applyDay1Guided(manager: DishPuzzleManager): DishPuzzlePiece[] {
    manager.initDay1Layout();
    return manager.getAllPieces();
  }

  /**
   * Day 2 Classification: Two distinct 2-piece starter groups for Salad and Breakfast,
   * plus scattered pieces to teach players that board pieces belong to different dishes.
   */
  private static applyDay2Classification(manager: DishPuzzleManager, seed: string | number): DishPuzzlePiece[] {
    manager.clearBoard();
    const instSalad = manager.createDishInstance('dish_salad');
    const instBreakfast = manager.createDishInstance('dish_breakfast');
    const instRamen = manager.createDishInstance('dish_ramen');

    // 1. Salad 2-piece horizontal base at (0..1, 0)
    const s00 = manager.createPiece(instSalad.instanceId, 'dish_salad', 0, 0, { col: 0, row: 0 });
    const s10 = manager.createPiece(instSalad.instanceId, 'dish_salad', 1, 0, { col: 1, row: 0 });
    manager.createGroup([s00, s10]);

    // 2. Breakfast 2-piece horizontal base at (0..1, 2)
    const b00 = manager.createPiece(instBreakfast.instanceId, 'dish_breakfast', 0, 0, { col: 0, row: 2 });
    const b10 = manager.createPiece(instBreakfast.instanceId, 'dish_breakfast', 1, 0, { col: 1, row: 2 });
    manager.createGroup([b00, b10]);

    // 3. Scatter matching pieces across columns 3..7
    // Salad pieces
    manager.localSettlePiece(instSalad, 0, 1, 3);
    manager.localSettlePiece(instSalad, 1, 1, 4);
    manager.localSettlePiece(instSalad, 2, 0, 5);
    manager.localSettlePiece(instSalad, 2, 1, 6);

    // Breakfast pieces
    manager.localSettlePiece(instBreakfast, 0, 1, 3);
    manager.localSettlePiece(instBreakfast, 1, 1, 4);
    manager.localSettlePiece(instBreakfast, 2, 0, 5);

    // Ramen pieces (background non-order dish)
    manager.localSettlePiece(instRamen, 0, 0, 6);
    manager.localSettlePiece(instRamen, 1, 0, 7);
    manager.localSettlePiece(instRamen, 0, 1, 7);

    return manager.getAllPieces();
  }

  /**
   * Procedural: seeded procedural distribution across active dishes.
   */
  private static applyProcedural(manager: DishPuzzleManager, seed: string | number): DishPuzzlePiece[] {
    const runtimeConfig = manager.getRuntimeConfig();
    if (runtimeConfig) {
      manager.initializeDishPuzzleSession(runtimeConfig, seed);
    }
    return manager.getAllPieces();
  }
}
