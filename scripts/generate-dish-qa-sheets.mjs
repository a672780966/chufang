import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const artifactDir = 'C:\\Users\\admin\\.gemini\\antigravity\\brain\\a581706c-feba-4a01-94fc-8c62ff40a9bf';
const docsDir = path.join(rootDir, 'docs');

const DISHES = [
  { id: 'dish_breakfast', name: '春日早餐盘', cat: 'Breakfast', diff: 'MEDIUM', hash: '80342B5EC130F05C' },
  { id: 'dish_salad', name: '田园沙拉', cat: 'Salad', diff: 'MEDIUM', hash: '464DBA9C95C00C3B' },
  { id: 'dish_ramen', name: '豚骨拉面', cat: 'Ramen', diff: 'EASY', hash: '7FCE8C677B219096' },
  { id: 'dish_curry_rice', name: '金黄咖喱饭', cat: 'Curry', diff: 'MEDIUM', hash: '4F0A8858993F1456' },
  { id: 'dish_tomato_pasta', name: '番茄肉酱意面', cat: 'Pasta', diff: 'EASY', hash: '2BFB574724716E4B' },
  { id: 'dish_avocado_chicken_bowl', name: '牛油果鸡肉碗', cat: 'Healthy', diff: 'HARD', hash: '84505167BBD5B715' },
  { id: 'dish_shrimp_fried_rice', name: '鲜虾蛋炒饭', cat: 'Rice', diff: 'HARD', hash: 'E3CA60877A28C145' },
  { id: 'dish_grilled_steak', name: '炭烤牛排拼盘', cat: 'Steak', diff: 'MEDIUM', hash: '680D0BA523796492' }
];

function buildHtmlPage() {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>QA Sheets Generator</title></head>
<body>
<h1>Generating Dish QA Sheets...</h1>
<div id="status">Loading...</div>
<script>
function logMsg(msg) {
  console.log(msg);
  fetch('/api/log?msg=' + encodeURIComponent(msg));
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load ' + src));
    img.src = src;
  });
}

