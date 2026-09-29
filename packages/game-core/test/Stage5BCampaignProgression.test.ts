import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GameFlowManager,
  SaveSystem,
  MemoryStoragePort,
  DishPuzzleTutorialDirector,
  getDishCampaignDayConfig,
  DISH_CAMPAIGN_CANDIDATE_V1,
  InitialLayoutPresets,
  GOLD_SAMPLE_DISH_CATALOG
} from '../src/index.js';

describe('Stage 5B: DishPuzzle Campaign Progression & Lifecycle Assertions', () => {
  // Test 1: Authoritative 12-day Campaign Curriculum definitions
  it('1. should define all 12 days in DISH_CAMPAIGN_CANDIDATE_V1 with explicit pedagogical parameters', () => {
    assert.strictEqual(DISH_CAMPAIGN_CANDIDATE_V1.length, 12, 'Must contain exactly 12 day configurations');

    for (let day = 1; day <= 12; day++) {
      const cfg = getDishCampaignDayConfig(day);
      assert.strictEqual(cfg.dayNumber, day);
      assert.ok(cfg.learningGoal && cfg.learningGoal.length > 0, `Day ${day} must have explicit learningGoal`);
      assert.ok(cfg.businessGoal > 0, `Day ${day} businessGoal must be > 0`);
      assert.ok(cfg.initialPieceCount > 0, `Day ${day} initialPieceCount must be > 0`);
      assert.ok(cfg.comfortablePieceCount > 0, `Day ${day} comfortablePieceCount must be > 0`);
      assert.ok(cfg.maxPieceCount >= cfg.initialPieceCount, `Day ${day} maxPieceCount must be >= initialPieceCount`);
      assert.strictEqual(cfg.supplyPerAction, 1, `Day ${day} supplyPerAction must be 1`);
      assert.ok(cfg.dangerThreshold >= 0.50 && cfg.dangerThreshold <= 0.75, `Day ${day} dangerThreshold valid`);
      assert.ok(cfg.nextOrderPreviewDay === 7, `Day ${day} nextOrderPreviewDay must be 7`);

      // Verify activeDishIds strictly contain Gold Sample dishes
      assert.ok(cfg.activeDishIds.length > 0);
      for (const dId of cfg.activeDishIds) {
        assert.ok(GOLD_SAMPLE_DISH_CATALOG[dId], `Dish ${dId} must be in Gold Sample catalog`);
      }
    }
  });

  // Test 2: InitialLayoutPreset Day 1 Guided Layout
  it('2. should apply DAY1_GUIDED preset on Day 1 with exact 17 pieces and Salad base group', () => {
    const flow = new GameFlowManager();
    const session = flow.startDay(1, 'day1_preset_seed');
    flow.beginPlaying();

    const pieces = session.dishPuzzleManager.getAllPieces();
    assert.strictEqual(pieces.length, 17, 'Day 1 Guided preset must have exactly 17 pieces');

    const saladBase = session.dishPuzzleManager.getAllGroups().find(
      g => g.dishId === 'dish_salad' && g.pieceIds.length >= 2
    );
    assert.ok(saladBase, 'Day 1 must have an assembled Salad base group');
  });

  // Test 3: InitialLayoutPreset Day 2 Classification Layout
  it('3. should apply DAY2_CLASSIFICATION preset on Day 2 with distinct starter groups for Salad and Breakfast', () => {
    const flow = new GameFlowManager();
    const session = flow.startDay(2, 'day2_preset_seed');
    flow.beginPlaying();

    const pieces = session.dishPuzzleManager.getAllPieces();
    assert.strictEqual(pieces.length, 14, 'Day 2 Classification preset must have exactly 14 pieces');

    const saladGroups = session.dishPuzzleManager.getAllGroups().filter(g => g.dishId === 'dish_salad' && g.pieceIds.length >= 2);
    const breakfastGroups = session.dishPuzzleManager.getAllGroups().filter(g => g.dishId === 'dish_breakfast' && g.pieceIds.length >= 2);

    assert.ok(saladGroups.length >= 1, 'Day 2 must feature a Salad starter group');
    assert.ok(breakfastGroups.length >= 1, 'Day 2 must feature a Breakfast starter group');
  });

  // Test 4: DishPuzzleTutorialDirector Day 1 first Piece-to-Piece drag cue
  it('4. should deliver non-blocking Day 1 Piece-to-Piece drag tutorial cue and dismiss upon move', () => {
    SaveSystem.setStorage(new MemoryStoragePort());
    SaveSystem.resetCampaignState();

    let capturedCue: any = null;
    const flow = new GameFlowManager({
      onDishTutorialCue: (cue) => {
        capturedCue = cue;
      }
    });

    const session = flow.startDay(1, 'day1_tutorial_seed');
    flow.beginPlaying();

    assert.ok(capturedCue, 'Day 1 must emit onDishTutorialCue on first play');
    assert.strictEqual(capturedCue.dishId, 'dish_salad');
    assert.deepStrictEqual(capturedCue.toCoord, { col: 2, row: 0 });

    // Moving a group dismisses the tutorial cue permanently
    const res = flow.moveDishGroup(capturedCue.groupId, capturedCue.toCoord.col, capturedCue.toCoord.row, capturedCue.pieceInstanceId);
    assert.ok(res.success, 'Tutorial move must succeed');

    const stateAfter = SaveSystem.loadCampaignState();
    assert.strictEqual(stateAfter.tutorialFlags['dish_first_drag_shown'], true, 'Flag must be set to true');

    // Starting a new session must not trigger cue again
    let secondCue: any = null;
    const flow2 = new GameFlowManager({
      onDishTutorialCue: (cue) => {
        secondCue = cue;
      }
    });
    flow2.startDay(1, 'day1_tutorial_seed_2');
    flow2.beginPlaying();
    assert.strictEqual(secondCue, null, 'Tutorial cue must NOT be shown again after dismissal');
  });

  // Test 5: Day 7 NEXT order preview unlock cue
  it('5. should trigger NEXT order preview unlock cue on Day 7', () => {
    const memory = new MemoryStoragePort();
    SaveSystem.setStorage(memory);
    const state = SaveSystem.resetCampaignState();

    assert.strictEqual(DishPuzzleTutorialDirector.shouldShowNextOrderUnlockCue(6, state), false, 'Day 6 must not show NEXT unlock');
    assert.strictEqual(DishPuzzleTutorialDirector.shouldShowNextOrderUnlockCue(7, state), true, 'Day 7 must show NEXT unlock');
    // Subsequent check returns false (shown once)
    const state2 = SaveSystem.loadCampaignState();
    assert.strictEqual(DishPuzzleTutorialDirector.shouldShowNextOrderUnlockCue(7, state2), false, 'Day 7 must not repeat NEXT unlock');
  });

  // Test 6: Continuous Campaign progression: Day 1 Clear -> Save -> Unlock Day 2 -> ... -> Day 12
  it('6. should continuously progress and unlock days 1 through 12 via SaveSystem', () => {
    SaveSystem.setStorage(new MemoryStoragePort());
    let state = SaveSystem.resetCampaignState();
    assert.strictEqual(state.highestUnlockedDay, 1);

    for (let day = 1; day <= 12; day++) {
      assert.ok(day <= state.highestUnlockedDay, `Day ${day} must be unlocked`);

      // Record simulated day completion
      const cfg = getDishCampaignDayConfig(day);
      state = SaveSystem.recordDayCompletion({
        dayNumber: day,
        clearedAt: Date.now(),
        revenueAchieved: cfg.businessGoal + 50,
        businessGoal: cfg.businessGoal,
        ordersCompleted: Math.ceil(cfg.businessGoal / 80),
        maxCascadeStreak: day >= 9 ? 2 : 0,
        piecesPlaced: 15
      });

      assert.ok(state.completedDays[day], `Day ${day} must be recorded as completed`);
      assert.strictEqual(state.bestRevenueByDay[day], cfg.businessGoal + 50);

      const expectedNext = Math.min(12, day + 1);
      assert.strictEqual(state.highestUnlockedDay, expectedNext, `Day ${expectedNext} must be unlocked after clearing Day ${day}`);
    }

    assert.strictEqual(state.highestUnlockedDay, 12);
    assert.strictEqual(Object.keys(state.completedDays).length, 12);
  });
});
