import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const DISHES = [
  {
    id: 'dish_breakfast',
    name: '春日早餐盘',
    masterFile: 'packages/web-greybox/public/assets/dishes/dish_breakfast_master.jpg',
    cols: 3,
    rows: 3
  },
  {
    id: 'dish_salad',
    name: '田园沙拉',
    masterFile: 'packages/web-greybox/public/assets/dishes/dish_salad_master.jpg',
    cols: 3,
    rows: 3
  },
  {
    id: 'dish_ramen',
    name: '暖汤拉面',
    masterFile: 'packages/web-greybox/public/assets/dishes/dish_ramen_master.jpg',
    cols: 3,
    rows: 3
  }
];

import ts from 'typescript';
const compiler = ts.default || ts;

// Read PuzzleGeometry logic to embed into browser runner
const puzzleGeometryPath = path.join(rootDir, 'packages/game-core/src/pipeline/PuzzleGeometry.ts');
const puzzleGeometryCode = fs.readFileSync(puzzleGeometryPath, 'utf-8');

// Build HTML runner page that runs inside Chrome with native Canvas 2D
function buildHtmlPage() {
  const transpileResult = compiler.transpileModule(puzzleGeometryCode, {
    compilerOptions: { target: 7 } // ES2020
  });
  const jsGeometry = transpileResult.outputText
    .replace(/import .*/g, '')
    .replace(/Object\.defineProperty\(exports, "__esModule", \{ value: true \}\);/g, '')
    .replace(/exports\.\w+ = void 0;/g, '')
    .replace(/exports\./g, '');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Puzzle Mask Cutter</title></head>
<body>
<h1>Puzzle Mask Cutter Running...</h1>
<div id="status">Initializing...</div>
<script>
window.onerror = (msg, url, line) => {
  fetch('/api/log?msg=' + encodeURIComponent('BROWSER ERROR: ' + msg + ' at line ' + line));
};

function logMsg(msg) {
  console.log(msg);
  fetch('/api/log?msg=' + encodeURIComponent(msg));
}

${jsGeometry}

async function run() {
  logMsg('[Browser] Starting puzzle cut...');
  const dishes = ${JSON.stringify(DISHES)};
  const results = {};

  for (const dish of dishes) {
    document.getElementById('status').textContent = 'Cutting ' + dish.name + '...';
    
    // Load master image
    const img = new Image();
    img.src = '/image?path=' + encodeURIComponent(dish.masterFile);
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    const masterW = img.naturalWidth || 1024;
    const masterH = img.naturalHeight || 1024;
    const cols = dish.cols;
    const rows = dish.rows;
    const cellW = masterW / cols;
    const cellH = masterH / rows;
    const pad = Math.round(cellW * 0.28);
    const pieceW = Math.round(cellW + pad * 2);
    const pieceH = Math.round(cellH + pad * 2);

    // Pre-calculate deterministic complementary edges
    // vEdges[r][c]: between (c, r) and (c+1, r)
    const vEdges = [];
    for (let r = 0; r < rows; r++) {
      vEdges[r] = [];
      for (let c = 0; c < cols - 1; c++) {
        // Alternating deterministic tabs
        vEdges[r][c] = ((r + c) % 2 === 0) ? 'tab' : 'blank';
      }
    }

    // hEdges[r][c]: between (c, r) and (c, r+1)
    const hEdges = [];
    for (let r = 0; r < rows - 1; r++) {
      hEdges[r] = [];
      for (let c = 0; c < cols; c++) {
        hEdges[r][c] = ((r * 2 + c) % 2 === 0) ? 'tab' : 'blank';
      }
    }

    // Atlas canvas
    const atlasCols = cols;
    const atlasRows = rows;
    const atlasCanvas = document.createElement('canvas');
    atlasCanvas.width = pieceW * atlasCols;
    atlasCanvas.height = pieceH * atlasRows;
    const atlasCtx = atlasCanvas.getContext('2d');

    const dishResult = {
      dishId: dish.id,
      name: dish.name,
      cols,
      rows,
      pieceWidth: pieceW,
      pieceHeight: pieceH,
      cellWidth: cellW,
      cellHeight: cellH,
      padding: pad,
      pieces: [],
      atlasDataUrl: ''
    };

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const slotId = 'slot_' + c + '_' + r;
        
        // Edge calculation
        const edges = {
          top: r === rows - 1 ? 'flat' : (hEdges[r][c] === 'tab' ? 'tab' : 'blank'),
          bottom: r === 0 ? 'flat' : (hEdges[r - 1][c] === 'tab' ? 'blank' : 'tab'),
          left: c === 0 ? 'flat' : (vEdges[r][c - 1] === 'tab' ? 'blank' : 'tab'),
          right: c === cols - 1 ? 'flat' : (vEdges[r][c] === 'tab' ? 'tab' : 'blank')
        };

        const pieceCanvas = document.createElement('canvas');
        pieceCanvas.width = pieceW;
        pieceCanvas.height = pieceH;
        const pctx = pieceCanvas.getContext('2d');

        const bounds = { x: pad, y: pad, width: cellW, height: cellH };
        const commands = PuzzleGeometry.generateSlotPathCommands(bounds, edges);

        // 1. Clipping path
        pctx.save();
        pctx.beginPath();
        for (const cmd of commands) {
          if (cmd.type === 'M') pctx.moveTo(cmd.x, cmd.y);
          else if (cmd.type === 'L') pctx.lineTo(cmd.x, cmd.y);
          else if (cmd.type === 'C') pctx.bezierCurveTo(cmd.cp1x, cmd.cp1y, cmd.cp2x, cmd.cp2y, cmd.x, cmd.y);
          else if (cmd.type === 'Z') pctx.closePath();
        }
        pctx.clip();

        // Source bounds in master image (r=0 is bottom in grid coords, but y=0 is top in canvas)
        const masterCellX = c * cellW;
        const masterCellY = (rows - 1 - r) * cellH;
        const srcX = masterCellX - pad;
        const srcY = masterCellY - pad;

        pctx.drawImage(img, srcX, srcY, cellW + pad * 2, cellH + pad * 2, 0, 0, pieceW, pieceH);
        pctx.restore();

        // 2. Crisp cardboard puzzle outline & subtle inner glow
        pctx.save();
        pctx.beginPath();
        for (const cmd of commands) {
          if (cmd.type === 'M') pctx.moveTo(cmd.x, cmd.y);
          else if (cmd.type === 'L') pctx.lineTo(cmd.x, cmd.y);
          else if (cmd.type === 'C') pctx.bezierCurveTo(cmd.cp1x, cmd.cp1y, cmd.cp2x, cmd.cp2y, cmd.x, cmd.y);
          else if (cmd.type === 'Z') pctx.closePath();
        }
        pctx.strokeStyle = 'rgba(255, 253, 247, 0.95)';
        pctx.lineWidth = 3.5;
        pctx.stroke();

        pctx.strokeStyle = 'rgba(70, 55, 40, 0.22)';
        pctx.lineWidth = 1.2;
        pctx.stroke();
        pctx.restore();

        // Copy into Atlas
        const atlasX = c * pieceW;
        const atlasY = (rows - 1 - r) * pieceH;
        atlasCtx.drawImage(pieceCanvas, atlasX, atlasY);

        const dataUrl = pieceCanvas.toDataURL('image/png');
        dishResult.pieces.push({
          slotId,
          col: c,
          row: r,
          edges,
          atlasRect: { x: atlasX, y: atlasY, width: pieceW, height: pieceH },
          dataUrl
        });
      }
    }

    dishResult.atlasDataUrl = atlasCanvas.toDataURL('image/png');
    results[dish.id] = dishResult;
  }

  // Send results to server
  document.getElementById('status').textContent = 'Uploading results to disk...';
  const resp = await fetch('/api/save-results', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(results)
  });
  const res = await resp.json();
  document.getElementById('status').textContent = 'DONE: ' + JSON.stringify(res);
}