async function generateAll() {
  const dishes = ${JSON.stringify(DISHES)};
  const outputs = {};

  // 1. Generate Master Contact Sheet (4x2 grid, 1600x900)
  logMsg('Generating master contact sheet...');
  const csCanvas = document.createElement('canvas');
  csCanvas.width = 1600;
  csCanvas.height = 920;
  const csCtx = csCanvas.getContext('2d');

  csCtx.fillStyle = '#1A1817';
  csCtx.fillRect(0, 0, 1600, 920);

  // Header
  csCtx.fillStyle = '#FFFFFF';
  csCtx.font = 'bold 26px sans-serif';
  csCtx.fillText('Chufang - Stage 5B Round 2A: 8-Dish Master Contact Sheet', 40, 48);
  csCtx.fillStyle = '#A09890';
  csCtx.font = '15px sans-serif';
  csCtx.fillText('Full 1024x1024 Master Illustrations | Visual Classification Set | Bezier Jigsaw Complementary Edges', 40, 75);

  const cardW = 350;
  const cardH = 380;
  const startX = 40;
  const startY = 100;
  const gapX = 35;
  const gapY = 25;

  for (let i = 0; i < dishes.length; i++) {
    const d = dishes[i];
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = startX + col * (cardW + gapX);
    const y = startY + row * (cardH + gapY);

    // Card background
    csCtx.fillStyle = '#262320';
    csCtx.beginPath();
    csCtx.roundRect(x, y, cardW, cardH, 10);
    csCtx.fill();

    // Image
    const img = await loadImage('/asset?path=packages/web-greybox/public/assets/dishes/' + d.id + '_master.jpg');
    csCtx.drawImage(img, x + 15, y + 15, 320, 270);

    // Card border
    csCtx.strokeStyle = '#3D3834';
    csCtx.lineWidth = 1.5;
    csCtx.stroke();

    // Badge
    let badgeBg = '#4A8505';
    if (d.diff === 'MEDIUM') badgeBg = '#C67D00';
    if (d.diff === 'HARD') badgeBg = '#B23A22';
    csCtx.fillStyle = badgeBg;
    csCtx.beginPath();
    csCtx.roundRect(x + 250, y + 25, 75, 24, 6);
    csCtx.fill();
    csCtx.fillStyle = '#FFFFFF';
    csCtx.font = 'bold 11px sans-serif';
    csCtx.fillText(d.diff, x + 265, y + 41);

    // Text details
    csCtx.fillStyle = '#FFFFFF';
    csCtx.font = 'bold 17px sans-serif';
    csCtx.fillText(d.name, x + 15, y + 312);

    csCtx.fillStyle = '#A09890';
    csCtx.font = '13px sans-serif';
    csCtx.fillText(d.id + ' (' + d.cat + ')', x + 15, y + 334);

    csCtx.fillStyle = '#D67D3E';
    csCtx.font = '12px monospace';
    csCtx.fillText('SHA: ' + d.hash + '...', x + 15, y + 358);
  }

  outputs['dish_set_8_master_contact_sheet.png'] = csCanvas.toDataURL('image/png');

  // 2. Generate 24-Piece Mixed Sheet (8 dishes x 3 pieces each, 6x4 grid)
  logMsg('Generating 24-piece mixed sheet...');
  const mixCanvas = document.createElement('canvas');
  mixCanvas.width = 1500;
  mixCanvas.height = 1000;
  const mCtx = mixCanvas.getContext('2d');

  mCtx.fillStyle = '#141312';
  mCtx.fillRect(0, 0, 1500, 1000);

  mCtx.fillStyle = '#FFFFFF';
  mCtx.font = 'bold 24px sans-serif';
  mCtx.fillText('Stage 5B Round 2A: 24-Piece Mixed Visual Discrimination Test', 40, 45);
  mCtx.fillStyle = '#9C948B';
  mCtx.font = '14px sans-serif';
  mCtx.fillText('Randomized selection of cut puzzle pieces side-by-side to verify silhouette clarity & texture recognition', 40, 70);

  // We choose 3 distinct slots from each dish: corner, edge, and center
  const sampleSlots = [
    { c: 0, r: 0, type: 'Corner' },
    { c: 1, r: 0, type: 'Edge' },
    { c: 1, r: 1, type: 'Center' }
  ];

  const pieceGridCols = 6;
  const pieceGridRows = 4;
  const pCardW = 220;
  const pCardH = 200;
  const pStartX = 45;
  const pStartY = 95;
  const pGapX = 20;
  const pGapY = 18;

  let pieceIdx = 0;
  for (const d of dishes) {
    for (const slot of sampleSlots) {
      const gCol = pieceIdx % pieceGridCols;
      const gRow = Math.floor(pieceIdx / pieceGridCols);
      const px = pStartX + gCol * (pCardW + pGapX);
      const py = pStartY + gRow * (pCardH + pGapY);

      // Card BG
      mCtx.fillStyle = '#211E1C';
      mCtx.beginPath();
      mCtx.roundRect(px, py, pCardW, pCardH, 8);
      mCtx.fill();
      mCtx.strokeStyle = '#38332F';
      mCtx.lineWidth = 1;
      mCtx.stroke();

      const pieceImg = await loadImage('/asset?path=packages/web-greybox/public/assets/dishes/piece_' + d.id + '_slot_' + slot.c + '_' + slot.r + '.png');
      mCtx.drawImage(pieceImg, px + 35, py + 12, 150, 150);

      mCtx.fillStyle = '#FFFFFF';
      mCtx.font = 'bold 12px sans-serif';
      mCtx.fillText(d.name + ' (' + slot.c + ',' + slot.r + ')', px + 12, py + 180);

      mCtx.fillStyle = '#8B837A';
      mCtx.font = '10px sans-serif';
      mCtx.fillText(slot.type + ' | ' + d.diff, px + 12, py + 193);

      pieceIdx++;
    }
  }

  outputs['dish_set_8_mixed_piece_test.png'] = mixCanvas.toDataURL('image/png');

  // 3. Generate 8 Jigsaw QA Sheets (one for each dish, 1200x680)
  for (const d of dishes) {
    logMsg('Generating QA sheet for ' + d.id + '...');
    const qaCanvas = document.createElement('canvas');
    qaCanvas.width = 1200;
    qaCanvas.height = 680;
    const qCtx = qaCanvas.getContext('2d');

    qCtx.fillStyle = '#171615';
    qCtx.fillRect(0, 0, 1200, 680);

    // Title
    qCtx.fillStyle = '#FFFFFF';
    qCtx.font = 'bold 22px sans-serif';
    qCtx.fillText('Jigsaw Drop QA Sheet: ' + d.name + ' (' + d.id + ')', 40, 42);
    qCtx.fillStyle = '#9C948B';
    qCtx.font = '14px sans-serif';
    qCtx.fillText('Category: ' + d.cat + ' | Visual Difficulty: ' + d.diff + ' | 3x3 Grid (9 Complementary Pieces) | SHA256: ' + d.hash + '...', 40, 66);

    // Left panel: Master Illustration
    qCtx.fillStyle = '#221F1D';
    qCtx.beginPath();
    qCtx.roundRect(40, 90, 520, 550, 10);
    qCtx.fill();
    qCtx.strokeStyle = '#38332E';
    qCtx.stroke();

    const masterImg = await loadImage('/asset?path=packages/web-greybox/public/assets/dishes/' + d.id + '_master.jpg');
    qCtx.drawImage(masterImg, 55, 105, 490, 490);
    qCtx.fillStyle = '#CCCCCC';
    qCtx.font = 'bold 14px sans-serif';
    qCtx.fillText('Master 1:1 Illustration (1024x1024)', 55, 622);

    // Right panel: 3x3 Exploded Cut Pieces
    qCtx.fillStyle = '#221F1D';
    qCtx.beginPath();
    qCtx.roundRect(580, 90, 580, 550, 10);
    qCtx.fill();
    qCtx.strokeStyle = '#38332E';
    qCtx.stroke();

    qCtx.fillStyle = '#CCCCCC';
    qCtx.font = 'bold 14px sans-serif';
    qCtx.fillText('Exploded 3x3 Puzzle Pieces (Bezier Tab/Blank Complementary Cutouts)', 595, 622);

    // Draw the 9 pieces in a 3x3 exploded layout
    const pSize = 160;
    const pStep = 180;
    const pOffsetX = 600;
    const pOffsetY = 100;

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        // r=2 is top, r=0 is bottom
        const drawY = pOffsetY + (2 - r) * (pStep - 20);
        const drawX = pOffsetX + c * (pStep - 10);
        const pImg = await loadImage('/asset?path=packages/web-greybox/public/assets/dishes/piece_' + d.id + '_slot_' + c + '_' + r + '.png');
        qCtx.drawImage(pImg, drawX, drawY, pSize, pSize);
      }
    }

    outputs['dish_' + d.id + '_jigsaw_qa.png'] = qaCanvas.toDataURL('image/png');
  }

  logMsg('Uploading QA sheets to disk...');
  const resp = await fetch('/api/save-sheets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(outputs)
  });
  const res = await resp.json();
  logMsg('Completed: ' + JSON.stringify(res));
  document.getElementById('status').textContent = 'DONE: ' + JSON.stringify(res);
}

