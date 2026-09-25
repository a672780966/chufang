import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\admin\\.gemini\\antigravity\\brain\\a581706c-feba-4a01-94fc-8c62ff40a9bf';
const SHOTS_DIR = 'C:\\Users\\admin\\Music\\chufang\\scripts\\shots';

if (!fs.existsSync(SHOTS_DIR)) {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
}

const profileDir = path.join(process.env.TEMP || 'C:\\Temp', 'cdp-real-pointer-' + Date.now());

const chromeProc = spawn(CHROME_PATH, [
  '--headless=new',
  '--remote-debugging-port=9225',
  '--window-size=1200,900',
  '--disable-gpu',
  `--user-data-dir=${profileDir}`,
  'http://localhost:5173/?day=1'
]);

async function getDebuggerUrl(port = 9225, maxRetries = 30) {
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
  console.log(`Saved screenshot: ${filename} (${buf.length} bytes) to shots/ and artifacts/`);
}

async function main() {
  try {
    const wsUrl = await getDebuggerUrl(9225);
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

          // Wait 2.5s for initial assets, textures and Day 1 layout to fully initialize
          await new Promise(r => setTimeout(r, 2500));

          // ---------------------------------------------------------------
          // Milestone 1: Initial Board State (shot1_initial_board.png)
          // ---------------------------------------------------------------
          console.log('\n=== Milestone 1: Capturing shot1_initial_board.png ===');
          const initStats = await callCDP('Runtime.evaluate', {
            expression: `
              (function() {
                const app = window.__app;
                if (!app) return { error: 'No app' };
                const mgr = app.dishPuzzleManager;
                const pieces = mgr.getAllPieces();
                const saladPieces = pieces.filter(p => p.dishId === 'dish_salad');
                const order = app.flow.session.orderSystem.currentOrder;
                const buffer = app.flow.session.orderSystem.preparedDishBuffer;
                const revenue = app.flow.session.revenue;
                return {
                  totalPieces: pieces.length,
                  saladPieces: saladPieces.length,
                  currentOrderDishId: order?.dishId,
                  currentOrderRevenue: order?.baseRevenue,
                  preparedBufferLength: buffer.length,
                  revenue
                };
              })()
            `,
            returnByValue: true
          });
          console.log('Initial Board Status:', initStats.result?.value);
          await saveScreenshot(callCDP, 'shot1_initial_board.png');

          // ---------------------------------------------------------------
          // Milestone 2: Rigid Group Drag in Flight (shot2_group_lift.png)
          // Move 1 part A: Drag Group 2 (at (4,0)) into mid-air
          // ---------------------------------------------------------------
          console.log('\n=== Milestone 2: Capturing shot2_group_lift.png ===');
          const liftEval = await callCDP('Runtime.evaluate', {
            expression: `
              (function() {
                const app = window.__app;
                const { originX, originY, cellSize } = app.getBoardOrigin();
                const rect = app.canvas.getBoundingClientRect();

                // Group 2 is at col 4, row 0..1. Grab piece (2,0) at board (4,0)
                const startX = rect.left + originX + 4 * cellSize + cellSize / 2;
                const startY = rect.top + originY - 0 * cellSize + cellSize / 2;

                // Lift up and towards col 3, row 1
                const liftX = rect.left + originX + 3.2 * cellSize + cellSize / 2;
                const liftY = rect.top + originY - 1.2 * cellSize + cellSize / 2;

                app.canvas.dispatchEvent(new PointerEvent('pointerdown', {
                  clientX: startX,
                  clientY: startY,
                  pointerId: 1,
                  isPrimary: true,
                  bubbles: true
                }));

                app.canvas.dispatchEvent(new PointerEvent('pointermove', {
                  clientX: liftX,
                  clientY: liftY,
                  pointerId: 1,
                  isPrimary: true,
                  bubbles: true
                }));

                return {
                  dragging: !!app.draggingGroup,
                  liftedPieces: app.draggingGroup ? app.draggingGroup.pieces.length : 0
                };
              })()
            `,
            returnByValue: true
          });
          console.log('Group Lift in flight:', liftEval.result?.value);
          await new Promise(r => setTimeout(r, 150));
          await saveScreenshot(callCDP, 'shot2_group_lift.png');

          // ---------------------------------------------------------------
          // Milestone 3: Drop at target (2,0) -> Snap & Merge (shot3_snap_merge.png)
          // Move 1 part B: Complete drag to (2,0) -> 6-piece group formed!
          // ---------------------------------------------------------------
          console.log('\n=== Milestone 3: Capturing shot3_snap_merge.png ===');
          const drop1 = await callCDP('Runtime.evaluate', {
            expression: `
              (async function() {
                const app = window.__app;
                const { originX, originY, cellSize } = app.getBoardOrigin();
                const rect = app.canvas.getBoundingClientRect();

                const targetX = rect.left + originX + 2 * cellSize + cellSize / 2;
                const targetY = rect.top + originY - 0 * cellSize + cellSize / 2;

                // Move smoothly to target (2,0)
                for (let i = 1; i <= 5; i++) {
                  const x = (targetX * i + (rect.left + originX + 3.2 * cellSize + cellSize / 2) * (5 - i)) / 5;
                  const y = (targetY * i + (rect.top + originY - 1.2 * cellSize + cellSize / 2) * (5 - i)) / 5;
                  app.canvas.dispatchEvent(new PointerEvent('pointermove', {
                    clientX: x,
                    clientY: y,
                    pointerId: 1,
                    isPrimary: true,
                    bubbles: true
                  }));
                  await new Promise(r => setTimeout(r, 20));
                }

                // Release pointer at (2,0)
                app.canvas.dispatchEvent(new PointerEvent('pointerup', {
                  clientX: targetX,
                  clientY: targetY,
                  pointerId: 1,
                  isPrimary: true,
                  bubbles: true
                }));

                const saladGroups = app.dishPuzzleManager.getAllGroups().filter(g => g.dishId === 'dish_salad');
                const maxSize = saladGroups.reduce((m, g) => Math.max(m, g.pieceIds.length), 0);
                return {
                  saladGroupsCount: saladGroups.length,
                  maxGroupSize: maxSize
                };
              })()
            `,
            awaitPromise: true,
            returnByValue: true
          });
          console.log('Move 1 Snap & Merge Result:', drop1.result?.value);
          await new Promise(r => setTimeout(r, 300));
          await saveScreenshot(callCDP, 'shot3_snap_merge.png');

          // ---------------------------------------------------------------
          // Moves 2 & 3: Sequential real pointer drags
          // Move 2: Drag piece (0,2) from (3,0) to (0,2) -> 7 pieces
          // Move 3: Drag piece (1,2) from (5,0) to (1,2) -> 8 pieces (near complete)
          // ---------------------------------------------------------------
          console.log('\nExecuting Move 2: Drag piece (0,2) from (3,0) to (0,2)...');
          await callCDP('Runtime.evaluate', {
            expression: `
              (async function() {
                const app = window.__app;
                const { originX, originY, cellSize } = app.getBoardOrigin();
                const rect = app.canvas.getBoundingClientRect();

                const startX = rect.left + originX + 3 * cellSize + cellSize / 2;
                const startY = rect.top + originY - 0 * cellSize + cellSize / 2;
                const endX = rect.left + originX + 0 * cellSize + cellSize / 2;
                const endY = rect.top + originY - 2 * cellSize + cellSize / 2;

                app.canvas.dispatchEvent(new PointerEvent('pointerdown', {
                  clientX: startX,
                  clientY: startY,
                  pointerId: 1,
                  isPrimary: true,
                  bubbles: true
                }));

                for (let i = 1; i <= 6; i++) {
                  app.canvas.dispatchEvent(new PointerEvent('pointermove', {
                    clientX: startX + (endX - startX) * (i / 6),
                    clientY: startY + (endY - startY) * (i / 6),
                    pointerId: 1,
                    isPrimary: true,
                    bubbles: true
                  }));
                  await new Promise(r => setTimeout(r, 20));
                }

                app.canvas.dispatchEvent(new PointerEvent('pointerup', {
                  clientX: endX,
                  clientY: endY,
                  pointerId: 1,
                  isPrimary: true,
                  bubbles: true
                }));
              })()
            `,
            awaitPromise: true
          });
          await new Promise(r => setTimeout(r, 250));

          console.log('Executing Move 3: Drag piece (1,2) from (5,0) to (1,2)...');
          await callCDP('Runtime.evaluate', {
            expression: `
              (async function() {
                const app = window.__app;
                const { originX, originY, cellSize } = app.getBoardOrigin();
                const rect = app.canvas.getBoundingClientRect();

                const startX = rect.left + originX + 5 * cellSize + cellSize / 2;
                const startY = rect.top + originY - 0 * cellSize + cellSize / 2;
                const endX = rect.left + originX + 1 * cellSize + cellSize / 2;
                const endY = rect.top + originY - 2 * cellSize + cellSize / 2;

                app.canvas.dispatchEvent(new PointerEvent('pointerdown', {
                  clientX: startX,
                  clientY: startY,
                  pointerId: 1,
                  isPrimary: true,
                  bubbles: true
                }));

                for (let i = 1; i <= 6; i++) {
                  app.canvas.dispatchEvent(new PointerEvent('pointermove', {
                    clientX: startX + (endX - startX) * (i / 6),
                    clientY: startY + (endY - startY) * (i / 6),
                    pointerId: 1,
                    isPrimary: true,
                    bubbles: true
                  }));
                  await new Promise(r => setTimeout(r, 20));
                }

                app.canvas.dispatchEvent(new PointerEvent('pointerup', {
                  clientX: endX,
                  clientY: endY,
                  pointerId: 1,
                  isPrimary: true,
                  bubbles: true
                }));
              })()
            `,
            awaitPromise: true
          });
          await new Promise(r => setTimeout(r, 250));

          // ---------------------------------------------------------------
          // Milestone 4: Final Snap of piece (2,2) from (6,0) to (2,2)
          // Naturally triggers DISH_COMPLETED -> ORDER_COMPLETED -> +¥70!
          // Active celebration animation (shot4_dish_complete.png)
          // ---------------------------------------------------------------
          console.log('\n=== Milestone 4: Executing Final Snap & Capturing shot4_dish_complete.png ===');
          const finalSnap = await callCDP('Runtime.evaluate', {
            expression: `
              (async function() {
                const app = window.__app;
                const { originX, originY, cellSize } = app.getBoardOrigin();
                const rect = app.canvas.getBoundingClientRect();

                const startX = rect.left + originX + 6 * cellSize + cellSize / 2;
                const startY = rect.top + originY - 0 * cellSize + cellSize / 2;
                const endX = rect.left + originX + 2 * cellSize + cellSize / 2;
                const endY = rect.top + originY - 2 * cellSize + cellSize / 2;

                app.canvas.dispatchEvent(new PointerEvent('pointerdown', {
                  clientX: startX,
                  clientY: startY,
                  pointerId: 1,
                  isPrimary: true,
                  bubbles: true
                }));

                for (let i = 1; i <= 6; i++) {
                  app.canvas.dispatchEvent(new PointerEvent('pointermove', {
                    clientX: startX + (endX - startX) * (i / 6),
                    clientY: startY + (endY - startY) * (i / 6),
                    pointerId: 1,
                    isPrimary: true,
                    bubbles: true
                  }));
                  await new Promise(r => setTimeout(r, 20));
                }

                app.canvas.dispatchEvent(new PointerEvent('pointerup', {
                  clientX: endX,
                  clientY: endY,
                  pointerId: 1,
                  isPrimary: true,
                  bubbles: true
                }));

                return {
                  completedAnimsCount: app.completedDishAnims.size,
                  revenue: app.flow.session.revenue,
                  ordersCount: app.flow.session.orderSystem.ordersFulfilledCount
                };
              })()
            `,
            awaitPromise: true,
            returnByValue: true
          });
          console.log('Final Snap Completion Result:', finalSnap.result?.value);
          // Wait 150ms into the 550ms celebration to capture golden glow and steam puffs
          await new Promise(r => setTimeout(r, 150));
          await saveScreenshot(callCDP, 'shot4_dish_complete.png');

          // ---------------------------------------------------------------
          // Milestone 5: Celebration End, Clear Completed Group, Rigid Reflow & Deterministic Refill
          // (shot5_clear_and_reflow.png)
          // ---------------------------------------------------------------
          console.log('\n=== Milestone 5: Capturing shot5_clear_and_reflow.png ===');
          // Wait 650ms for celebration to finish, clearing group, settling rigid gravity, and refilling pieces
          await new Promise(r => setTimeout(r, 650));

          const settleStats = await callCDP('Runtime.evaluate', {
            expression: `
              (function() {
                const app = window.__app;
                const mgr = app.dishPuzzleManager;
                const pieces = mgr.getAllPieces();
                const saladPieces = pieces.filter(p => p.dishId === 'dish_salad');
                const nonSaladPieces = pieces.filter(p => p.dishId !== 'dish_salad');
                return {
                  completedAnimsRemaining: app.completedDishAnims.size,
                  remainingSaladPieces: saladPieces.length,
                  refilledAndRemainingPieces: nonSaladPieces.length,
                  revenue: app.flow.session.revenue,
                  ordersCount: app.flow.session.orderSystem.ordersFulfilledCount
                };
              })()
            `,
            returnByValue: true
          });
          console.log('Post-Clear & Reflow Status:', settleStats.result?.value);
          await saveScreenshot(callCDP, 'shot5_clear_and_reflow.png');

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
  console.log('\nReal-Pointer closed loop verification completed successfully!');
  process.exit(0);
}).catch(err => {
  console.error('Real-Pointer verification failed:', err);
  process.exit(1);
});
