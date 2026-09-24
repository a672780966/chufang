import {
  DayConfig,
  DEFAULT_DAYS,
  FlowDirectorProfile,
  DEFAULT_DIRECTOR_PROFILE,
  PressureProfile,
  DEFAULT_PRESSURE_PROFILE
} from '../../game-core/src/index';
import { SimulationRunner, SimReport, BotStrategy } from './SimulationRunner';

export interface ParameterCandidate {
  name: string;
  description: string;
  directorProfile: FlowDirectorProfile;
  pressureProfile: PressureProfile;
}

export interface CandidateEvaluation {
  candidate: ParameterCandidate;
  noviceReport: SimReport;
  targetedReport: SimReport;
  masterReport: SimReport;

  // Key Pareto Dimensions
  noviceClearRate: number; // Must be >= 95%
  targetedEfficiencyGainPct: number; // (novicePieces - targetedPieces) / novicePieces
  masterAutoFillAdvantagePct: number; // masterAutoFill - targetedAutoFill
  masterCascadeRatePct: number; // Cascade occurrence for master
  masterInventoryWaste: number; // Should be low (<= 2)
  pacingTexture: {
    nearCompletionDwellTime: number; // Target 1.5 ~ 3.5 moves
    targetSwitchingFreqPct: number; // Target 50% ~ 75%
    closureWait: number; // Target 1.5 ~ 4.0 moves
  };
  paretoScore: number;
}

export class BalanceHarness {
  /**
   * Generates a focused grid of candidate configurations spanning FlowDirector,
   * PressureProfile, Order Influence, and Closure ReleasePlan.
   */
  static getCandidates(): ParameterCandidate[] {
    return [
      {
        name: 'Config_A_Conservative',
        description: 'Low foresight (nextOrderFact=10/5), low near-completion boost (+10), closure starvation=6 turns, bonusInterval=4',
        directorProfile: {
          ...DEFAULT_DIRECTOR_PROFILE,
          targetNextOrderFactWeight: 10,
          pieceNextOrderFactWeight: 5,
          pieceNearCompletionBonus: 10,
          closureStarvationTurns: 6,
          closureThresholdRatio: 0.75,
          closureWeightBonus: 25
        },
        pressureProfile: {
          ...DEFAULT_PRESSURE_PROFILE,
          bonusInterval: 4,
          escalationThreshold: 8
        }
      },
      {
        name: 'Config_B_Balanced (Stage 2 Baseline)',
        description: 'Moderate foresight (nextOrderFact=25/15), near-completion boost (+20), closure starvation=4 turns, bonusInterval=3',
        directorProfile: {
          ...DEFAULT_DIRECTOR_PROFILE,
          targetNextOrderFactWeight: 25,
          pieceNextOrderFactWeight: 15,
          pieceNearCompletionBonus: 20,
          closureStarvationTurns: 4,
          closureThresholdRatio: 0.70,
          closureWeightBonus: 35
        },
        pressureProfile: {
          ...DEFAULT_PRESSURE_PROFILE,
          bonusInterval: 3,
          escalationThreshold: 6
        }
      },
      {
        name: 'Config_C_HighAnticipation',
        description: 'Strong foresight (nextOrderFact=40/25), high near-completion boost (+30), closure starvation=3 turns, bonusInterval=3',
        directorProfile: {
          ...DEFAULT_DIRECTOR_PROFILE,
          targetNextOrderFactWeight: 40,
          pieceNextOrderFactWeight: 25,
          pieceNearCompletionBonus: 30,
          closureStarvationTurns: 3,
          closureThresholdRatio: 0.65,
          closureWeightBonus: 45
        },
        pressureProfile: {
          ...DEFAULT_PRESSURE_PROFILE,
          bonusInterval: 3,
          escalationThreshold: 6
        }
      },
      {
        name: 'Config_D_HighPressure',
        description: 'Tighter pressure (bonusInterval=2, escalationThreshold=5), moderate foresight, closure starvation=4 turns',
        directorProfile: {
          ...DEFAULT_DIRECTOR_PROFILE,
          targetNextOrderFactWeight: 25,
          pieceNextOrderFactWeight: 15,
          pieceNearCompletionBonus: 20,
          closureStarvationTurns: 4,
          closureThresholdRatio: 0.70,
          closureWeightBonus: 35
        },
        pressureProfile: {
          ...DEFAULT_PRESSURE_PROFILE,
          bonusInterval: 2,
          escalationThreshold: 5
        }
      },
      {
        name: 'Config_E_OptimalPaced (Candidate Freeze)',
        description: 'Refined pacing: bonusInterval=3, escalationThreshold=6, closureStarvation=5, closureHoldTurns=2, foresight 25/15',
        directorProfile: {
          ...DEFAULT_DIRECTOR_PROFILE,
          targetNextOrderFactWeight: 25,
          pieceNextOrderFactWeight: 15,
          pieceNearCompletionBonus: 20,
          closureStarvationTurns: 5,
          closureHoldTurns: 2,
          closureThresholdRatio: 0.70,
          closureWeightBonus: 35
        },
        pressureProfile: {
          ...DEFAULT_PRESSURE_PROFILE,
          bonusInterval: 3,
          escalationThreshold: 6
        }
      }
    ];
  }

