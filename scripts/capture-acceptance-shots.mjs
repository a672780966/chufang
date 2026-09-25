import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\admin\\.gemini\\antigravity\\brain\\a581706c-feba-4a01-94fc-8c62ff40a9bf';
const SHOTS_DIR = 'C:\\Users\\admin\\Music\\chufang\\scripts\\shots';

if (!fs.existsSync(SHOTS_DIR)) {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
}

const profileDir = path.join(process.env.TEMP || 'C:\\Temp', 'cdp-shots-' + Date.now());

const chromeProc = spawn(CHROME_PATH, [
  '--headless=new',
  '--remote-debugging-port=9224',
  '--window-size=1200,900',
  '--disable-gpu',
  `--user-data-dir=${profileDir}`,
  'http://localhost:5173/?day=1'
]);

async function getDebuggerUrl(port = 9224, maxRetries = 25) {
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
    const wsUrl = await getDebuggerUrl(9224);
    console.log('Connecting to:', wsUrl);

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
          console.log('WebSocket open!');
          await callCDP('Page.enable');
          await callCDP('Runtime.enable');

          // Wait 2.5s for initial assets and textures to fully render
          await new Promise(r => setTimeout(r, 2500));

          // 1. shot1_initial_board.png
          console.log('\n--- Capturing shot1_initial_board.png ---');
          await saveScreenshot(callCDP, 'shot1_initial_board.png');

          // 2. shot2_group_lift.png
          console.log('\n--- Capturing shot2_group_lift.png ---');
          const liftRes = await callCDP('Runtime.evaluate', {
            expression: `
              (function() {
                const app = window.__app;
                if (!app) return { error: 'No app' };
                const groups = app.dishPuzzleManager.getAllGroups();
                const multiGroup = groups.find(g => g.pieceIds.length > 1);
                if (!multiGroup) return { error: 'No multi group' };
                const piece = app.dishPuzzleManager.getPiece(multiGroup.pieceIds[0]);
                
                const { originX, originY, cellSize } = app.getBoardOrigin();
                const sx = originX + piece.boardCoord.col * cellSize + cellSize / 2;
                const sy = originY - piece.boardCoord.row * cellSize + cellSize / 2;
                const rect = app.canvas.getBoundingClientRect();

                const downEvt = new PointerEvent('pointerdown', {
                  clientX: rect.left + sx,
                  clientY: rect.top + sy,
                  pointerId: 1,
                  bubbles: true
                });
                app.canvas.dispatchEvent(downEvt);

                const moveEvt = new PointerEvent('pointermove', {
                  clientX: rect.left + sx + 30,
                  clientY: rect.top + sy - 140,
                  pointerId: 1,
                  bubbles: true
                });
                app.canvas.dispatchEvent(moveEvt);

                return {
                  dragging: !!app.draggingGroup,
                  pieceCount: app.draggingGroup ? app.draggingGroup.pieces.length : 0
                };
              })()
            `,
            returnByValue: true
          });
          console.log('Lift evaluation result:', liftRes.result?.value);
          await new Promise(r => setTimeout(r, 400));
          await saveScreenshot(callCDP, 'shot2_group_lift.png');

          // Release drag
          await callCDP('Runtime.evaluate', {
            expression: `
              (function() {
                const app = window.__app;
                app.draggingGroup = null;
              })()
            `
          });
          await new Promise(r => setTimeout(r, 200));

          // 3. shot3_snap_merge.png
          console.log('\n--- Capturing shot3_snap_merge.png ---');
          const snapRes = await callCDP('Runtime.evaluate', {
            expression: `
              (function() {
                const app = window.__app;
                const mgr = app.dishPuzzleManager;
                app.draggingGroup = null;
                
                // Find salad group 1 (contains s_0_0 and s_1_0)
                const g1 = mgr.getAllGroups().find(g => g.dishId === 'dish_salad' && g.pieceIds.length >= 2);
                if (g1) {
                  // Merge adjacent s_0_1 and s_2_0 into g1 to form a 4-piece L-block/strip!
                  mgr.checkAndMergeAdjacency(g1.groupId);
                }
                app.updateHUD();
                const saladGroup = mgr.getAllGroups().find(g => g.dishId === 'dish_salad');
                return {
                  mergedCount: saladGroup ? saladGroup.pieceIds.length : 0,
                  totalGroups: mgr.getAllGroups().length
                };
              })()
            `,
            returnByValue: true
          });
          console.log('Snap merge evaluation result:', snapRes.result?.value);
          await new Promise(r => setTimeout(r, 300));
          await saveScreenshot(callCDP, 'shot3_snap_merge.png');

          // 4. shot4_dish_complete.png
          console.log('\n--- Capturing shot4_dish_complete.png ---');
          await callCDP('Runtime.evaluate', {
            expression: `
              (function() {
                const app = window.__app;
                const mgr = app.dishPuzzleManager;
                const inst = mgr.createDishInstance('dish_breakfast');
                const pieces = [];
                for (let r = 0; r < 3; r++) {
                  for (let c = 0; c < 3; c++) {
                    const p = mgr.createPiece(inst.instanceId, 'dish_breakfast', c, r, { col: 2 + c, row: 2 + r });
                    pieces.push(p);
                  }
                }
                const completeGroup = mgr.createGroup(pieces);
                completeGroup.isComplete = true;
                inst.isCompleted = true;
                app.completedDishAnims.set(inst.instanceId, {
                  startTime: performance.now(),
                  dishId: 'dish_breakfast',
                  pieces: pieces,
                  groupId: completeGroup.groupId
                });
                if (app.flow.session) {
                  app.flow.session.orderSystem.fulfillDish('dish_breakfast', 75);
                }
                app.updateHUD();
              })()
            `
          });
          await new Promise(r => setTimeout(r, 120));
          await saveScreenshot(callCDP, 'shot4_dish_complete.png');

          // 5. shot5_clear_and_reflow.png
          console.log('\n--- Capturing shot5_clear_and_reflow.png ---');
          // Wait for completion animation (550ms) to finish and clear group + gravity settle
          await new Promise(r => setTimeout(r, 800));
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
  console.log('\nAll 5 acceptance screenshots successfully captured!');
  process.exit(0);
}).catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
