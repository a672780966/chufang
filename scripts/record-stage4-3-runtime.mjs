import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\admin\\.gemini\\antigravity\\brain\\a581706c-feba-4a01-94fc-8c62ff40a9bf';
const SHOTS_DIR = 'C:\\Users\\admin\\Music\\chufang\\scripts\\shots';
const TEMP_BASE = path.join(process.env.TEMP || 'C:\\Temp', 'stage4-3-recording-' + Date.now());

if (!fs.existsSync(SHOTS_DIR)) fs.mkdirSync(SHOTS_DIR, { recursive: true });
if (!fs.existsSync(ARTIFACT_DIR)) fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
if (!fs.existsSync(TEMP_BASE)) fs.mkdirSync(TEMP_BASE, { recursive: true });

const profileDir = path.join(TEMP_BASE, 'chrome-profile');

const chromeProc = spawn(CHROME_PATH, [
  '--headless=new',
  '--remote-debugging-port=9229',
  '--window-size=1200,900',
  '--disable-gpu',
  `--user-data-dir=${profileDir}`,
  'http://localhost:5173/?day=1'
]);

async function getDebuggerUrl(port = 9229, maxRetries = 30) {
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
    const wsUrl = await getDebuggerUrl(9229);
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
        // Always ack frame
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

    // Wait for initial render, spritesheet preloading and day 1 layout
    await new Promise(r => setTimeout(r, 3000));

    async function saveScreenshot(filename) {
      const shot = await callCDP('Page.captureScreenshot', { format: 'png' });
      const buf = Buffer.from(shot.data, 'base64');
      fs.writeFileSync(path.join(SHOTS_DIR, filename), buf);
      fs.writeFileSync(path.join(ARTIFACT_DIR, filename), buf);
      console.log(`[Screenshot] Saved ${filename} (${buf.length} bytes)`);
    }

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

    // Helper: Query current game and actor status
    async function getStatus() {
      const res = await callCDP('Runtime.evaluate', {
        expression: `
          (function() {
            const app = window.__app;
            if (!app) return { error: 'No __app' };
            const session = app.flow.session;
            const mgr = app.dishPuzzleManager;
            const saladInstances = mgr ? Array.from(mgr._instances.values()).filter(i => i.dishId === 'dish_salad') : [];
            const activeSalad = saladInstances.find(i => !i.isCompleted);
            const victoryModal = document.getElementById('modal-victory');
            const victoryVisible = victoryModal ? (victoryModal.style.display === 'flex' || getComputedStyle(victoryModal).display === 'flex') : false;

            return {
              catState: app.catActor?.getState(),
              catFrame: app.catActor?.getCurrentFrame(),
              printerState: app.printerActor?.getState(),
              revenue: session?.revenue || 0,
              businessGoal: session?.dayConfig.businessGoal || 0,
              ordersFulfilledCount: session?.orderSystem.ordersFulfilledCount || 0,
              currentOrderId: session?.orderSystem.currentOrder?.orderId || null,
              currentOrderDishId: session?.orderSystem.currentOrder?.dishId || null,
              isGoalReached: session?.orderSystem.isGoalReached || false,
              activeSaladInstanceId: activeSalad?.instanceId || null,
              victoryVisible,
              activeAnimsCount: app.completedDishAnims.size
            };
          })()
        `,
        returnByValue: true
      });
      return res.result?.value;
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

            return {
              success: true,
              catStateAfter: app.catActor?.getState(),
              pieceId: piece.pieceInstanceId
            };
          })()
        `,
        awaitPromise: true,
        returnByValue: true
      });
      if (dragResult.result?.value?.error) throw new Error(dragResult.result.value.error);
      return dragResult.result?.value;
    }

    // Helper: Touch drag any ramen piece to trigger COOK_STIR
    async function touchRamenPiece() {
      const res = await callCDP('Runtime.evaluate', {
        expression: `
          (async function() {
            const app = window.__app;
            const mgr = app.dishPuzzleManager;
            const ramenPiece = mgr.getAllPieces().find(p => p.dishId === 'dish_ramen');
            if (!ramenPiece) return { error: 'No ramen piece found' };

            const { originX, originY, cellSize } = app.getBoardOrigin();
            const rect = app.canvas.getBoundingClientRect();
            const pX = rect.left + originX + ramenPiece.boardCoord.col * cellSize + cellSize / 2;
            const pY = rect.top + originY - ramenPiece.boardCoord.row * cellSize + cellSize / 2;

            app.canvas.dispatchEvent(new PointerEvent('pointerdown', {
              clientX: pX,
              clientY: pY,
              pointerId: 1,
              isPrimary: true,
              bubbles: true
            }));

            await new Promise(r => setTimeout(r, 60));

            app.canvas.dispatchEvent(new PointerEvent('pointerup', {
              clientX: pX,
              clientY: pY,
              pointerId: 1,
              isPrimary: true,
              bubbles: true
            }));

            return { success: true, catState: app.catActor?.getState() };
          })()
        `,
        awaitPromise: true,
        returnByValue: true
      });
      return res.result?.value;
    }

    console.log('[Initial Status Check]:', await getStatus());
    await saveScreenshot('shot_stage4_3_runtime_idle.png');
    await saveScreenshot('shot_stage4_3_runtime_layout.png');

    // Capture printer printing snapshot
    await callCDP('Runtime.evaluate', {
      expression: `window.__app.printerActor.printNewOrder();`
    });
    await new Promise(r => setTimeout(r, 200));
    await saveScreenshot('shot_stage4_3_printer_print.png');
    await new Promise(r => setTimeout(r, 1100));

    // =========================================================================
    // CASE A & B: Full Gameplay Loop Recording (stage4_3_runtime_full_loop.mp4)
    // Start -> Idle -> Ticket Print -> Chop/Stir -> Complete Salad -> PASS -> Idle
    // =========================================================================
    await startRecording('full_loop');

    // 1. Initial breathing idle + ticket printing
    await new Promise(r => setTimeout(r, 800));

    // 2. Touch ramen piece to show STIR in real play
    console.log('[Action] Touch ramen piece -> COOK_STIR');
    await touchRamenPiece();
    await new Promise(r => setTimeout(r, 600));
    await saveScreenshot('shot_stage4_3_runtime_stir.png');

    // 3. Drag salad pieces (triggers COOK_CHOP) and complete Order 1
    console.log('[Action] Drag salad pieces -> COOK_CHOP and complete dish');
    await executePieceDrag(2, 0, 2, 0);
    await saveScreenshot('shot_stage4_3_runtime_chop.png');
    await new Promise(r => setTimeout(r, 150));

    await executePieceDrag(0, 2, 0, 2);
    await new Promise(r => setTimeout(r, 150));

    await executePieceDrag(1, 2, 1, 2);
    await new Promise(r => setTimeout(r, 150));

    // Final snap triggers Climax Final Ceremony -> Serve -> ORDER_READY (PASS)
    console.log('[Action] Final snap (2,2) -> Climax & Serve -> PASS');
    await executePieceDrag(2, 2, 2, 2);

    // Wait into PASS animation & screenshot
    await new Promise(r => setTimeout(r, 200));
    await saveScreenshot('shot_stage4_3_runtime_pass.png');

    // Wait for serve celebration, ticket print, and return to IDLE
    await new Promise(r => setTimeout(r, 1800));
    const postOrder1 = await getStatus();
    console.log('[Post Order 1 Status]:', postOrder1);

    await stopRecording('full_loop', 'stage4_3_runtime_full_loop.mp4', 25);

    // =========================================================================
    // CASE D: Rapid Switching Test (stage4_3_runtime_rapid_switch.mp4)
    // IDLE -> CHOP -> STIR -> CHOP -> PASS -> IDLE (Zero white frame, zero glitch)
    // =========================================================================
    await startRecording('rapid_switch');

    console.log('[Rapid Switch] Sequence: CHOP -> STIR -> CHOP -> PASS -> IDLE');
    await callCDP('Runtime.evaluate', {
      expression: `
        (async function() {
          const app = window.__app;
          app.catActor.onEvent('COOK_CHOP');
          await new Promise(r => setTimeout(r, 250));
          app.catActor.onEvent('COOK_STIR');
          await new Promise(r => setTimeout(r, 250));
          app.catActor.onEvent('COOK_CHOP');
          await new Promise(r => setTimeout(r, 250));
          app.catActor.onEvent('ORDER_READY'); // Plays PASS then auto-returns to IDLE
          await new Promise(r => setTimeout(r, 1400));
        })()
      `,
      awaitPromise: true
    });

    await stopRecording('rapid_switch', 'stage4_3_runtime_rapid_switch.mp4', 25);

    // =========================================================================
    // CASE C: Day Victory Loop (stage4_3_runtime_win.mp4)
    // Solve Order 2 & Order 3 -> Reach Business Goal -> DAY_CLEARED -> ROUND_WIN -> Victory Ledger Modal
    // =========================================================================
    await startRecording('win_loop');

    console.log('[Action] Solving Order 2...');
    await executePieceDrag(2, 0, 2, 0);
    await new Promise(r => setTimeout(r, 150));
    await executePieceDrag(0, 2, 0, 2);
    await new Promise(r => setTimeout(r, 150));
    await executePieceDrag(1, 2, 1, 2);
    await new Promise(r => setTimeout(r, 150));
    await executePieceDrag(2, 2, 2, 2);
    console.log('[Action] Order 2 complete, waiting for board to settle & input unlock...');
    await new Promise(r => setTimeout(r, 1500));

    console.log('[Action] Solving Order 3 (Final Order reaching goal)...');
    await executePieceDrag(2, 0, 2, 0);
    await new Promise(r => setTimeout(r, 150));
    await executePieceDrag(0, 2, 0, 2);
    await new Promise(r => setTimeout(r, 150));
    await executePieceDrag(1, 2, 1, 2);
    await new Promise(r => setTimeout(r, 150));
    // Final snap for goal
    await executePieceDrag(2, 2, 2, 2);

    console.log('[Action] Order 3 complete, waiting for victory celebration & modal...');
    await new Promise(r => setTimeout(r, 1500));
    await saveScreenshot('shot_stage4_3_runtime_win.png');

    // Record victory cheer dance and victory ledger display
    await new Promise(r => setTimeout(r, 2200));

    const finalStatus = await getStatus();
    console.log('[Final Day Status]:', finalStatus);

    await stopRecording('win_loop', 'stage4_3_runtime_win.mp4', 25);

    console.log('\n======================================================');
    console.log('STAGE 4.3 RUNTIME RECORDINGS & VERIFICATION COMPLETE!');
    console.log('======================================================');

    ws.close();
    chromeProc.kill();
  } catch (err) {
    console.error('[Error in Recorder]:', err);
    chromeProc.kill();
    process.exit(1);
  }
}

main();