generateAll().catch(err => {
  logMsg('ERROR: ' + err.message);
  document.getElementById('status').textContent = 'ERROR: ' + err.message;
});
</script>
</body>
</html>`;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost:5192');

  if (url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(buildHtmlPage());
  } else if (url.pathname === '/asset') {
    const relPath = url.searchParams.get('path');
    const fullPath = path.resolve(rootDir, relPath);
    if (!fs.existsSync(fullPath)) {
      res.writeHead(404);
      return res.end('Not found: ' + fullPath);
    }
    const ext = path.extname(fullPath).toLowerCase();
    res.writeHead(200, { 'Content-Type': ext === '.jpg' ? 'image/jpeg' : 'image/png' });
    fs.createReadStream(fullPath).pipe(res);
  } else if (url.pathname === '/api/log') {
    console.log('[QA Sheet Log]', url.searchParams.get('msg'));
    res.writeHead(200);
    res.end('ok');
  } else if (url.pathname === '/api/save-sheets' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const outputs = JSON.parse(body);
        fs.mkdirSync(docsDir, { recursive: true });
        fs.mkdirSync(artifactDir, { recursive: true });

        let count = 0;
        for (const [filename, dataUrl] of Object.entries(outputs)) {
          const buf = Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');
          fs.writeFileSync(path.join(docsDir, filename), buf);
          fs.writeFileSync(path.join(artifactDir, filename), buf);
          count++;
        }

        console.log(`[QASheetGen] Saved ${count} QA sheet images to docs/ and artifactDir.`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, count }));

        setTimeout(() => {
          server.close(() => {
            console.log('[QASheetGen] Server closed.');
            process.exit(0);
          });
        }, 1000);
      } catch (e) {
        console.error('[QASheetGen] Error:', e);
        res.writeHead(500);
        res.end(JSON.stringify({ error: e.message }));
      }
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

const PORT = 5192;
server.listen(PORT, () => {
  console.log(`[QASheetGen] Listening on http://localhost:${PORT}`);
  const chromeCmd = `"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --headless --disable-gpu http://localhost:${PORT}/`;
  exec(chromeCmd, err => {
    if (err) console.warn('[QASheetGen] Chrome notice:', err.message);
  });
});
