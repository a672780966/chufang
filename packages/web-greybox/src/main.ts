import {
  GameSession,
  DEFAULT_DAYS,
  DEFAULT_INGREDIENTS,
  GridCoord,
  IngredientTarget,
  LoosePiece
} from '../../game-core/src/index.js';
import { AudioDirector } from './AudioDirector.js';

class WebGreyboxApp {
  private session!: GameSession;
  private audio = new AudioDirector();
  private currentDayIndex: number = 0;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;

  // Dragging state
  private draggingPiece: LoosePiece | null = null;
  private dragPointerPos: { x: number; y: number } = { x: 0, y: 0 };
  private dragOriginCoord: GridCoord | null = null;

  // Animations & Visual effects
  private pieceVisualPositions = new Map<string, { x: number; y: number }>();
  private targetVisualAnchors = new Map<string, { x: number; y: number }>();
  private activeHoverSlot: { targetId: string; slotId: string } | null = null;

  constructor() {
    this.initDOM();
    this.initSession();
    this.initEvents();
    this.startRenderLoop();
  }

  private initDOM(): void {
    this.canvas = document.getElementById('board-canvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    // Controls
    document.getElementById('btn-audio')?.addEventListener('click', (e) => {
      const btn = e.target as HTMLButtonElement;
      const isMuted = this.audio.toggleMute();
      btn.textContent = isMuted ? '🔇' : '🔊';
    });

    document.getElementById('btn-restart')?.addEventListener('click', () => {
      this.initSession();
    });

    document.getElementById('btn-retry')?.addEventListener('click', () => {
      (document.getElementById('modal-failed') as HTMLElement).style.display = 'none';
      this.initSession();
    });

    document.getElementById('btn-next-day')?.addEventListener('click', () => {
      (document.getElementById('modal-victory') as HTMLElement).style.display = 'none';
      this.currentDayIndex = (this.currentDayIndex + 1) % DEFAULT_DAYS.length;
      this.initSession();
    });
  }

  private resizeCanvas(): void {
    const wrapper = document.getElementById('board-wrapper')!;
    const rect = wrapper.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.resetTransform();
    this.ctx.scale(dpr, dpr);
  }

  private initSession(): void {
    const dayConfig = DEFAULT_DAYS[this.currentDayIndex];
    const seed = Date.now();
    this.session = new GameSession(dayConfig, seed);

    // Audio initial unlock
    this.audio.playReceiptPrint();

    this.pieceVisualPositions.clear();
    this.targetVisualAnchors.clear();
    this.draggingPiece = null;

    this.bindSessionEvents();
    this.updateHUD();
  }

  private bindSessionEvents(): void {
    const events = this.session.events;

    events.on('PIECE_SPAWNED', (p) => {
      // Spawn animation from top
      const screenPos = this.gridToScreen(p.fromCoord);
      this.pieceVisualPositions.set(p.piece.instanceId, { ...screenPos });
      this.updateHUD();
    });

    events.on('PIECE_PLACED', () => {
      this.audio.playPieceSnap();
      this.updateHUD();
    });

    events.on('INGREDIENT_COMPLETED', () => {
      this.audio.playIngredientComplete();
      this.updateHUD();
    });

    events.on('ORDER_CREATED', () => {
      this.audio.playReceiptPrint();
      this.updateHUD();
    });

    events.on('ORDER_COMPLETED', () => {
      this.audio.playReceiptTear();
      this.updateHUD();
    });

    events.on('CASCADE_STEP', (payload) => {
      this.audio.playCascadeDing(payload.chainIndex);
      this.showCascadeBanner(payload.chainIndex, payload.multiplier);
      this.updateHUD();
    });

    events.on('BOARD_DANGER', (payload) => {
      const banner = document.getElementById('danger-banner')!;
      banner.style.display = 'block';
      banner.textContent = `⚠️ 棋盘空间告急！顶部占用 ${(payload.topRowOccupancy * 100).toFixed(0)}%！`;
    });

    events.on('DAY_CLEARED', (payload) => {
      this.audio.playDayClear();
      const modal = document.getElementById('modal-victory')!;
      const summary = document.getElementById('victory-summary')!;
      summary.innerHTML = `DAY ${payload.dayNumber} 胜利达成！<br>最终营业额: <b>¥${payload.totalRevenue}</b> / 目标 ¥${payload.businessGoal}<br>完成订单: <b>${payload.ordersCompleted}</b> 单<br>最大连锁: <b>x${this.session.stats.maxCascadeChain}</b>`;
      modal.style.display = 'flex';
    });

    events.on('DAY_FAILED', (payload) => {
      const modal = document.getElementById('modal-failed')!;
      modal.style.display = 'flex';
    });
  }

  private showCascadeBanner(chainIndex: number, multiplier: number): void {
    const banner = document.getElementById('cascade-banner')!;
    banner.textContent = `⚡ CASCADE x${chainIndex}! +${Math.round((multiplier - 1) * 100)}% 收入`;
    banner.classList.add('show');
    setTimeout(() => {
      banner.classList.remove('show');
    }, 1200);
  }

  private updateHUD(): void {
    const state = this.session.getState();

    // Day title & revenue
    document.getElementById('day-title')!.textContent = `DAY 0${state.dayNumber}`;
    document.getElementById('revenue-display')!.textContent = `¥${state.currentRevenue} / ¥${state.businessGoal}`;

    // Progress bar
    const pct = Math.min(100, Math.round((state.currentRevenue / state.businessGoal) * 100));
    document.getElementById('goal-progress-fill')!.style.width = `${pct}%`;

    // Order receipt
    const currentOrder = state.currentOrder;
    if (currentOrder) {
      document.getElementById('order-id-dish')!.textContent = `${currentOrder.orderId} ${currentOrder.emoji} ${currentOrder.dishName}`;
      document.getElementById('order-revenue')!.textContent = `¥${currentOrder.baseRevenue}`;

      const checklistEl = document.getElementById('receipt-checklist')!;
      checklistEl.innerHTML = '';
      for (const item of currentOrder.items) {
        const def = DEFAULT_INGREDIENTS[item.ingredientId];
        const isDone = item.reserved >= item.needed;
        const div = document.createElement('div');
        div.className = `check-item ${isDone ? 'done' : ''}`;
        div.textContent = `${isDone ? '✓' : '□'} ${def ? def.name : item.ingredientId}`;
        checklistEl.appendChild(div);
      }
    }

    // Next order hint
    const nextHint = state.nextOrderPreview;
    const nextHintEl = document.getElementById('next-order-hint')!;
    if (nextHint && nextHint.mode !== 'NONE' && nextHint.dishName) {
      nextHintEl.textContent = `下一单: ${nextHint.emoji || '🍽️'} ${nextHint.dishName}`;
    } else {
      nextHintEl.textContent = '下一单: 准备中...';
    }

    // Inventory tray chips
    const trayEl = document.getElementById('inventory-tray')!;
    trayEl.innerHTML = '';
    const invEntries = Object.entries(state.inventory);
    if (invEntries.length === 0) {
      trayEl.innerHTML = '<span style="color:#888; font-size:11px;">备料库存: 空</span>';
    } else {
      for (const [ingId, count] of invEntries) {
        if (count <= 0) continue;
        const def = DEFAULT_INGREDIENTS[ingId];
        const chip = document.createElement('div');
        chip.className = 'inv-chip';
        chip.textContent = `${def ? def.emoji : '📦'} ${def ? def.name : ingId} x${count}`;
        trayEl.appendChild(chip);
      }
    }
  }

  /**
   * Transforms board grid coord into canvas pixel coords.
   * Note: Row 0 is at bottom, Row (rows-1) is at top.
   */
  private gridToScreen(coord: GridCoord): { x: number; y: number; width: number; height: number } {
    const wrapper = document.getElementById('board-wrapper')!;
    const rect = wrapper.getBoundingClientRect();
    const cols = this.session.grid.columns;
    const rows = this.session.grid.rows; // Playable rows visible on screen

    const cellWidth = rect.width / cols;
    const cellHeight = rect.height / rows;

    const x = coord.col * cellWidth;
    // Invert row so row 0 is at the bottom
    const y = rect.height - (coord.row + 1) * cellHeight;

    return { x, y, width: cellWidth, height: cellHeight };
  }

  private screenToGrid(x: number, y: number): GridCoord {
    const wrapper = document.getElementById('board-wrapper')!;
    const rect = wrapper.getBoundingClientRect();
    const cols = this.session.grid.columns;
    const rows = this.session.grid.rows;

    const cellWidth = rect.width / cols;
    const cellHeight = rect.height / rows;

    const col = Math.floor(x / cellWidth);
    const row = Math.floor((rect.height - y) / cellHeight);

    return { col, row };
  }

  private initEvents(): void {
    const getPos = (e: MouseEvent | TouchEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      if ('touches' in e && e.touches.length > 0) {
        return {
          x: e.touches[0].clientX - rect.left,
          y: e.touches[0].clientY - rect.top
        };
      }
      const me = e as MouseEvent;
      return {
        x: me.clientX - rect.left,
        y: me.clientY - rect.top
      };
    };

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (this.session.isGameOver) return;
      const pos = getPos(e);
      const coord = this.screenToGrid(pos.x, pos.y);

      // Hit test loose pieces
      const loosePieces = this.session.grid.getAllLoosePieces();
      for (const piece of loosePieces) {
        if (piece.coord.col === coord.col && piece.coord.row === coord.row) {
          this.draggingPiece = piece;
          this.dragPointerPos = pos;
          this.dragOriginCoord = { ...piece.coord };
          break;
        }
      }
    };

    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      if (!this.draggingPiece) return;
      this.dragPointerPos = getPos(e);

      // Check slot magnetism
      this.activeHoverSlot = null;
      const target = this.session.grid.getTarget(this.draggingPiece.targetInstanceId);
      if (target) {
        const def = DEFAULT_INGREDIENTS[target.ingredientId];
        const slotDef = def?.slots.find(s => s.slotId === this.draggingPiece!.slotId);
        if (slotDef) {
          const slotAbsCoord = {
            col: target.anchor.col + slotDef.relativeCol,
            row: target.anchor.row + slotDef.relativeRow
          };
          const slotScreen = this.gridToScreen(slotAbsCoord);
          const dist = Math.hypot(
            this.dragPointerPos.x - (slotScreen.x + slotScreen.width / 2),
            this.dragPointerPos.y - (slotScreen.y + slotScreen.height / 2)
          );

          if (dist < slotScreen.width * 1.5) {
            this.activeHoverSlot = {
              targetId: target.instanceId,
              slotId: this.draggingPiece.slotId
            };
          }
        }
      }
    };