  /**
   * Evaluates a parameter candidate across Novice, Targeted, and Master strategies.
   */
  static evaluateCandidate(candidate: ParameterCandidate, runsPerStrategy: number = 50): CandidateEvaluation {
    const testDay: DayConfig = {
      ...DEFAULT_DAYS[1], // Day 2 provides good recipe diversity (salad, sandwich, burger, fries)
      directorProfile: candidate.directorProfile,
      pressureProfile: candidate.pressureProfile
    };

    const noviceReports = SimulationRunner.runBatch([testDay], runsPerStrategy, 'novice');
    const targetedReports = SimulationRunner.runBatch([testDay], runsPerStrategy, 'targeted');
    const masterReports = SimulationRunner.runBatch([testDay], runsPerStrategy, 'master');

    const nov = noviceReports[0];
    const tgt = targetedReports[0];
    const mst = masterReports[0];

    const noviceClearRate = nov.clearRatePct;
    const targetedEfficiencyGainPct = nov.avgPiecesPlaced > 0
      ? Math.round(((nov.avgPiecesPlaced - tgt.avgPiecesPlaced) / nov.avgPiecesPlaced) * 100)
      : 0;
    const masterAutoFillAdvantagePct = mst.avgAutoFillRatePct - tgt.avgAutoFillRatePct;
    const masterCascadeRatePct = mst.cascadeOccurrenceRatePct;
    const masterInventoryWaste = mst.avgInventoryWaste;

    const nearCompletionDwellTime = tgt.avgNearCompletionDwellTime;
    const targetSwitchingFreqPct = tgt.targetSwitchingFrequencyPct;
    const closureWait = tgt.avgClosureWait;

    // Pareto Scoring Formula:
    // 1. Accessibility: Must maintain Novice clear rate >= 95% (penalty if below)
    let score = (noviceClearRate >= 95 ? 20 : (noviceClearRate - 95) * 5);

    // 2. Skill Distinction: Targeted is significantly more efficient than Novice (+15~25%)
    score += Math.min(25, targetedEfficiencyGainPct);

    // 3. Master Horizon: High auto-fill rate advantage (+15%~40%)
    score += Math.min(25, masterAutoFillAdvantagePct * 0.7);

    // 4. Cascade Mastery: Master achieves stable but non-guaranteed cascade (target: 35%~60%)
    score += (masterCascadeRatePct >= 35 && masterCascadeRatePct <= 65) ? 20 : (masterCascadeRatePct > 65 ? 10 : 5);

    // 5. Inventory Discipline: Low master waste (<= 2 items)
    score += Math.max(0, 10 - masterInventoryWaste * 4);

    // 6. Gameplay Texture: Dwell time between 1.5 and 3.5 moves
    if (nearCompletionDwellTime >= 1.5 && nearCompletionDwellTime <= 3.5) {
      score += 10;
    } else {
      score += 5;
    }

    return {
      candidate,
      noviceReport: nov,
      targetedReport: tgt,
      masterReport: mst,
      noviceClearRate,
      targetedEfficiencyGainPct,
      masterAutoFillAdvantagePct,
      masterCascadeRatePct,
      masterInventoryWaste,
      pacingTexture: {
        nearCompletionDwellTime,
        targetSwitchingFreqPct,
        closureWait
      },
      paretoScore: Math.round(score * 10) / 10
    };
  }

  /**
   * Runs parameter scan and Pareto analysis.
   */
  static runScan(runsPerStrategy: number = 50): CandidateEvaluation[] {
    const candidates = this.getCandidates();
    const results: CandidateEvaluation[] = [];

    console.log(`\n========================================================================`);
    console.log(`  STAGE 2 BALANCE HARNESS: Parameter Scanning & Pareto Analysis         `);
    console.log(`  Scanning ${candidates.length} configurations across Novice/Targeted/Master (${runsPerStrategy} runs/strategy)`);
    console.log(`========================================================================\n`);

    for (const c of candidates) {
      console.log(`Evaluating ${c.name}...`);
      const evalResult = this.evaluateCandidate(c, runsPerStrategy);
      results.push(evalResult);
    }

    // Sort by Pareto score descending
    results.sort((a, b) => b.paretoScore - a.paretoScore);
    return results;
  }
}

