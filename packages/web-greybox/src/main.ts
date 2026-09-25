import {
  GameFlowManager,
  GameSession,
  SaveSystem,
  TutorialDirector,
  DEFAULT_DAYS,
  DEFAULT_INGREDIENTS,
  DEFAULT_RECIPES,
  PuzzleCutter,
  PuzzleGeometry,
  BezierCommand,
  GridCoord,
  IngredientTarget,
  LoosePiece,
  DragTutorialCue
} from '../../game-core/src/index.js';
import { AudioDirector } from './audio/AudioDirector.js';
import { WebStorageAdapter } from './storage/WebStorageAdapter.js';
import { WebTelemetrySink } from './telemetry/WebTelemetrySink.js';
import { PastoralTheme } from './theme/PastoralTheme.js';
import { DishTextureManager } from './pipeline/DishTextureManager.js';

class WebGameApp {
  private flow!: GameFlowManager;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;

  // Render & Touch State
  private draggingPiece: LoosePiece | null = null;
  private dragPointerPos: { x: number; y: number } = { x: 0, y: 0 };
  private dragOriginCoord: GridCoord | null = null;
  private wobblePieces = new Map<string, { startTime: number; startX: number; startY: number }>();
  private pieceVisualPositions = new Map<string, { x: number; y: number }>();
  private targetVisualAnchors = new Map<string, { x: number; y: number }>();
  private currentTutorialCue: DragTutorialCue | null = null;
  private completedAnimTargets = new Map<string, { startTime: number; target: IngredientTarget }>();

  // SVG Image Cache for 60fps canvas blitting
  private svgImageCache = new Map<string, HTMLImageElement>();

