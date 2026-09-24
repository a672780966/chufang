import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import {
  STAGE2_FROZEN_PRESSURE_PROFILE,
  STAGE2_FROZEN_DIRECTOR_PROFILE,
  DEFAULT_PRESSURE_PROFILE,
  DEFAULT_DIRECTOR_PROFILE,
  DEFAULT_DAYS,
  GameSession
} from '../src/index';

describe('Stage 2 Balance Freeze & Zero Parameter Drift Guarantee', () => {
  it('should match STAGE2_FROZEN profiles with stage2-balance-report.json winner byte-for-byte', () => {
    const reportPath = path.resolve(process.cwd(), 'stage2-balance-report.json');
    assert.ok(fs.existsSync(reportPath), 'stage2-balance-report.json must exist in repository root');

    const reportContent = fs.readFileSync(reportPath, 'utf-8');
    const report = JSON.parse(reportContent);

    assert.ok(report.winner, 'Report must contain a declared winner');
    assert.strictEqual(report.winner.name, 'Config_A_Conservative', 'Winner must be Config_A_Conservative');

    // Verify STAGE2_FROZEN_PRESSURE_PROFILE matches report winner
    assert.deepStrictEqual(
      STAGE2_FROZEN_PRESSURE_PROFILE,
      report.winner.pressureProfile,
      'STAGE2_FROZEN_PRESSURE_PROFILE must match winner pressureProfile in report'
    );

    // Verify STAGE2_FROZEN_DIRECTOR_PROFILE matches report winner
    assert.deepStrictEqual(
      STAGE2_FROZEN_DIRECTOR_PROFILE,
      report.winner.directorProfile,
      'STAGE2_FROZEN_DIRECTOR_PROFILE must match winner directorProfile in report'
    );

    // Verify DEFAULT_PRESSURE_PROFILE points to STAGE2_FROZEN_PRESSURE_PROFILE
    assert.deepStrictEqual(
      DEFAULT_PRESSURE_PROFILE,
      STAGE2_FROZEN_PRESSURE_PROFILE,
      'DEFAULT_PRESSURE_PROFILE must alias STAGE2_FROZEN_PRESSURE_PROFILE'
    );

    // Verify DEFAULT_DIRECTOR_PROFILE points to STAGE2_FROZEN_DIRECTOR_PROFILE
    assert.deepStrictEqual(
      DEFAULT_DIRECTOR_PROFILE,
      STAGE2_FROZEN_DIRECTOR_PROFILE,
      'DEFAULT_DIRECTOR_PROFILE must alias STAGE2_FROZEN_DIRECTOR_PROFILE'
    );
  });

  it('should verify all DEFAULT_DAYS reference the frozen profiles', () => {
    for (const day of DEFAULT_DAYS) {
      assert.ok(day.pressureProfile, `Day ${day.dayNumber} must have pressureProfile defined`);
      assert.ok(day.directorProfile, `Day ${day.dayNumber} must have directorProfile defined`);

      assert.deepStrictEqual(
        day.pressureProfile,
        STAGE2_FROZEN_PRESSURE_PROFILE,
        `Day ${day.dayNumber} pressureProfile must match STAGE2_FROZEN_PRESSURE_PROFILE`
      );

      assert.deepStrictEqual(
        day.directorProfile,
        STAGE2_FROZEN_DIRECTOR_PROFILE,
        `Day ${day.dayNumber} directorProfile must match STAGE2_FROZEN_DIRECTOR_PROFILE`
      );
    }
  });

  it('should ensure GameSession uses frozen profile defaults by default', () => {
    const session = new GameSession(DEFAULT_DAYS[0], 'test_freeze_seed');
    assert.deepStrictEqual(
      session.dayConfig.pressureProfile,
      STAGE2_FROZEN_PRESSURE_PROFILE,
      'GameSession must instantiate with frozen pressure profile'
    );
    assert.deepStrictEqual(
      session.dayConfig.directorProfile,
      STAGE2_FROZEN_DIRECTOR_PROFILE,
      'GameSession must instantiate with frozen director profile'
    );
    assert.strictEqual(session.flowDirector.profile.closureStarvationTurns, 6);
    assert.strictEqual(session.flowDirector.profile.closureHoldTurns, 2);
    assert.strictEqual(session.flowDirector.profile.closureThresholdRatio, 0.75);
    assert.strictEqual(session.flowDirector.profile.targetNextOrderFactWeight, 10);
    assert.strictEqual(session.flowDirector.profile.pieceNextOrderFactWeight, 5);
  });
});
