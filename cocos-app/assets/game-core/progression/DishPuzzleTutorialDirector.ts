/**
 * DishPuzzleTutorialDirector.ts
 * Stage 5B Campaign Tutorial Director for DishPuzzle / Jigsaw Drop.
 * Replaces legacy Ingredient-target cues with lightweight Piece-to-Piece and unlock cues:
 *   1. Day 1: First Piece-to-Piece Drag cue
 *   2. First Dish Complete: Complete image & clear feedback cue
 *   3. Day 7: NEXT Order preview unlock cue
 */

import { GameSession } from '../session/GameSession';
import { CampaignState, GridCoord } from '../model/Types';
import { SaveSystem } from './SaveSystem';

export interface DishPieceDragTutorialCue {
  pieceInstanceId: string;
  groupId: string;
  dishId: string;
  fromCoord: GridCoord;
  toCoord: GridCoord;
  targetPieceId?: string;
  label?: string;
}

export class DishPuzzleTutorialDirector {
  /**
   * Day 1: Identifies the first Piece-to-Piece drag opportunity.
   * On Day 1 guided layout, piece at (4,2) can be moved to (2,0) to merge with the Salad base group.
   */
  static getDay1FirstDragCue(session: GameSession, state: CampaignState): DishPieceDragTutorialCue | null {
    if (session.dayConfig.dayNumber !== 1 || state.tutorialFlags['dish_first_drag_shown']) {
      return null;
    }

    const mgr = session.dishPuzzleManager;
    const pieces = mgr.getAllPieces().filter(p => p.dishId === 'dish_salad');
    const baseGroup = mgr.getAllGroups().find(g => g.dishId === 'dish_salad' && g.pieceIds.length >= 2);
    if (!baseGroup) return null;

    // Find the standalone salad piece at slot (2,0) that can snap into board (2,0)
    for (const p of pieces) {
      if (baseGroup.pieceIds.includes(p.pieceInstanceId)) continue;
      if (p.dishCol === 2 && p.dishRow === 0) {
        return {
          pieceInstanceId: p.pieceInstanceId,
          groupId: p.groupId,
          dishId: p.dishId,
          fromCoord: { ...p.boardCoord },
          toCoord: { col: 2, row: 0 },
          label: '拖动碎片完成拼接'
        };
      }
    }

    return null;
  }

  /**
   * Dismisses the Day 1 first drag tutorial cue permanently.
   */
  static dismissDay1FirstDragCue(): void {
    SaveSystem.setTutorialFlag('dish_first_drag_shown');
  }

  /**
   * Checks whether to trigger the "First Dish Complete" feedback presentation.
   */
  static shouldShowFirstDishCompleteCue(state: CampaignState): boolean {
    if (!state.tutorialFlags['first_dish_complete_shown']) {
      SaveSystem.setTutorialFlag('first_dish_complete_shown');
      return true;
    }
    return false;
  }

  /**
   * Checks whether to trigger the Day 7 NEXT Order preview unlock notification.
   */
  static shouldShowNextOrderUnlockCue(dayNumber: number, state: CampaignState, unlockDay: number = 7): boolean {
    if (dayNumber >= unlockDay && !state.tutorialFlags['next_order_unlock_shown']) {
      SaveSystem.setTutorialFlag('next_order_unlock_shown');
      return true;
    }
    return false;
  }
}
