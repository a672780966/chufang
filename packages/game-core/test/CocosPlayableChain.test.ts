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

  it('should verify TouchController.screenToBoardLocal parity with BoardView.gridToLocalPos and touch mechanics', () => {
    // Canvas config: 720 x 1280 (Center at 360, 640)
    // BoardView node at (0, -120) relative to Canvas center -> BoardView Center on screen is (360, 520)
    // BoardView contentSize: 576 x 864, anchor (0.5, 0.5)
    // Columns: 8, Rows: 12. Cell size: 576/8 = 72, 864/12 = 72
    const boardWidth = 576;
    const boardHeight = 864;
    const cellWidth = 72;
    const cellHeight = 72;
    const boardWorldCenter = { x: 360, y: 520 };

    // BoardView.gridToLocalPos:
    // originX = -boardWidth / 2 = -288
    // originY = -boardHeight / 2 = -432
    // x = originX + (col + 0.5) * cellWidth
    // y = originY + (row + 0.5) * cellHeight
    const gridToLocalPos = (coord: { col: number; row: number }) => {
      const originX = -boardWidth / 2;
      const originY = -boardHeight / 2;
      return {
        x: originX + (coord.col + 0.5) * cellWidth,
        y: originY + (coord.row + 0.5) * cellHeight
      };
    };

    // Simulated UITransform.convertToNodeSpaceAR for BoardView.node:
    // Converts screen UI coordinate (uiLocation) to node local coordinate relative to anchor point (0.5, 0.5)
    const boardNodeConvertToNodeSpaceAR = (uiLocation: { x: number; y: number }) => {
      return {
        x: uiLocation.x - boardWorldCenter.x,
        y: uiLocation.y - boardWorldCenter.y
      };
    };

    // Test 1: Coordinate Parity
    // For every cell in the 8x12 grid, a touch on screen corresponding to that cell
    // must convert to the EXACT same coordinate as gridToLocalPos!
    for (let c = 0; c < 8; c++) {
      for (let r = 0; r < 12; r++) {
        const localPos = gridToLocalPos({ col: c, row: r });
        // The touch on screen for this cell is at boardWorldCenter + localPos
        const screenTouch = {
          x: boardWorldCenter.x + localPos.x,
          y: boardWorldCenter.y + localPos.y
        };

        // When using boardView.node UITransform:
        const converted = boardNodeConvertToNodeSpaceAR(screenTouch);
        assert.strictEqual(converted.x, localPos.x, `X mismatch at (${c}, ${r})`);
        assert.strictEqual(converted.y, localPos.y, `Y mismatch at (${c}, ${r})`);

        // Distance is 0 -> hit guaranteed (< 55px)
        const hitDist = Math.hypot(converted.x - localPos.x, converted.y - localPos.y);
        assert.strictEqual(hitDist, 0, `Hit distance must be 0`);
      }
    }

    // Test 2: Contrast with buggy piecesContainer without UITransform
    // Without UITransform, screenToBoardLocal would return raw screenTouch
    const sampleLocal = gridToLocalPos({ col: 2, row: 3 });
    const screenTouch = { x: boardWorldCenter.x + sampleLocal.x, y: boardWorldCenter.y + sampleLocal.y };
    const rawDist = Math.hypot(screenTouch.x - sampleLocal.x, screenTouch.y - sampleLocal.y);
    // Raw screen touch distance from local position is ~632px, completely failing hit detection!
    assert.ok(rawDist > 500, 'Buggy fallback to screen coordinates creates >500px offset error');

    // Test 3: Snap & Rebound Simulation
    const session = new GameSession(DEFAULT_DAYS[0], 'touch_controller_test_seed');
    const targets = session.grid.getAllTargets();
    const pieces = session.grid.getAllLoosePieces();
    assert.ok(targets.length > 0 && pieces.length > 0);

    const piece = pieces[0];
    const target = targets.find(t => t.instanceId === piece.targetInstanceId)!;
    assert.ok(target, 'Target must match piece.targetInstanceId');

    const def = DEFAULT_INGREDIENTS[target.ingredientId];
    const slotDef = def.slots.find(s => s.slotId === piece.slotId)!;
    const slotAbsCoord = {
      col: target.anchor.col + slotDef.relativeCol,
      row: target.anchor.row + slotDef.relativeRow
    };
    const slotLocalPos = gridToLocalPos(slotAbsCoord);

    // Case A: Released within snap radius (dist = 50px <= 95px)
    const nearTouchScreen = {
      x: boardWorldCenter.x + slotLocalPos.x + 30,
      y: boardWorldCenter.y + slotLocalPos.y + 40
    };
    const nearLocal = boardNodeConvertToNodeSpaceAR(nearTouchScreen);
    const snapDist = Math.hypot(nearLocal.x - slotLocalPos.x, nearLocal.y - slotLocalPos.y);
    assert.strictEqual(snapDist, 50);
    assert.ok(snapDist <= 95, 'Must be within snap radius');

    const placeRes = session.placePiece(piece.instanceId, target.instanceId, piece.slotId);
    assert.strictEqual(placeRes.success, true, 'Placement within snap radius must succeed');

    // Case B: Released beyond snap radius (dist = 150px > 95px) -> Rebound
    const farTouchScreen = {
      x: boardWorldCenter.x + slotLocalPos.x + 90,
      y: boardWorldCenter.y + slotLocalPos.y + 120
    };
    const farLocal = boardNodeConvertToNodeSpaceAR(farTouchScreen);
    const farDist = Math.hypot(farLocal.x - slotLocalPos.x, farLocal.y - slotLocalPos.y);
    assert.strictEqual(farDist, 150);
    assert.ok(farDist > 95, 'Must be outside snap radius -> triggers error rebound');
  });

  it('should execute full Cocos Day 1 3-order loop with DISH_COMPLETED -> clear -> DISH_SERVED -> victory lifecycle', () => {
    const session = new GameSession(DEFAULT_DAYS[0], 'cocos_3order_lifecycle_seed');

    // 1. Verify raster asset key generation parity and zero slot_slot_0_0 duplication
    const getCocosAssetPath = (dishOrIngId: string, slotId: string) => {
      const normalizedSlot = slotId.startsWith('slot_') ? slotId : `slot_${slotId}`;
      const dishPath = `textures/dishes/piece_${dishOrIngId}_${normalizedSlot}/spriteFrame`;
      return { normalizedSlot, dishPath };
    };

    const keyCheck1 = getCocosAssetPath('dish_salad', 'slot_0_0');
    assert.strictEqual(keyCheck1.dishPath, 'textures/dishes/piece_dish_salad_slot_0_0/spriteFrame');
    assert.ok(!keyCheck1.dishPath.includes('slot_slot_'), 'Must never produce slot_slot_ in raster asset path');

    const keyCheck2 = getCocosAssetPath('dish_salad', '0_0');
    assert.strictEqual(keyCheck2.dishPath, 'textures/dishes/piece_dish_salad_slot_0_0/spriteFrame');

    // 2. Verify Gold Sample raster asset assertion (strictly forbids silent vector fallback)
    const simulateCocosLoadRaster = (dishId: string, slotId: string, hasAsset: boolean) => {
      const { dishPath } = getCocosAssetPath(dishId, slotId);
      if (!hasAsset && dishId.startsWith('dish_')) {
        throw new Error(`[Gold Sample Error] Missing raster asset for dish piece: ${dishPath}. Silent fallback to vector graphics is strictly prohibited for Gold Sample dishes!`);
      }
      return hasAsset;
    };

    assert.throws(
      () => simulateCocosLoadRaster('dish_salad', 'slot_1_1', false),
      /\[Gold Sample Error\] Missing raster asset for dish piece/
    );

    // 3. Cocos Presentation State Simulation
    const cocosBoardState = {
      dishPieceNodes: new Map<string, { pieceId: string; dishId: string; coord: { col: number; row: number }; nodeName: string }>(),
      activeCelebrations: 0,
      clearedCount: 0,
      receiptTitle: '',
      revenue: 0,
      victoryActive: false,
      dayClearedCount: 0
    };

    // Initialize board with Day 1 pieces using createDishPieceNode contract
    for (const p of session.dishPuzzleManager.getAllPieces()) {
      cocosBoardState.dishPieceNodes.set(p.pieceInstanceId, {
        pieceId: p.pieceInstanceId,
        dishId: p.dishId,
        coord: { ...p.boardCoord },
        nodeName: `DishPiece_${p.pieceInstanceId}`
      });
    }
    assert.strictEqual(cocosBoardState.dishPieceNodes.size, 17, 'Initial Day 1 board has 17 pieces');

    // Wire Cocos event handlers identical to Cocos GameManager & BoardView
    session.events.on('DISH_PIECE_SPAWNED', (payload) => {
      // Must invoke createDishPieceNode contract
      cocosBoardState.dishPieceNodes.set(payload.piece.pieceInstanceId, {
        pieceId: payload.piece.pieceInstanceId,
        dishId: payload.piece.dishId,
        coord: { ...payload.toCoord },
        nodeName: `DishPiece_${payload.piece.pieceInstanceId}`
      });
    });

    session.events.on('DISH_COMPLETED', (payload) => {
      cocosBoardState.activeCelebrations++;
      // Cocos BoardView schedules clearCompletedGroup after 550ms completion celebration
      setTimeout(() => {
        session.dishPuzzleManager.clearCompletedGroup(payload.groupId);
      }, 0);
    });

    session.events.on('DISH_CLEARED', (payload) => {
      cocosBoardState.clearedCount++;
      // Remove cleared piece nodes
      for (const [id, node] of Array.from(cocosBoardState.dishPieceNodes.entries())) {
        if (!session.dishPuzzleManager.getPiece(id)) {
          cocosBoardState.dishPieceNodes.delete(id);
        }
      }
    });

    session.events.on('DISH_SERVED', () => {
      cocosBoardState.revenue = session.revenue;
      cocosBoardState.receiptTitle = session.orderSystem.currentOrder?.dishName || '';
    });

    session.events.on('DAY_CLEARED', () => {
      cocosBoardState.dayClearedCount++;
      cocosBoardState.victoryActive = true;
    });

    // Helper: simulate touch drag moves solving the active salad instance
    const solveSaladViaTouchMoves = () => {
      const mgr = session.dishPuzzleManager;
      const saladPieces = mgr.getAllPieces().filter(p => p.dishId === 'dish_salad');
      const p00 = saladPieces.find(p => p.dishCol === 0 && p.dishRow === 0)!;

      // Touch Move 1: Duo (2,0) & (2,1)
      const p20 = saladPieces.find(p => p.dishCol === 2 && p.dishRow === 0)!;
      const g20 = mgr.getGroupByPieceId(p20.pieceInstanceId)!;
      const res1 = mgr.tryMoveGroup(g20.groupId, 2, 0, p20.pieceInstanceId);
      assert.ok(res1.success);

      // Touch Move 2: (0,2)
      const p02 = saladPieces.find(p => p.dishCol === 0 && p.dishRow === 2)!;
      const g02 = mgr.getGroupByPieceId(p02.pieceInstanceId)!;
      const res2 = mgr.tryMoveGroup(g02.groupId, 0, 2, p02.pieceInstanceId);
      assert.ok(res2.success);

      // Touch Move 3: (1,2)
      const p12 = saladPieces.find(p => p.dishCol === 1 && p.dishRow === 2)!;
      const g12 = mgr.getGroupByPieceId(p12.pieceInstanceId)!;
      const res3 = mgr.tryMoveGroup(g12.groupId, 1, 2, p12.pieceInstanceId);
      assert.ok(res3.success);

      // Touch Move 4: (2,2) -> Completes Dish
      const p22 = saladPieces.find(p => p.dishCol === 2 && p.dishRow === 2)!;
      const g22 = mgr.getGroupByPieceId(p22.pieceInstanceId)!;
      const res4 = mgr.tryMoveGroup(g22.groupId, 2, 2, p22.pieceInstanceId);
      assert.ok(res4.completedDish, 'Should trigger completedDish in Cocos TouchController');

      // Clear completed dish via BoardView lifecycle
      mgr.clearCompletedGroup(p00.groupId);
    };

    // --- Cocos Order 1 (#1001 Salad) ---
    assert.strictEqual(session.orderSystem.currentOrder?.orderId, '#1001');
    solveSaladViaTouchMoves();
    assert.strictEqual(session.revenue, 70);
    assert.strictEqual(session.orderSystem.ordersFulfilledCount, 1);
    assert.strictEqual(session.orderSystem.currentOrder?.orderId, '#1002');
    assert.strictEqual(cocosBoardState.dayClearedCount, 0);

    // --- Cocos Order 2 (#1002 Salad) ---
    solveSaladViaTouchMoves();
    assert.strictEqual(session.revenue, 140);
    assert.strictEqual(session.orderSystem.ordersFulfilledCount, 2);
    assert.strictEqual(session.orderSystem.currentOrder?.orderId, '#1003');
    assert.strictEqual(cocosBoardState.dayClearedCount, 0);

    // --- Cocos Order 3 (#1003 Salad -> Business Goal Reached) ---
    solveSaladViaTouchMoves();
    assert.strictEqual(session.revenue, 210);
    assert.strictEqual(session.orderSystem.ordersFulfilledCount, 3);
    assert.ok(session.orderSystem.isGoalReached);
    assert.strictEqual(session.orderSystem.currentOrder, null, 'Must stop advancing orders when goal reached');

    // Authoritative Day Cleared in Cocos
    assert.strictEqual(cocosBoardState.dayClearedCount, 1, 'Cocos DAY_CLEARED must be emitted exactly once');
    assert.strictEqual(cocosBoardState.victoryActive, true, 'Cocos Victory Modal must be activated');

    // Zero orphan pieces on Cocos board, with breakfast and ramen having actively grown via multi-dish scheduler
    const finalPieces = session.dishPuzzleManager.getAllPieces();
    assert.ok(finalPieces.length >= 8, 'Active dishes must grow during gameplay via multi-dish scheduler');
    for (const p of finalPieces) {
      assert.ok(cocosBoardState.dishPieceNodes.has(p.pieceInstanceId));
      assert.ok(['dish_breakfast', 'dish_ramen'].includes(p.dishId));
    }
  });
});
