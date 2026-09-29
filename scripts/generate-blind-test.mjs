/**
 * scripts/generate-blind-test.mjs
 * Generates:
 *   1. docs/dish_set_8_mixed_piece_blind.png: 24 randomly ordered pieces labeled strictly "01".."24", zero dish hints.
 *   2. docs/dish_set_8_mixed_piece_answer.json: Independent ground-truth answer key.
 *   3. docs/dish_set_8_mixed_piece_answer.png: Visual answer sheet for post-blind review.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const docsDir = path.join(rootDir, 'docs');
const artifactDir = 'C:\\Users\\admin\\.gemini\\antigravity\\brain\\a581706c-feba-4a01-94fc-8c62ff40a9bf';

const DISH_LIST = [
  { id: 'dish_breakfast', name: '春日早餐盘' },
  { id: 'dish_salad', name: '田园沙拉' },
  { id: 'dish_ramen', name: '豚骨拉面' },
  { id: 'dish_curry_rice', name: '金黄咖喱饭' },
  { id: 'dish_tomato_pasta', name: '番茄肉酱意面' },
  { id: 'dish_avocado_chicken_bowl', name: '牛油果鸡肉碗' },
  { id: 'dish_shrimp_fried_rice', name: '鲜虾蛋炒饭' },
  { id: 'dish_grilled_steak', name: '炭烤牛排拼盘' }
];

// Pick 3 varied pieces from each dish: corner, edge, center
const rawSelection = [];
for (const dish of DISH_LIST) {
  rawSelection.push({ dishId: dish.id, dishName: dish.name, col: 0, row: 0, slotType: 'Corner (0,0)' });
  rawSelection.push({ dishId: dish.id, dishName: dish.name, col: 1, row: 0, slotType: 'Edge (1,0)' });
  rawSelection.push({ dishId: dish.id, dishName: dish.name, col: 1, row: 1, slotType: 'Center (1,1)' });
}

// Pseudo-random deterministic shuffle ensuring no consecutive items from the same dish
function shuffleNonConsecutive(items, seed = 42) {
  let list = [...items];
  // Simple LCG
  let s = seed;
  function rnd() {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  }
  // Fisher-Yates
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  // Verify no consecutive identical dishes
  for (let i = 0; i < list.length - 1; i++) {
    if (list[i].dishId === list[i + 1].dishId) {
      // Swap with next non-matching
      for (let j = i + 2; j < list.length; j++) {
        if (list[j].dishId !== list[i].dishId && (j === list.length - 1 || list[j].dishId !== list[i - 1]?.dishId)) {
          [list[i + 1], list[j]] = [list[j], list[i + 1]];
          break;
        }
      }
    }
  }
  return list;
}

const shuffled24 = shuffleNonConsecutive(rawSelection, 20260930);

// Assign numbers "01" to "24"
const answerKey = {};
const blindList = [];

shuffled24.forEach((item, idx) => {
  const numStr = String(idx + 1).padStart(2, '0');
  blindList.push({
    num: numStr,
    dishId: item.dishId,
    col: item.col,
    row: item.row,
    assetFile: `packages/web-greybox/public/assets/dishes/piece_${item.dishId}_slot_${item.col}_${item.row}.png`
  });
  answerKey[numStr] = {
    num: numStr,
    dishId: item.dishId,
    dishName: item.dishName,
    slotId: `slot_${item.col}_${item.row}`,
    slotType: item.slotType
  };
});

function buildHtml() {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Blind Test Generator</title></head>
<body>
<h1>Generating Blind Sheet & Answer Sheet...</h1>
<div id="status">Loading...</div>
<script>
function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('Load failed ' + src));
    img.src = src;
  });
}

async function run() {
  const blindList = ${JSON.stringify(blindList)};
  const answerKey = ${JSON.stringify(answerKey)};
  const outputs = {};

  const cols = 6;
  const rows = 4;
  const w = 1500;
  const h = 1050;
  const cardW = 220;
  const cardH = 210;
  const startX = 45;
  const startY = 110;
  const gapX = 20;
  const gapY = 20;

  // 1. BLIND SHEET (docs/dish_set_8_mixed_piece_blind.png)
  const bCanvas = document.createElement('canvas');
  bCanvas.width = w;
  bCanvas.height = h;
  const bCtx = bCanvas.getContext('2d');

  bCtx.fillStyle = '#1A1817';
  bCtx.fillRect(0, 0, w, h);

  bCtx.fillStyle = '#FFFFFF';
  bCtx.font = 'bold 26px sans-serif';
  bCtx.fillText('Stage 5B Round 2A: 24-Piece Blind Visual Classification Test', 45, 50);
  bCtx.fillStyle = '#A09890';
  bCtx.font = '15px sans-serif';
  bCtx.fillText('Instructions: Review each numbered piece (01..24). Identify the target Dish without prior label hints.', 45, 78);

  for (let i = 0; i < blindList.length; i++) {
    const p = blindList[i];
    const c = i % cols;
    const r = Math.floor(i / cols);
    const x = startX + c * (cardW + gapX);
    const y = startY + r * (cardH + gapY);

    // Uniform neutral card
    bCtx.fillStyle = '#262320';
    bCtx.beginPath();
    bCtx.roundRect(x, y, cardW, cardH, 8);
    bCtx.fill();
    bCtx.strokeStyle = '#3D3834';
    bCtx.lineWidth = 1;
    bCtx.stroke();

    // Piece Image
    const img = await loadImage('/asset?path=' + encodeURIComponent(p.assetFile));
    bCtx.drawImage(img, x + 35, y + 10, 150, 150);

    // ONLY Number Label
    bCtx.fillStyle = '#E5E0DA';
    bCtx.font = 'bold 20px monospace';
    bCtx.textAlign = 'center';
    bCtx.fillText('#' + p.num, x + cardW / 2, y + 192);
    bCtx.textAlign = 'left';
  }
  outputs['dish_set_8_mixed_piece_blind.png'] = bCanvas.toDataURL('image/png');

  // 2. ANSWER SHEET (docs/dish_set_8_mixed_piece_answer.png)
  const aCanvas = document.createElement('canvas');
  aCanvas.width = w;
  aCanvas.height = h;
  const aCtx = aCanvas.getContext('2d');

  aCtx.fillStyle = '#1A1817';
  aCtx.fillRect(0, 0, w, h);

  aCtx.fillStyle = '#FFFFFF';
  aCtx.font = 'bold 26px sans-serif';
  aCtx.fillText('Stage 5B Round 2A: 24-Piece Visual Classification ANSWER KEY', 45, 50);
  aCtx.fillStyle = '#E08030';
  aCtx.font = '15px sans-serif';
  aCtx.fillText('Ground-truth Answer Key revealing Dish Identity, Slot, and Category for post-test grading.', 45, 78);

  for (let i = 0; i < blindList.length; i++) {
    const p = blindList[i];
    const ans = answerKey[p.num];
    const c = i % cols;
    const r = Math.floor(i / cols);
    const x = startX + c * (cardW + gapX);
    const y = startY + r * (cardH + gapY);

    aCtx.fillStyle = '#262320';
    aCtx.beginPath();
    aCtx.roundRect(x, y, cardW, cardH, 8);
    aCtx.fill();
    aCtx.strokeStyle = '#3D3834';
    aCtx.lineWidth = 1;
    aCtx.stroke();

    const img = await loadImage('/asset?path=' + encodeURIComponent(p.assetFile));
    aCtx.drawImage(img, x + 40, y + 8, 140, 140);

    aCtx.fillStyle = '#E08030';
    aCtx.font = 'bold 15px monospace';
    aCtx.fillText('#' + p.num, x + 12, y + 168);

    aCtx.fillStyle = '#FFFFFF';
    aCtx.font = 'bold 13px sans-serif';
    aCtx.fillText(ans.dishName, x + 50, y + 168);

    aCtx.fillStyle = '#9C948B';
    aCtx.font = '11px sans-serif';
    aCtx.fillText(ans.dishId + ' | ' + ans.slotType, x + 12, y + 192);
  }
  outputs['dish_set_8_mixed_piece_answer.png'] = aCanvas.toDataURL('image/png');

  // Send back
  const resp = await fetch('/api/save-blind', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(outputs)
  });
  const res = await resp.json();
  document.getElementById('status').textContent = 'DONE: ' + JSON.stringify(res);
}

run().catch(e => {
  document.getElementById('status').textContent = 'ERROR: ' + e.message;
  console.error(e);
});
</script>
</body>
</html>`;
}

// Server
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost:5194');

  if (url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(buildHtml());
  } else if (url.pathname === '/asset') {
    const rel = url.searchParams.get('path');
    const full = path.resolve(rootDir, rel);
    if (!fs.existsSync(full)) {
      res.writeHead(404);
      return res.end('Not found');
    }
    res.writeHead(200, { 'Content-Type': 'image/png' });
    fs.createReadStream(full).pipe(res);
  } else if (url.pathname === '/api/save-blind' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const outputs = JSON.parse(body);
        fs.mkdirSync(docsDir, { recursive: true });
        fs.mkdirSync(artifactDir, { recursive: true });

        // Save PNGs
        for (const [fname, dUrl] of Object.entries(outputs)) {
          const buf = Buffer.from(dUrl.replace(/^data:image\/png;base64,/, ''), 'base64');
          fs.writeFileSync(path.join(docsDir, fname), buf);
          fs.writeFileSync(path.join(artifactDir, fname), buf);
        }

        // Save JSON answer key
        const jsonStr = JSON.stringify(answerKey, null, 2);
        fs.writeFileSync(path.join(docsDir, 'dish_set_8_mixed_piece_answer.json'), jsonStr);
        fs.writeFileSync(path.join(artifactDir, 'dish_set_8_mixed_piece_answer.json'), jsonStr);

        console.log('[BlindTestGen] Saved blind PNG, answer PNG, and answer JSON!');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));

        setTimeout(() => {
          server.close(() => process.exit(0));
        }, 800);
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

const PORT = 5194;
server.listen(PORT, () => {
  console.log(`[BlindTestGen] Server on http://localhost:${PORT}`);
  const chromeCmd = `"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --headless --disable-gpu http://localhost:${PORT}/`;
  exec(chromeCmd);
});