  constructor() {
    SaveSystem.setStorage(new WebStorageAdapter());
    DishTextureManager.init();
    this.initFlow();
    this.initDOM();
    this.startRenderLoop();

    // Support direct launch via URL query parameter ?day=1..12
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const directDay = urlParams.get('day');
      if (directDay) {
        const d = parseInt(directDay, 10);
        if (d >= 1 && d <= 12) {
          this.startDay(d);
        }
      }
    } catch {}
  }

  private initFlow(): void {
    this.flow = new GameFlowManager({
      onPhaseChanged: (phase, prev) => {
        this.handlePhaseTransition(phase, prev);
      },
      onTutorialCue: (cue) => {
        this.currentTutorialCue = cue;
        this.updateTutorialCue(cue);
      },
      onDayCompleted: (record) => {
        WebTelemetrySink.log('day_clear', record.dayNumber, {
          revenue: record.revenueAchieved,
          pieces: record.piecesPlaced,
          cascades: record.maxCascadeStreak
        });
        this.showDayCompleteModal(record);
      },
      onDayFailed: (reason) => {
        WebTelemetrySink.log('day_fail', this.flow.selectedDay, { reason });
        this.showDayFailedModal(reason);
      },
      onResolvingRequested: (durationMs) => {
        setTimeout(() => {
          this.flow.finishResolving();
        }, durationMs);
      }
    });

    this.renderMenuDayGrid();
  }

  private initDOM(): void {
    this.canvas = document.getElementById('board-canvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    // Navigation & Menu Buttons
    document.getElementById('btn-menu-continue')?.addEventListener('click', () => {
      const highest = this.flow.campaignState.highestUnlockedDay;
      this.startDay(highest);
    });

    document.getElementById('btn-menu-settings')?.addEventListener('click', () => {
      (document.getElementById('modal-settings') as HTMLElement).style.display = 'flex';
    });

    document.getElementById('btn-close-settings')?.addEventListener('click', () => {
      (document.getElementById('modal-settings') as HTMLElement).style.display = 'none';
    });

    document.getElementById('btn-toggle-bgm')?.addEventListener('click', (e) => {
      const btn = e.target as HTMLButtonElement;
      const cur = this.flow.campaignState.settings.musicEnabled;
      SaveSystem.updateSettings({ musicEnabled: !cur });
      AudioDirector.setBgmEnabled(!cur);
      btn.textContent = !cur ? '开启' : '关闭';
      btn.style.background = !cur ? '#ea580c' : '#64748b';
    });

    document.getElementById('btn-toggle-sfx')?.addEventListener('click', (e) => {
      const btn = e.target as HTMLButtonElement;
      const cur = !!this.flow.campaignState.settings.soundEnabled;
      SaveSystem.updateSettings({ soundEnabled: !cur, sfxEnabled: !cur });
      AudioDirector.setSfxEnabled(!cur);
      btn.textContent = !cur ? '开启' : '关闭';
      btn.style.background = !cur ? '#ea580c' : '#64748b';
    });

    document.getElementById('btn-reset-save')?.addEventListener('click', () => {
      if (confirm('确认重置全部通关进度吗？')) {
        SaveSystem.resetCampaignState();
        this.renderMenuDayGrid();
        (document.getElementById('modal-settings') as HTMLElement).style.display = 'none';
      }
    });

    document.getElementById('btn-export-telemetry')?.addEventListener('click', () => {
      WebTelemetrySink.downloadJson();
    });

    // In-Game Controls
    document.getElementById('btn-audio')?.addEventListener('click', (e) => {
      const btn = e.target as HTMLButtonElement;
      const cur = !!this.flow.campaignState.settings.soundEnabled;
      SaveSystem.updateSettings({ soundEnabled: !cur, sfxEnabled: !cur, musicEnabled: !cur });
      AudioDirector.setSfxEnabled(!cur);
      AudioDirector.setBgmEnabled(!cur);
      btn.textContent = !cur ? '🔊' : '🔇';
    });

    document.getElementById('btn-pause')?.addEventListener('click', () => {
      this.flow.pauseGame();
      (document.getElementById('modal-pause') as HTMLElement).style.display = 'flex';
    });

    document.getElementById('btn-resume')?.addEventListener('click', () => {
      (document.getElementById('modal-pause') as HTMLElement).style.display = 'none';
      this.flow.resumeGame();
    });

    document.getElementById('btn-pause-menu')?.addEventListener('click', () => {
      (document.getElementById('modal-pause') as HTMLElement).style.display = 'none';
      this.flow.enterMainMenu();
    });

    document.getElementById('btn-victory-menu')?.addEventListener('click', () => {
      (document.getElementById('modal-victory') as HTMLElement).style.display = 'none';
      this.flow.enterMainMenu();
    });

    document.getElementById('btn-failed-menu')?.addEventListener('click', () => {
      (document.getElementById('modal-failed') as HTMLElement).style.display = 'none';
      this.flow.enterMainMenu();
    });

    document.getElementById('btn-next-day')?.addEventListener('click', () => {
      (document.getElementById('modal-victory') as HTMLElement).style.display = 'none';
      this.flow.advanceToNextDay();
    });

    document.getElementById('btn-retry')?.addEventListener('click', () => {
      (document.getElementById('modal-failed') as HTMLElement).style.display = 'none';
      this.flow.restartCurrentDay();
    });

    // Pointer Interaction on Board Canvas
    this.canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    this.canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
    this.canvas.addEventListener('pointerup', (e) => this.onPointerUp(e));
    this.canvas.addEventListener('pointercancel', (e) => this.onPointerUp(e));
  }

  private resizeCanvas(): void {
    const wrapper = document.getElementById('board-wrapper');
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.round(rect.width * dpr);
    const targetH = Math.round(rect.height * dpr);
    if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
      this.canvas.width = targetW;
      this.canvas.height = targetH;
      this.ctx.resetTransform();
      this.ctx.scale(dpr, dpr);
    }
  }

  private handlePhaseTransition(phase: string, _prev: string): void {
    if (!this.flow) return;
    const menuView = document.getElementById('view-menu');
    const gameView = document.getElementById('view-game');
    if (!menuView || !gameView) return;

    if (phase === 'MAIN_MENU') {
      menuView.classList.remove('view-hidden');
      gameView.classList.add('view-hidden');
      this.renderMenuDayGrid();
    } else {
      menuView.classList.add('view-hidden');
      gameView.classList.remove('view-hidden');
      this.resizeCanvas();
      this.updateHUD();
    }
  }

  private renderMenuDayGrid(): void {
    if (!this.flow) return;
    const grid = document.getElementById('menu-day-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const highest = this.flow.campaignState.highestUnlockedDay;
    const continueLabel = document.getElementById('btn-continue-label');
    if (continueLabel) {
      continueLabel.textContent = `开始今日营业 (DAY ${highest})`;
    }

    for (let day = 1; day <= 12; day++) {
      const tile = document.createElement('div');
      tile.className = 'day-tile';
      const isCompleted = !!this.flow.campaignState.completedDays[day];
      const isLocked = day > highest;

      if (isCompleted) {
        tile.classList.add('completed');
        tile.innerHTML = `<div>D${day}</div><div class="day-stamp">已营业✓</div>`;
      } else if (isLocked) {
        tile.classList.add('locked');
        tile.innerHTML = `<div>D${day}</div><div style="font-size:10px; color:var(--ink-muted);">🔒</div>`;
      } else {
        if (day === highest) tile.classList.add('current-play');
        tile.innerHTML = `<div>D${day}</div><div style="font-size:10px; color:var(--sage-dark); font-weight:800;">今日</div>`;
      }

      if (!isLocked) {
        tile.addEventListener('click', () => {
          this.startDay(day);
        });
      }

      grid.appendChild(tile);
    }
  }

  private startDay(dayNumber: number): void {
    this.pieceVisualPositions.clear();
    this.targetVisualAnchors.clear();
    this.draggingPiece = null;
    this.wobblePieces.clear();
    this.completedAnimTargets.clear();
    this.currentTutorialCue = null;
    this.resizeCanvas();

    const session = this.flow.startDay(dayNumber);
    WebTelemetrySink.log('day_start', dayNumber);

    setTimeout(() => {
      this.flow.beginPlaying();
    }, 250);

    // Bind session audio & visual cues
    session.events.on('PIECE_PLACED', () => AudioDirector.playSnapPiece());
    session.events.on('INGREDIENT_COMPLETED', (d: any) => {
      AudioDirector.playIngredientComplete(d.target?.ingredientId);
      if (d.target) {
        this.completedAnimTargets.set(d.target.instanceId, {
          startTime: performance.now(),
          target: d.target
        });
      }
    });
    session.events.on('CASCADE_STEP', (d: any) => AudioDirector.playCascade(d.chainLength));
    session.events.on('ORDER_COMPLETED', () => {
      AudioDirector.playOrderComplete();
      AudioDirector.playRevenueGain();
    });
    session.events.on('BOARD_SETTLED', () => AudioDirector.playBoardSettling());
    session.events.on('BOARD_DANGER', () => AudioDirector.playDanger());
    session.events.on('DAY_CLEARED', () => AudioDirector.playDayClear());

    AudioDirector.playReceiptPrint();
    if (this.flow.campaignState.settings.musicEnabled) {
      AudioDirector.startBgm();
    }

    this.updateHUD();
  }

  private updateHUD(): void {
    const session = this.flow.session;
    if (!session) return;

    // A. Top Header Day & Revenue
    const dayTitle = document.getElementById('day-title');
    if (dayTitle) dayTitle.textContent = `DAY ${String(session.dayConfig.dayNumber).padStart(2, '0')}`;

    const revDisplay = document.getElementById('revenue-display');
    if (revDisplay) revDisplay.textContent = `¥${session.revenue} / ¥${session.dayConfig.businessGoal}`;

    const fill = document.getElementById('goal-progress-fill');
    if (fill) {
      const pct = Math.min(100, (session.revenue / session.dayConfig.businessGoal) * 100);
      fill.style.width = `${pct}%`;
    }

    // B. Hanging Thermal Receipt
    const order = session.orderSystem.currentOrder;
    const orderIdNum = document.getElementById('order-id-num');
    const orderIdDish = document.getElementById('order-id-dish');
    const orderRevenue = document.getElementById('order-revenue');
    const checklist = document.getElementById('receipt-checklist');

    if (order) {
      if (orderIdNum) orderIdNum.textContent = `${order.orderId}`;
      if (orderIdDish) orderIdDish.textContent = `${order.dishName}`;
      const dishThumb = document.getElementById('receipt-dish-thumb') as HTMLImageElement;
      if (dishThumb) {
        dishThumb.src = DishTextureManager.DISH_MASTERS[order.recipeId] || '/assets/dishes/dish_salad_master.jpg';
      }
      if (orderRevenue) orderRevenue.textContent = `¥${order.baseRevenue}`;

      if (checklist) {
        checklist.innerHTML = '';
        // Clean dish progress dots (no raw ugly ingredient text lists!)
        for (const item of order.items) {
          const dot = document.createElement('div');
          const isSatisfied = item.reserved >= item.needed;
          dot.className = `dish-progress-dot ${isSatisfied ? 'filled' : ''}`;
          dot.title = `${item.ingredientId}: ${item.reserved}/${item.needed}`;
          checklist.appendChild(dot);
        }
      }
    }

    // Next Order Hint (Dish only, unlocked Day 7+)
    const nextHint = document.getElementById('next-order-hint');
    const nextLabel = document.getElementById('next-order-label');
    const nextPreview = session.orderSystem.getNextOrderPreview();

    if (nextHint && nextLabel) {
      if (session.dayConfig.dayNumber >= 7 && nextPreview.dishId) {
        nextHint.style.display = 'inline-flex';
        nextLabel.textContent = `${nextPreview.dishName}`;
      } else {
        nextHint.style.display = 'none';
      }
    }

    // D. Serving Tray (2 slots for prepared dishes)
    const slot0 = document.getElementById('tray-slot-0');
    const slot1 = document.getElementById('tray-slot-1');
    const stock = session.inventory.getAllAvailable();
    const stockEntries = Object.entries(stock).filter(([_, c]) => c > 0);
    if (slot0) {
      if (stockEntries[0]) {
        const ing = DEFAULT_INGREDIENTS[stockEntries[0][0]];
        slot0.textContent = ing?.name || '备用';
        slot0.className = 'tray-dish-slot occupied';
      } else {
        slot0.textContent = '空';
        slot0.className = 'tray-dish-slot';
      }
    }
    if (slot1) {
      if (stockEntries[1]) {
        const ing = DEFAULT_INGREDIENTS[stockEntries[1][0]];
        slot1.textContent = ing?.name || '备用';
        slot1.className = 'tray-dish-slot occupied';
      } else {
        slot1.textContent = '空';
        slot1.className = 'tray-dish-slot';
      }
    }

    // Danger banner
    const dangerBanner = document.getElementById('danger-banner');
    if (dangerBanner) {
      dangerBanner.style.display = session.isBoardInDanger() ? 'block' : 'none';
      dangerBanner.textContent = '⚠️ 厨房忙碌中，请尽快拼合出餐腾出台面~';
    }

    // Cascade banner
    const cascadeBanner = document.getElementById('cascade-banner');
    if (cascadeBanner) {
      if (session.stats.cascadeEventsCount > 0) {
        cascadeBanner.style.display = 'block';
        cascadeBanner.textContent = `⚡ 连续出餐 ×${session.stats.maxCascadeChain}！今日厨房好忙~`;
      } else {
        cascadeBanner.style.display = 'none';
      }
    }
  }

  private updateTutorialCue(cue: DragTutorialCue | null): void {
    this.currentTutorialCue = cue;
    const indicator = document.getElementById('tutorial-indicator');
    if (!indicator) return;

    if (!cue) {
      indicator.style.display = 'none';
      return;
    }

    // Position indicator over candidate loose piece
    const screenPos = this.gridToScreen(cue.fromCoord);
    const cellSize = this.getCellSize();
    indicator.style.display = 'block';
    indicator.style.left = `${screenPos.x + cellSize / 2 - 16}px`;
    indicator.style.top = `${screenPos.y + cellSize - 6}px`;
  }

  private showDayCompleteModal(record: any): void {
    const modal = document.getElementById('modal-victory') as HTMLElement;
    const summary = document.getElementById('victory-summary');
    if (summary) {
      summary.innerHTML = `<strong>DAY ${record.dayNumber} 完成！</strong><br>营业额: ¥${record.revenueAchieved} / ¥${record.businessGoal}<br>完成订单: ${record.ordersCompleted} 单 | 连续出餐最高 ×${record.maxCascadeStreak}`;
    }
    modal.style.display = 'flex';
  }

  private showDayFailedModal(reason: string): void {
    const modal = document.getElementById('modal-failed') as HTMLElement;
    modal.style.display = 'flex';
  }

  // --- Coordinate Transformation & Rendering Geometry ---
  private getBoardOrigin(): { originX: number; originY: number; cellSize: number } {
    const session = this.flow?.session;
    const wrapper = document.getElementById('board-wrapper');
    const rect = wrapper ? wrapper.getBoundingClientRect() : { width: 400, height: 600 };
    const cols = session?.grid.columns || 8;
    const rows = session?.grid.rows || 12;
    const padding = 10;
    const availW = Math.max(100, (rect.width > 0 ? rect.width : 400) - padding * 2);
    const availH = Math.max(100, (rect.height > 0 ? rect.height : 600) - padding * 2);
    const cellSize = Math.min(availW / cols, availH / rows);
    const originX = ((rect.width > 0 ? rect.width : 400) - cols * cellSize) / 2;
    // Vertically center board inside wrapper: row 0 is bottom, row rows-1 is top
    const originY = ((rect.height > 0 ? rect.height : 600) + rows * cellSize) / 2 - cellSize;
    return { originX, originY, cellSize };
  }

  private getCellSize(): number {
    return this.getBoardOrigin().cellSize;
  }

  private gridToScreen(coord: GridCoord): { x: number; y: number } {
    const { originX, originY, cellSize } = this.getBoardOrigin();
    const x = originX + coord.col * cellSize;
    const y = originY - coord.row * cellSize;
    return { x, y };
  }

  private screenToGrid(x: number, y: number): GridCoord {
    const { originX, originY, cellSize } = this.getBoardOrigin();
    const col = Math.floor((x - originX) / cellSize);
    const row = Math.floor(((originY + cellSize) - y) / cellSize);
    return { col, row };
  }

  /**
   * Directly translates PuzzleGeometry Bezier commands into Canvas 2D path commands.
   * Runs natively at 60 FPS with zero async image latency.
   */
  private drawBezierPath(commands: BezierCommand[]): void {
    this.ctx.beginPath();
    for (const cmd of commands) {
      if (cmd.type === 'M') {
        this.ctx.moveTo(cmd.x, cmd.y);
      } else if (cmd.type === 'L') {
        this.ctx.lineTo(cmd.x, cmd.y);
      } else if (cmd.type === 'C') {
        this.ctx.bezierCurveTo(cmd.cp1x!, cmd.cp1y!, cmd.cp2x!, cmd.cp2y!, cmd.x, cmd.y);
      } else if (cmd.type === 'Z') {
        this.ctx.closePath();
      }
    }
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // --- SVG Image Cached Loading (Optional texture overlay) ---
  private getOrCreateSvgImage(cacheKey: string, svgString: string): HTMLImageElement {
    let img = this.svgImageCache.get(cacheKey);
    if (!img) {
      img = new Image();
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      img.src = URL.createObjectURL(blob);
      this.svgImageCache.set(cacheKey, img);
    }
    return img;
  }

  // --- Touch & Pointer Handling ---
  private onPointerDown(e: PointerEvent): void {
    if (this.flow.isInputLocked || !this.flow.session) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const coord = this.screenToGrid(x, y);
    const loose = this.flow.session.grid.getAllLoosePieces();

    // Check hit on loose piece: exact coord match first, then proximity radius <= 1.15
    let matchedPiece: LoosePiece | null = null;
    for (const piece of loose) {
      if (piece.coord.col === coord.col && piece.coord.row === coord.row) {
        matchedPiece = piece;
        break;
      }
    }
    if (!matchedPiece) {
      let bestDist = 1.15;
      for (const piece of loose) {
        const d = Math.hypot(piece.coord.col - coord.col, piece.coord.row - coord.row);
        if (d < bestDist) {
          bestDist = d;
          matchedPiece = piece;
        }
      }
    }

    if (matchedPiece) {
      this.draggingPiece = matchedPiece;
      this.dragPointerPos = { x, y };
      this.dragOriginCoord = { ...matchedPiece.coord };
      AudioDirector.playPickPiece();
      this.canvas.setPointerCapture(e.pointerId);
    }
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.draggingPiece) return;
    const rect = this.canvas.getBoundingClientRect();
    this.dragPointerPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private onPointerUp(e: PointerEvent): void {
    if (!this.draggingPiece || !this.flow.session) {
      this.draggingPiece = null;
      return;
    }

    const session = this.flow.session;
    const piece = this.draggingPiece;
    const coord = this.screenToGrid(this.dragPointerPos.x, this.dragPointerPos.y);

    // Look for matching target at or near dropped coordinate
    const target = session.grid.getAllTargets().find(t => t.instanceId === piece.targetInstanceId);

    let placed = false;
    if (target && target.missingSlotIds.includes(piece.slotId)) {
      const def = session.ingredients[target.ingredientId];
      const slot = def?.slots.find(s => s.slotId === piece.slotId);
      if (slot) {
        const slotAbsCol = target.anchor.col + slot.relativeCol;
        const slotAbsRow = target.anchor.row + slot.relativeRow;

        // Tolerant snap radius: distance in grid coords <= 1.35
        const dist = Math.hypot(coord.col - slotAbsCol, coord.row - slotAbsRow);
        if (dist <= 1.35) {
          const res = this.flow.placePiece(piece.instanceId, target.instanceId, piece.slotId);
          if (res.success) {
            placed = true;
            WebTelemetrySink.log('piece_placed', session.dayConfig.dayNumber, {
              pieceId: piece.instanceId,
              targetId: target.instanceId,
              slotId: piece.slotId
            });
            this.updateTutorialCue(null);
          }
        }
      }
    }

    if (!placed) {
      // Trigger wobble feedback & smooth return
      AudioDirector.playWrongDrop();
      WebTelemetrySink.log('wrong_drop', session.dayConfig.dayNumber);
      this.wobblePieces.set(piece.instanceId, {
        startTime: performance.now(),
        startX: this.dragPointerPos.x,
        startY: this.dragPointerPos.y
      });
    }

    this.draggingPiece = null;
    this.dragOriginCoord = null;
    try {
      this.canvas.releasePointerCapture(e.pointerId);
    } catch {}
    this.updateHUD();
  }

  // --- Render Loop (60 FPS) ---
  private startRenderLoop(): void {
    const loop = () => {
      this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  private drawSteamPuffs(centerX: number, topY: number, progress: number): void {
    this.ctx.save();
    const alpha = Math.max(0, (1 - progress) * 0.8);
    this.ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
    this.ctx.lineWidth = 2.5;
    this.ctx.lineCap = 'round';
    for (let i = -1; i <= 1; i++) {
      const offsetX = i * 14;
      const lift = progress * 32;
      const baseY = topY - lift;
      this.ctx.beginPath();
      this.ctx.moveTo(centerX + offsetX, baseY);
      this.ctx.bezierCurveTo(
        centerX + offsetX - 5 + Math.sin(progress * 5 + i * 1.5) * 4,
        baseY - 8,
        centerX + offsetX + 5 + Math.cos(progress * 5 + i * 1.5) * 4,
        baseY - 16,
        centerX + offsetX + Math.sin(progress * 3) * 3,
        baseY - 24
      );
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  private render(): void {
    this.resizeCanvas();
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    this.ctx.clearRect(0, 0, rect.width, rect.height);

    const session = this.flow.session;
    if (!session || this.flow.phase === 'MAIN_MENU') return;

    const { originX, originY, cellSize } = this.getBoardOrigin();
    const cols = session.grid.columns;
    const rows = session.grid.rows;
    const now = performance.now();

    // 1. Linen Mat Base Plate (Warm Pastoral Table Mat - ZERO visible grid cells!)
    const boardW = cols * cellSize;
    const boardH = rows * cellSize;
    const boardX = originX;
    const boardY = originY - (rows - 1) * cellSize;

    this.ctx.save();
    // Warm Linen mat fill
    this.ctx.fillStyle = PastoralTheme.colors.bgLinen;
    this.roundRect(this.ctx, boardX, boardY, boardW, boardH, PastoralTheme.radii.board);
    this.ctx.fill();

    // Soft wood trim border
    this.ctx.strokeStyle = PastoralTheme.colors.woodLight;
    this.ctx.lineWidth = 4;
    this.roundRect(this.ctx, boardX, boardY, boardW, boardH, PastoralTheme.radii.board);
    this.ctx.stroke();

    // Delicate inner border line
    this.ctx.strokeStyle = 'rgba(139, 99, 71, 0.12)';
    this.ctx.lineWidth = 1.5;
    this.roundRect(this.ctx, boardX + 3, boardY + 3, boardW - 6, boardH - 6, PastoralTheme.radii.board - 2);
    this.ctx.stroke();

    // Top Danger Zone Divider (Warm pastel alert line, never harsh red)
    const dangerZonePos = this.gridToScreen({ col: 0, row: 10 });
    const isDanger = session.isBoardInDanger();
    if (isDanger) {
      this.ctx.fillStyle = 'rgba(231, 155, 98, 0.10)';
      this.ctx.fillRect(boardX + 4, dangerZonePos.y, boardW - 8, cellSize * 2);
    }
    this.ctx.setLineDash([8, 6]);
    this.ctx.strokeStyle = isDanger ? PastoralTheme.colors.danger : 'rgba(180, 160, 140, 0.35)';
    this.ctx.lineWidth = isDanger ? 2 : 1;
    this.ctx.beginPath();
    this.ctx.moveTo(boardX + 8, dangerZonePos.y + cellSize);
    this.ctx.lineTo(boardX + boardW - 8, dangerZonePos.y + cellSize);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
    this.ctx.restore();

    // 2. Active Targets (Ceramic Plates & Jigsaw Sockets)
    for (const target of session.grid.getAllTargets()) {
      const def = session.ingredients[target.ingredientId];
      if (!def) continue;

      const targetX = originX + target.anchor.col * cellSize;
      const targetY = originY - (target.anchor.row + def.height - 1) * cellSize;
      const targetW = def.width * cellSize;
      const targetH = def.height * cellSize;

      // Ceramic white target dish base plate
      this.ctx.save();
      this.ctx.fillStyle = PastoralTheme.colors.targetPlate;
      this.ctx.shadowColor = PastoralTheme.shadows.targetPlate;
      this.ctx.shadowBlur = 8;
      this.ctx.shadowOffsetY = 2;
      this.roundRect(this.ctx, targetX + 2, targetY + 2, targetW - 4, targetH - 4, PastoralTheme.radii.plate);
      this.ctx.fill();
      this.ctx.restore();

      this.ctx.save();
      this.ctx.strokeStyle = PastoralTheme.colors.targetBorder;
      this.ctx.lineWidth = 1.5;
      this.roundRect(this.ctx, targetX + 2, targetY + 2, targetW - 4, targetH - 4, PastoralTheme.radii.plate);
      this.ctx.stroke();
      this.ctx.restore();

      // Draw each slot in target
      const baseColor = def.color || PastoralTheme.colors.tomato;
      for (const slot of def.slots) {
        const isPlaced = target.placedSlotIds.includes(slot.slotId);
        const isMatchingDrag = this.draggingPiece &&
          this.draggingPiece.targetInstanceId === target.instanceId &&
          this.draggingPiece.slotId === slot.slotId;
        const isTutorialTarget = this.currentTutorialCue?.targetInstanceId === target.instanceId &&
          this.currentTutorialCue?.slotId === slot.slotId;

        const slotCol = target.anchor.col + slot.relativeCol;
        const slotRow = target.anchor.row + slot.relativeRow;
        const slotPos = this.gridToScreen({ col: slotCol, row: slotRow });

        const slotBounds = {
          x: slotPos.x + 3,
          y: slotPos.y + 3,
          width: cellSize - 6,
          height: cellSize - 6
        };

        const pathCommands = PuzzleGeometry.generateSlotPathCommands(slotBounds, slot.edges);

        if (isPlaced) {
          // Completed slot: Authentic cut piece image texture from Master Dish Art!
          const pieceImg = DishTextureManager.getPieceImage(target.ingredientId, slot.slotId);
          if (pieceImg) {
            const padScreen = cellSize * 0.28;
            this.ctx.drawImage(
              pieceImg,
              slotPos.x - padScreen,
              slotPos.y - padScreen,
              cellSize + padScreen * 2,
              cellSize + padScreen * 2
            );
          } else {
            this.ctx.save();
            this.ctx.fillStyle = baseColor;
            this.drawBezierPath(pathCommands);
            this.ctx.fill();
            this.ctx.strokeStyle = PastoralTheme.colors.cardboard;
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            this.ctx.restore();
          }
        } else {
          // Missing slot: Recessed socket (ZERO debug text!)
          this.ctx.save();

          if (isMatchingDrag) {
            // Drag-Hover Snap Guide: Gentle golden honey glow
            const pulse = Math.sin(now / 140) * 0.18 + 0.65;
            this.ctx.fillStyle = `rgba(253, 230, 138, ${pulse})`;
            this.drawBezierPath(pathCommands);
            this.ctx.fill();

            this.ctx.strokeStyle = PastoralTheme.colors.honey;
            this.ctx.lineWidth = 2.5;
            this.ctx.stroke();
          } else if (isTutorialTarget) {
            // Tutorial cue: Soft amber beacon
            this.ctx.fillStyle = 'rgba(254, 243, 199, 0.85)';
            this.drawBezierPath(pathCommands);
            this.ctx.fill();

            this.ctx.setLineDash([5, 4]);
            this.ctx.strokeStyle = PastoralTheme.colors.honey;
            this.ctx.lineWidth = 2.5;
            this.ctx.stroke();
            this.ctx.setLineDash([]);
          } else {
            // Normal empty socket: Translucent recessed socket with soft dashed outline
            this.ctx.fillStyle = PastoralTheme.colors.socketBg;
            this.drawBezierPath(pathCommands);
            this.ctx.fill();

            this.ctx.setLineDash([4, 4]);
            this.ctx.strokeStyle = PastoralTheme.colors.socketDashed;
            this.ctx.lineWidth = 1.5;
            this.drawBezierPath(pathCommands);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
          }
          this.ctx.restore();
        }
      }
    }

    // 3. Dish Completion Celebration Animations (550ms: scale bounce, seam fading, golden shimmer, steam puffs)
    for (const [instanceId, anim] of this.completedAnimTargets.entries()) {
      const elapsed = now - anim.startTime;
      if (elapsed > 550) {
        this.completedAnimTargets.delete(instanceId);
        continue;
      }

      const progress = elapsed / 550;
      const target = anim.target;
      const def = session.ingredients[target.ingredientId];
      if (!def) continue;

      const targetX = originX + target.anchor.col * cellSize;
      const targetY = originY - (target.anchor.row + def.height - 1) * cellSize;
      const targetW = def.width * cellSize;
      const targetH = def.height * cellSize;
      const bounce = 1.0 + 0.05 * Math.sin(progress * Math.PI);
      const alpha = Math.max(0, 1 - Math.max(0, (progress - 0.75) / 0.25));

      this.ctx.save();
      this.ctx.globalAlpha = alpha;
      this.ctx.translate(targetX + targetW / 2, targetY + targetH / 2);
      this.ctx.scale(bounce, bounce);
      this.ctx.translate(-(targetX + targetW / 2), -(targetY + targetH / 2));

      // Golden celebratory glow plate
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
      this.ctx.shadowColor = 'rgba(232, 184, 92, 0.5)';
      this.ctx.shadowBlur = 18;
      this.roundRect(this.ctx, targetX + 2, targetY + 2, targetW - 4, targetH - 4, PastoralTheme.radii.plate);
      this.ctx.fill();

      this.ctx.strokeStyle = PastoralTheme.colors.honey;
      this.ctx.lineWidth = 2.5;
      this.ctx.stroke();

      // Draw slots with fading seams using real cut piece textures
      const baseColor = def.color || PastoralTheme.colors.tomato;
      for (const slot of def.slots) {
        const slotCol = target.anchor.col + slot.relativeCol;
        const slotRow = target.anchor.row + slot.relativeRow;
        const slotPos = this.gridToScreen({ col: slotCol, row: slotRow });

        const slotBounds = {
          x: slotPos.x + 3,
          y: slotPos.y + 3,
          width: cellSize - 6,
          height: cellSize - 6
        };
        const pathCommands = PuzzleGeometry.generateSlotPathCommands(slotBounds, slot.edges);

        const pieceImg = DishTextureManager.getPieceImage(target.ingredientId, slot.slotId);
        if (pieceImg) {
          const padScreen = cellSize * 0.28;
          this.ctx.drawImage(
            pieceImg,
            slotPos.x - padScreen,
            slotPos.y - padScreen,
            cellSize + padScreen * 2,
            cellSize + padScreen * 2
          );
        } else {
          this.ctx.save();
          this.ctx.fillStyle = baseColor;
          this.drawBezierPath(pathCommands);
          this.ctx.fill();
          this.ctx.restore();
        }

        // Fading seam highlight
        this.ctx.save();
        this.ctx.strokeStyle = `rgba(255, 255, 255, ${Math.max(0, 1 - progress * 1.6)})`;
        this.ctx.lineWidth = 2;
        this.drawBezierPath(pathCommands);
        this.ctx.stroke();
        this.ctx.restore();
      }

      // Golden shimmer sweep across the plate
      const shimmerX = targetX - targetW * 0.4 + progress * targetW * 2.2;
      const shimmerGrad = this.ctx.createLinearGradient(shimmerX, targetY, shimmerX + 50, targetY + targetH);
      shimmerGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
      shimmerGrad.addColorStop(0.5, 'rgba(253, 230, 138, 0.75)');
      shimmerGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      this.ctx.fillStyle = shimmerGrad;
      this.roundRect(this.ctx, targetX + 2, targetY + 2, targetW - 4, targetH - 4, PastoralTheme.radii.plate);
      this.ctx.fill();

      // Master Dish Art celebration image dissolves smoothly over the assembled pieces
      const recipeId = session.orderSystem.currentOrder?.recipeId || 'salad';
      const masterImg = DishTextureManager.getDishMasterImage(recipeId);
      if (masterImg) {
        this.ctx.save();
        this.ctx.globalAlpha = Math.min(1, progress * 1.4);
        this.ctx.beginPath();
        this.roundRect(this.ctx, targetX + 4, targetY + 4, targetW - 8, targetH - 8, PastoralTheme.radii.plate);
        this.ctx.clip();
        this.ctx.drawImage(masterImg, targetX + 4, targetY + 4, targetW - 8, targetH - 8);
        this.ctx.restore();
      }

      // Steam puffs rising up
      this.drawSteamPuffs(targetX + targetW / 2, targetY, progress);

      this.ctx.restore();
    }

    // 4. Loose Pieces (Resting & Smooth Wobbling - ZERO debug text!)
    for (const piece of session.grid.getAllLoosePieces()) {
      if (this.draggingPiece && this.draggingPiece.instanceId === piece.instanceId) {
        continue; // Render dragged piece on topmost layer
      }

      const def = session.ingredients[piece.ingredientId];
      if (!def) continue;

      let drawX = 0;
      let drawY = 0;

      // Smooth wrong drop wobble
      const wobble = this.wobblePieces.get(piece.instanceId);
      if (wobble) {
        const elapsed = now - wobble.startTime;
        const targetScreen = this.gridToScreen(piece.coord);
        if (elapsed < 300) {
          const t = elapsed / 300;
          const wobbleOffset = Math.sin(t * Math.PI * 4) * (1 - t) * 10;
          drawX = wobble.startX + (targetScreen.x - wobble.startX) * t + wobbleOffset;
          drawY = wobble.startY + (targetScreen.y - wobble.startY) * t;
        } else {
          this.wobblePieces.delete(piece.instanceId);
          drawX = targetScreen.x;
          drawY = targetScreen.y;
        }
      } else {
        const screenPos = this.gridToScreen(piece.coord);
        drawX = screenPos.x;
        drawY = screenPos.y;
      }

      const slotDef = def.slots.find(s => s.slotId === piece.slotId);
      const pieceBounds = {
        x: drawX + 3,
        y: drawY + 3,
        width: cellSize - 6,
        height: cellSize - 6
      };
      const edges = slotDef?.edges || { top: 'flat', right: 'flat', bottom: 'flat', left: 'flat' };
      const pathCommands = PuzzleGeometry.generateSlotPathCommands(pieceBounds, edges);

      // Render cut piece texture from Master Dish Art
      const pieceImg = DishTextureManager.getPieceImage(piece.ingredientId, piece.slotId);
      if (pieceImg) {
        const padScreen = cellSize * 0.28;
        this.ctx.save();
        this.ctx.shadowColor = PastoralTheme.shadows.piece;
        this.ctx.shadowBlur = 6;
        this.ctx.shadowOffsetY = 3;
        this.ctx.drawImage(
          pieceImg,
          drawX - padScreen,
          drawY - padScreen,
          cellSize + padScreen * 2,
          cellSize + padScreen * 2
        );
        this.ctx.restore();
      } else {
        // Fallback procedural piece while texture is loading
        this.ctx.save();
        this.ctx.shadowColor = PastoralTheme.shadows.piece;
        this.ctx.shadowBlur = 6;
        this.ctx.shadowOffsetY = 3;
        this.ctx.fillStyle = def.color || PastoralTheme.colors.tomato;
        this.drawBezierPath(pathCommands);
        this.ctx.fill();
        this.ctx.restore();

        this.ctx.save();
        this.ctx.strokeStyle = PastoralTheme.colors.cardboard;
        this.ctx.lineWidth = 2.5;
        this.drawBezierPath(pathCommands);
        this.ctx.stroke();
        this.ctx.restore();
      }
    }

    // 5. Target Header Pill Badges (Rendered over plate edge so always readable: "温泉蛋牛丼 (2/4)")
    for (const target of session.grid.getAllTargets()) {
      const def = session.ingredients[target.ingredientId];
      if (!def) continue;

      const targetX = originX + target.anchor.col * cellSize;
      const targetY = originY - (target.anchor.row + def.height - 1) * cellSize;
      const targetW = def.width * cellSize;

      const labelText = `${def.name} (${target.placedSlotIds.length}/${def.slots.length})`;
      this.ctx.save();
      this.ctx.font = `bold ${Math.max(11, Math.round(cellSize * 0.23))}px "Hiragino Maru Gothic ProN", "Yu Gothic UI", sans-serif`;
      const textW = this.ctx.measureText(labelText).width;
      const badgeW = textW + 16;
      const badgeH = 18;
      const badgeX = targetX + (targetW - badgeW) / 2;
      const badgeY = targetY - badgeH / 2; // Sits neatly across top rim of dish

      this.ctx.fillStyle = PastoralTheme.colors.paper;
      this.ctx.shadowColor = 'rgba(70, 55, 40, 0.16)';
      this.ctx.shadowBlur = 5;
      this.ctx.shadowOffsetY = 1;
      this.roundRect(this.ctx, badgeX, badgeY, badgeW, badgeH, 9);
      this.ctx.fill();

      this.ctx.shadowColor = 'transparent';
      this.ctx.strokeStyle = PastoralTheme.colors.woodLight;
      this.ctx.lineWidth = 1.2;
      this.roundRect(this.ctx, badgeX, badgeY, badgeW, badgeH, 9);
      this.ctx.stroke();

      this.ctx.fillStyle = PastoralTheme.colors.inkDark;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(labelText, targetX + targetW / 2, badgeY + badgeH / 2);
      this.ctx.restore();
    }

    // 6. Dragging Piece (Topmost Layer: 1.08x scale, elevated shadow, finger lift offset)
    if (this.draggingPiece) {
      const def = session.ingredients[this.draggingPiece.ingredientId];
      if (def) {
        const slotDef = def.slots.find(s => s.slotId === this.draggingPiece!.slotId);
        const dragScale = 1.08;
        const dragSize = cellSize * dragScale;
        // Finger lift offset (-10px) so player's fingertip doesn't block the piece!
        const dragX = this.dragPointerPos.x - dragSize / 2;
        const dragY = this.dragPointerPos.y - dragSize / 2 - 10;

        const pieceBounds = {
          x: dragX + 3,
          y: dragY + 3,
          width: dragSize - 6,
          height: dragSize - 6
        };
        const edges = slotDef?.edges || { top: 'flat', right: 'flat', bottom: 'flat', left: 'flat' };
        const pathCommands = PuzzleGeometry.generateSlotPathCommands(pieceBounds, edges);

        const pieceImg = DishTextureManager.getPieceImage(this.draggingPiece.ingredientId, this.draggingPiece.slotId);
        if (pieceImg) {
          const padScreen = dragSize * 0.28;
          this.ctx.save();
          this.ctx.shadowColor = PastoralTheme.shadows.pieceLifted;
          this.ctx.shadowBlur = 18;
          this.ctx.shadowOffsetY = 10;
          this.ctx.drawImage(
            pieceImg,
            dragX - padScreen,
            dragY - padScreen,
            dragSize + padScreen * 2,
            dragSize + padScreen * 2
          );
          this.ctx.restore();
        } else {
          this.ctx.save();
          this.ctx.shadowColor = PastoralTheme.shadows.pieceLifted;
          this.ctx.shadowBlur = 18;
          this.ctx.shadowOffsetY = 10;
          this.ctx.fillStyle = def.color || PastoralTheme.colors.tomato;
          this.drawBezierPath(pathCommands);
          this.ctx.fill();
          this.ctx.restore();

          this.ctx.save();
          this.ctx.strokeStyle = PastoralTheme.colors.cardboard;
          this.ctx.lineWidth = 3.5;
          this.drawBezierPath(pathCommands);
          this.ctx.stroke();
          this.ctx.restore();
        }
      }
    }
  }
}

// Boot application
function boot(): void {
  try {
    new WebGameApp();
    console.log('[WebGameApp] Game initialized successfully.');
  } catch (err) {
    console.error('[WebGameApp] Boot failed:', err);
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
