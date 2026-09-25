import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PuzzleGeometry } from '../packages/game-core/src/pipeline/PuzzleGeometry.js';
import { JigsawEdgeType } from '../packages/game-core/src/model/Types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

interface DishConfig {
  id: string;
  name: string;
  masterFile: string;
  cols: number;
  rows: number;
}

const DISHES: DishConfig[] = [
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

// Precompute puzzle geometry on Node side
function prepareDishData() {
  const masterSize = 1024;
  return DISHES.map(dish => {
    const cols = dish.cols;
    const rows = dish.rows;
    const cellW = masterSize / cols;
    const cellH = masterSize / rows;
    const pad = Math.round(cellW * 0.28);
    const pieceW = Math.round(cellW + pad * 2);
    const pieceH = Math.round(cellH + pad * 2);

    // Complementary edge tables
    const vEdges: JigsawEdgeType[][] = [];
    for (let r = 0; r < rows; r++) {
      vEdges[r] = [];
      for (let c = 0; c < cols - 1; c++) {
        vEdges[r][c] = ((r + c) % 2 === 0) ? 'tab' : 'blank';
      }
    }

    const hEdges: JigsawEdgeType[][] = [];
    for (let r = 0; r < rows - 1; r++) {
      hEdges[r] = [];
      for (let c = 0; c < cols; c++) {
        hEdges[r][c] = ((r * 2 + c) % 2 === 0) ? 'tab' : 'blank';
      }
    }

    const pieces = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const slotId = `slot_${c}_${r}`;
        const edges: { top: JigsawEdgeType; right: JigsawEdgeType; bottom: JigsawEdgeType; left: JigsawEdgeType } = {
          top: r === rows - 1 ? 'flat' : (hEdges[r][c] === 'tab' ? 'tab' : 'blank'),
          bottom: r === 0 ? 'flat' : (hEdges[r - 1][c] === 'tab' ? 'blank' : 'tab'),
          left: c === 0 ? 'flat' : (vEdges[r][c - 1] === 'tab' ? 'blank' : 'tab'),
          right: c === cols - 1 ? 'flat' : (vEdges[r][c] === 'tab' ? 'tab' : 'blank')
        };

        const bounds = { x: pad, y: pad, width: cellW, height: cellH };
        const commands = PuzzleGeometry.generateSlotPathCommands(bounds, edges);

        const masterCellX = c * cellW;
        const masterCellY = (rows - 1 - r) * cellH;
        const srcX = masterCellX - pad;
        const srcY = masterCellY - pad;

        const atlasX = c * pieceW;
        const atlasY = (rows - 1 - r) * pieceH;

        pieces.push({
          slotId,
          col: c,
          row: r,
          edges,
          bounds,
          commands,
          srcBounds: { x: srcX, y: srcY, width: cellW + pad * 2, height: cellH + pad * 2 },
          atlasRect: { x: atlasX, y: atlasY, width: pieceW, height: pieceH }
        });
      }
    }

    return {
      dishId: dish.id,
      name: dish.name,
      masterFile: dish.masterFile,
      cols,
      rows,
      cellWidth: cellW,
      cellHeight: cellH,
      pieceWidth: pieceW,
      pieceHeight: pieceH,
      padding: pad,
      pieces
    };
  });
}

function buildHtmlPage(dishesData: any[]) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Puzzle Mask Cutter</title></head>
<body>
<h1>Puzzle Mask Cutter Running...</h1>
<div id="status">Initializing...</div>
<script>
window.onerror = (msg, url, line) => {
  fetch('/api/log?msg=' + encodeURIComponent('BROWSER ERROR: ' + msg + ' at ' + line));
};

function logMsg(msg) {
  console.log(msg);
  fetch('/api/log?msg=' + encodeURIComponent(msg));
}

