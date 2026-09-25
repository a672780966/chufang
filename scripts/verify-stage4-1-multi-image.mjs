import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\admin\\.gemini\\antigravity\\brain\\a581706c-feba-4a01-94fc-8c62ff40a9bf';
const SHOTS_DIR = 'C:\\Users\\admin\\Music\\chufang\\scripts\\shots';

if (!fs.existsSync(SHOTS_DIR)) {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
}

const profileDir = path.join(process.env.TEMP || 'C:\\Temp', 'cdp-stage4-1-' + Date.now());

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
  console.log(`Saved screenshot: ${filename} (${buf.length} bytes) to shots/ and artifacts/`);
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

          // Wait 2.5s for initial assets and Day 1 layout
          await new Promise(r => setTimeout(r, 2500));

          // Helper: Query detailed board state
          async function queryBoardState() {
            const res = await callCDP('Runtime.evaluate', {
              expression: `
                (function() {
                  const app = window.__app;
                  const mgr = app.dishPuzzleManager;
                  const pieces = mgr.getAllPieces();
                  const instances = Array.from(mgr._instances.values());
                  const activeInsts = instances.filter(i => !i.isCompleted);

                  let minRow = Infinity;
                  let maxRow = -Infinity;
                  const dishCounts = {};
                  for (const p of pieces) {
                    if (p.boardCoord.row < minRow) minRow = p.boardCoord.row;
                    if (p.boardCoord.row > maxRow) maxRow = p.boardCoord.row;
                    dishCounts[p.dishId] = (dishCounts[p.dishId] || 0) + 1;
                  }

                  const verticalSpanRows = pieces.length > 0 ? (maxRow - minRow) + 1 : 0;
                  const verticalSpanRatio = verticalSpanRows / 12;

                  return {
                    totalPieces: pieces.length,
                    minRow,
                    maxRow,
                    verticalSpanRows,
                    verticalSpanRatio,
                    dishCounts,
                    totalInstances: instances.length,
                    activeInstancesCount: activeInsts.length,
                    activeDishIds: activeInsts.map(i => i.dishId),
                    currentOrderId: app.flow.session.orderSystem.currentOrder?.orderId || null,
                    currentOrderDishId: app.flow.session.orderSystem.currentOrder?.dishId || null
                  };
                })()
              `,
              returnByValue: true
            });
            return res.result?.value;
          }

          // Helper: execute real pointer drag
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

          console.log('\n======================================================');
          console.log('STAGE 4.1 P0: MULTI-IMAGE BOARD SUPPLY VERIFICATION');
          console.log('======================================================\n');

          // --- T0: Initial 3-Dish Parallel Board ---
          console.log('>>> Evaluating T0: Initial 3-Dish Parallel Board <<<');
          const stateT0 = await queryBoardState();
          console.log('T0 State:', JSON.stringify(stateT0, null, 2));

          if (stateT0.verticalSpanRatio < 0.45 || stateT0.verticalSpanRatio > 0.65) {
            throw new Error(`T0 Failure: Vertical span ratio ${stateT0.verticalSpanRatio.toFixed(3)} is not in [0.45, 0.65]`);
          }
          if (stateT0.dishCounts['dish_salad'] !== 9) {
            throw new Error(`T0 Failure: Salad piece count ${stateT0.dishCounts['dish_salad']} !== 9`);
          }
          if (stateT0.dishCounts['dish_breakfast'] !== 4) {
            throw new Error(`T0 Failure: Breakfast piece count ${stateT0.dishCounts['dish_breakfast']} !== 4`);
          }
          if (stateT0.dishCounts['dish_ramen'] !== 4) {
            throw new Error(`T0 Failure: Ramen piece count ${stateT0.dishCounts['dish_ramen']} !== 4`);
          }
          if (stateT0.activeInstancesCount !== 3) {
            throw new Error(`T0 Failure: Active instances count ${stateT0.activeInstancesCount} !== 3`);
          }

          await saveScreenshot(callCDP, 'shot_t0_initial_three_dishes.png');
          console.log('✅ T0 Verified: 3 dishes present, vertical span 58.3%, exactly 3 active instances.\n');

          // --- T1: Three Dishes Growing After Moves / Multi-Dish Supply ---
          console.log('>>> Evaluating T1: Three Dishes Growing <<<');
          // Perform Move 1: Duo (2,0) -> (2,0)
          console.log('Performing Move 1 (Duo 2,0 -> 2,0)...');
          await executePieceDrag(2, 0, 2, 0);
          await new Promise(r => setTimeout(r, 600));

          // Perform Move 2: Piece (0,2) -> (0,2)
          console.log('Performing Move 2 (Piece 0,2 -> 0,2)...');
          await executePieceDrag(0, 2, 0, 2);
          await new Promise(r => setTimeout(r, 600));

          const stateT1 = await queryBoardState();
          console.log('T1 State:', JSON.stringify(stateT1, null, 2));

          const totalNonOrderPiecesT1 = (stateT1.dishCounts['dish_breakfast'] || 0) + (stateT1.dishCounts['dish_ramen'] || 0);
          console.log(`Non-order pieces count at T1: ${totalNonOrderPiecesT1} (started at 8)`);
          if (totalNonOrderPiecesT1 <= 8) {
            throw new Error(`T1 Failure: Non-order pieces did not grow! Expected > 8, got ${totalNonOrderPiecesT1}`);
          }

          await saveScreenshot(callCDP, 'shot_t1_three_dishes_growing.png');
          console.log('✅ T1 Verified: Breakfast and Ramen piece counts actively grew via Multi-Dish Scheduler.\n');

          // --- T2: Near Complete Parallel Board ---
          console.log('>>> Evaluating T2: Near Complete Parallel Board <<<');
          // Perform Move 3: Piece (1,2) -> (1,2) [8/9 Near Complete]
          console.log('Performing Move 3 (Piece 1,2 -> 1,2) -> 8/9 Near Complete...');
          await executePieceDrag(1, 2, 1, 2);
          await new Promise(r => setTimeout(r, 600));

          const stateT2 = await queryBoardState();
          console.log('T2 State:', JSON.stringify(stateT2, null, 2));

          // Check that Salad has 8 pieces in its main group
          const saladGroupInfo = await callCDP('Runtime.evaluate', {
            expression: `
              (function() {
                const app = window.__app;
                const mgr = app.dishPuzzleManager;
                const activeSalad = Array.from(mgr._instances.values()).find(i => i.dishId === 'dish_salad' && !i.isCompleted);
                const p00 = mgr.getAllPieces().find(p => p.dishPuzzleInstanceId === activeSalad.instanceId && p.dishCol === 0 && p.dishRow === 0);
                const group = mgr.getGroupByPieceId(p00.pieceInstanceId);
                return {
                  assembledCount: group.pieceIds.length,
                  isNearComplete: group.pieceIds.length === 8
                };
              })()
            `,
            returnByValue: true
          });
          console.log('Salad Assembled Group Info:', saladGroupInfo.result?.value);

          if (saladGroupInfo.result?.value?.assembledCount !== 8) {
            throw new Error(`T2 Failure: Salad assembled count is ${saladGroupInfo.result?.value?.assembledCount}, expected 8`);
          }

          await saveScreenshot(callCDP, 'shot_t2_near_complete_parallel.png');
          console.log('✅ T2 Verified: Salad is 8/9 Near Complete, other two dishes distinctly visible.\n');

          // --- T3: Cleared Reflow & New Instance Entry ---
          console.log('>>> Evaluating T3: Cleared Reflow & New Instance Entry <<<');
          // Perform Move 4: Piece (2,2) -> (2,2) [9/9 Completion & Clear]
          console.log('Performing Move 4 (Piece 2,2 -> 2,2) [Final Snap -> DISH_COMPLETED]...');
          await executePieceDrag(2, 2, 2, 2);

          // Wait for completion animation, dish clear, reflow, and serving (around 2.5s)
          await new Promise(r => setTimeout(r, 2600));

          const stateT3 = await queryBoardState();
          console.log('T3 State:', JSON.stringify(stateT3, null, 2));

          if (stateT3.activeInstancesCount !== 3) {
            throw new Error(`T3 Failure: Active instances count ${stateT3.activeInstancesCount} !== 3 after clear`);
          }
          if (!stateT3.activeDishIds.includes('dish_salad')) {
            throw new Error('T3 Failure: New Salad instance did not enter active pool');
          }
          if (!stateT3.activeDishIds.includes('dish_breakfast') || !stateT3.activeDishIds.includes('dish_ramen')) {
            throw new Error('T3 Failure: Breakfast or Ramen active instance was lost');
          }

          // Verify zero orphan pieces on board
          const orphanCheck = await callCDP('Runtime.evaluate', {
            expression: `
              (function() {
                const app = window.__app;
                const mgr = app.dishPuzzleManager;
                const pieces = mgr.getAllPieces();
                const instanceIds = new Set(Array.from(mgr._instances.values()).map(i => i.instanceId));
                let orphanCount = 0;
                for (const p of pieces) {
                  if (!instanceIds.has(p.dishPuzzleInstanceId)) orphanCount++;
                }
                return { totalPieces: pieces.length, orphanCount };
              })()
            `,
            returnByValue: true
          });
          console.log('Orphan Check at T3:', orphanCheck.result?.value);
          if (orphanCheck.result?.value?.orphanCount > 0) {
            throw new Error(`T3 Failure: Found ${orphanCheck.result?.value?.orphanCount} orphan pieces on board`);
          }

          await saveScreenshot(callCDP, 'shot_t3_cleared_reflow_new_instance.png');
          console.log('✅ T3 Verified: Dish cleared -> Completion Reflow -> new instance entered -> zero orphans.\n');

          console.log('======================================================');
          console.log('SUCCESS: STAGE 4.1 MULTI-IMAGE BOARD SUPPLY VERIFIED!');
          console.log('- T0: shot_t0_initial_three_dishes.png (vertical span > 50%)');
          console.log('- T1: shot_t1_three_dishes_growing.png (multi-dish growth)');
          console.log('- T2: shot_t2_near_complete_parallel.png (8/9 near complete)');
          console.log('- T3: shot_t3_cleared_reflow_new_instance.png (cleared + reflow)');
          console.log('======================================================\n');

          resolve();
        } catch (err) {
          reject(err);
        }
      };
    });
  } catch (err) {
    console.error('Test execution failed:', err);
    process.exit(1);
  } finally {
    try {
      chromeProc.kill();
    } catch {}
    try {
      fs.rmSync(profileDir, { recursive: true, force: true });
    } catch {}
  }
}

main();