run().catch(err => {
  document.getElementById('status').textContent = 'ERROR: ' + err.message;
  console.error(err);
});
</script>
</body>
</html>`;
}

// Start HTTP server to orchestrate cutting
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost:5174');

  if (url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(buildHtmlPage());
  } else if (url.pathname === '/image') {
    const filePath = path.resolve(rootDir, url.searchParams.get('path'));
    if (!fs.existsSync(filePath)) {
      res.writeHead(404);
      return res.end('Image not found: ' + filePath);
    }
    const ext = path.extname(filePath).toLowerCase();
    const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
    res.writeHead(200, { 'Content-Type': mime });
    fs.createReadStream(filePath).pipe(res);
  } else if (url.pathname === '/api/log') {
    const msg = url.searchParams.get('msg');
    console.log('[BrowserLog]', msg);
    res.writeHead(200);
    res.end('ok');
  } else if (url.pathname === '/api/save-results' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const results = JSON.parse(body);
        const webOutDir = path.join(rootDir, 'packages/web-greybox/public/assets/dishes');
        const cocosOutDir = path.join(rootDir, 'cocos-app/assets/textures/dishes');

        fs.mkdirSync(webOutDir, { recursive: true });
        fs.mkdirSync(cocosOutDir, { recursive: true });

        let totalPiecesSaved = 0;

        for (const [dishId, dish] of Object.entries(results)) {
          // Save Atlas PNG
          const atlasBuffer = Buffer.from(dish.atlasDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');
          fs.writeFileSync(path.join(webOutDir, `atlas_${dishId}.png`), atlasBuffer);
          fs.writeFileSync(path.join(cocosOutDir, `atlas_${dishId}.png`), atlasBuffer);

          // Save Atlas metadata JSON
          const metadata = {
            dishId: dish.dishId,
            name: dish.name,
            cols: dish.cols,
            rows: dish.rows,
            pieceWidth: dish.pieceWidth,
            pieceHeight: dish.pieceHeight,
            cellWidth: dish.cellWidth,
            cellHeight: dish.cellHeight,
            padding: dish.padding,
            pieces: dish.pieces.map(p => ({
              slotId: p.slotId,
              col: p.col,
              row: p.row,
              edges: p.edges,
              atlasRect: p.atlasRect,
              imageFile: `piece_${dishId}_${p.slotId}.png`
            }))
          };

          fs.writeFileSync(path.join(webOutDir, `atlas_${dishId}.json`), JSON.stringify(metadata, null, 2));
          fs.writeFileSync(path.join(cocosOutDir, `atlas_${dishId}.json`), JSON.stringify(metadata, null, 2));

          // Save individual piece PNGs
          for (const piece of dish.pieces) {
            const pieceBuffer = Buffer.from(piece.dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');
            const fileName = `piece_${dishId}_${piece.slotId}.png`;
            fs.writeFileSync(path.join(webOutDir, fileName), pieceBuffer);
            fs.writeFileSync(path.join(cocosOutDir, fileName), pieceBuffer);
            totalPiecesSaved++;
          }
        }

        console.log(`[PuzzleMaskCutter] Successfully cut and saved ${totalPiecesSaved} piece PNGs and 3 Atlases!`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, piecesSaved: totalPiecesSaved }));

        // Exit server cleanly after brief delay
        setTimeout(() => {
          server.close(() => {
            console.log('[PuzzleMaskCutter] Server closed successfully.');
            process.exit(0);
          });
        }, 1000);
      } catch (err) {
        console.error('[PuzzleMaskCutter] Save error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

const PORT = 5190;
server.listen(PORT, () => {
  console.log(`[PuzzleMaskCutter] Server listening on http://localhost:${PORT}`);
  const chromeCmd = `"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --headless --disable-gpu http://localhost:${PORT}/`;
  console.log(`[PuzzleMaskCutter] Launching Chrome runner: ${chromeCmd}`);
  exec(chromeCmd, (err, stdout, stderr) => {
    if (err) {
      console.warn('[PuzzleMaskCutter] Chrome process notice:', err.message);
    }
  });
});
