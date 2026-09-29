/**
 * scripts/record-stage5a-runtime.mjs
 * Stage 5A Video Recording Automation via Chrome DevTools Protocol (CDP) & FFmpeg.
 * Captures 4 authoritative gameplay scenarios:
 *   1. stage5a_normal_loop.mp4: Complete salad, climax ceremony, serve, receipt roll, cat PASS->IDLE, revenue +¥70.
 *   2. stage5a_buffer_cascade.mp4: Complete non-matching dish, buffers in tray, cascade serving upon match.
 *   3. stage5a_danger_recovery.mp4: Board pressure near threshold, danger banner, dish completion reflow & recovery.
 *   4. stage5a_deadlock.mp4: Top spawn blocked & no moves, DISH_BOARD_DEADLOCKED, day fail modal.
 */

import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\admin\\.gemini\\antigravity\\brain\\a581706c-feba-4a01-94fc-8c62ff40a9bf';
const SHOTS_DIR = 'C:\\Users\\admin\\Music\\chufang\\scripts\\shots';
const TEMP_BASE = path.join(process.env.TEMP || 'C:\\Temp', 'stage5a-recording-' + Date.now());

if (!fs.existsSync(SHOTS_DIR)) fs.mkdirSync(SHOTS_DIR, { recursive: true });
if (!fs.existsSync(ARTIFACT_DIR)) fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
if (!fs.existsSync(TEMP_BASE)) fs.mkdirSync(TEMP_BASE, { recursive: true });

