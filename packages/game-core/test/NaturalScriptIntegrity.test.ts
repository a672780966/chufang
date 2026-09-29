import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('NaturalScriptIntegrity - Zero Prohibited Call Assertions', () => {
  const SCRIPT_PATH = path.resolve(__dirname, '../../../scripts/record-stage5b-r2a-natural-runtime.mjs');

  const PROHIBITED_CALLS = [
    'createPiece(',
    'createGroup(',
    'setCurrentOrderForTesting(',
    '._pieces.clear(',
    '._groups.clear(',
    '._instances.clear(',
    'handleCompletedDish(',
    'resolveCompletedDish('
  ];

  it('natural recording script file must exist', () => {
    assert.ok(fs.existsSync(SCRIPT_PATH), `Script not found at: ${SCRIPT_PATH}`);
  });

  it('natural recording script must contain ZERO prohibited state injection or authority bypass calls', () => {
    const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');

    for (const prohibited of PROHIBITED_CALLS) {
      // Ignore occurrences in comments or descriptions (e.g. "Zero calls to: ...")
      // Check executable code occurrences:
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('*') || line.startsWith('//') || line.startsWith('/*')) {
          continue; // comment line
        }
        assert.ok(
          !line.includes(prohibited),
          `Prohibited call "${prohibited}" found at line ${i + 1} of record-stage5b-r2a-natural-runtime.mjs: "${line}"`
        );
      }
    }
  });

  it('natural recording script must utilize legitimate scheduler or pointer input routines', () => {
    const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');
    assert.ok(
      content.includes('schedulePieceAcrossActiveDishes('),
      'Script must use schedulePieceAcrossActiveDishes for piece delivery'
    );
    assert.ok(
      content.includes('PointerEvent') && content.includes('pointerdown'),
      'Script must use legitimate DOM pointer events (pointerdown/move/up) for interactions'
    );
  });
});
