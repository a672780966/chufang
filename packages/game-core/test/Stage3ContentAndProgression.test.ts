import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { SaveSystem, MemoryStoragePort } from '../src/progression/SaveSystem';
import { TutorialDirector } from '../src/progression/TutorialDirector';
import { GameFlowManager } from '../src/progression/GameFlowManager';
import { GameSession } from '../src/session/GameSession';
import { DEFAULT_DAYS } from '../src/data/DefaultData';
import { PlaytestSimulator } from '../../simulation/src/PlaytestSimulator';

describe('Stage 3 Progression, Tutorial & SaveSystem', () => {
  beforeEach(() => {
    SaveSystem.setStorage(new MemoryStoragePort());
    SaveSystem.resetCampaignState();
  });

  it('should save and load CampaignState accurately with persistence and reset', () => {
    let state = SaveSystem.loadCampaignState();
    assert.strictEqual(state.highestUnlockedDay, 1);
    assert.deepStrictEqual(state.completedDays, {});

    // Record completion of Day 1
    state = SaveSystem.recordDayCompletion({
      dayNumber: 1,
      clearedAt: 0,
      revenueAchieved: 210,
      businessGoal: 200,
      ordersCompleted: 3,
      maxCascadeStreak: 1,
      piecesPlaced: 12
    });

    assert.strictEqual(state.highestUnlockedDay, 2, 'Should unlock Day 2 after clearing Day 1');
    assert.strictEqual(state.bestRevenueByDay[1], 210);
    assert.strictEqual(state.bestCascadeByDay[1], 1);

    // Update settings
    state = SaveSystem.updateSettings({ musicEnabled: false });
    assert.strictEqual(state.settings.musicEnabled, false);

    // Reset save
    state = SaveSystem.resetCampaignState();
    assert.strictEqual(state.highestUnlockedDay, 1);
    assert.deepStrictEqual(state.completedDays, {});
  });

  it('should support injected StoragePort for platform decoupling', () => {
    const customStore = new Map<string, string>();
    const customStoragePort = {
      getItem: (k: string) => customStore.get(k) || null,
      setItem: (k: string, v: string) => { customStore.set(k, v); },
      removeItem: (k: string) => { customStore.delete(k); }
    };

    SaveSystem.setStorage(customStoragePort);
    SaveSystem.resetCampaignState();
    let state = SaveSystem.loadCampaignState();
    assert.strictEqual(state.highestUnlockedDay, 1);

    SaveSystem.recordDayCompletion({
      dayNumber: 1,
      clearedAt: 0,
      revenueAchieved: 300,
      businessGoal: 200,
      ordersCompleted: 4,
      maxCascadeStreak: 2,
      piecesPlaced: 15
    });

    assert.ok(customStore.has('chufang_campaign_save_v1'));
    state = SaveSystem.loadCampaignState();
    assert.strictEqual(state.highestUnlockedDay, 2);
    assert.strictEqual(state.bestRevenueByDay[1], 300);
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

  it('should manage game lifecycle states, input locks, and deterministic transitions', () => {
    const flow = new GameFlowManager();
    assert.strictEqual(flow.phase, 'MAIN_MENU');
    assert.strictEqual(flow.isInputLocked, true);

    // Start Day 1
    const session = flow.startDay(1, 'flow_test_seed');
    assert.strictEqual(flow.phase, 'DAY_INTRO');
    assert.strictEqual(flow.isInputLocked, true);

    // Call beginPlaying() (driven by presentation/animation completion)
    flow.beginPlaying();
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

  it('should verify that a Novice first-timer bot completes Day 1 through Day 3 deterministically', () => {
    const result = PlaytestSimulator.runCampaignEvaluation('novice_first_timer', [1, 2, 3], 999);
    assert.strictEqual(result.allCleared, true, 'Novice bot must clear Days 1 to 3 with 100% success');
    assert.strictEqual(result.summaries.length, 3);
    for (const summary of result.summaries) {
      assert.strictEqual(summary.isCleared, true, `Day ${summary.dayNumber} must be cleared`);
      assert.ok(summary.finalRevenue >= summary.businessGoal, `Day ${summary.dayNumber} revenue met goal`);
    }
  });

  it('should verify that Strategic Master bot can progress through evaluated days', () => {
    const daysToTest = [1, 6, 12];
    const result = PlaytestSimulator.runCampaignEvaluation('strategic_master', daysToTest, 1234);
    assert.strictEqual(result.allCleared, true, 'Master bot must clear all evaluated days');
    for (const summary of result.summaries) {
      assert.strictEqual(summary.isCleared, true);
    }
  });
});
