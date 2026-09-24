import { GameSession } from '../session/GameSession';
import { CampaignState, GridCoord } from '../model/Types';
import { SaveSystem } from './SaveSystem';

export interface DragTutorialCue {
  pieceInstanceId: string;
  targetInstanceId: string;
  slotId: string;
  fromCoord: GridCoord;
  toCoord: GridCoord;
}

export class TutorialDirector {
  /**
   * Checks if the Day 1 first drag tutorial hint should be shown.
   * If yes, identifies a legal piece and its matching slot on the board.
   */
  static getFirstDragCue(session: GameSession, state: CampaignState): DragTutorialCue | null {
    // Only show on Day 1 and only if not dismissed yet
    if (session.dayConfig.dayNumber !== 1 || state.tutorialFlags['drag_hint_shown']) {
      return null;
    }

    const loosePieces = session.grid.getAllLoosePieces();
    const targets = session.grid.getAllTargets();

    for (const piece of loosePieces) {
      const target = targets.find(t => t.instanceId === piece.targetInstanceId);
      if (target && target.missingSlotIds.includes(piece.slotId)) {
        // Calculate destination coord of the slot in board grid space
        const def = session.ingredients[target.ingredientId];
        const slot = def?.slots.find(s => s.slotId === piece.slotId);
        if (slot) {
          const destCoord: GridCoord = {
            col: target.anchor.col + slot.relativeCol,
            row: target.anchor.row + slot.relativeRow
          };
          return {
            pieceInstanceId: piece.instanceId,
            targetInstanceId: target.instanceId,
            slotId: piece.slotId,
            fromCoord: piece.coord,
            toCoord: destCoord
          };
        }
      }
    }
    return null;
  }

  /**
   * Dismisses the first drag cue permanently.
   */
  static dismissFirstDragCue(): void {
    SaveSystem.setTutorialFlag('drag_hint_shown');
  }

  /**
   * Checks whether the receipt should pulse with a subtle glow on first ingredient completion.
   */
  static shouldShowFirstCompleteGlow(state: CampaignState): boolean {
    if (!state.tutorialFlags['first_complete_glow_shown']) {
      SaveSystem.setTutorialFlag('first_complete_glow_shown');
      return true;
    }
    return false;
  }

  /**
   * Checks whether to display the subtle "下一单" pulse on Day 7 when next order preview unlocks.
   */
  static shouldShowNextOrderUnlockCue(dayNumber: number, state: CampaignState): boolean {
    if (dayNumber >= 7 && !state.tutorialFlags['next_order_unlock_shown']) {
      SaveSystem.setTutorialFlag('next_order_unlock_shown');
      return true;
    }
    return false;
  }
}
