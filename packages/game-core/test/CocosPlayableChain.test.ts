import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  GameSession,
  DEFAULT_DAYS,
  DEFAULT_INGREDIENTS,
  DEFAULT_RECIPES
} from '../src/index.js';

describe('Cocos Presentation Playable Chain: Drag -> Place -> Complete -> Refill -> Order Complete', () => {
  it('should execute the full playable interaction chain with valid UI state transitions', () => {
    const session = new GameSession(DEFAULT_DAYS[0], 'cocos_playable_chain_seed');

    // Simulate Cocos View UI states
    const boardViewState = {
      targets: new Map<string, { anchor: any; slotsPlaced: string[]; missing: string[] }>(),
      pieces: new Map<string, { coord: any; targetId: string; slotId: string }>(),
      settleCount: 0
    };

    const receiptPrinterState = {
      currentDishName: '',
      revenueText: '',
      itemsCompleted: 0,
      totalItemsNeeded: 0,
      nextOrderTitle: '',
      cascadeBannerVisible: false,
      ordersCompletedCount: 0
    };

    // Bind event handlers identically to Cocos GameManager
    session.events.on('TARGET_SPAWNED', (p) => {
      boardViewState.targets.set(p.target.instanceId, {
        anchor: { ...p.target.anchor },
        slotsPlaced: [...p.target.placedSlotIds],
        missing: [...p.target.missingSlotIds]
      });
    });

    session.events.on('PIECE_SPAWNED', (p) => {
      boardViewState.pieces.set(p.piece.instanceId, {
        coord: { ...p.toCoord },
        targetId: p.piece.targetInstanceId,
        slotId: p.piece.slotId
      });
    });

    session.events.on('PIECE_PLACED', (p) => {
      boardViewState.pieces.delete(p.pieceInstanceId);
      const t = boardViewState.targets.get(p.targetInstanceId);
      if (t) {
        t.slotsPlaced.push(p.slotId);
        t.missing = t.missing.filter(s => s !== p.slotId);
      }
    });

    session.events.on('INGREDIENT_COMPLETED', (p) => {
      boardViewState.targets.delete(p.target.instanceId);
    });

    session.events.on('BOARD_SETTLED', (p) => {
      boardViewState.settleCount++;
      for (const t of p.movedTargets) {
        const item = boardViewState.targets.get(t.instanceId);
        if (item) item.anchor = { ...t.toAnchor };
      }
      for (const piece of p.movedPieces) {
        const item = boardViewState.pieces.get(piece.instanceId);
        if (item) item.coord = { ...piece.toCoord };
      }
    });

    session.events.on('ORDER_CREATED', (p) => {
      receiptPrinterState.currentDishName = p.order.dishName;
      receiptPrinterState.revenueText = `+¥${p.order.baseRevenue}`;
      receiptPrinterState.totalItemsNeeded = p.order.items.reduce((sum, i) => sum + i.needed, 0);
      receiptPrinterState.itemsCompleted = 0;
      const preview = session.orderSystem.getNextOrderPreview();
      receiptPrinterState.nextOrderTitle = preview?.dishName || '';
    });

    session.events.on('ORDER_PROGRESS', (p) => {
      receiptPrinterState.itemsCompleted = p.order.items.reduce((sum, i) => sum + i.reserved, 0);
    });

    session.events.on('ORDER_COMPLETED', (p) => {
      receiptPrinterState.ordersCompletedCount++;
    });

    session.events.on('CASCADE_STEP', (p) => {
      receiptPrinterState.cascadeBannerVisible = true;
    });

    // Populate initial state
    for (const t of session.grid.getAllTargets()) {
      boardViewState.targets.set(t.instanceId, {
        anchor: { ...t.anchor },
        slotsPlaced: [...t.placedSlotIds],
        missing: [...t.missingSlotIds]
      });
    }
    for (const p of session.grid.getAllLoosePieces()) {
      boardViewState.pieces.set(p.instanceId, {
        coord: { ...p.coord },
        targetId: p.targetInstanceId,
        slotId: p.slotId
      });
    }
    const initialOrder = session.orderSystem.currentOrder;
    assert.ok(initialOrder, 'Initial order must be active');
    receiptPrinterState.currentDishName = initialOrder.dishName;
    receiptPrinterState.revenueText = `+¥${initialOrder.baseRevenue}`;
    receiptPrinterState.totalItemsNeeded = initialOrder.items.reduce((sum, i) => sum + i.needed, 0);

    // Verify initial synchronization
    assert.strictEqual(boardViewState.targets.size, session.dayConfig.targetIngredientCount);
    assert.ok(boardViewState.pieces.size >= session.dayConfig.loosePieceComfortMin);
    assert.ok(receiptPrinterState.currentDishName.length > 0);

    // Simulate Touch Drag & Drop: find a matching piece and drag it to the target slot
    let piecesPlacedCount = 0;
    let ingredientCompletedCount = 0;

    let safetyLimit = 50;
    while (!session.isGameOver && safetyLimit-- > 0) {
      const activeTargets = session.grid.getAllTargets();
      const activePieces = session.grid.getAllLoosePieces();

      let moved = false;
      for (const piece of activePieces) {
        const target = activeTargets.find(t => t.instanceId === piece.targetInstanceId);
        if (target && target.missingSlotIds.includes(piece.slotId)) {
          // Touch drag simulation:
          // 1. Piece is at piece.coord
          // 2. Dragged to target anchor + slot relative position
          // 3. Drop action
          const res = session.placePiece(piece.instanceId, target.instanceId, piece.slotId);
          assert.strictEqual(res.success, true, 'Touch drop placement must succeed');
          piecesPlacedCount++;
          moved = true;
          break;
        }
      }

      if (receiptPrinterState.ordersCompletedCount >= 1) {
        break; // Successfully fulfilled at least 1 full order!
      }

      if (!moved) break;
    }

    assert.ok(piecesPlacedCount > 0, 'Must have placed at least 1 piece');
    assert.ok(receiptPrinterState.ordersCompletedCount >= 1, 'Must have fulfilled at least 1 order via playable chain');
    assert.ok(boardViewState.targets.size > 0, 'New targets must have replenished after completion');
    assert.ok(boardViewState.pieces.size > 0, 'New pieces must have replenished after completion');
  });
});
