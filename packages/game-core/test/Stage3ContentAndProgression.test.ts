import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { SaveSystem } from '../src/progression/SaveSystem';
import { TutorialDirector } from '../src/progression/TutorialDirector';
import { GameFlowManager } from '../src/progression/GameFlowManager';
import { AudioDirector } from '../src/audio/AudioDirector';
import { PlaytestSimulator } from '../src/telemetry/PlaytestSimulator';
import { GameSession } from '../src/session/GameSession';
import { DEFAULT_DAYS } from '../src/data/DefaultData';

describe('Stage 3 Progression, Tutorial & SaveSystem', () => {
  beforeEach(() => {
    SaveSystem.resetCampaignState();
  });

  it('should save and load CampaignState accurately with persistence and reset', () => {
    let state = SaveSystem.loadCampaignState();
    assert.strictEqual(state.highestUnlockedDay, 1);
    assert.deepStrictEqual(state.completedDays, {});

    // Record completion of Day 1
    state = SaveSystem.recordDayCompletion({
      dayNumber: 1,
      revenueAchieved: 210,
      businessGoal: 200,
      ordersCompleted: 3,
      maxCascadeStreak: 1,
      completedAt: Date.now()
    });

    assert.strictEqual(state.highestUnlockedDay, 2, 'Should unlock Day 2 after clearing Day 1');
    assert.strictEqual(state.bestRevenueByDay[1], 210);

    // Update settings
    state = SaveSystem.updateSettings({ musicEnabled: false });
    assert.strictEqual(state.settings.musicEnabled, false);

    // Reset save
    state = SaveSystem.resetCampaignState();
    assert.strictEqual(state.highestUnlockedDay, 1);
    assert.deepStrictEqual(state.completedDays, {});
  });

  it('should deliver non-blocking contextual tutorial cues strictly per specification', () => {
    const session = new GameSession(DEFAULT_DAYS[0], 'tutorial_seed');
    let state = SaveSystem.loadCampaignState();

    // 1. Day 1 first drag cue
    const dragCue = TutorialDirector.getFirstDragCue(session, state);
    assert.ok(dragCue, 'Must provide drag cue on Day 1 initially');
    assert.ok(dragCue.pieceInstanceId);
    assert.ok(dragCue.targetInstanceId);

    // Dismiss drag cue
    TutorialDirector.dismissFirstDragCue();
    state = SaveSystem.loadCampaignState();
    const dismissedCue = TutorialDirector.getFirstDragCue(session, state);
    assert.strictEqual(dismissedCue, null, 'Must not show drag cue after dismissal');

    // 2. First complete receipt glow
    assert.strictEqual(TutorialDirector.shouldShowFirstCompleteGlow(state), true);
    state = SaveSystem.loadCampaignState();
    assert.strictEqual(TutorialDirector.shouldShowFirstCompleteGlow(state), false, 'Glow should only show once');

    // 3. Day 7 next order unlock cue
    assert.strictEqual(TutorialDirector.shouldShowNextOrderUnlockCue(6, state), false);
    assert.strictEqual(TutorialDirector.shouldShowNextOrderUnlockCue(7, state), true);
    state = SaveSystem.loadCampaignState();
    assert.strictEqual(TutorialDirector.shouldShowNextOrderUnlockCue(7, state), false, 'Next order cue only once');
  });

  it('should manage game lifecycle states, input locks, and transitions', async () => {
    const flow = new GameFlowManager();
    assert.strictEqual(flow.phase, 'MAIN_MENU');
    assert.strictEqual(flow.isInputLocked, true);

    // Start Day 1
    const session = flow.startDay(1, 'flow_test_seed');
    assert.strictEqual(flow.phase, 'DAY_INTRO');
    assert.strictEqual(flow.isInputLocked, true);

    // Wait for DAY_INTRO -> PLAYING
    await new Promise(r => setTimeout(r, 350));
    assert.strictEqual(flow.phase, 'PLAYING');
    assert.strictEqual(flow.isInputLocked, false);

    // Pause & Resume
    flow.pauseGame();
    assert.strictEqual(flow.phase, 'PAUSED');
    assert.strictEqual(flow.isInputLocked, true);

    flow.resumeGame();
    assert.strictEqual(flow.phase, 'PLAYING');
    assert.strictEqual(flow.isInputLocked, false);
  });

  it('should execute AudioDirector synthesis calls safely in any environment without throwing', () => {
    assert.doesNotThrow(() => {
      AudioDirector.playPickPiece();
      AudioDirector.playSnapPiece();
      AudioDirector.playWrongDrop();
      AudioDirector.playIngredientComplete('tomato');
      AudioDirector.playIngredientComplete('beef');
      AudioDirector.playIngredientComplete('egg');
      AudioDirector.playIngredientComplete('bread');
      AudioDirector.playBoardSettling();
      AudioDirector.playReceiptPrint();
      AudioDirector.playOrderComplete();
      AudioDirector.playRevenueGain();
      AudioDirector.playCascade(2);
      AudioDirector.playDanger();
      AudioDirector.playDayClear();
      AudioDirector.setBgmEnabled(false);
    });
  });

  it('should verify that a Novice first-timer unpromptedly completes Day 1 through Day 3', () => {
    const result = PlaytestSimulator.runCampaignEvaluation('novice_first_timer', [1, 2, 3], 999);
    assert.strictEqual(result.allCleared, true, 'Novice must clear Days 1 to 3 with 100% success');
    assert.strictEqual(result.summaries.length, 3);
    for (const summary of result.summaries) {
      assert.strictEqual(summary.isCleared, true, `Day ${summary.dayNumber} must be cleared`);
      assert.ok(summary.finalRevenue >= summary.businessGoal, `Day ${summary.dayNumber} revenue met goal`);
    }
  });

  it('should verify that Strategic Master can progress through all 12 days', () => {
    // Test across sample of days: Day 1, Day 6, Day 12
    const daysToTest = [1, 6, 12];
    const result = PlaytestSimulator.runCampaignEvaluation('strategic_master', daysToTest, 1234);
    assert.strictEqual(result.allCleared, true, 'Master must clear all evaluated days');
    for (const summary of result.summaries) {
      assert.strictEqual(summary.isCleared, true);
    }
  });
});