    const onPointerUp = () => {
      if (!this.draggingPiece) return;

      const piece = this.draggingPiece;
      this.draggingPiece = null;

      if (this.activeHoverSlot) {
        // Place piece into target slot!
        const result = this.session.placePiece(
          piece.instanceId,
          this.activeHoverSlot.targetId,
          this.activeHoverSlot.slotId
        );

        if (!result.success) {
          this.audio.playPieceBounce();
        }
      } else {
        this.audio.playPieceBounce();
      }

      this.activeHoverSlot = null;
    };

    this.canvas.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    this.canvas.addEventListener('touchstart', onPointerDown, { passive: false });
    window.addEventListener('touchmove', onPointerMove, { passive: false });
    window.addEventListener('touchend', onPointerUp);
  }

  private startRenderLoop(): void {
    const loop = () => {
      this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  private render(): void {
    const ctx = this.ctx;
    const wrapper = document.getElementById('board-wrapper')!;
    const rect = wrapper.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    ctx.clearRect(0, 0, w, h);

    // 1. Draw subtle grid background
    const cols = this.session.grid.columns;
    const rows = this.session.grid.rows;
    const cellW = w / cols;
    const cellH = h / rows;

    ctx.strokeStyle = '#e0dbcf';
    ctx.lineWidth = 1;
    for (let c = 0; c <= cols; c++) {
      ctx.beginPath();
      ctx.moveTo(c * cellW, 0);
      ctx.lineTo(c * cellW, h);
      ctx.stroke();
    }
    for (let r = 0; r <= rows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * cellH);
      ctx.lineTo(w, r * cellH);
      ctx.stroke();
    }

    // 2. Draw Ingredient Targets
    for (const target of this.session.grid.getAllTargets()) {
      this.renderTarget(target);
    }

    // 3. Draw Loose Pieces (except currently dragged one)
    for (const piece of this.session.grid.getAllLoosePieces()) {
      if (this.draggingPiece && this.draggingPiece.instanceId === piece.instanceId) {
        continue;
      }
      this.renderLoosePiece(piece);
    }

    // 4. Draw currently dragging piece on top
    if (this.draggingPiece) {
      this.renderDraggingPiece(this.draggingPiece);
    }
  }

  private drawJigsawPath(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    edges: { top: string; bottom: string; left: string; right: string }
  ) {
    const tabH = Math.min(w, h) * 0.22;
    const tabW1 = 0.35;
    const tabW2 = 0.65;

    ctx.beginPath();
    ctx.moveTo(x, y);

    // 1. TOP EDGE
    if (edges.top === 'tab') {
      ctx.lineTo(x + w * tabW1, y);
      ctx.bezierCurveTo(x + w * tabW1, y - tabH, x + w * tabW2, y - tabH, x + w * tabW2, y);
      ctx.lineTo(x + w, y);
    } else if (edges.top === 'blank') {
      ctx.lineTo(x + w * tabW1, y);
      ctx.bezierCurveTo(x + w * tabW1, y + tabH, x + w * tabW2, y + tabH, x + w * tabW2, y);
      ctx.lineTo(x + w, y);
    } else {
      ctx.lineTo(x + w, y);
    }

    // 2. RIGHT EDGE
    if (edges.right === 'tab') {
      ctx.lineTo(x + w, y + h * tabW1);
      ctx.bezierCurveTo(x + w + tabH, y + h * tabW1, x + w + tabH, y + h * tabW2, x + w, y + h * tabW2);
      ctx.lineTo(x + w, y + h);
    } else if (edges.right === 'blank') {
      ctx.lineTo(x + w, y + h * tabW1);
      ctx.bezierCurveTo(x + w - tabH, y + h * tabW1, x + w - tabH, y + h * tabW2, x + w, y + h * tabW2);
      ctx.lineTo(x + w, y + h);
    } else {
      ctx.lineTo(x + w, y + h);
    }

    // 3. BOTTOM EDGE
    if (edges.bottom === 'tab') {
      ctx.lineTo(x + w * tabW2, y + h);
      ctx.bezierCurveTo(x + w * tabW2, y + h + tabH, x + w * tabW1, y + h + tabH, x + w * tabW1, y + h);
      ctx.lineTo(x, y + h);
    } else if (edges.bottom === 'blank') {
      ctx.lineTo(x + w * tabW2, y + h);
      ctx.bezierCurveTo(x + w * tabW2, y + h - tabH, x + w * tabW1, y + h - tabH, x + w * tabW1, y + h);
      ctx.lineTo(x, y + h);
    } else {
      ctx.lineTo(x, y + h);
    }

    // 4. LEFT EDGE
    if (edges.left === 'tab') {
      ctx.lineTo(x, y + h * tabW2);
      ctx.bezierCurveTo(x - tabH, y + h * tabW2, x - tabH, y + h * tabW1, x, y + h * tabW1);
      ctx.lineTo(x, y);
    } else if (edges.left === 'blank') {
      ctx.lineTo(x, y + h * tabW2);
      ctx.bezierCurveTo(x + tabH, y + h * tabW2, x + tabH, y + h * tabW1, x, y + h * tabW1);
      ctx.lineTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }

    ctx.closePath();
  }

  private renderTarget(target: IngredientTarget): void {
    const ctx = this.ctx;
    const def = DEFAULT_INGREDIENTS[target.ingredientId];
    if (!def) return;

    // Draw occupied footprint silhouette background
    for (const offset of def.footprint) {
      const coord = { col: target.anchor.col + offset.col, row: target.anchor.row + offset.row };
      const s = this.gridToScreen(coord);

      ctx.fillStyle = def.color + '22';
      ctx.strokeStyle = def.color + '66';
      ctx.lineWidth = 1.5;
      this.roundRect(ctx, s.x + 2, s.y + 2, s.width - 4, s.height - 4, 8);
      ctx.fill();
      ctx.stroke();
    }

    // Draw puzzle slots inside target with real jigsaw tabs & blanks
    for (const slot of def.slots) {
      const isPlaced = target.placedSlotIds.includes(slot.slotId);
      const isHovered =
        this.activeHoverSlot &&
        this.activeHoverSlot.targetId === target.instanceId &&
        this.activeHoverSlot.slotId === slot.slotId;

      const slotCoord = {
        col: target.anchor.col + slot.relativeCol,
        row: target.anchor.row + slot.relativeRow
      };
      const s = this.gridToScreen(slotCoord);
      const pad = 3;
      const x = s.x + pad;
      const y = s.y + pad;
      const w = s.width - pad * 2;
      const h = s.height - pad * 2;

      const edges = slot.edges || { top: 'flat', bottom: 'flat', left: 'flat', right: 'flat' };

      if (isPlaced) {
        // Placed slot: Vibrant solid piece body with seamless jigsaw contour
        ctx.fillStyle = def.color;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        this.drawJigsawPath(ctx, x, y, w, h, edges);
        ctx.fill();
        ctx.stroke();

        // Subtle piece gloss highlight
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(slot.label, s.x + s.width / 2, s.y + s.height / 2);
      } else {
        // Missing slot: Translucent silhouette hole showing jigsaw interlocking indentation
        ctx.save();
        ctx.fillStyle = isHovered ? '#ffd16677' : 'rgba(255,255,255,0.45)';
        ctx.strokeStyle = isHovered ? '#ffb703' : def.color + '99';
        ctx.lineWidth = isHovered ? 3 : 1.5;
        if (!isHovered) ctx.setLineDash([4, 4]);

        this.drawJigsawPath(ctx, x, y, w, h, edges);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = isHovered ? '#fb8500' : '#777777';
        ctx.font = isHovered ? 'bold 11px sans-serif' : '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(slot.label, s.x + s.width / 2, s.y + s.height / 2);
      }
    }
  }

  private renderLoosePiece(piece: LoosePiece): void {
    const ctx = this.ctx;
    const def = DEFAULT_INGREDIENTS[piece.ingredientId];
    if (!def) return;
    const slotDef = def.slots.find(s => s.slotId === piece.slotId);
    const edges = slotDef?.edges || { top: 'flat', bottom: 'flat', left: 'flat', right: 'flat' };

    const s = this.gridToScreen(piece.coord);

    // Smooth drop animation interpolation
    let visPos = this.pieceVisualPositions.get(piece.instanceId);
    if (!visPos) {
      visPos = { x: s.x, y: s.y };
      this.pieceVisualPositions.set(piece.instanceId, visPos);
    } else {
      visPos.x += (s.x - visPos.x) * 0.35;
      visPos.y += (s.y - visPos.y) * 0.35;
    }

    const pad = 4;
    const x = visPos.x + pad;
    const y = visPos.y + pad;
    const w = s.width - pad * 2;
    const h = s.height - pad * 2;

    // Drop shadow
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    this.drawJigsawPath(ctx, x + 2, y + 4, w, h, edges);
    ctx.fill();
    ctx.restore();

    // Piece body
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 2.5;
    this.drawJigsawPath(ctx, x, y, w, h, edges);
    ctx.fill();
    ctx.stroke();

    // Emoji icon watermark
    ctx.font = '15px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.emoji, x + w / 2, y + h / 2 - 4);

    ctx.fillStyle = '#333333';
    ctx.font = 'bold 9px sans-serif';
    ctx.textBaseline = 'bottom';
    ctx.fillText(slotDef ? slotDef.label : piece.slotId, x + w / 2, y + h - 2);
  }

  private renderDraggingPiece(piece: LoosePiece): void {
    const ctx = this.ctx;
    const def = DEFAULT_INGREDIENTS[piece.ingredientId];
    if (!def) return;
    const slotDef = def.slots.find(s => s.slotId === piece.slotId);
    const edges = slotDef?.edges || { top: 'flat', bottom: 'flat', left: 'flat', right: 'flat' };

    const s = this.gridToScreen(piece.coord);
    const w = (s.width - 8) * 1.15;
    const h = (s.height - 8) * 1.15;
    const x = this.dragPointerPos.x - w / 2;
    const y = this.dragPointerPos.y - h / 2;

    // High shadow
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    this.drawJigsawPath(ctx, x + 4, y + 8, w, h, edges);
    ctx.fill();
    ctx.restore();

    // Piece Body
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ffb703';
    ctx.lineWidth = 3.5;
    this.drawJigsawPath(ctx, x, y, w, h, edges);
    ctx.fill();
    ctx.stroke();

    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.emoji, x + w / 2, y + h / 2 - 5);

    ctx.fillStyle = '#fb8500';
    ctx.font = 'bold 11px sans-serif';
    ctx.textBaseline = 'bottom';
    ctx.fillText(slotDef ? slotDef.label : piece.slotId, x + w / 2, y + h - 2);
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new WebGreyboxApp();
});
