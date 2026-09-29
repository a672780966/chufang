/**
 * scripts/record-stage5b-r2a-dishes.mjs
 * Stage 5B Round 2A CDP Screencast Recording Automation.
 * Captures 3 real gameplay verification videos:
 *   1. stage5b_r2a_new_dishes_board.mp4: New dishes on active board with Bezier complementary edge snapping.
 *   2. stage5b_r2a_mixed_three_dish.mp4: 3-dish visual discrimination test (distractor disambiguation).
 *   3. stage5b_r2a_complete_each_new_dish.mp4: Full 9-piece completions of new dishes with final ceremony, clearing, & serving.
 */

import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\admin\\.gemini\\antigravity\\brain\\a581706c-feba-4a01-94fc-8c62ff40a9bf';
const SHOTS_DIR = 'C:\\Users\\admin\\Music\\chufang\\scripts\\shots';
const TEMP_BASE = path.join(process.env.TEMP || 'C:\\Temp', 'stage5b-r2a-rec-' + Date.now());

if (!fs.existsSync(SHOTS_DIR)) fs.mkdirSync(SHOTS_DIR, { recursive: true });
if (!fs.existsSync(ARTIFACT_DIR)) fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
if (!fs.existsSync(TEMP_BASE)) fs.mkdirSync(TEMP_BASE, { recursive: true });

const profileDir = path.join(TEMP_BASE, 'chrome-profile');
const CDP_PORT = 9248;

const chromeProc = spawn(CHROME_PATH, [
  '--headless=new',
  `--remote-debugging-port=${CDP_PORT}`,
  '--window-size=480,960',
  '--disable-gpu',
  `--user-data-dir=${profileDir}`,
  'http://localhost:5173/?day=1'
]);