async function run() {
  logMsg('[Browser] Starting puzzle cut execution...');
  const dishes = ${JSON.stringify(dishesData)};
  const results = {};

  for (const dish of dishes) {
    logMsg('[Browser] Loading master image for ' + dish.name + '...');
    const img = new Image();
    img.src = '/image?path=' + encodeURIComponent(dish.masterFile);
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    const pieceW = dish.pieceWidth;
    const pieceH = dish.pieceHeight;
    const atlasCanvas = document.createElement('canvas');
    atlasCanvas.width = pieceW * dish.cols;
    atlasCanvas.height = pieceH * dish.rows;
    const atlasCtx = atlasCanvas.getContext('2d');

    const dishResult = {
      dishId: dish.dishId,
      name: dish.name,
      cols: dish.cols,
      rows: dish.rows,
      pieceWidth: pieceW,
      pieceHeight: pieceH,
      cellWidth: dish.cellWidth,
      cellHeight: dish.cellHeight,
      padding: dish.padding,
      pieces: [],
      atlasDataUrl: ''
    };

    for (const piece of dish.pieces) {
      const pieceCanvas = document.createElement('canvas');
      pieceCanvas.width = pieceW;
      pieceCanvas.height = pieceH;
      const pctx = pieceCanvas.getContext('2d');

      // 1. Clipping path from precomputed Bezier commands
      pctx.save();
      pctx.beginPath();
      for (const cmd of piece.commands) {
        if (cmd.type === 'M') pctx.moveTo(cmd.x, cmd.y);
        else if (cmd.type === 'L') pctx.lineTo(cmd.x, cmd.y);
        else if (cmd.type === 'C') pctx.bezierCurveTo(cmd.cp1x, cmd.cp1y, cmd.cp2x, cmd.cp2y, cmd.x, cmd.y);
        else if (cmd.type === 'Z') pctx.closePath();
      }
      pctx.clip();

      // Draw slice from master image
      pctx.drawImage(
        img,
        piece.srcBounds.x, piece.srcBounds.y, piece.srcBounds.width, piece.srcBounds.height,
        0, 0, pieceW, pieceH
      );
      pctx.restore();

      // 2. Cardboard puzzle white outline & subtle bevel stroke
      pctx.save();
      pctx.beginPath();
      for (const cmd of piece.commands) {
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

      // Copy to Atlas canvas
      atlasCtx.drawImage(pieceCanvas, piece.atlasRect.x, piece.atlasRect.y);

      dishResult.pieces.push({
        slotId: piece.slotId,
        col: piece.col,
        row: piece.row,
        edges: piece.edges,
        atlasRect: piece.atlasRect,
        dataUrl: pieceCanvas.toDataURL('image/png')
      });
    }

    dishResult.atlasDataUrl = atlasCanvas.toDataURL('image/png');
    results[dish.dishId] = dishResult;
    logMsg('[Browser] Finished cutting ' + dish.name + ' (' + dish.pieces.length + ' pieces)');
  }

  logMsg('[Browser] Uploading cut assets to server...');
  const resp = await fetch('/api/save-results', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(results)
  });
  const res = await resp.json();
  logMsg('[Browser] Save completed: ' + JSON.stringify(res));
}

run().catch(err => {
  logMsg('[Browser Error] ' + err.message);
});
</script>
</body>
</html>`;
}

async function start() {
  const dishesData = prepareDishData();
  const PORT = 5195;

  const server = http.createServer((req, res) => {
    const url = new URL(req.url!, `http://localhost:${PORT}`);

    if (url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(buildHtmlPage(dishesData));
    } else if (url.pathname === '/image') {
      const filePath = path.resolve(rootDir, url.searchParams.get('path') || '');
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
      console.log(msg);
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

          for (const [dishId, dish] of Object.entries<any>(results)) {
            // 1. Save Atlas PNG
            const atlasBuffer = Buffer.from(dish.atlasDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');
            fs.writeFileSync(path.join(webOutDir, `atlas_${dishId}.png`), atlasBuffer);
            fs.writeFileSync(path.join(cocosOutDir, `atlas_${dishId}.png`), atlasBuffer);

            // 2. Save Atlas metadata JSON
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
              pieces: dish.pieces.map((p: any) => ({
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

            // 3. Save individual piece PNGs
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

          setTimeout(() => {
            server.close(() => {
              console.log('[PuzzleMaskCutter] Server shutdown complete.');
              process.exit(0);
            });
          }, 800);
        } catch (err: any) {
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

  server.listen(PORT, () => {
    console.log(`[PuzzleMaskCutter] Server listening on http://localhost:${PORT}`);
    const chromeCmd = `"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --headless --disable-gpu http://localhost:${PORT}/`;
    console.log(`[PuzzleMaskCutter] Launching Chrome runner...`);
    exec(chromeCmd, (err) => {
      if (err) {
        console.warn('[PuzzleMaskCutter] Chrome process notice:', err.message);
      }
    });
  });
}

start().catch(err => {
  console.error('[PuzzleMaskCutter] Fatal error:', err);
  process.exit(1);
});
