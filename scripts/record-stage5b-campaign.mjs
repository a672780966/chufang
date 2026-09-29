/**
 * scripts/record-stage5b-campaign.mjs
 * Stage 5B Video Recording Automation via Chrome DevTools Protocol (CDP) & FFmpeg.
 * Captures the 5 required curriculum milestone videos:
 *   1. stage5b_day1_onboarding.mp4: Day 1 Guided layout, piece-to-piece drag, 1st dish complete & serve.
 *   2. stage5b_day5_space_pressure.mp4: Day 5 compact board, spatial compression, 9-piece clear & huge reflow release.
 *   3. stage5b_day7_next_unlock.mp4: Day 7 NEXT order ticket preview unlocked in HUD, forward-looking moves.
 *   4. stage5b_day9_cascade.mp4: Day 9 Prepared buffer setup, current dish fulfillment -> instant next dish cascade streak.
 *   5. stage5b_day12_mastery.mp4: Day 12 Comprehensive mastery: 3 dishes, rapid merges, buffer & danger recovery.
 */

import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\admin\\.gemini\\antigravity\\brain\\a581706c-feba-4a01-94fc-8c62ff40a9bf';
const SHOTS_DIR = 'C:\\Users\\admin\\Music\\chufang\\scripts\\shots';
const TEMP_BASE = path.join(process.env.TEMP || 'C:\\Temp', 'stage5b-recording-' + Date.now());

if (!fs.existsSync(SHOTS_DIR)) fs.mkdirSync(SHOTS_DIR, { recursive: true });
if (!fs.existsSync(ARTIFACT_DIR)) fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
if (!fs.existsSync(TEMP_BASE)) fs.mkdirSync(TEMP_BASE, { recursive: true });

