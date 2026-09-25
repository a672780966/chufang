import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\admin\\.gemini\\antigravity\\brain\\a581706c-feba-4a01-94fc-8c62ff40a9bf';
const SHOTS_DIR = 'C:\\Users\\admin\\Music\\chufang\\scripts\\shots';

if (!fs.existsSync(SHOTS_DIR)) {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
}

const profileDir = path.join(process.env.TEMP || 'C:\\Temp', 'cdp-full-day-loop-' + Date.now());

const chromeProc = spawn(CHROME_PATH, [
  '--headless=new',
  '--remote-debugging-port=9226',
  '--window-size=1200,900',
  '--disable-gpu',
  `--user-data-dir=${profileDir}`,
  'http://localhost:5173/?day=1'
]);

async function getDebuggerUrl(port = 9226, maxRetries = 30) {
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
    const wsUrl = await getDebuggerUrl(9226);
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

          // Helper: execute real pointer drag for a specific dish piece to target cell
          async function executePieceDrag(dishCol, dishRow, targetCol, targetRow) {
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

                  // 1. pointerdown at piece center
                  app.canvas.dispatchEvent(new PointerEvent('pointerdown', {
                    clientX: startX,
                    clientY: startY,
                    pointerId: 1,
                    isPrimary: true,
                    bubbles: true
                  }));

                  // 2. intermediate pointermove steps
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

                  // 3. pointerup at target
                  app.canvas.dispatchEvent(new PointerEvent('pointerup', {
                    clientX: endX,
                    clientY: endY,
                    pointerId: 1,
                    isPrimary: true,
                    bubbles: true
                  }));

                  return {
                    success: true,
                    pieceId: piece.pieceInstanceId,
                    from: { col: piece.boardCoord.col, row: piece.boardCoord.row },
                    to: { col: ${targetCol}, row: ${targetRow} }
                  };
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

          // Helper: Query current game session status
          async function getStatus() {
            const res = await callCDP('Runtime.evaluate', {
              expression: `
                (function() {
                  const app = window.__app;
                  const session = app.flow.session;
                  const mgr = app.dishPuzzleManager;
                  const saladInstances = Array.from(mgr._instances.values()).filter(i => i.dishId === 'dish_salad');
                  const activeSalad = saladInstances.find(i => !i.isCompleted);
                  const victoryModal = document.getElementById('modal-victory');
                  const victoryVisible = victoryModal ? (victoryModal.style.display === 'flex' || getComputedStyle(victoryModal).display === 'flex') : false;

                  return {
                    revenue: session.revenue,
                    businessGoal: session.dayConfig.businessGoal,
                    ordersFulfilledCount: session.orderSystem.ordersFulfilledCount,
                    currentOrderId: session.orderSystem.currentOrder?.orderId || null,
                    currentOrderDishId: session.orderSystem.currentOrder?.dishId || null,
                    isGoalReached: session.orderSystem.isGoalReached,
                    activeSaladInstanceId: activeSalad?.instanceId || null,
                    totalSaladInstances: saladInstances.length,
                    activeAnimsCount: app.completedDishAnims.size,
                    victoryVisible,
                    totalBoardPieces: mgr.getAllPieces().length
                  };
                })()
              `,
              returnByValue: true
            });
            return res.result?.value;
          }

          console.log('\n======================================================');
          console.log('REAL POINTER-PATH BROWSER ACCEPTANCE: DAY 1 FULL LOOP');
          console.log('======================================================');

          const initialStatus = await getStatus();
          console.log('Initial Status:', initialStatus);
          if (initialStatus.revenue !== 0 || initialStatus.currentOrderId !== '#1001') {
            throw new Error(`Unexpected initial state: revenue=${initialStatus.revenue}, order=${initialStatus.currentOrderId}`);
          }

          // -----------------------------------------------------------------
          // ORDER 1: Salad #1 (Order #1001 -> ¥70)
          // -----------------------------------------------------------------
          console.log('\n--- Executing Order 1: Salad #1 (#1001) ---');
          console.log('Drag 1: Duo (2,0) -> (2,0)');
          await executePieceDrag(2, 0, 2, 0);
          await new Promise(r => setTimeout(r, 120));

          console.log('Drag 2: Piece (0,2) -> (0,2)');
          await executePieceDrag(0, 2, 0, 2);
          await new Promise(r => setTimeout(r, 120));

          console.log('Drag 3: Piece (1,2) -> (1,2)');
          await executePieceDrag(1, 2, 1, 2);
          await new Promise(r => setTimeout(r, 120));

          console.log('Drag 4: Piece (2,2) -> (2,2) [Final Snap]');
          await executePieceDrag(2, 2, 2, 2);

          // Wait 150ms into celebration
          await new Promise(r => setTimeout(r, 150));
          const animStatus1 = await getStatus();
          console.log('Order 1 Celebration Anim in flight:', animStatus1.activeAnimsCount > 0);

          // Wait 650ms for celebration completion, clearCompletedGroup, reflow & refill
          await new Promise(r => setTimeout(r, 650));
          const postOrder1Status = await getStatus();
          console.log('Post Order 1 Status:', postOrder1Status);

          if (postOrder1Status.revenue !== 70 || postOrder1Status.ordersFulfilledCount !== 1) {
            throw new Error(`Order 1 fulfillment failure: revenue=${postOrder1Status.revenue}, orders=${postOrder1Status.ordersFulfilledCount}`);
          }
          if (postOrder1Status.currentOrderId !== '#1002') {
            throw new Error(`Expected next order #1002, got: ${postOrder1Status.currentOrderId}`);
          }
          if (!postOrder1Status.activeSaladInstanceId || postOrder1Status.activeSaladInstanceId === initialStatus.activeSaladInstanceId) {
            throw new Error(`Expected new active salad instance, got: ${postOrder1Status.activeSaladInstanceId}`);
          }

          await saveScreenshot(callCDP, 'shot_day1_order1_complete.png');

          // -----------------------------------------------------------------
          // ORDER 2: Salad #2 (Order #1002 -> ¥140)
          // -----------------------------------------------------------------
          console.log('\n--- Executing Order 2: Salad #2 (#1002) ---');
          console.log('Drag 1: Duo (2,0) -> (2,0)');
          await executePieceDrag(2, 0, 2, 0);
          await new Promise(r => setTimeout(r, 120));

          console.log('Drag 2: Piece (0,2) -> (0,2)');
          await executePieceDrag(0, 2, 0, 2);
          await new Promise(r => setTimeout(r, 120));

          console.log('Drag 3: Piece (1,2) -> (1,2)');
          await executePieceDrag(1, 2, 1, 2);
          await new Promise(r => setTimeout(r, 120));

          console.log('Drag 4: Piece (2,2) -> (2,2) [Final Snap]');
          await executePieceDrag(2, 2, 2, 2);

          // Wait 150ms into celebration
          await new Promise(r => setTimeout(r, 150));
          const animStatus2 = await getStatus();
          console.log('Order 2 Celebration Anim in flight:', animStatus2.activeAnimsCount > 0);

          // Wait 650ms for celebration completion, clear, reflow & refill
          await new Promise(r => setTimeout(r, 650));
          const postOrder2Status = await getStatus();
          console.log('Post Order 2 Status:', postOrder2Status);

          if (postOrder2Status.revenue !== 140 || postOrder2Status.ordersFulfilledCount !== 2) {
            throw new Error(`Order 2 fulfillment failure: revenue=${postOrder2Status.revenue}, orders=${postOrder2Status.ordersFulfilledCount}`);
          }
          if (postOrder2Status.currentOrderId !== '#1003') {
            throw new Error(`Expected next order #1003, got: ${postOrder2Status.currentOrderId}`);
          }
          if (!postOrder2Status.activeSaladInstanceId || postOrder2Status.activeSaladInstanceId === postOrder1Status.activeSaladInstanceId) {
            throw new Error(`Expected new active salad instance for Order 3, got: ${postOrder2Status.activeSaladInstanceId}`);
          }

          await saveScreenshot(callCDP, 'shot_day1_order2_complete.png');

          // -----------------------------------------------------------------
          // ORDER 3: Salad #3 (Order #1003 -> ¥210 -> Business Goal Reached!)
          // -----------------------------------------------------------------
          console.log('\n--- Executing Order 3: Salad #3 (#1003) ---');
          console.log('Drag 1: Duo (2,0) -> (2,0)');
          await executePieceDrag(2, 0, 2, 0);
          await new Promise(r => setTimeout(r, 120));

          console.log('Drag 2: Piece (0,2) -> (0,2)');
          await executePieceDrag(0, 2, 0, 2);
          await new Promise(r => setTimeout(r, 120));

          console.log('Drag 3: Piece (1,2) -> (1,2)');
          await executePieceDrag(1, 2, 1, 2);
          await new Promise(r => setTimeout(r, 120));

          console.log('Drag 4: Piece (2,2) -> (2,2) [Final Snap -> Goal Reached!]');
          await executePieceDrag(2, 2, 2, 2);

          // Wait 150ms into celebration
          await new Promise(r => setTimeout(r, 150));
          const animStatus3 = await getStatus();
          console.log('Order 3 Celebration Anim in flight:', animStatus3.activeAnimsCount > 0);

          // Wait 750ms for celebration completion, clearCompletedGroup, BUSINESS_GOAL_REACHED, and victory modal
          await new Promise(r => setTimeout(r, 750));
          const finalStatus = await getStatus();
          console.log('\nFinal Full Day Loop Status:', finalStatus);

          if (finalStatus.revenue !== 210) {
            throw new Error(`Expected final revenue 210, got: ${finalStatus.revenue}`);
          }
          if (finalStatus.ordersFulfilledCount !== 3) {
            throw new Error(`Expected 3 fulfilled orders, got: ${finalStatus.ordersFulfilledCount}`);
          }
          if (!finalStatus.isGoalReached) {
            throw new Error(`Expected isGoalReached to be true, got: ${finalStatus.isGoalReached}`);
          }
          if (finalStatus.currentOrderId !== null) {
            throw new Error(`Expected currentOrder to be null (no extra order created), got: ${finalStatus.currentOrderId}`);
          }
          if (!finalStatus.victoryVisible) {
            throw new Error(`Expected victory modal to be visible, got victoryVisible=${finalStatus.victoryVisible}`);
          }

          // Verify zero orphan pieces on the board
          const orphanCheck = await callCDP('Runtime.evaluate', {
            expression: `
              (function() {
                const app = window.__app;
                const mgr = app.dishPuzzleManager;
                const pieces = mgr.getAllPieces();
                const orphans = pieces.filter(p => !mgr._instances.has(p.dishPuzzleInstanceId));
                return {
                  totalPieces: pieces.length,
                  orphanCount: orphans.length
                };
              })()
            `,
            returnByValue: true
          });
          console.log('Orphan Check Result:', orphanCheck.result?.value);
          if (orphanCheck.result?.value?.orphanCount > 0) {
            throw new Error(`Found ${orphanCheck.result.value.orphanCount} orphan pieces on board!`);
          }

          await saveScreenshot(callCDP, 'shot_day1_victory.png');

          console.log('\n======================================================');
          console.log('SUCCESS: Full Day Loop 100% verified via real pointer paths!');
          console.log(`- Orders completed: ${finalStatus.ordersFulfilledCount}/3 (Salad #1001, #1002, #1003)`);
          console.log(`- Final Revenue: ¥${finalStatus.revenue} / ¥${finalStatus.businessGoal} (Goal reached)`);
          console.log(`- Order Advancement: Halted (currentOrder is null)`);
          console.log(`- Victory Modal: Displayed ("今天辛苦啦")`);
          console.log(`- Orphan Pieces: 0`);
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
  console.log('Full Day Loop verification completed successfully!');
  process.exit(0);
}).catch(err => {
  console.error('Full Day Loop verification failed:', err);
  process.exit(1);
});
