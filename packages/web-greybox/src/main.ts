import {
  GameFlowManager,
  GameSession,
  SaveSystem,
  TutorialDirector,
  DEFAULT_DAYS,
  DEFAULT_INGREDIENTS,
  DEFAULT_RECIPES,
  PuzzleGeometry,
  BezierCommand,
  GridCoord,
  DishPuzzleManager,
  DishPuzzlePiece,
  PieceGroup,
  DishPuzzleInstance,
  GOLD_SAMPLE_DISH_MANIFEST,
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
  private currentTutorialCue: DragTutorialCue | null = null;

  // DishPuzzle Domain & Touch State
  private dishPuzzleManager!: DishPuzzleManager;
  private draggingGroup: {
    groupId: string;
    pieces: DishPuzzlePiece[];
    grabPiece: DishPuzzlePiece;
    grabOffset: { x: number; y: number };
  } | null = null;
  private dragPointerPos: { x: number; y: number } = { x: 0, y: 0 };
  private wobblePieces = new Map<string, { startTime: number; startX: number; startY: number }>();
  private completedDishAnims = new Map<string, { startTime: number; dishId: string; pieces: DishPuzzlePiece[]; groupId: string }>();

  constructor() {
    SaveSystem.setStorage(new WebStorageAdapter());
    DishTextureManager.init();
    (window as any).__app = this;
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
    this.draggingGroup = null;
    this.wobblePieces.clear();
    this.completedDishAnims.clear();
    this.resizeCanvas();

    const session = this.flow.startDay(dayNumber);
    WebTelemetrySink.log('day_start', dayNumber);

    // Initialize True DishPuzzle domain with Day 1 layout
    this.dishPuzzleManager = session.dishPuzzleManager;

    setTimeout(() => {
      this.flow.beginPlaying();
    }, 250);

    // Bind session audio & visual cues
    session.events.on('PIECE_PLACED', () => AudioDirector.playSnapPiece());
    session.events.on('ORDER_COMPLETED', () => {
      AudioDirector.playOrderComplete();
      AudioDirector.playRevenueGain();
      this.updateHUD();
    });
    session.events.on('REVENUE_CHANGED', () => {
      this.updateHUD();
    });
    session.events.on('BOARD_SETTLED', () => AudioDirector.playBoardSettling());
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

    // B. Hanging Thermal Receipt - True Master Dish Art Order from OrderSystem
    const currentOrder = session.orderSystem.currentOrder;
    const curDishId = currentOrder?.dishId || (currentOrder?.recipeId.startsWith('dish_') ? currentOrder.recipeId : `dish_${currentOrder?.recipeId}`) || 'dish_salad';
    const manifest = GOLD_SAMPLE_DISH_MANIFEST[curDishId];
    const orderIdNum = document.getElementById('order-id-num');
    const orderIdDish = document.getElementById('order-id-dish');
    const orderRevenue = document.getElementById('order-revenue');
    const checklist = document.getElementById('receipt-checklist');

    if (orderIdNum) {
      const rawId = currentOrder?.orderId || '#1001';
      orderIdNum.textContent = rawId.startsWith('#') ? rawId : `#${rawId.replace('order_', '')}`;
    }
    if (orderIdDish) orderIdDish.textContent = manifest?.name || currentOrder?.dishName || '田园沙拉';
    const dishThumb = document.getElementById('receipt-dish-thumb') as HTMLImageElement;
    if (dishThumb) {
      dishThumb.src = manifest?.masterAsset || '/assets/dishes/dish_salad_master.jpg';
    }
    if (orderRevenue) {
      orderRevenue.textContent = `¥${manifest?.orderRevenue || currentOrder?.baseRevenue || 70}`;
    }

    if (checklist) {
      // Day 1 HUD: No explicit (2/9) or (4/9) badges. Visual puzzle state conveys completion.
      checklist.innerHTML = '';
      if (manifest?.category) {
        const catBadge = document.createElement('div');
        catBadge.textContent = manifest.category;
        catBadge.style.padding = '3px 8px';
        catBadge.style.fontSize = '12px';
        catBadge.style.color = 'var(--ink-muted)';
        checklist.appendChild(catBadge);
      }
    }

    // C. Next Order Preview (Stage 2 Gated: Day 1 hidden)
    const nextHint = document.getElementById('next-order-hint');
    const nextLabel = document.getElementById('next-order-label');
    const preview = session.orderSystem.getNextOrderPreview();
    const isDay1 = session.dayConfig.dayNumber === 1;

    if (nextHint && nextLabel) {
      if (isDay1 || preview.mode === 'NONE' || !preview.dishName) {
        nextHint.style.display = 'none';
      } else {
        nextHint.style.display = 'inline-flex';
        const nextDishId = preview.dishId || 'dish_salad';
        const nextManifest = GOLD_SAMPLE_DISH_MANIFEST[nextDishId];
        nextLabel.textContent = `下道料理: ${nextManifest?.name || preview.dishName}`;
      }
    }

    // D. Serving Tray (2 slots bound to session.orderSystem.preparedDishBuffer)
    const slot0 = document.getElementById('tray-slot-0');
    const slot1 = document.getElementById('tray-slot-1');
    const buffer = session.orderSystem.preparedDishBuffer;
    if (slot0) {
      if (buffer[0]) {
        const dManifest = GOLD_SAMPLE_DISH_MANIFEST[buffer[0]];
        slot0.textContent = dManifest?.name || buffer[0];
        slot0.className = 'tray-dish-slot occupied';
      } else {
        slot0.textContent = '空';
        slot0.className = 'tray-dish-slot';
      }
    }
    if (slot1) {
      if (buffer[1]) {
        const dManifest = GOLD_SAMPLE_DISH_MANIFEST[buffer[1]];
        slot1.textContent = dManifest?.name || buffer[1];
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


  // --- Touch & Pointer Handling ---
  private onPointerDown(e: PointerEvent): void {
    if (this.flow.isInputLocked || !this.dishPuzzleManager) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const { cellSize } = this.getBoardOrigin();
    const allPieces = this.dishPuzzleManager.getAllPieces();

    // Check hit on any piece: exact bounding box first, then distance
    let hitPiece: DishPuzzlePiece | null = null;
    for (const piece of allPieces) {
      const sp = this.gridToScreen(piece.boardCoord);
      if (x >= sp.x && x <= sp.x + cellSize && y >= sp.y && y <= sp.y + cellSize) {
        hitPiece = piece;
        break;
      }
    }

    if (!hitPiece) {
      let bestDist = cellSize * 0.9;
      for (const piece of allPieces) {
        const sp = this.gridToScreen(piece.boardCoord);
        const center = { x: sp.x + cellSize / 2, y: sp.y + cellSize / 2 };
        const d = Math.hypot(center.x - x, center.y - y);
        if (d < bestDist) {
          bestDist = d;
          hitPiece = piece;
        }
      }
    }

    if (hitPiece) {
      const group = this.dishPuzzleManager.getGroupByPieceId(hitPiece.pieceInstanceId);
      if (group) {
        const memberPieces = group.pieceIds.map(id => this.dishPuzzleManager.getPiece(id)!).filter(Boolean);
        const refScreen = this.gridToScreen(hitPiece.boardCoord);
        this.draggingGroup = {
          groupId: group.groupId,
          pieces: memberPieces,
          grabPiece: hitPiece,
          grabOffset: {
            x: x - (refScreen.x + cellSize / 2),
            y: y - (refScreen.y + cellSize / 2)
          }
        };
        this.dragPointerPos = { x, y };
        AudioDirector.playPickPiece();
        try { this.canvas.setPointerCapture(e.pointerId); } catch {}
      }
    }
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.draggingGroup) return;
    const rect = this.canvas.getBoundingClientRect();
    this.dragPointerPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private onPointerUp(e: PointerEvent): void {
    if (!this.draggingGroup || !this.dishPuzzleManager) {
      this.draggingGroup = null;
      return;
    }

    const group = this.draggingGroup;
    // Calculate drop cell from grabPiece center position
    const grabCenterX = this.dragPointerPos.x - group.grabOffset.x;
    const grabCenterY = this.dragPointerPos.y - group.grabOffset.y;
    const targetCoord = this.screenToGrid(grabCenterX, grabCenterY);

    const moveResult = this.dishPuzzleManager.tryMoveGroup(
      group.groupId,
      targetCoord.col,
      targetCoord.row,
      group.grabPiece.pieceInstanceId
    );

    if (moveResult.success) {
      if (moveResult.merged) {
        AudioDirector.playSnapPiece();
      }
      if (moveResult.completedDish) {
        AudioDirector.playOrderComplete();
        AudioDirector.playRevenueGain();

        // 550ms completion celebration with all 9 pieces of completed dish
        const finalGroup = this.dishPuzzleManager.getGroup(group.groupId);
        const finalPieces = finalGroup
          ? finalGroup.pieceIds.map(id => this.dishPuzzleManager.getPiece(id)!).filter(Boolean)
          : group.pieces;

        this.completedDishAnims.set(moveResult.completedDish.instanceId, {
          startTime: performance.now(),
          dishId: moveResult.completedDish.dishId,
          pieces: finalPieces,
          groupId: group.groupId
        });
      }
    } else {
      AudioDirector.playWrongDrop();
      this.wobblePieces.set(group.grabPiece.pieceInstanceId, {
        startTime: performance.now(),
        startX: this.dragPointerPos.x,
        startY: this.dragPointerPos.y
      });
    }

    this.draggingGroup = null;
    try { this.canvas.releasePointerCapture(e.pointerId); } catch {}
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

    // 1. Pastoral Cutting Board / Counter Table Background
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

    // Subtle tactile dot guides at cell centers (NO rigid grid boxes)
    this.ctx.fillStyle = 'rgba(180, 160, 140, 0.22)';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const pt = this.gridToScreen({ col: c, row: r });
        this.ctx.beginPath();
        this.ctx.arc(pt.x + cellSize / 2, pt.y + cellSize / 2, 2, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }

    // Top subtle divider line
    const dangerZonePos = this.gridToScreen({ col: 0, row: 10 });
    this.ctx.setLineDash([8, 6]);
    this.ctx.strokeStyle = 'rgba(180, 160, 140, 0.35)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(boardX + 8, dangerZonePos.y + cellSize);
    this.ctx.lineTo(boardX + boardW - 8, dangerZonePos.y + cellSize);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
    this.ctx.restore();

    if (!this.dishPuzzleManager) return;

    // 2. Dish Completion Celebrations (550ms: glow, seam fading, smooth master art fade in)
    for (const [instanceId, anim] of this.completedDishAnims.entries()) {
      const elapsed = now - anim.startTime;
      if (elapsed > 550) {
        this.dishPuzzleManager.clearCompletedGroup(anim.groupId);
        this.completedDishAnims.delete(instanceId);
        this.updateHUD();
        continue;
      }

      const progress = elapsed / 550;
      const masterImg = DishTextureManager.getDishMasterImage(anim.dishId);
      if (masterImg && anim.pieces.length > 0) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of anim.pieces) {
          const sp = this.gridToScreen(p.boardCoord);
          minX = Math.min(minX, sp.x);
          minY = Math.min(minY, sp.y);
          maxX = Math.max(maxX, sp.x + cellSize);
          maxY = Math.max(maxY, sp.y + cellSize);
        }

        const dishW = maxX - minX;
        const dishH = maxY - minY;
        const bounce = 1.0 + 0.05 * Math.sin(progress * Math.PI);

        this.ctx.save();
        this.ctx.translate(minX + dishW / 2, minY + dishH / 2);
        this.ctx.scale(bounce, bounce);
        this.ctx.translate(-(minX + dishW / 2), -(minY + dishH / 2));

        // Golden celebratory plate glow
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        this.ctx.shadowColor = 'rgba(232, 184, 92, 0.6)';
        this.ctx.shadowBlur = 20;
        this.roundRect(this.ctx, minX + 2, minY + 2, dishW - 4, dishH - 4, PastoralTheme.radii.plate);
        this.ctx.fill();

        // Dissolve into full master dish illustration
        this.ctx.globalAlpha = Math.min(1, progress * 1.5);
        this.ctx.beginPath();
        this.roundRect(this.ctx, minX + 4, minY + 4, dishW - 8, dishH - 8, PastoralTheme.radii.plate);
        this.ctx.clip();
        this.ctx.drawImage(masterImg, minX + 4, minY + 4, dishW - 8, dishH - 8);
        this.ctx.restore();

        // Rising steam puffs
        this.drawSteamPuffs(minX + dishW / 2, minY, progress);
      }
    }

    // 3. Resting Piece Groups
    const groups = this.dishPuzzleManager.getAllGroups();
    const padScreen = cellSize * 0.28;

    for (const group of groups) {
      if (this.draggingGroup && this.draggingGroup.groupId === group.groupId) {
        continue; // Draw dragging group on topmost layer
      }

      for (const pieceId of group.pieceIds) {
        const piece = this.dishPuzzleManager.getPiece(pieceId);
        if (!piece) continue;

        let drawX = 0;
        let drawY = 0;

        // Smooth wobble animation if dropped wrong
        const wobble = this.wobblePieces.get(piece.pieceInstanceId);
        const targetScreen = this.gridToScreen(piece.boardCoord);
        if (wobble) {
          const elapsed = now - wobble.startTime;
          if (elapsed < 300) {
            const t = elapsed / 300;
            const wobbleOffset = Math.sin(t * Math.PI * 4) * (1 - t) * 10;
            drawX = wobble.startX + (targetScreen.x - wobble.startX) * t + wobbleOffset;
            drawY = wobble.startY + (targetScreen.y - wobble.startY) * t;
          } else {
            this.wobblePieces.delete(piece.pieceInstanceId);
            drawX = targetScreen.x;
            drawY = targetScreen.y;
          }
        } else {
          drawX = targetScreen.x;
          drawY = targetScreen.y;
        }

        const pieceImg = DishTextureManager.getPieceImage(piece.dishId, piece.slotId);
        if (pieceImg) {
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
        }
      }
    }

    // 4. Dragging Group (Topmost Layer: elevated shadow, rigid multi-piece translation)
    if (this.draggingGroup) {
      const group = this.draggingGroup;
      const refPiece = group.grabPiece;
      const dragScale = 1.06;
      const dragCellSize = cellSize * dragScale;
      const dragPad = dragCellSize * 0.28;

      for (const piece of group.pieces) {
        const relCol = piece.dishCol - refPiece.dishCol;
        const relRow = piece.dishRow - refPiece.dishRow;

        const pieceDrawX = (this.dragPointerPos.x - group.grabOffset.x) + relCol * dragCellSize - dragCellSize / 2;
        const pieceDrawY = (this.dragPointerPos.y - group.grabOffset.y) - relRow * dragCellSize - dragCellSize / 2 - 10;

        const pieceImg = DishTextureManager.getPieceImage(piece.dishId, piece.slotId);
        if (pieceImg) {
          this.ctx.save();
          this.ctx.shadowColor = PastoralTheme.shadows.pieceLifted;
          this.ctx.shadowBlur = 18;
          this.ctx.shadowOffsetY = 10;
          this.ctx.drawImage(
            pieceImg,
            pieceDrawX - dragPad,
            pieceDrawY - dragPad,
            dragCellSize + dragPad * 2,
            dragCellSize + dragPad * 2
          );
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
