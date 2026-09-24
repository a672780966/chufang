import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  GameSession,
  DEFAULT_DAYS,
  DEFAULT_INGREDIENTS,
  DEFAULT_RECIPES
} from '../src/index.js';

describe('End-to-End Playthrough & Cocos Event Contract Lifecycle', () => {
  it('should emit all required UI events from Day start to goal completion', () => {
    const dayConfig = { ...DEFAULT_DAYS[0], businessGoal: 100 }; // Lower goal for fast completion
    const session = new GameSession(dayConfig, 99999);

    const emittedEvents: string[] = [];
    const eventCounts: Record<string, number> = {};

    const track = (eventName: string) => {
      emittedEvents.push(eventName);
      eventCounts[eventName] = (eventCounts[eventName] || 0) + 1;
    };

    session.events.on('TARGET_SPAWNED', () => track('TARGET_SPAWNED'));
    session.events.on('PIECE_SPAWNED', () => track('PIECE_SPAWNED'));
    session.events.on('PIECE_PLACED', () => track('PIECE_PLACED'));
    session.events.on('INGREDIENT_PROGRESS', () => track('INGREDIENT_PROGRESS'));
    session.events.on('INGREDIENT_COMPLETED', () => track('INGREDIENT_COMPLETED'));
    session.events.on('INGREDIENT_REMOVED', () => track('INGREDIENT_REMOVED'));
    session.events.on('ORDER_CREATED', () => track('ORDER_CREATED'));
    session.events.on('ORDER_PROGRESS', () => track('ORDER_PROGRESS'));
    session.events.on('ORDER_COMPLETED', () => track('ORDER_COMPLETED'));
    session.events.on('BOARD_SETTLED', () => track('BOARD_SETTLED'));
    session.events.on('DAY_CLEARED', () => track('DAY_CLEARED'));

    // 1. Initial state validation
    const initialTargets = session.grid.getAllTargets();
    const initialPieces = session.grid.getAllLoosePieces();
    assert.ok(initialTargets.length > 0, 'Must have initial targets on board');
    assert.ok(initialPieces.length > 0, 'Must have initial loose pieces on board');
    assert.ok(session.orderSystem.currentOrder !== null, 'Must have active initial order');

    // 2. Play intelligently until day cleared or limit reached
    let maxSteps = 100;
    while (!session.getState().isGameOver && maxSteps > 0) {
      maxSteps--;
      const targets = session.grid.getAllTargets();
      const loose = session.grid.getAllLoosePieces();

      let placed = false;
      for (const piece of loose) {
        const target = targets.find(t => t.instanceId === piece.targetInstanceId && t.missingSlotIds.includes(piece.slotId));
        if (target) {
          const res = session.placePiece(piece.instanceId, target.instanceId, piece.slotId);
          if (res.success) {
            placed = true;
            break;
          }
        }
      }

      if (!placed) break;
    }

    // Verify key lifecycle milestones were reached and communicated to UI
    assert.ok(eventCounts['PIECE_PLACED'] > 0, 'PIECE_PLACED must have occurred');
    assert.ok(eventCounts['INGREDIENT_PROGRESS'] > 0, 'INGREDIENT_PROGRESS must have occurred');
    assert.ok(eventCounts['INGREDIENT_COMPLETED'] > 0, 'INGREDIENT_COMPLETED must have occurred');
    assert.ok(eventCounts['INGREDIENT_REMOVED'] > 0, 'INGREDIENT_REMOVED must have occurred');
    assert.ok(eventCounts['BOARD_SETTLED'] > 0, 'BOARD_SETTLED must have occurred');
    assert.ok(eventCounts['ORDER_PROGRESS'] > 0, 'ORDER_PROGRESS must have occurred');
    assert.ok(eventCounts['ORDER_COMPLETED'] > 0, 'ORDER_COMPLETED must have occurred');
    assert.ok(eventCounts['DAY_CLEARED'] > 0, 'DAY_CLEARED must have occurred');

    assert.strictEqual(session.getState().isGoalReached, true, 'Goal must be reached');
  });
});