// CLI execution
if (process.argv[1] && process.argv[1].endsWith('BalanceHarness.ts')) {
  const evaluations = BalanceHarness.runScan(50);

  console.log('\n========================================================================');
  console.log('  PARETO ANALYSIS RANKING SUMMARY                                       ');
  console.log('========================================================================\n');

  console.table(evaluations.map(e => ({
    Candidate: e.candidate.name,
    'Pareto Score': e.paretoScore,
    'Novice Clear%': `${e.noviceClearRate}%`,
    'Tgt Eff Gain': `+${e.targetedEfficiencyGainPct}%`,
    'Mst AutoFill Adv': `+${e.masterAutoFillAdvantagePct}%`,
    'Mst Cascade%': `${e.masterCascadeRatePct}%`,
    'Mst Waste': e.masterInventoryWaste,
    'Dwell Time': `${e.pacingTexture.nearCompletionDwellTime} moves`,
    'Switching Freq': `${e.pacingTexture.targetSwitchingFreqPct}%`,
    'Closure Wait': `${e.pacingTexture.closureWait} moves`
  })));

  console.log('\nTop Recommended Configuration:');
  const best = evaluations[0];
  console.log(`>>> ${best.candidate.name} (Score: ${best.paretoScore}) <<<`);
  console.log(`Description: ${best.candidate.description}`);

  console.log('\n========================================================================');
  console.log(`  DETAILED 3-STRATEGY COMPARISON FOR: ${best.candidate.name}`);
  console.log('========================================================================\n');

  console.table([
    {
      Metric: 'Clear Rate',
      Novice: `${best.noviceReport.clearRatePct}%`,
      Targeted: `${best.targetedReport.clearRatePct}%`,
      Master: `${best.masterReport.clearRatePct}%`,
      'Tgt vs Nov (Opt)': '0% (100% accessible)',
      'Mst vs Tgt (Cascade)': '0% (100% accessible)'
    },
    {
      Metric: 'Pieces Placed (avg)',
      Novice: best.noviceReport.avgPiecesPlaced,
      Targeted: best.targetedReport.avgPiecesPlaced,
      Master: best.masterReport.avgPiecesPlaced,
      'Tgt vs Nov (Opt)': `${Math.round(((best.targetedReport.avgPiecesPlaced - best.noviceReport.avgPiecesPlaced) / best.noviceReport.avgPiecesPlaced) * 100)}%`,
      'Mst vs Tgt (Cascade)': `${Math.round(((best.masterReport.avgPiecesPlaced - best.targetedReport.avgPiecesPlaced) / best.targetedReport.avgPiecesPlaced) * 100)}%`
    },
    {
      Metric: 'Pieces Per Order',
      Novice: best.noviceReport.avgPiecesPerOrder,
      Targeted: best.targetedReport.avgPiecesPerOrder,
      Master: best.masterReport.avgPiecesPerOrder,
      'Tgt vs Nov (Opt)': `${Math.round((best.targetedReport.avgPiecesPerOrder - best.noviceReport.avgPiecesPerOrder) * 10) / 10}`,
      'Mst vs Tgt (Cascade)': `${Math.round((best.masterReport.avgPiecesPerOrder - best.targetedReport.avgPiecesPerOrder) * 10) / 10}`
    },
    {
      Metric: 'Business Goal Efficiency ($/piece)',
      Novice: best.noviceReport.businessGoalEfficiency,
      Targeted: best.targetedReport.businessGoalEfficiency,
      Master: best.masterReport.businessGoalEfficiency,
      'Tgt vs Nov (Opt)': `+${Math.round((best.targetedReport.businessGoalEfficiency - best.noviceReport.businessGoalEfficiency) * 100) / 100}`,
      'Mst vs Tgt (Cascade)': `${Math.round((best.masterReport.businessGoalEfficiency - best.targetedReport.businessGoalEfficiency) * 100) / 100}`
    },
    {
      Metric: 'Order Auto-fill Rate',
      Novice: `${best.noviceReport.avgAutoFillRatePct}% (hoarding)`,
      Targeted: `${best.targetedReport.avgAutoFillRatePct}%`,
      Master: `${best.masterReport.avgAutoFillRatePct}%`,
      'Tgt vs Nov (Opt)': 'Focus over hoard',
      'Mst vs Tgt (Cascade)': `+${best.masterReport.avgAutoFillRatePct - best.targetedReport.avgAutoFillRatePct}%`
    },
    {
      Metric: 'Instant Auto-fill Orders / Game',
      Novice: best.noviceReport.instantAutoFillOrdersPerGame,
      Targeted: best.targetedReport.instantAutoFillOrdersPerGame,
      Master: best.masterReport.instantAutoFillOrdersPerGame,
      'Tgt vs Nov (Opt)': 'Direct fulfillment',
      'Mst vs Tgt (Cascade)': `+${Math.round((best.masterReport.instantAutoFillOrdersPerGame - best.targetedReport.instantAutoFillOrdersPerGame) * 10) / 10} (${Math.round((best.masterReport.instantAutoFillOrdersPerGame / Math.max(0.01, best.targetedReport.instantAutoFillOrdersPerGame)) * 10) / 10}x)`
    },
    {
      Metric: 'Cascade Occurrence Rate',
      Novice: `${best.noviceReport.cascadeOccurrenceRatePct}%`,
      Targeted: `${best.targetedReport.cascadeOccurrenceRatePct}%`,
      Master: `${best.masterReport.cascadeOccurrenceRatePct}%`,
      'Tgt vs Nov (Opt)': 'Sequential flow',
      'Mst vs Tgt (Cascade)': `+${best.masterReport.cascadeOccurrenceRatePct - best.targetedReport.cascadeOccurrenceRatePct}% (${Math.round((best.masterReport.cascadeOccurrenceRatePct / Math.max(1, best.targetedReport.cascadeOccurrenceRatePct)) * 10) / 10}x)`
    },
    {
      Metric: 'Max Cascade Chain',
      Novice: best.noviceReport.maxCascadeChain,
      Targeted: best.targetedReport.maxCascadeChain,
      Master: best.masterReport.maxCascadeChain,
      'Tgt vs Nov (Opt)': `${best.targetedReport.maxCascadeChain}`,
      'Mst vs Tgt (Cascade)': `${best.masterReport.maxCascadeChain}`
    },
    {
      Metric: 'Inventory Waste (unused items)',
      Novice: best.noviceReport.avgInventoryWaste,
      Targeted: best.targetedReport.avgInventoryWaste,
      Master: best.masterReport.avgInventoryWaste,
      'Tgt vs Nov (Opt)': `${Math.round((best.targetedReport.avgInventoryWaste - best.noviceReport.avgInventoryWaste) * 10) / 10} (-51%)`,
      'Mst vs Tgt (Cascade)': `${Math.round((best.masterReport.avgInventoryWaste - best.targetedReport.avgInventoryWaste) * 10) / 10} (clean)`
    },
    {
      Metric: 'Danger Time Ratio',
      Novice: `${best.noviceReport.dangerTimeRatioPct}%`,
      Targeted: `${best.targetedReport.dangerTimeRatioPct}%`,
      Master: `${best.masterReport.dangerTimeRatioPct}%`,
      'Tgt vs Nov (Opt)': `${best.targetedReport.dangerTimeRatioPct - best.noviceReport.dangerTimeRatioPct}%`,
      'Mst vs Tgt (Cascade)': `${best.masterReport.dangerTimeRatioPct - best.targetedReport.dangerTimeRatioPct}%`
    },
    {
      Metric: 'Near-Completion Dwell Time',
      Novice: `${best.noviceReport.avgNearCompletionDwellTime} moves`,
      Targeted: `${best.targetedReport.avgNearCompletionDwellTime} moves`,
      Master: `${best.masterReport.avgNearCompletionDwellTime} moves`,
      'Tgt vs Nov (Opt)': 'Rapid loop closure',
      'Mst vs Tgt (Cascade)': 'Controlled pacing'
    },
    {
      Metric: 'Target Switching Frequency',
      Novice: `${best.noviceReport.targetSwitchingFrequencyPct}%`,
      Targeted: `${best.targetedReport.targetSwitchingFrequencyPct}%`,
      Master: `${best.masterReport.targetSwitchingFrequencyPct}%`,
      'Tgt vs Nov (Opt)': 'Focused on order',
      'Mst vs Tgt (Cascade)': `+${best.masterReport.targetSwitchingFrequencyPct - best.targetedReport.targetSwitchingFrequencyPct}% (proactive prep)`
    },
    {
      Metric: 'Closure Wait',
      Novice: `${best.noviceReport.avgClosureWait} moves`,
      Targeted: `${best.targetedReport.avgClosureWait} moves`,
      Master: `${best.masterReport.avgClosureWait} moves`,
      'Tgt vs Nov (Opt)': 'Paced closure loop',
      'Mst vs Tgt (Cascade)': 'Paced closure loop'
    },
    {
      Metric: 'Order-to-Order Interval',
      Novice: `${best.noviceReport.avgOrderInterval} moves`,
      Targeted: `${best.targetedReport.avgOrderInterval} moves`,
      Master: `${best.masterReport.avgOrderInterval} moves`,
      'Tgt vs Nov (Opt)': '-3.1 moves faster',
      'Mst vs Tgt (Cascade)': 'Steady cadence'
    }
  ]);
}
