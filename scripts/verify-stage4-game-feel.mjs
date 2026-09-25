import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\admin\\.gemini\\antigravity\\brain\\a581706c-feba-4a01-94fc-8c62ff40a9bf';
const SHOTS_DIR = 'C:\\Users\\admin\\Music\\chufang\\scripts\\shots';

if (!fs.existsSync(SHOTS_DIR)) {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
}

const profileDir = path.join(process.env.TEMP || 'C:\\Temp', 'cdp-stage4-game-feel-' + Date.now());

const chromeProc = spawn(CHROME_PATH, [
  '--headless=new',
  '--remote-debugging-port=9227',
  '--window-size=1200,900',
  '--disable-gpu',
  `--user-data-dir=${profileDir}`,
  'http://localhost:5173/?day=1'
]);

async function getDebuggerUrl(port = 9227, maxRetries = 30) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json`);
      if (res.ok) {
        const list = await res.json();
        const page = list.find(t => t.type === 'page');
        if (page && page.webSocketDebuggerUrl) {
          return page.webSocketDebuggerUrl;
        }
      }
    } catch {}
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error('Chrome debugger failed to start');
}

async function saveScreenshot(callCDP, filename) {
  const shot = await callCDP('Page.captureScreenshot', { format: 'png' });
  const buf = Buffer.from(shot.data, 'base64');
  
  const shotPath1 = path.join(SHOTS_DIR, filename);
  const shotPath2 = path.join(ARTIFACT_DIR, filename);

  fs.writeFileSync(shotPath1, buf);
  fs.writeFileSync(shotPath2, buf);
  console.log(`[Screenshot Captured] ${filename} (${buf.length} bytes)`);
}

async function main() {
  try {
    const wsUrl = await getDebuggerUrl(9227);
    console.log('Connecting to debugger at:', wsUrl);

    await new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      let idCounter = 1;
      const handlers = new Map();

      function callCDP(method, params = {}) {
        return new Promise((res, rej) => {
          const reqId = idCounter++;
          handlers.set(reqId, { resolve: res, reject: rej });
          ws.send(JSON.stringify({ id: reqId, method, params }));
        });
      }

      ws.onmessage = (evt) => {
        const data = JSON.parse(evt.data);
        if (data.id && handlers.has(data.id)) {
          const { resolve, reject } = handlers.get(data.id);
          handlers.delete(data.id);
          if (data.error) reject(new Error(data.error.message));
          else resolve(data.result);
        }
      };

      ws.onerror = reject;

      ws.onopen = async () => {
        try {
          console.log('CDP WebSocket connected!');
          await callCDP('Page.enable');
          await callCDP('Runtime.enable');

          // Wait 2.5s for initial assets and textures to fully render
          await new Promise(r => setTimeout(r, 2500));

          // Helper: Pointer drag with active salad instance targeting
          async function executeDrag(dishCol, dishRow, targetCol, targetRow, holdMs = 0) {
            const dragResult = await callCDP('Runtime.evaluate', {
              expression: `
                (async function() {
                  const app = window.__app;
                  const mgr = app.dishPuzzleManager;
                  const activeSalad = Array.from(mgr._instances.values()).find(i => i.dishId === 'dish_salad' && !i.isCompleted);
                  if (!activeSalad) return { error: 'No active salad instance found' };

                  const saladPieces = mgr.getAllPieces().filter(p => p.dishPuzzleInstanceId === activeSalad.instanceId);
                  const piece = saladPieces.find(p => p.dishCol === ${dishCol} && p.dishRow === ${dishRow});
                  if (!piece) return { error: 'Piece not found: dishCol=${dishCol}, dishRow=${dishRow}' };

                  const { originX, originY, cellSize } = app.getBoardOrigin();
                  const rect = app.canvas.getBoundingClientRect();
                  const startX = rect.left + originX + piece.boardCoord.col * cellSize + cellSize / 2;
                  const startY = rect.top + originY - piece.boardCoord.row * cellSize + cellSize / 2;
                  const endX = rect.left + originX + ${targetCol} * cellSize + cellSize / 2;
                  const endY = rect.top + originY - ${targetRow} * cellSize + cellSize / 2;

                  app.canvas.dispatchEvent(new PointerEvent('pointerdown', {
                    clientX: startX,
                    clientY: startY,
                    pointerId: 1,
                    isPrimary: true,
                    bubbles: true
                  }));

                  for (let i = 1; i <= 6; i++) {
                    const curX = startX + (endX - startX) * (i / 6);
                    const curY = startY + (endY - startY) * (i / 6);
                    app.canvas.dispatchEvent(new PointerEvent('pointermove', {
                      clientX: curX,
                      clientY: curY,
                      pointerId: 1,
                      isPrimary: true,
                      bubbles: true
                    }));
                    await new Promise(r => setTimeout(r, 16));
                  }

                  if (${holdMs} > 0) {
                    await new Promise(r => setTimeout(r, ${holdMs}));
                  }

                  app.canvas.dispatchEvent(new PointerEvent('pointerup', {
                    clientX: endX,
                    clientY: endY,
                    pointerId: 1,
                    isPrimary: true,
                    bubbles: true
                  }));

                  return { success: true };
                })()
              `,
              awaitPromise: true,
              returnByValue: true
            });
            if (dragResult.result?.value?.error) {
              throw new Error(dragResult.result.value.error);
            }
            return dragResult.result?.value;
          }

          console.log('\n======================================================');
          console.log('STAGE 4 GAME FEEL & PRESENTATION VERIFICATION');
          console.log('======================================================\n');

          // Keyframe 1: Initial Composition
          console.log('Capturing Keyframe 1: shot1_initial_composition.png');
          await saveScreenshot(callCDP, 'shot1_initial_composition.png');

          // Keyframe 2: Piece Lift Feedback (Lift piece under finger without releasing)
          console.log('Capturing Keyframe 2: shot2_piece_lift.png');
          await callCDP('Runtime.evaluate', {
            expression: `
              (async function() {
                const app = window.__app;
                const mgr = app.dishPuzzleManager;
                const piece = mgr.getAllPieces().find(p => p.dishCol === 2 && p.dishRow === 0);
                if (!piece) return;
                const { originX, originY, cellSize } = app.getBoardOrigin();
                const rect = app.canvas.getBoundingClientRect();
                const startX = rect.left + originX + piece.boardCoord.col * cellSize + cellSize / 2;
                const startY = rect.top + originY - piece.boardCoord.row * cellSize + cellSize / 2;

                app.canvas.dispatchEvent(new PointerEvent('pointerdown', {
                  clientX: startX,
                  clientY: startY,
                  pointerId: 1,
                  isPrimary: true,
                  bubbles: true
                }));

                app.canvas.dispatchEvent(new PointerEvent('pointermove', {
                  clientX: startX + 20,
                  clientY: startY - 20,
                  pointerId: 1,
                  isPrimary: true,
                  bubbles: true
                }));
              })()
            `,
            awaitPromise: true
          });
          await new Promise(r => setTimeout(r, 60));
          await saveScreenshot(callCDP, 'shot2_piece_lift.png');

          // Keyframe 4: Wrong Drop Wobble (Drop to invalid cell)
          console.log('Capturing Keyframe 4: shot4_wrong_drop_wobble.png');
          await callCDP('Runtime.evaluate', {
            expression: `
              (async function() {
                const app = window.__app;
                const rect = app.canvas.getBoundingClientRect();
                // Release in occupied or illegal position
                app.canvas.dispatchEvent(new PointerEvent('pointerup', {
                  clientX: rect.left + 50,
                  clientY: rect.top + 50,
                  pointerId: 1,
                  isPrimary: true,
                  bubbles: true
                }));
              })()
            `,
            awaitPromise: true
          });
          await new Promise(r => setTimeout(r, 50));
          await saveScreenshot(callCDP, 'shot4_wrong_drop_wobble.png');
          await new Promise(r => setTimeout(r, 300)); // wait for wobble settle

          // Keyframe 3: Snap Seam Flare (Drag duo (2,0) into base (2,0))
          console.log('Capturing Keyframe 3: shot3_snap_seam_flare.png');
          await executeDrag(2, 0, 2, 0);
          await new Promise(r => setTimeout(r, 20));
          await saveScreenshot(callCDP, 'shot3_snap_seam_flare.png');
          await new Promise(r => setTimeout(r, 200));

          // Drag piece (0,2) and (1,2)
          await executeDrag(0, 2, 0, 2);
          await new Promise(r => setTimeout(r, 120));
          await executeDrag(1, 2, 1, 2);
          await new Promise(r => setTimeout(r, 120));

          // Drag piece (2,2) - Final Snap for Order 1!
          console.log('Executing Final Snap for Order 1 (2,2) -> (2,2)...');
          await executeDrag(2, 2, 2, 2);

          // Keyframe 5: Master Dish Reveal & Golden Aura (~380ms)
          await new Promise(r => setTimeout(r, 360));
          console.log('Capturing Keyframe 5: shot5_final_ceremony_reveal.png');
          await saveScreenshot(callCDP, 'shot5_final_ceremony_reveal.png');

          // Keyframe 6: Serve Bezier Flight (~580ms)
          await new Promise(r => setTimeout(r, 200));
          console.log('Capturing Keyframe 6: shot6_serve_flight.png');
          await saveScreenshot(callCDP, 'shot6_serve_flight.png');

          // Keyframe 7: Receipt Cinnabar Seal Stamp (~700ms)
          await new Promise(r => setTimeout(r, 130));
          console.log('Capturing Keyframe 7: shot7_receipt_cinnabar_seal.png');
          await saveScreenshot(callCDP, 'shot7_receipt_cinnabar_seal.png');

          // Keyframe 8: Flying Revenue Particle (~760ms)
          await new Promise(r => setTimeout(r, 60));
          console.log('Capturing Keyframe 8: shot8_revenue_flying_particle.png');
          await saveScreenshot(callCDP, 'shot8_revenue_flying_particle.png');

          // Keyframe 9: Receipt Tear and New Order Print (~920ms)
          await new Promise(r => setTimeout(r, 200));
          console.log('Capturing Keyframe 9: shot9_receipt_tear_and_print.png');
          await saveScreenshot(callCDP, 'shot9_receipt_tear_and_print.png');

          // Wait for board reflow and Order 2 layout to settle
          await new Promise(r => setTimeout(r, 800));

          // Execute Order 2: Salad #2
          console.log('Executing Order 2 (Salad #2)...');
          await executeDrag(2, 0, 2, 0);
          await new Promise(r => setTimeout(r, 120));
          await executeDrag(0, 2, 0, 2);
          await new Promise(r => setTimeout(r, 120));
          await executeDrag(1, 2, 1, 2);
          await new Promise(r => setTimeout(r, 120));
          await executeDrag(2, 2, 2, 2);
          await new Promise(r => setTimeout(r, 1100));

          // Execute Order 3: Salad #3 (Reaches ¥210 -> Day Clear!)
          console.log('Executing Order 3 (Salad #3 -> Day Clear)...');
          await executeDrag(2, 0, 2, 0);
          await new Promise(r => setTimeout(r, 120));
          await executeDrag(0, 2, 0, 2);
          await new Promise(r => setTimeout(r, 120));
          await executeDrag(1, 2, 1, 2);
          await new Promise(r => setTimeout(r, 120));
          await executeDrag(2, 2, 2, 2);

          // Wait for ceremony, serve arrival, and victory modal
          await new Promise(r => setTimeout(r, 1100));

          const finalStatus = await callCDP('Runtime.evaluate', {
            expression: `
              (function() {
                const app = window.__app;
                const session = app.flow.session;
                const victoryModal = document.getElementById('modal-victory');
                const victoryVisible = victoryModal ? (victoryModal.style.display === 'flex' || getComputedStyle(victoryModal).display === 'flex') : false;
                return {
                  revenue: session.revenue,
                  ordersFulfilledCount: session.orderSystem.ordersFulfilledCount,
                  isGoalReached: session.orderSystem.isGoalReached,
                  victoryVisible
                };
              })()
            `,
            returnByValue: true
          });
          console.log('Final Status before Keyframe 10:', finalStatus.result?.value);

          // Keyframe 10: Day Clear Daily Ledger Journal
          console.log('Capturing Keyframe 10: shot10_day_clear_journal.png');
          await saveScreenshot(callCDP, 'shot10_day_clear_journal.png');

          console.log('\n======================================================');
          console.log('STAGE 4 VERIFICATION COMPLETE: ALL 10 KEYFRAMES SAVED');
          console.log('======================================================\n');

          ws.close();
          resolve();
        } catch (err) {
          reject(err);
        }
      };
    });
  } finally {
    chromeProc.kill('SIGKILL');
  }
}

main().then(() => {
  console.log('Stage 4 Game Feel verification completed successfully!');
  process.exit(0);
}).catch(err => {
  console.error('Stage 4 Game Feel verification failed:', err);
  process.exit(1);
});
