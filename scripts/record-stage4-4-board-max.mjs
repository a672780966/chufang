import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\admin\\.gemini\\antigravity\\brain\\a581706c-feba-4a01-94fc-8c62ff40a9bf';
const SHOTS_DIR = 'C:\\Users\\admin\\Music\\chufang\\scripts\\shots';
const TEMP_BASE = path.join(process.env.TEMP || 'C:\\Temp', 'stage4-4-capture-' + Date.now());

if (!fs.existsSync(SHOTS_DIR)) fs.mkdirSync(SHOTS_DIR, { recursive: true });
if (!fs.existsSync(ARTIFACT_DIR)) fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
if (!fs.existsSync(TEMP_BASE)) fs.mkdirSync(TEMP_BASE, { recursive: true });

const profileDir = path.join(TEMP_BASE, 'chrome-profile');

const chromeProc = spawn(CHROME_PATH, [
  '--headless=new',
  '--remote-debugging-port=9230',
  '--window-size=480,960',
  '--disable-gpu',
  `--user-data-dir=${profileDir}`,
  'http://localhost:5173/?day=1'
]);

async function getDebuggerUrl(port = 9230, maxRetries = 30) {
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
    const wsUrl = await getDebuggerUrl(9230);
    console.log('[Capture] Connected to CDP debugger at:', wsUrl);

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

    await new Promise((res, rej) => {
      ws.onopen = res;
      ws.onerror = rej;
    });

    console.log('[Capture] Enabling Page & Runtime domains...');
    await callCDP('Page.enable');
    await callCDP('Runtime.enable');

    // Wait for initial render, spritesheet preloading, and Day 1 layout settling
    await new Promise(r => setTimeout(r, 3000));

    async function saveScreenshot(filename, clip = null) {
      const params = { format: 'png' };
      if (clip) params.clip = clip;
      const shot = await callCDP('Page.captureScreenshot', params);
      const buf = Buffer.from(shot.data, 'base64');
      fs.writeFileSync(path.join(SHOTS_DIR, filename), buf);
      fs.writeFileSync(path.join(ARTIFACT_DIR, filename), buf);
      console.log(`[Screenshot] Saved ${filename} (${buf.length} bytes)`);
    }

    async function getElementBox(selector) {
      const res = await callCDP('Runtime.evaluate', {
        expression: `
          (function() {
            const el = document.querySelector('${selector}');
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { x: r.left, y: r.top, width: r.width, height: r.height, scale: 1 };
          })()
        `,
        returnByValue: true
      });
      return res.result?.value;
    }

    // 1. Capture Full View: stage4_4_board_maximized.png
    console.log('\n--- 1. Capturing stage4_4_board_maximized.png ---');
    const containerBox = await getElementBox('#game-container');
    await saveScreenshot('stage4_4_board_maximized.png', containerBox);

    // 2. Capture Cat in Idle State: stage4_4_cat_idle.png
    console.log('\n--- 2. Capturing stage4_4_cat_idle.png ---');
    const catBox = await getElementBox('#cat-actor-mount');
    if (catBox) {
      // Add padding around cat mount to show the cutting board / counter context
      const pad = 24;
      const catContextClip = {
        x: Math.max(0, catBox.x - pad),
        y: Math.max(0, catBox.y - pad),
        width: catBox.width + pad * 2,
        height: catBox.height + pad * 2,
        scale: 1
      };
      await saveScreenshot('stage4_4_cat_idle.png', catContextClip);
    }

    // 3. Trigger Piece Touch -> Cat Action (COOK_CHOP or COOK_STIR): stage4_4_cat_action.png
    console.log('\n--- 3. Capturing stage4_4_cat_action.png ---');
    await callCDP('Runtime.evaluate', {
      expression: `
        (function() {
          const app = window.__app;
          app.catActor?.onEvent('COOK_CHOP');
        })()
      `
    });
    // Wait for frame to advance in chop animation
    await new Promise(r => setTimeout(r, 200));
    if (catBox) {
      const pad = 24;
      const catContextClip = {
        x: Math.max(0, catBox.x - pad),
        y: Math.max(0, catBox.y - pad),
        width: catBox.width + pad * 2,
        height: catBox.height + pad * 2,
        scale: 1
      };
      await saveScreenshot('stage4_4_cat_action.png', catContextClip);
    }

    // 4. Large Group Drag: Drag Group 1 (2x2 base: 4 pieces) or Group 2 across the wide board
    console.log('\n--- 4. Capturing stage4_4_large_group_drag.png ---');
    await callCDP('Runtime.evaluate', {
      expression: `
        (async function() {
          const app = window.__app;
          const mgr = app.dishPuzzleManager;
          const activeSalad = Array.from(mgr._instances.values()).find(i => i.dishId === 'dish_salad' && !i.isCompleted);
          if (!activeSalad) return;

          // Find the 2x2 base salad group
          const saladPieces = mgr.getAllPieces().filter(p => p.dishPuzzleInstanceId === activeSalad.instanceId);
          const p00 = saladPieces.find(p => p.dishCol === 0 && p.dishRow === 0);
          if (!p00) return;

          const { originX, originY, cellSize } = app.getBoardOrigin();
          const rect = app.canvas.getBoundingClientRect();

          const startX = rect.left + originX + p00.boardCoord.col * cellSize + cellSize / 2;
          const startY = rect.top + originY - p00.boardCoord.row * cellSize + cellSize / 2;

          // Drag to center of the wide board (col 3, row 3)
          const targetX = rect.left + originX + 2.5 * cellSize;
          const targetY = rect.top + originY - 2.5 * cellSize;

          app.canvas.dispatchEvent(new PointerEvent('pointerdown', {
            clientX: startX,
            clientY: startY,
            pointerId: 1,
            isPrimary: true,
            bubbles: true
          }));

          // Move progressively
          for (let step = 1; step <= 8; step++) {
            const curX = startX + (targetX - startX) * (step / 8);
            const curY = startY + (targetY - startY) * (step / 8);
            app.canvas.dispatchEvent(new PointerEvent('pointermove', {
              clientX: curX,
              clientY: curY,
              pointerId: 1,
              isPrimary: true,
              bubbles: true
            }));
            await new Promise(r => setTimeout(r, 20));
          }
        })()
      `
    });

    await new Promise(r => setTimeout(r, 150));
    await saveScreenshot('stage4_4_large_group_drag.png', containerBox);

    // Release pointer to clean up
    await callCDP('Runtime.evaluate', {
      expression: `
        (function() {
          const app = window.__app;
          const rect = app.canvas.getBoundingClientRect();
          app.canvas.dispatchEvent(new PointerEvent('pointerup', {
            clientX: rect.left + 100,
            clientY: rect.top + 100,
            pointerId: 1,
            isPrimary: true,
            bubbles: true
          }));
        })()
      `
    });

    console.log('\n[Capture] All Stage 4.4 screenshots successfully captured!');
    ws.close();
  } catch (err) {
    console.error('[Capture] Error:', err);
  } finally {
    try {
      chromeProc.kill();
    } catch {}
  }
}

main();
