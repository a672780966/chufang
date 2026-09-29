/**
 * scripts/run-dish-simulation.ts
 * Executes 1000-seed Stage 5A DishPuzzle Monte-Carlo simulation and outputs stage5a_dish_simulation.json.
 */

import * as fs from 'fs';
import * as path from 'path';
import { DishPuzzleSimulationRunner } from '../packages/simulation/src/DishPuzzleSimulationRunner';

console.log('🚀 Starting Stage 5A 1000-Seed DishPuzzle Monte-Carlo Simulation...');
const startTime = Date.now();

const summary = DishPuzzleSimulationRunner.runSuite();
const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

console.log(`✅ Simulation completed in ${elapsed}s`);
console.log(`   Total Seeds: ${summary.totalSeeds}`);
console.log(`   Crashes: ${summary.totalCrashes}`);
console.log(`   Orphan Violations: ${summary.totalOrphanViolations}`);
console.log(`   Reserved Violations: ${summary.totalReservedViolations}`);
console.log(`   Unclassified Runs: ${summary.unclassifiedRuns}`);
console.log(`   Determinism Passed: ${summary.determinismPassed}`);
console.log('   Policy Breakdown:');
console.log('     Random Legal:       ', summary.policyBreakdown.random_legal);
console.log('     Order Focus:        ', summary.policyBreakdown.order_focus);
console.log('     Multi-Dish Planner: ', summary.policyBreakdown.multi_dish_planner);

const outputPath = path.resolve(process.cwd(), 'stage5a_dish_simulation.json');
fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2), 'utf-8');
console.log(`📁 Report written to ${outputPath}`);
