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
import { GameFeelProfile } from './theme/GameFeelProfile.js';
import { PresentationStateMachine } from './pipeline/PresentationStateMachine.js';

class WebGameApp {
  private flow!: GameFlowManager;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private currentTutorialCue: DragTutorialCue | null = null;

  // Presentation State Machine & Physical Animation
  private stateMachine = new PresentationStateMachine();
  private recentSnapFlares = new Map<string, { startTime: number; minX: number; minY: number; maxX: number; maxY: number }>();

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

    // Prep Tray Slots: tap to serve buffered dish to matching order
    const slot0 = document.getElementById('tray-slot-0');
    const slot1 = document.getElementById('tray-slot-1');
    slot0?.addEventListener('click', () => this.handleTrayServe(0));
    slot1?.addEventListener('click', () => this.handleTrayServe(1));

    // Pointer Interaction on Board Canvas
    this.canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    this.canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
    this.canvas.addEventListener('pointerup', (e) => this.onPointerUp(e));
    this.canvas.addEventListener('pointercancel', (e) => this.onPointerUp(e));
  }

  private handleTrayServe(slotIdx: number): void {
    const session = this.flow?.session;
    if (!session) return;
    const buffer = session.orderSystem.preparedDishBuffer;
    const dishId = buffer[slotIdx];
    if (!dishId) return;

    const currentOrder = session.orderSystem.currentOrder;
    const neededDishId = currentOrder?.dishId || (currentOrder?.recipeId.startsWith('dish_') ? currentOrder.recipeId : `dish_${currentOrder?.recipeId}`);
    if (dishId === neededDishId) {
      AudioDirector.playPrepDishServe();
      session.orderSystem.handleCompletedDish(dishId);
      this.triggerRevenueFlyer('+¥70');
      this.updateHUD();
    }
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
    this.recentSnapFlares.clear();
    this.stateMachine.reset();
    this.resizeCanvas();

    const session = this.flow.startDay(dayNumber);
    WebTelemetrySink.log('day_start', dayNumber);

    // Initialize True DishPuzzle domain with Day 1 layout
    this.dishPuzzleManager = session.dishPuzzleManager;

    setTimeout(() => {
      this.flow.beginPlaying();
    }, 250);

    // Bind session audio & visual cues
    session.events.on('PIECE_PLACED', () => AudioDirector.playPieceSnap());
    session.events.on('ORDER_COMPLETED', () => {
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
        slot0.innerHTML = '<span class="tray-slot-empty">🍽</span>';
        slot0.className = 'tray-dish-slot';
      }
    }
    if (slot1) {
      if (buffer[1]) {
        const dManifest = GOLD_SAMPLE_DISH_MANIFEST[buffer[1]];
        slot1.textContent = dManifest?.name || buffer[1];
        slot1.className = 'tray-dish-slot occupied';
      } else {
        slot1.innerHTML = '<span class="tray-slot-empty">🍽</span>';
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

    const screenPos = this.gridToScreen(cue.fromCoord);
    const cellSize = this.getCellSize();
    indicator.style.display = 'block';
    indicator.style.left = `${screenPos.x + cellSize / 2 - 16}px`;
    indicator.style.top = `${screenPos.y + cellSize - 6}px`;
  }

  private showDayCompleteModal(record: any): void {
    const modal = document.getElementById('modal-victory') as HTMLElement;
    const dayTitle = document.getElementById('victory-day-title');
    const totalRev = document.getElementById('victory-total-revenue');
    const totalOrders = document.getElementById('victory-total-orders');
    const completion = document.getElementById('victory-dish-completion');
    const summary = document.getElementById('victory-summary');

    if (dayTitle) dayTitle.textContent = `DAY ${String(record.dayNumber).padStart(2, '0')}`;
    if (totalRev) totalRev.textContent = `¥${record.revenueAchieved}`;
    if (totalOrders) totalOrders.textContent = `${record.ordersCompleted} 单`;
    if (completion) completion.textContent = '100% 达成';
    if (summary) {
      summary.innerHTML = `DAY ${String(record.dayNumber).padStart(2, '0')} 营业结束<br>营业额: ¥${record.revenueAchieved} / ¥${record.businessGoal} | 料理准时送出！`;
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
    if (this.flow.isInputLocked || this.stateMachine.isInputLocked() || !this.dishPuzzleManager) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const { cellSize } = this.getBoardOrigin();
    const allPieces = this.dishPuzzleManager.getAllPieces();

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
        this.stateMachine.transitionTo('DRAGGING');
        AudioDirector.playPiecePick();
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
      if (this.stateMachine.getState() === 'DRAGGING') {
        this.stateMachine.transitionTo('IDLE');
      }
      return;
    }

    const group = this.draggingGroup;
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
      if (moveResult.completedDish) {
        // Climax Final Ceremony & Serve Transition
        AudioDirector.playFinalSnap();
        this.stateMachine.transitionTo('FINAL_CEREMONY');

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
      } else if (moveResult.merged) {
        // Normal piece snap with radiant seam flare
        AudioDirector.playPieceSnap();
        this.stateMachine.transitionTo('IDLE');

        const finalGroup = this.dishPuzzleManager.getGroup(group.groupId);
        const pieces = finalGroup ? finalGroup.pieceIds.map(id => this.dishPuzzleManager.getPiece(id)!).filter(Boolean) : group.pieces;
        const { cellSize } = this.getBoardOrigin();
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of pieces) {
          const sp = this.gridToScreen(p.boardCoord);
          minX = Math.min(minX, sp.x);
          minY = Math.min(minY, sp.y);
          maxX = Math.max(maxX, sp.x + cellSize);
          maxY = Math.max(maxY, sp.y + cellSize);
        }
        this.recentSnapFlares.set(group.groupId, {
          startTime: performance.now(),
          minX, minY, maxX, maxY
        });
      } else {
        AudioDirector.playPieceDrop();
        this.stateMachine.transitionTo('IDLE');
      }
    } else {
      AudioDirector.playWrongDrop();
      this.stateMachine.transitionTo('IDLE');
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

  // --- Serve Arrival & Settlement Flow ---
  private triggerDishServeArrival(dishId: string, groupId: string): void {
    AudioDirector.playDishServe();

    // 1. Camera micro-pulse
    const container = document.getElementById('game-container');
    if (container) {
      container.classList.remove('camera-pulse');
      void container.offsetWidth;
      container.classList.add('camera-pulse');
      setTimeout(() => container.classList.remove('camera-pulse'), 300);
    }

    // 2. Receipt thumbnail pop
    const thumb = document.getElementById('receipt-dish-thumb');
    if (thumb) {
      thumb.style.transform = `scale(${GameFeelProfile.serve.receiptThumbnailPopScale})`;
      setTimeout(() => { thumb.style.transform = 'scale(1)'; }, 180);
    }

    // 3. Receipt cinnabar seal stamp
    const stamp = document.getElementById('receipt-seal-stamp');
    if (stamp) {
      stamp.classList.add('stamped');
      AudioDirector.playReceiptStamp();
    }

    // 4. Price pop
    const priceTag = document.getElementById('order-revenue');
    if (priceTag) {
      priceTag.style.transform = 'scale(1.18) rotate(-2deg)';
      setTimeout(() => { priceTag.style.transform = 'scale(1) rotate(-2deg)'; }, 180);
    }

    // 5. Clear completed group from board (triggers DISH_SERVED -> order fulfillment)
    this.dishPuzzleManager.clearCompletedGroup(groupId);

    // 6. Flying revenue particle
    const manifest = GOLD_SAMPLE_DISH_MANIFEST[dishId];
    const revenueAmount = manifest?.orderRevenue || 70;
    this.triggerRevenueFlyer(`+¥${revenueAmount}`);

    // 7. Tear paper and roll next receipt
    setTimeout(() => {
      AudioDirector.playReceiptTear();
      const paper = document.getElementById('receipt-paper');
      if (paper) {
        paper.style.transition = 'transform 0.16s ease-out, opacity 0.16s ease-out';
        paper.style.transform = 'translateY(-12px)';
        paper.style.opacity = '0.7';
        setTimeout(() => {
          if (stamp) stamp.classList.remove('stamped');
          paper.style.transform = 'translateY(0)';
          paper.style.opacity = '1';
          AudioDirector.playReceiptPrint();
        }, 160);
      }
      this.stateMachine.transitionTo('IDLE');
    }, 220);

    this.updateHUD();
  }

  private triggerRevenueFlyer(amountText: string): void {
    const particle = document.getElementById('revenue-flying-particle');
    const receiptPrice = document.getElementById('order-revenue');
    const revenueCounter = document.getElementById('revenue-display');
    if (!particle || !receiptPrice || !revenueCounter) return;

    const startRect = receiptPrice.getBoundingClientRect();
    const endRect = revenueCounter.getBoundingClientRect();
    const containerRect = document.getElementById('game-container')?.getBoundingClientRect() || { left: 0, top: 0 };

    const startX = startRect.left - containerRect.left;
    const startY = startRect.top - containerRect.top;
    const endX = endRect.left - containerRect.left + endRect.width / 2;
    const endY = endRect.top - containerRect.top + endRect.height / 2;

    particle.textContent = amountText;
    particle.style.transition = 'none';
    particle.style.left = `${startX}px`;
    particle.style.top = `${startY}px`;
    particle.style.opacity = '1';
    particle.style.transform = 'scale(1.2)';

    void particle.offsetWidth;

    particle.style.transition = 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.4s ease, left 0.4s ease, top 0.4s ease';
    particle.style.left = `${endX}px`;
    particle.style.top = `${endY}px`;
    particle.style.transform = 'scale(0.8)';
    particle.style.opacity = '0';

    setTimeout(() => {
      AudioDirector.playRevenueGain();
      if (revenueCounter) {
        revenueCounter.style.transform = 'scale(1.15)';
        setTimeout(() => { revenueCounter.style.transform = 'scale(1)'; }, 150);
      }
    }, 380);
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
    const alpha = Math.max(0, (1 - progress) * 0.85);
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
    this.ctx.fillStyle = PastoralTheme.colors.bgLinen;
    this.roundRect(this.ctx, boardX, boardY, boardW, boardH, PastoralTheme.radii.board);
    this.ctx.fill();

    this.ctx.strokeStyle = PastoralTheme.colors.woodLight;
    this.ctx.lineWidth = 4;
    this.roundRect(this.ctx, boardX, boardY, boardW, boardH, PastoralTheme.radii.board);
    this.ctx.stroke();

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

    // Top danger zone divider
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

    // 2. Dish Completion Ceremonies & Serve Flight (680ms total)
    for (const [instanceId, anim] of this.completedDishAnims.entries()) {
      const elapsed = now - anim.startTime;
      if (elapsed >= GameFeelProfile.serve.totalAnimDurationMs) {
        this.triggerDishServeArrival(anim.dishId, anim.groupId);
        this.completedDishAnims.delete(instanceId);
        continue;
      }

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
        const centerX = minX + dishW / 2;
        const centerY = minY + dishH / 2;

        // Phase 3 & 4: Master Dish Reveal, Shimmer, and Title Pill (260 ~ 480ms)
        if (elapsed >= 260 && elapsed < 480) {
          const tReveal = (elapsed - 260) / 220;

          // Subtle board dim
          this.ctx.save();
          this.ctx.fillStyle = `rgba(31, 26, 23, ${GameFeelProfile.finalCeremony.boardDimAlpha * Math.min(1, tReveal * 1.5)})`;
          this.roundRect(this.ctx, boardX, boardY, boardW, boardH, PastoralTheme.radii.board);
          this.ctx.fill();
          this.ctx.restore();

          // Golden plate glow
          this.ctx.save();
          this.ctx.fillStyle = '#FFFFFF';
          this.ctx.shadowColor = GameFeelProfile.finalCeremony.plateGlowColor;
          this.ctx.shadowBlur = GameFeelProfile.finalCeremony.plateGlowBlur;
          this.roundRect(this.ctx, minX + 2, minY + 2, dishW - 4, dishH - 4, PastoralTheme.radii.plate);
          this.ctx.fill();

          // Master artwork
          this.ctx.globalAlpha = Math.min(1, tReveal * 1.6);
          this.ctx.beginPath();
          this.roundRect(this.ctx, minX + 4, minY + 4, dishW - 8, dishH - 8, PastoralTheme.radii.plate);
          this.ctx.clip();
          this.ctx.drawImage(masterImg, minX + 4, minY + 4, dishW - 8, dishH - 8);

          // Diagonal shimmer sheen sweep
          const shimmerT = (elapsed - 260) / 220;
          const shimmerX = minX - dishW + (dishW * 3) * shimmerT;
          const shimmerGrad = this.ctx.createLinearGradient(shimmerX, minY, shimmerX + 50, minY + dishH);
          shimmerGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
          shimmerGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.45)');
          shimmerGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
          this.ctx.fillStyle = shimmerGrad;
          this.ctx.fillRect(minX, minY, dishW, dishH);
          this.ctx.restore();

          // Rising steam puffs
          this.drawSteamPuffs(centerX, minY, tReveal);
        }

        // Phase 4: Floating Title Pill (320 ~ 580ms)
        if (elapsed >= 320 && elapsed < 580) {
          const tTitle = (elapsed - 320) / 260;
          const titleAlpha = Math.sin(tTitle * Math.PI);
          const titleY = minY - 14 + GameFeelProfile.finalCeremony.titleLiftPx * tTitle;
          const manifest = GOLD_SAMPLE_DISH_MANIFEST[anim.dishId];
          const dishTitleText = `${manifest?.name || '料理'} 完成！`;

          this.ctx.save();
          this.ctx.globalAlpha = titleAlpha;
          this.ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          const textMetrics = this.ctx.measureText(dishTitleText);
          const pillW = textMetrics.width + 24;
          const pillH = 28;
          const pillX = centerX - pillW / 2;

          this.ctx.fillStyle = 'rgba(255, 253, 247, 0.95)';
          this.ctx.shadowColor = 'rgba(65, 45, 30, 0.25)';
          this.ctx.shadowBlur = 8;
          this.ctx.shadowOffsetY = 3;
          this.roundRect(this.ctx, pillX, titleY - pillH / 2, pillW, pillH, 14);
          this.ctx.fill();

          this.ctx.strokeStyle = PastoralTheme.colors.woodLight;
          this.ctx.lineWidth = 1.5;
          this.roundRect(this.ctx, pillX, titleY - pillH / 2, pillW, pillH, 14);
          this.ctx.stroke();

          this.ctx.fillStyle = PastoralTheme.colors.inkMain;
          this.ctx.textAlign = 'center';
          this.ctx.textBaseline = 'middle';
          this.ctx.fillText(dishTitleText, centerX, titleY);
          this.ctx.restore();
        }

        // Phase 5: Serve Bezier Flight (480 ~ 680ms)
        if (elapsed >= 480) {
          const tFlight = Math.min(1, (elapsed - 480) / 200);
          const thumb = document.getElementById('receipt-dish-thumb');
          const canvasRect = this.canvas.getBoundingClientRect();
          const thumbRect = thumb ? thumb.getBoundingClientRect() : { left: canvasRect.left + 50, top: canvasRect.top - 50, width: 38, height: 38 };
          const targetX = thumbRect.left - canvasRect.left + thumbRect.width / 2;
          const targetY = thumbRect.top - canvasRect.top + thumbRect.height / 2;

          const cpX = (centerX + targetX) / 2 - 25;
          const cpY = Math.min(centerY, targetY) - 45;

          const curX = (1 - tFlight) * (1 - tFlight) * centerX + 2 * (1 - tFlight) * tFlight * cpX + tFlight * tFlight * targetX;
          const curY = (1 - tFlight) * (1 - tFlight) * (centerY - 14) + 2 * (1 - tFlight) * tFlight * cpY + tFlight * tFlight * targetY;

          const curScale = 1.0 + (GameFeelProfile.serve.flightScaleEnd - 1.0) * tFlight;
          const curW = dishW * curScale;
          const curH = dishH * curScale;
          const curTilt = Math.sin(tFlight * Math.PI) * (GameFeelProfile.serve.flightMaxTiltDeg * Math.PI / 180);

          this.ctx.save();
          this.ctx.translate(curX, curY);
          this.ctx.rotate(curTilt);
          this.ctx.translate(-curX, -curY);

          this.ctx.save();
          this.ctx.shadowColor = 'rgba(55, 38, 22, 0.3)';
          this.ctx.shadowBlur = 16 * (1 - tFlight * 0.5);
          this.ctx.shadowOffsetY = 8 * (1 - tFlight * 0.5);
          this.ctx.fillStyle = '#FFFFFF';
          this.roundRect(this.ctx, curX - curW / 2, curY - curH / 2, curW, curH, PastoralTheme.radii.plate * curScale);
          this.ctx.fill();
          this.ctx.restore();

          this.ctx.save();
          this.roundRect(this.ctx, curX - curW / 2 + 2, curY - curH / 2 + 2, curW - 4, curH - 4, PastoralTheme.radii.plate * curScale);
          this.ctx.clip();
          this.ctx.drawImage(masterImg, curX - curW / 2 + 2, curY - curH / 2 + 2, curW - 4, curH - 4);
          this.ctx.restore();

          this.ctx.restore();
        }
      }
    }

    // 3. Normal Snap Seam Flares (110ms)
    for (const [groupId, flare] of this.recentSnapFlares.entries()) {
      const elapsed = now - flare.startTime;
      if (elapsed > GameFeelProfile.snap.seamGlowDurationMs) {
        this.recentSnapFlares.delete(groupId);
        continue;
      }
      const alpha = 1.0 - elapsed / GameFeelProfile.snap.seamGlowDurationMs;
      this.ctx.save();
      this.ctx.strokeStyle = `rgba(255, 245, 192, ${alpha * 0.95})`;
      this.ctx.lineWidth = GameFeelProfile.snap.seamGlowWidth;
      this.ctx.shadowColor = 'rgba(255, 245, 192, 0.8)';
      this.ctx.shadowBlur = 10;
      this.roundRect(this.ctx, flare.minX - 2, flare.minY - 2, (flare.maxX - flare.minX) + 4, (flare.maxY - flare.minY) + 4, 8);
      this.ctx.stroke();
      this.ctx.restore();
    }

    // 4. Resting Piece Groups (3-Layer Physical Cardboard: Contact Shadow -> Cardboard Bevel -> Top Artwork)
    const groups = this.dishPuzzleManager.getAllGroups();
    const padScreen = cellSize * 0.28;

    for (const group of groups) {
      if (this.draggingGroup && this.draggingGroup.groupId === group.groupId) {
        continue; // Handled in dragging layer
      }

      for (const pieceId of group.pieceIds) {
        const piece = this.dishPuzzleManager.getPiece(pieceId);
        if (!piece) continue;

        let drawX = 0;
        let drawY = 0;

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

        const bounds = { x: drawX, y: drawY, width: cellSize, height: cellSize };
        const pathCmds = PuzzleGeometry.generateSlotPathCommands(bounds, piece.edges);

        // Layer 1: Physical Contact Shadow
        this.ctx.save();
        this.ctx.shadowColor = GameFeelProfile.piece.restingShadowColor;
        this.ctx.shadowOffsetY = GameFeelProfile.piece.restingShadowOffsetY;
        this.ctx.shadowBlur = GameFeelProfile.piece.restingShadowBlur;
        this.ctx.fillStyle = 'rgba(55, 38, 22, 0.08)';
        this.drawBezierPath(pathCmds);
        this.ctx.fill();
        this.ctx.restore();

        // Layer 2: Warm Cardboard Side Edge / Bevel
        this.ctx.save();
        const bevelGrad = this.ctx.createLinearGradient(drawX, drawY, drawX + cellSize, drawY + cellSize);
        bevelGrad.addColorStop(0, GameFeelProfile.piece.edgeColorTop);
        bevelGrad.addColorStop(0.5, GameFeelProfile.piece.edgeColorSide);
        bevelGrad.addColorStop(1, GameFeelProfile.piece.edgeColorBottom);
        this.ctx.strokeStyle = bevelGrad;
        this.ctx.lineWidth = GameFeelProfile.piece.strokeWidth;
        this.ctx.lineJoin = 'round';
        this.drawBezierPath(pathCmds);
        this.ctx.stroke();
        this.ctx.restore();

        // Layer 3: Top Artwork with subtle bevel inner highlight
        const pieceImg = DishTextureManager.getPieceImage(piece.dishId, piece.slotId);
        if (pieceImg) {
          this.ctx.save();
          this.drawBezierPath(pathCmds);
          this.ctx.clip();
          this.ctx.drawImage(
            pieceImg,
            drawX - padScreen,
            drawY - padScreen,
            cellSize + padScreen * 2,
            cellSize + padScreen * 2
          );
          const rimGrad = this.ctx.createLinearGradient(drawX, drawY, drawX + cellSize * 0.4, drawY + cellSize * 0.4);
          rimGrad.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
          rimGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
          this.ctx.fillStyle = rimGrad;
          this.ctx.fillRect(drawX, drawY, cellSize * 0.4, cellSize * 0.4);
          this.ctx.restore();
        }
      }
    }

    // 5. Dragging Group (Topmost Layer: elevated shadow, visual lift -8px, subtle 1.2° tilt)
    if (this.draggingGroup) {
      const group = this.draggingGroup;
      const refPiece = group.grabPiece;
      const isSingle = group.pieces.length === 1;
      const dragScale = isSingle ? GameFeelProfile.piece.singleLiftScale : GameFeelProfile.piece.groupLiftScale;
      const dragCellSize = cellSize * dragScale;
      const dragPad = dragCellSize * 0.28;
      const visualLiftY = GameFeelProfile.piece.visualLiftY;

      const refCenterX = this.dragPointerPos.x - group.grabOffset.x;
      const refCenterY = this.dragPointerPos.y - group.grabOffset.y + visualLiftY;

      this.ctx.save();
      this.ctx.translate(refCenterX, refCenterY);
      this.ctx.rotate((GameFeelProfile.piece.fingerTiltDeg * Math.PI) / 180);
      this.ctx.translate(-refCenterX, -refCenterY);

      for (const piece of group.pieces) {
        const relCol = piece.dishCol - refPiece.dishCol;
        const relRow = piece.dishRow - refPiece.dishRow;

        const pieceDrawX = refCenterX + relCol * dragCellSize - dragCellSize / 2;
        const pieceDrawY = refCenterY - relRow * dragCellSize - dragCellSize / 2;

        const bounds = { x: pieceDrawX, y: pieceDrawY, width: dragCellSize, height: dragCellSize };
        const pathCmds = PuzzleGeometry.generateSlotPathCommands(bounds, piece.edges);

        // Layer 1: Lifted Contact Shadow
        this.ctx.save();
        this.ctx.shadowColor = GameFeelProfile.piece.liftedShadowColor;
        this.ctx.shadowOffsetY = GameFeelProfile.piece.liftedShadowOffsetY;
        this.ctx.shadowBlur = GameFeelProfile.piece.liftedShadowBlur;
        this.ctx.fillStyle = 'rgba(55, 38, 22, 0.18)';
        this.drawBezierPath(pathCmds);
        this.ctx.fill();
        this.ctx.restore();

        // Layer 2: Cardboard Bevel
        this.ctx.save();
        const bevelGrad = this.ctx.createLinearGradient(pieceDrawX, pieceDrawY, pieceDrawX + dragCellSize, pieceDrawY + dragCellSize);
        bevelGrad.addColorStop(0, GameFeelProfile.piece.edgeColorTop);
        bevelGrad.addColorStop(0.5, GameFeelProfile.piece.edgeColorSide);
        bevelGrad.addColorStop(1, GameFeelProfile.piece.edgeColorBottom);
        this.ctx.strokeStyle = bevelGrad;
        this.ctx.lineWidth = GameFeelProfile.piece.strokeWidth * dragScale;
        this.ctx.lineJoin = 'round';
        this.drawBezierPath(pathCmds);
        this.ctx.stroke();
        this.ctx.restore();

        // Layer 3: Top Artwork
        const pieceImg = DishTextureManager.getPieceImage(piece.dishId, piece.slotId);
        if (pieceImg) {
          this.ctx.save();
          this.drawBezierPath(pathCmds);
          this.ctx.clip();
          this.ctx.drawImage(
            pieceImg,
            pieceDrawX - dragPad,
            pieceDrawY - dragPad,
            dragCellSize + dragPad * 2,
            dragCellSize + dragPad * 2
          );
          const rimGrad = this.ctx.createLinearGradient(pieceDrawX, pieceDrawY, pieceDrawX + dragCellSize * 0.4, pieceDrawY + dragCellSize * 0.4);
          rimGrad.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
          rimGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
          this.ctx.fillStyle = rimGrad;
          this.ctx.fillRect(pieceDrawX, pieceDrawY, dragCellSize * 0.4, dragCellSize * 0.4);
          this.ctx.restore();
        }
      }
      this.ctx.restore();
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