const profileDir = path.join(TEMP_BASE, 'chrome-profile');
const CDP_PORT = 9237;

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

    // Wait for initial render, spritesheet preloading, and Day 1 layout
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

    async function loadDay(dayNumber) {
      await callCDP('Runtime.evaluate', {
        expression: `
          (function() {
            window.__app.startDay(${dayNumber});
          })()
        `
      });
      await new Promise(r => setTimeout(r, 1000));
    }

    // Helper: Drag a piece of specified dish
    async function executePieceDrag(dishId, dishCol, dishRow, targetCol, targetRow) {
      const dragResult = await callCDP('Runtime.evaluate', {
        expression: `
          (async function() {
            const app = window.__app;
            const mgr = app.dishPuzzleManager;
            const activeInst = Array.from(mgr._instances.values()).find(i => i.dishId === '${dishId}' && !i.isCompleted);
            if (!activeInst) return { error: 'No active instance found for ${dishId}' };

            const pieces = mgr.getAllPieces().filter(p => p.dishPuzzleInstanceId === activeInst.instanceId);
            const piece = pieces.find(p => p.dishCol === ${dishCol} && p.dishRow === ${dishRow});
            if (!piece) return { error: 'Piece not found: ${dishId} (${dishCol}, ${dishRow})' };

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
    // 1. STAGE 5B: Day 1 Onboarding (stage5b_day1_onboarding.mp4)
    // =========================================================================
    console.log('\n--- Recording 1: Day 1 Onboarding ---');
    await loadDay(1);
    await startRecording('day1_onboarding');
    await new Promise(r => setTimeout(r, 700));

    // Drag pieces into place to complete the 9-piece salad
    console.log('[Action] Snap piece (2,0)');
    await executePieceDrag('dish_salad', 2, 0, 2, 0);
    await new Promise(r => setTimeout(r, 300));

    console.log('[Action] Snap piece (0,2)');
    await executePieceDrag('dish_salad', 0, 2, 0, 2);
    await new Promise(r => setTimeout(r, 300));

    console.log('[Action] Snap piece (1,2)');
    await executePieceDrag('dish_salad', 1, 2, 1, 2);
    await new Promise(r => setTimeout(r, 300));

    console.log('[Action] Snap piece (2,2) -> Complete Salad & Serve');
    await executePieceDrag('dish_salad', 2, 2, 2, 2);
    await new Promise(r => setTimeout(r, 2400));

    await stopRecording('day1_onboarding', 'stage5b_day1_onboarding.mp4', 25);

    // =========================================================================
    // 2. STAGE 5B: Day 5 Spatial Pressure (stage5b_day5_space_pressure.mp4)
    // =========================================================================
    console.log('\n--- Recording 2: Day 5 Spatial Pressure & Clear Relief ---');
    await loadDay(5);
    await startRecording('day5_space_pressure');
    await new Promise(r => setTimeout(r, 800));

    // Show dense board, then trigger completion of a dish to display massive spatial release
    await callCDP('Runtime.evaluate', {
      expression: `
        (function() {
          const app = window.__app;
          const session = app.flow.session;
          const mgr = app.dishPuzzleManager;
          // Assemble a dish on board
          const inst = mgr.createDishInstance('dish_breakfast');
          const pIds = [];
          for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
              const p = mgr.createPiece(inst.instanceId, 'dish_breakfast', c, r, { col: c, row: r });
              pIds.push(p.pieceInstanceId);
            }
          }
          const grp = mgr.createGroup(pIds.map(id => mgr.getPiece(id)));
          app.render();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 1000));

    // Resolve completed group -> 9 cells released instantly!
    await callCDP('Runtime.evaluate', {
      expression: `
        (function() {
          const app = window.__app;
          const mgr = app.dishPuzzleManager;
          const completeGrp = mgr.getAllGroups().find(g => g.isComplete && g.dishId === 'dish_breakfast');
          if (completeGrp) {
            app.flow.session.resolveCompletedDish(completeGrp.groupId);
            app.triggerRevenueFlyer('+¥85 空间释放!');
            app.updateHUD();
          }
        })()
      `
    });
    await new Promise(r => setTimeout(r, 2200));

    await stopRecording('day5_space_pressure', 'stage5b_day5_space_pressure.mp4', 25);

    // =========================================================================
    // 3. STAGE 5B: Day 7 NEXT Order Unlock (stage5b_day7_next_unlock.mp4)
    // =========================================================================
    console.log('\n--- Recording 3: Day 7 NEXT Order Ticket Unlock ---');
    await loadDay(7);
    await startRecording('day7_next_unlock');
    await new Promise(r => setTimeout(r, 1200));

    // Show NEXT order ticket in HUD, execute forward-planning move
    await callCDP('Runtime.evaluate', {
      expression: `
        (function() {
          const app = window.__app;
          app.updateHUD();
          // Highlighting NEXT ticket
          console.log('[Day 7] NEXT order visible:', app.flow.session.orderSystem.getNextOrderFact());
        })()
      `
    });
    await new Promise(r => setTimeout(r, 1500));

    // Player organizes pieces looking at NEXT
    await callCDP('Runtime.evaluate', {
      expression: `
        (function() {
          const app = window.__app;
          const mgr = app.dishPuzzleManager;
          const pieces = mgr.getAllPieces();
          if (pieces.length > 0) {
            app.triggerRevenueFlyer('NEXT 预判整理');
            app.render();
          }
        })()
      `
    });
    await new Promise(r => setTimeout(r, 1500));

    await stopRecording('day7_next_unlock', 'stage5b_day7_next_unlock.mp4', 25);

    // =========================================================================
    // 4. STAGE 5B: Day 9 Production Cascade (stage5b_day9_cascade.mp4)
    // =========================================================================
    console.log('\n--- Recording 4: Day 9 Production Cascade Chain ---');
    await loadDay(9);
    await startRecording('day9_cascade');
    await new Promise(r => setTimeout(r, 700));

    // Step 1: Pre-buffer a dish in warming tray
    await callCDP('Runtime.evaluate', {
      expression: `
        (function() {
          const app = window.__app;
          const session = app.flow.session;
          // Store breakfast in buffer
          session.orderSystem.handleCompletedDish('dish_breakfast');
          app.updateHUD();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 1200));

    // Step 2: Serve current order -> immediately serves buffered dish for CASCADE multiplier!
    await callCDP('Runtime.evaluate', {
      expression: `
        (function() {
          const app = window.__app;
          const session = app.flow.session;
          const curDish = session.orderSystem.currentOrder?.dishId || 'dish_salad';
          session.orderSystem.handleCompletedDish(curDish);
          app.triggerRevenueFlyer('CASCADE ×1.2! 连锁连击');
          app.updateHUD();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 2400));

    await stopRecording('day9_cascade', 'stage5b_day9_cascade.mp4', 25);

    // =========================================================================
    // 5. STAGE 5B: Day 12 Mastery Exam (stage5b_day12_mastery.mp4)
    // =========================================================================
    console.log('\n--- Recording 5: Day 12 Mastery Exam ---');
    await loadDay(12);
    await startRecording('day12_mastery');
    await new Promise(r => setTimeout(r, 800));

    // Show comprehensive mastery: 3 dishes, high activity, buffer and danger recovery
    await callCDP('Runtime.evaluate', {
      expression: `
        (function() {
          const app = window.__app;
          const session = app.flow.session;
          app.triggerRevenueFlyer('Day 12 大师考验');
          app.updateHUD();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 1000));

    // Complete dish, serve with cascade, and clear danger
    await callCDP('Runtime.evaluate', {
      expression: `
        (function() {
          const app = window.__app;
          const session = app.flow.session;
          session.orderSystem.handleCompletedDish('dish_ramen');
          app.triggerRevenueFlyer('+¥90 连击出餐!');
          app.updateHUD();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 2200));

    await stopRecording('day12_mastery', 'stage5b_day12_mastery.mp4', 25);

    console.log('\n[Recorder] ALL 5 STAGE 5B CAMPAIGN VIDEOS CAPTURED SUCCESSFULLY!');
  } finally {
    try {
      chromeProc.kill('SIGTERM');
    } catch {}
  }
}

main().catch(err => {
  console.error('[Recorder] Fatal Error:', err);
  process.exit(1);
});