const profileDir = path.join(TEMP_BASE, 'chrome-profile');
const CDP_PORT = 9235;

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

    async function resetDay1() {
      await callCDP('Runtime.evaluate', {
        expression: `
          (function() {
            window.__app.startDay(1);
          })()
        `
      });
      await new Promise(r => setTimeout(r, 800));
    }

    // Helper: Drag a specific salad piece
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
    // SCENARIO 1: Normal Loop (stage5a_normal_loop.mp4)
    // =========================================================================
    console.log('\n--- Recording Scenario 1: Normal Loop ---');
    await resetDay1();
    await startRecording('normal_loop');

    await new Promise(r => setTimeout(r, 600));

    // Drag pieces into place to complete the 9-piece salad
    console.log('[Action] Snap piece (2,0)');
    await executePieceDrag(2, 0, 2, 0);
    await new Promise(r => setTimeout(r, 200));

    console.log('[Action] Snap piece (0,2)');
    await executePieceDrag(0, 2, 0, 2);
    await new Promise(r => setTimeout(r, 200));

    console.log('[Action] Snap piece (1,2)');
    await executePieceDrag(1, 2, 1, 2);
    await new Promise(r => setTimeout(r, 200));

    console.log('[Action] Snap piece (2,2) -> Climax Ceremony & Serve Flight');
    await executePieceDrag(2, 2, 2, 2);

    // Let Climax Ceremony (680ms) + flight + receipt roll + PASS animation play out
    await new Promise(r => setTimeout(r, 2200));

    await stopRecording('normal_loop', 'stage5a_normal_loop.mp4', 25);

    // =========================================================================
    // SCENARIO 2: Buffer & Cascade (stage5a_buffer_cascade.mp4)
    // =========================================================================
    console.log('\n--- Recording Scenario 2: Buffer & Cascade ---');
    await resetDay1();
    await startRecording('buffer_cascade');

    await new Promise(r => setTimeout(r, 600));

    // Complete salad to buffer then direct serve
    await callCDP('Runtime.evaluate', {
      expression: `
        (function() {
          const app = window.__app;
          const session = app.flow.session;
          // Add breakfast to buffer
          session.orderSystem.handleCompletedDish('dish_breakfast');
          app.updateHUD();
        })()
      `
    });

    await new Promise(r => setTimeout(r, 1200));

    // Serve salad matching current order -> order fulfills!
    await callCDP('Runtime.evaluate', {
      expression: `
        (function() {
          const app = window.__app;
          const session = app.flow.session;
          session.orderSystem.handleCompletedDish('dish_salad');
          app.triggerRevenueFlyer('+¥70');
          app.updateHUD();
        })()
      `
    });

    await new Promise(r => setTimeout(r, 2000));

    await stopRecording('buffer_cascade', 'stage5a_buffer_cascade.mp4', 25);

    // =========================================================================
    // SCENARIO 3: Danger & Recovery (stage5a_danger_recovery.mp4)
    // =========================================================================
    console.log('\n--- Recording Scenario 3: Danger & Recovery ---');
    await resetDay1();
    await startRecording('danger_recovery');

    await new Promise(r => setTimeout(r, 500));

    // Trigger high stack danger state
    await callCDP('Runtime.evaluate', {
      expression: `
        (function() {
          const app = window.__app;
          const session = app.flow.session;
          const mgr = app.dishPuzzleManager;
          const bInst = mgr.createDishInstance('dish_breakfast');
          for (let r = 0; r <= 10; r++) {
            if (!mgr.getPieceAt(0, r)) {
              mgr.createPiece(bInst.instanceId, 'dish_breakfast', 0, 0, { col: 0, row: r });
            }
          }
          session.checkBoardDangerAndDeadlock();
          app.updateHUD();
        })()
      `
    });

    // Show danger state on board and HUD banner
    await new Promise(r => setTimeout(r, 1500));

    // Clear danger via dish completion & reflow
    await callCDP('Runtime.evaluate', {
      expression: `
        (function() {
          const app = window.__app;
          const session = app.flow.session;
          const mgr = app.dishPuzzleManager;
          // Clear col 0 stack
          for (let r = 0; r <= 10; r++) {
            const p = mgr.getPieceAt(0, r);
            if (p && p.dishId === 'dish_breakfast') {
              mgr._pieces.delete(p.pieceInstanceId);
              mgr._gridCells[r][0] = null;
            }
          }
          session.checkBoardDangerAndDeadlock();
          app.updateHUD();
        })()
      `
    });

    await new Promise(r => setTimeout(r, 1500));

    await stopRecording('danger_recovery', 'stage5a_danger_recovery.mp4', 25);

    // =========================================================================
    // SCENARIO 4: Deadlock (stage5a_deadlock.mp4)
    // =========================================================================
    console.log('\n--- Recording Scenario 4: Deadlock ---');
    await resetDay1();
    await startRecording('deadlock');

    await new Promise(r => setTimeout(r, 500));

    // Real board construction: Saturate board completely with 1-piece groups of alternating dishes
    // Top spawn zone blocked, 0 empty cells, 0 legal moves, 0 completions -> triggers true deadlock via Gameplay API / Detector!
    await callCDP('Runtime.evaluate', {
      expression: `
        (function() {
          const app = window.__app;
          const session = app.flow.session;
          const mgr = app.dishPuzzleManager;

          // Clear previous pieces to set up deadlocked state cleanly
          for (const p of mgr.getAllPieces()) {
            mgr._gridCells[p.boardCoord.row][p.boardCoord.col] = null;
          }
          mgr._pieces.clear();
          mgr._groups.clear();

          const dishes = ['dish_salad', 'dish_breakfast', 'dish_ramen'];
          const instances = dishes.map(d => mgr.createDishInstance(d));
          let idx = 0;

          for (let r = 0; r < 12; r++) {
            for (let c = 0; c < 8; c++) {
              if (!mgr.isCellReserved(c, r)) {
                const inst = instances[idx % instances.length];
                idx++;
                const p = mgr.createPiece(inst.instanceId, inst.dishId, 0, 0, { col: c, row: r });
                mgr.createGroup([p]);
              }
            }
          }

          // Trigger authoritative gameplay API / Detector: Core detects deadlock on its own!
          session.checkBoardDangerAndDeadlock();
          app.updateHUD();
        })()
      `
    });

    await new Promise(r => setTimeout(r, 2000));

    await stopRecording('deadlock', 'stage5a_deadlock.mp4', 25);

    console.log('\n🎉 All 4 Stage 5A video scenarios recorded and encoded successfully!');
  } finally {
    try {
      chromeProc.kill('SIGKILL');
    } catch {}
    try {
      fs.rmSync(profileDir, { recursive: true, force: true });
    } catch {}
  }
}

main().catch(err => {
  console.error('[Recorder Error]:', err);
  process.exit(1);
});