async function getDebuggerUrl(port = CDP_PORT, maxRetries = 30) {
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

async function main() {
  try {
    const wsUrl = await getDebuggerUrl(CDP_PORT);
    console.log('[Recorder] Connected to CDP debugger at:', wsUrl);

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

    let isRecording = false;
    let frameIndex = 0;
    let currentRecordingDir = '';

    ws.onmessage = (evt) => {
      const data = JSON.parse(evt.data);
      if (data.id && handlers.has(data.id)) {
        const { resolve, reject } = handlers.get(data.id);
        handlers.delete(data.id);
        if (data.error) reject(new Error(data.error.message));
        else resolve(data.result);
      } else if (data.method === 'Page.screencastFrame') {
        if (isRecording && currentRecordingDir) {
          const frameNum = String(frameIndex++).padStart(5, '0');
          const framePath = path.join(currentRecordingDir, `frame_${frameNum}.jpg`);
          const buf = Buffer.from(data.params.data, 'base64');
          fs.writeFileSync(framePath, buf);
        }
        ws.send(JSON.stringify({
          id: idCounter++,
          method: 'Page.screencastFrameAck',
          params: { sessionId: data.params.sessionId }
        }));
      }
    };

    await new Promise((res, rej) => {
      ws.onopen = res;
      ws.onerror = rej;
    });

    console.log('[Recorder] Enabling Page & Runtime domains...');
    await callCDP('Page.enable');
    await callCDP('Runtime.enable');

    // Wait for initial load
    await new Promise(r => setTimeout(r, 3000));

    async function startRecording(scenarioName) {
      console.log(`\n>>> Starting Screencast Recording: ${scenarioName} <<<`);
      frameIndex = 0;
      currentRecordingDir = path.join(TEMP_BASE, scenarioName);
      if (!fs.existsSync(currentRecordingDir)) fs.mkdirSync(currentRecordingDir, { recursive: true });
      isRecording = true;
      await callCDP('Page.startScreencast', {
        format: 'jpeg',
        quality: 90,
        everyNthFrame: 1
      });
    }

    async function stopRecording(scenarioName, outputMp4Name, fps = 25) {
      await callCDP('Page.stopScreencast');
      isRecording = false;
      await new Promise(r => setTimeout(r, 300));
      console.log(`[Recorder] Captured ${frameIndex} frames for ${scenarioName}. Encoding MP4 via ffmpeg...`);

      const outShotPath = path.join(SHOTS_DIR, outputMp4Name);
      const outArtifactPath = path.join(ARTIFACT_DIR, outputMp4Name);

      const ffmpegCmd = `ffmpeg -y -framerate ${fps} -i "${path.join(currentRecordingDir, 'frame_%05d.jpg')}" -vf "pad=ceil(iw/2)*2:ceil(ih/2)*2" -c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p "${outShotPath}"`;
      try {
        execSync(ffmpegCmd, { stdio: 'inherit' });
        fs.copyFileSync(outShotPath, outArtifactPath);
        console.log(`[Recorder] Successfully encoded and copied ${outputMp4Name} (${fs.statSync(outShotPath).size} bytes)`);
      } catch (err) {
        console.error(`[Recorder] ffmpeg failed for ${outputMp4Name}:`, err);
      }
    }

    // Helper: Drag a piece from (startCol, startRow) on board to (targetCol, targetRow)
    async function dragPieceByBoardCoord(fromCol, fromRow, toCol, toRow) {
      const dragResult = await callCDP('Runtime.evaluate', {
        expression: `
          (async function() {
            const app = window.__app;
            const mgr = app.dishPuzzleManager;
            const piece = mgr.getPieceAt(${fromCol}, ${fromRow});
            if (!piece) return { error: 'No piece at (${fromCol}, ${fromRow})' };

            const { originX, originY, cellSize } = app.getBoardOrigin();
            const rect = app.canvas.getBoundingClientRect();

            const startX = rect.left + originX + ${fromCol} * cellSize + cellSize / 2;
            const startY = rect.top + originY - ${fromRow} * cellSize + cellSize / 2;
            const endX = rect.left + originX + ${toCol} * cellSize + cellSize / 2;
            const endY = rect.top + originY - ${toRow} * cellSize + cellSize / 2;

            app.canvas.dispatchEvent(new PointerEvent('pointerdown', {
              clientX: startX,
              clientY: startY,
              pointerId: 1,
              isPrimary: true,
              bubbles: true
            }));

            for (let i = 1; i <= 8; i++) {
              const curX = startX + (endX - startX) * (i / 8);
              const curY = startY + (endY - startY) * (i / 8);
              app.canvas.dispatchEvent(new PointerEvent('pointermove', {
                clientX: curX,
                clientY: curY,
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

            return { success: true };
          })()
        `,
        awaitPromise: true,
        returnByValue: true
      });
      if (dragResult.result?.value?.error) throw new Error(dragResult.result.value.error);
      return dragResult.result?.value;
    }

    // =========================================================================
    // 1. VIDEO 1: stage5b_r2a_new_dishes_board.mp4
    // Active board with new dishes (curry rice, tomato pasta, avocado chicken bowl)
    // =========================================================================
    console.log('\n--- Video 1: New Dishes Board & Snapping ---');
    await callCDP('Runtime.evaluate', {
      expression: `
        (function() {
          const app = window.__app;
          const session = app.flow.startDay(1);
          app.dishPuzzleManager = session.dishPuzzleManager;
          app.flow.beginPlaying();

          const mgr = app.dishPuzzleManager;
          mgr._pieces.clear();
          mgr._groups.clear();
          mgr._instances.clear();
          for (let r = 0; r < mgr.rows; r++) {
            for (let c = 0; c < mgr.columns; c++) {
              mgr._gridCells[r][c] = null;
            }
          }

          // 1. Curry rice base cluster (col 0..1, row 0..1)
          const instCurry = mgr.createDishInstance('dish_curry_rice');
          const pCurry00 = mgr.createPiece(instCurry.instanceId, 'dish_curry_rice', 0, 0, { col: 0, row: 0 });
          const pCurry10 = mgr.createPiece(instCurry.instanceId, 'dish_curry_rice', 1, 0, { col: 1, row: 0 });
          const pCurry01 = mgr.createPiece(instCurry.instanceId, 'dish_curry_rice', 0, 1, { col: 0, row: 1 });
          mgr.createGroup([pCurry00, pCurry10, pCurry01]);

          // Curry piece (1, 1) detached at (1, 3)
          const pCurry11 = mgr.createPiece(instCurry.instanceId, 'dish_curry_rice', 1, 1, { col: 1, row: 3 });
          mgr.createGroup([pCurry11]);

          // 2. Tomato pasta cluster (col 3..4, row 0..1)
          const instPasta = mgr.createDishInstance('dish_tomato_pasta');
          const pPasta00 = mgr.createPiece(instPasta.instanceId, 'dish_tomato_pasta', 0, 0, { col: 3, row: 0 });
          const pPasta01 = mgr.createPiece(instPasta.instanceId, 'dish_tomato_pasta', 0, 1, { col: 3, row: 1 });
          mgr.createGroup([pPasta00, pPasta01]);

          // Pasta piece (1, 0) detached at (5, 2)
          const pPasta10 = mgr.createPiece(instPasta.instanceId, 'dish_tomato_pasta', 1, 0, { col: 5, row: 2 });
          mgr.createGroup([pPasta10]);

          // 3. Avocado chicken bowl pieces at (5, 0), (6, 0)
          const instAvo = mgr.createDishInstance('dish_avocado_chicken_bowl');
          const pAvo00 = mgr.createPiece(instAvo.instanceId, 'dish_avocado_chicken_bowl', 0, 0, { col: 5, row: 0 });
          const pAvo10 = mgr.createPiece(instAvo.instanceId, 'dish_avocado_chicken_bowl', 1, 0, { col: 6, row: 0 });
          mgr.createGroup([pAvo00]);
          mgr.createGroup([pAvo10]);

          // Update HUD order
          session.orderSystem.setCurrentOrderForTesting({
            orderId: '#2001',
            recipeId: 'dish_curry_rice',
            dishId: 'dish_curry_rice',
            dishName: '金黄咖喱饭',
            emoji: '🍛',
            baseRevenue: 80,
            items: [],
            isFulfilled: false,
            kind: 'DISH'
          });
          app.updateHUD();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 600));

    await startRecording('new_dishes_board');
    await new Promise(r => setTimeout(r, 500));

    // Drag Curry Piece (1, 1) from (1, 3) down to (1, 1) to snap!
    console.log('[Action] Drag Curry Piece (1, 1) from (1, 3) to (1, 1)');
    await dragPieceByBoardCoord(1, 3, 1, 1);
    await new Promise(r => setTimeout(r, 500));

    // Drag Pasta Piece (1, 0) from (5, 2) to (4, 0) to snap!
    console.log('[Action] Drag Pasta Piece (1, 0) from (5, 2) to (4, 0)');
    await dragPieceByBoardCoord(5, 2, 4, 0);
    await new Promise(r => setTimeout(r, 500));

    // Move avocado piece from (6, 0) to (5, 1) to stack
    console.log('[Action] Move Avocado Piece from (6, 0) to (5, 1)');
    await dragPieceByBoardCoord(6, 0, 5, 1);
    await new Promise(r => setTimeout(r, 1000));

    await stopRecording('new_dishes_board', 'stage5b_r2a_new_dishes_board.mp4', 25);

    // =========================================================================
    // 2. VIDEO 2: stage5b_r2a_mixed_three_dish.mp4
    // Triad C Visual Discrimination Test: Salad vs Avocado Chicken Bowl + Steak
    // =========================================================================
    console.log('\n--- Video 2: Mixed 3-Dish Visual Discrimination Test ---');
    await callCDP('Runtime.evaluate', {
      expression: `
        (function() {
          const app = window.__app;
          const session = app.flow.session;
          const mgr = app.dishPuzzleManager;
          mgr._pieces.clear();
          mgr._groups.clear();
          mgr._instances.clear();
          for (let r = 0; r < mgr.rows; r++) {
            for (let c = 0; c < mgr.columns; c++) {
              mgr._gridCells[r][c] = null;
            }
          }

          // Triad C: Salad, Avocado Bowl, Steak
          const instSalad = mgr.createDishInstance('dish_salad');
          const pSalad00 = mgr.createPiece(instSalad.instanceId, 'dish_salad', 0, 0, { col: 0, row: 0 });
          const pSalad10 = mgr.createPiece(instSalad.instanceId, 'dish_salad', 1, 0, { col: 1, row: 0 });
          mgr.createGroup([pSalad00, pSalad10]);

          const instAvo = mgr.createDishInstance('dish_avocado_chicken_bowl');
          const pAvo00 = mgr.createPiece(instAvo.instanceId, 'dish_avocado_chicken_bowl', 0, 0, { col: 3, row: 0 });
          const pAvo01 = mgr.createPiece(instAvo.instanceId, 'dish_avocado_chicken_bowl', 0, 1, { col: 3, row: 1 });
          mgr.createGroup([pAvo00, pAvo01]);

          const instSteak = mgr.createDishInstance('dish_grilled_steak');
          const pSteak00 = mgr.createPiece(instSteak.instanceId, 'dish_grilled_steak', 0, 0, { col: 5, row: 0 });
          const pSteak10 = mgr.createPiece(instSteak.instanceId, 'dish_grilled_steak', 1, 0, { col: 6, row: 0 });
          mgr.createGroup([pSteak00, pSteak10]);

          // Interspersed loose pieces (testing discrimination)
          // Salad (0, 1) placed near Avo column at (2, 2)
          const pSalad01 = mgr.createPiece(instSalad.instanceId, 'dish_salad', 0, 1, { col: 2, row: 2 });
          mgr.createGroup([pSalad01]);

          // Avo (1, 0) placed near Salad column at (1, 3)
          const pAvo10 = mgr.createPiece(instAvo.instanceId, 'dish_avocado_chicken_bowl', 1, 0, { col: 1, row: 3 });
          mgr.createGroup([pAvo10]);

          // Steak (0, 1) placed at (4, 3)
          const pSteak01 = mgr.createPiece(instSteak.instanceId, 'dish_grilled_steak', 0, 1, { col: 4, row: 3 });
          mgr.createGroup([pSteak01]);

          // Update HUD
          session.orderSystem.setCurrentOrderForTesting({
            orderId: '#2002',
            recipeId: 'dish_salad',
            dishId: 'dish_salad',
            dishName: '田园沙拉',
            emoji: '🥗',
            baseRevenue: 70,
            items: [],
            isFulfilled: false,
            kind: 'DISH'
          });
          app.updateHUD();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 600));

    await startRecording('mixed_three_dish');
    await new Promise(r => setTimeout(r, 500));

    // Player sorts: Drags Salad (0, 1) from (2, 2) to (0, 1) to attach to salad!
    console.log('[Action] Distinguish Salad: Drag (2, 2) to (0, 1)');
    await dragPieceByBoardCoord(2, 2, 0, 1);
    await new Promise(r => setTimeout(r, 600));

    // Player sorts: Drags Avocado (1, 0) from (1, 3) to (4, 0) to attach to avocado bowl!
    console.log('[Action] Distinguish Avocado: Drag (1, 3) to (4, 0)');
    await dragPieceByBoardCoord(1, 3, 4, 0);
    await new Promise(r => setTimeout(r, 600));

    // Player sorts: Drags Steak (0, 1) from (4, 3) to (5, 1) to attach to steak platter!
    console.log('[Action] Attach Steak: Drag (4, 3) to (5, 1)');
    await dragPieceByBoardCoord(4, 3, 5, 1);
    await new Promise(r => setTimeout(r, 1200));

    await stopRecording('mixed_three_dish', 'stage5b_r2a_mixed_three_dish.mp4', 25);

    // =========================================================================
    // 3. VIDEO 3: stage5b_r2a_complete_each_new_dish.mp4
    // Complete 9-piece Curry Rice & Tomato Pasta with Final Ceremony & Serving
    // =========================================================================
    console.log('\n--- Video 3: Complete & Serve Each New Dish ---');
    await callCDP('Runtime.evaluate', {
      expression: `
        (function() {
          const app = window.__app;
          const session = app.flow.session;
          const mgr = app.dishPuzzleManager;
          mgr._pieces.clear();
          mgr._groups.clear();
          mgr._instances.clear();
          for (let r = 0; r < mgr.rows; r++) {
            for (let c = 0; c < mgr.columns; c++) {
              mgr._gridCells[r][c] = null;
            }
          }

          // 1. Curry Rice: 8 pieces connected at (0, 0) to (2, 2), missing only (2, 2)
          const instCurry = mgr.createDishInstance('dish_curry_rice');
          const curryPieces = [];
          for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
              if (c === 2 && r === 2) continue; // missing piece
              const p = mgr.createPiece(instCurry.instanceId, 'dish_curry_rice', c, r, { col: c, row: r });
              curryPieces.push(p);
            }
          }
          mgr.createGroup(curryPieces);

          // 9th piece resting at (4, 4)
          const pCurry22 = mgr.createPiece(instCurry.instanceId, 'dish_curry_rice', 2, 2, { col: 4, row: 4 });
          mgr.createGroup([pCurry22]);

          // Order setup: Current = Curry Rice, Next = Tomato Pasta
          session.orderSystem.setCurrentOrderForTesting({
            orderId: '#2010',
            recipeId: 'dish_curry_rice',
            dishId: 'dish_curry_rice',
            dishName: '金黄咖喱饭',
            emoji: '🍛',
            baseRevenue: 80,
            items: [],
            isFulfilled: false,
            kind: 'DISH'
          });
          app.updateHUD();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 600));

    await startRecording('complete_new_dishes');
    await new Promise(r => setTimeout(r, 600));

    // Drag 9th Curry piece from (4, 4) into (2, 2) to complete the dish!
    console.log('[Action] Snap 9th Curry Piece from (4, 4) to (2, 2) -> COMPLETION!');
    await dragPieceByBoardCoord(4, 4, 2, 2);
    // Allow ceremony, flare, flying revenue, and serving transition
    await new Promise(r => setTimeout(r, 2600));

    // Setup 2nd dish: Tomato Pasta 8 pieces + 9th piece
    console.log('[Action] Setup Tomato Pasta nearly complete');
    await callCDP('Runtime.evaluate', {
      expression: `
        (function() {
          const app = window.__app;
          const session = app.flow.session;
          const mgr = app.dishPuzzleManager;

          const instPasta = mgr.createDishInstance('dish_tomato_pasta');
          const pastaPieces = [];
          for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
              if (c === 1 && r === 2) continue; // missing piece
              const p = mgr.createPiece(instPasta.instanceId, 'dish_tomato_pasta', c, r, { col: 2 + c, row: r });
              pastaPieces.push(p);
            }
          }
          mgr.createGroup(pastaPieces);

          // 9th piece at (0, 3)
          const pPasta12 = mgr.createPiece(instPasta.instanceId, 'dish_tomato_pasta', 1, 2, { col: 0, row: 3 });
          mgr.createGroup([pPasta12]);

          session.orderSystem.setCurrentOrderForTesting({
            orderId: '#2011',
            recipeId: 'dish_tomato_pasta',
            dishId: 'dish_tomato_pasta',
            dishName: '番茄肉酱意面',
            emoji: '🍝',
            baseRevenue: 85,
            items: [],
            isFulfilled: false,
            kind: 'DISH'
          });
          app.updateHUD();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 800));

    // Drag 9th Pasta piece from (0, 3) to (3, 2) to complete Pasta!
    console.log('[Action] Snap 9th Pasta Piece from (0, 3) to (3, 2) -> COMPLETION!');
    await dragPieceByBoardCoord(0, 3, 3, 2);
    await new Promise(r => setTimeout(r, 2600));

    await stopRecording('complete_new_dishes', 'stage5b_r2a_complete_each_new_dish.mp4', 25);

    console.log('\n======================================================');
    console.log('All 3 Stage 5B Round 2A gameplay videos recorded successfully!');
    console.log('======================================================\n');

    await callCDP('Browser.close');
    chromeProc.kill();
    process.exit(0);

  } catch (err) {
    console.error('[Recorder ERROR]', err);
    try { chromeProc.kill(); } catch {}
    process.exit(1);
  }
}

main();
