import {
  GameFlowManager,
  GameSession,
  SaveSystem,
  TutorialDirector,
  AudioDirector,
  DEFAULT_DAYS,
  DEFAULT_INGREDIENTS,
  DEFAULT_RECIPES,
  PuzzleCutter,
  GridCoord,
  IngredientTarget,
  LoosePiece
} from '../../game-core/src/index.js';

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

  // SVG Image Cache for 60fps canvas blitting
  private svgImageCache = new Map<string, HTMLImageElement>();

  constructor() {
    this.initDOM();
    this.initFlow();
    this.startRenderLoop();
  }

  private initFlow(): void {
    this.flow = new GameFlowManager({
      onPhaseChanged: (phase, prev) => {
        this.handlePhaseTransition(phase, prev);
      },
      onTutorialCue: (cue) => {
        this.updateTutorialCue(cue);
      },
      onDayCompleted: (record) => {
        this.showDayCompleteModal(record);
      },
      onDayFailed: (reason) => {
        this.showDayFailedModal(reason);
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
      const cur = this.flow.campaignState.settings.sfxEnabled;
      SaveSystem.updateSettings({ sfxEnabled: !cur });
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

    // In-Game Controls
    document.getElementById('btn-audio')?.addEventListener('click', (e) => {
      const btn = e.target as HTMLButtonElement;
      const cur = this.flow.campaignState.settings.sfxEnabled;
      SaveSystem.updateSettings({ sfxEnabled: !cur, musicEnabled: !cur });
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
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.resetTransform();
    this.ctx.scale(dpr, dpr);
  }

  private handlePhaseTransition(phase: string, _prev: string): void {
    const menuView = document.getElementById('view-menu')!;
    const gameView = document.getElementById('view-game')!;

    if (phase === 'MAIN_MENU') {
      menuView.classList.remove('view-hidden');
      gameView.classList.add('view-hidden');
      this.renderMenuDayGrid();
    } else {
      menuView.classList.add('view-hidden');
      gameView.classList.remove('view-hidden');
      this.updateHUD();
    }
  }

  private renderMenuDayGrid(): void {
    const grid = document.getElementById('menu-day-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const highest = this.flow.campaignState.highestUnlockedDay;
    const continueLabel = document.getElementById('btn-continue-label');
    if (continueLabel) {
      continueLabel.textContent = `开始营业 (DAY ${highest})`;
    }

    for (let day = 1; day <= 12; day++) {
      const tile = document.createElement('div');
      tile.className = 'day-tile';
      const isCompleted = !!this.flow.campaignState.completedDays[day];
      const isLocked = day > highest;

      if (isCompleted) {
        tile.classList.add('completed');
        tile.innerHTML = `<div>D${day}</div><div style="font-size:10px;">✓</div>`;
      } else if (isLocked) {
        tile.classList.add('locked');
        tile.innerHTML = `<div>D${day}</div><div style="font-size:10px;">🔒</div>`;
      } else {
        tile.innerHTML = `<div>D${day}</div><div style="font-size:10px; color:#ea580c;">GO</div>`;
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

    const session = this.flow.startDay(dayNumber);

    // Bind session audio cues
    session.events.on('PIECE_PLACED', () => AudioDirector.playSnapPiece());
    session.events.on('INGREDIENT_COMPLETED', (d: any) => AudioDirector.playIngredientComplete(d.target?.ingredientId));
    session.events.on('CASCADE_TRIGGERED', (d: any) => AudioDirector.playCascade(d.chainLength));
    session.events.on('ORDER_FULFILLED', () => {
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

    // Header Day & Revenue
    const dayTitle = document.getElementById('day-title');
    if (dayTitle) dayTitle.textContent = `DAY ${String(session.dayConfig.dayNumber).padStart(2, '0')}`;

    const revDisplay = document.getElementById('revenue-display');
    if (revDisplay) revDisplay.textContent = `¥${session.revenue} / ¥${session.dayConfig.businessGoal}`;

    const fill = document.getElementById('goal-progress-fill');
    if (fill) {
      const pct = Math.min(100, (session.revenue / session.dayConfig.businessGoal) * 100);
      fill.style.width = `${pct}%`;
    }

    // Receipt Order Info
    const order = session.orderSystem.currentOrder;
    const orderIdDish = document.getElementById('order-id-dish');
    const orderRevenue = document.getElementById('order-revenue');
    const checklist = document.getElementById('receipt-checklist');

    if (order) {
      if (orderIdDish) orderIdDish.textContent = `${order.orderId} ${order.emoji} ${order.dishName}`;
      if (orderRevenue) orderRevenue.textContent = `¥${order.baseRevenue}`;

      if (checklist) {
        checklist.innerHTML = '';
        for (const item of order.items) {
          const ing = DEFAULT_INGREDIENTS[item.ingredientId];
          const div = document.createElement('div');
          const isSatisfied = item.reserved >= item.needed;
          div.className = `receipt-item ${isSatisfied ? 'satisfied' : 'unmet'}`;
          div.textContent = `${ing?.name || item.ingredientId}`;
          checklist.appendChild(div);
        }
      }
    }

    // Next Order Hint (Dish only, unlocked Day 7+)
    const nextHint = document.getElementById('next-order-hint');
    const nextLabel = document.getElementById('next-order-label');
    const nextPreview = session.orderSystem.nextOrderPreview;

    if (nextHint && nextLabel) {
      if (session.dayConfig.dayNumber >= 7 && nextPreview.dishId) {
        nextHint.style.display = 'flex';
        nextLabel.textContent = `${nextPreview.emoji} ${nextPreview.dishName}`;
      } else {
        nextHint.style.display = 'none';
      }
    }

    // Inventory Tray
    const tray = document.getElementById('inventory-tray');
    if (tray) {
      tray.innerHTML = '';
      const stock = session.inventory.getAllAvailable();
      for (const [id, count] of Object.entries(stock)) {
        if (count > 0) {
          const ing = DEFAULT_INGREDIENTS[id];
          const chip = document.createElement('div');
          chip.className = 'inv-chip';
          chip.textContent = `${ing?.emoji || '🍱'} ×${count}`;
          tray.appendChild(chip);
        }
      }
    }

    // Danger banner
    const dangerBanner = document.getElementById('danger-banner');
    if (dangerBanner) {
      dangerBanner.style.display = session.isBoardInDanger() ? 'block' : 'none';
    }

    // Cascade banner
    const cascadeBanner = document.getElementById('cascade-banner');
    if (cascadeBanner) {
      if (session.stats.cascadeEventsCount > 0) {
        cascadeBanner.style.display = 'block';
        cascadeBanner.textContent = `⚡ 连续出餐 ×${session.stats.maxCascadeChain}! 厨房运转中`;
      } else {
        cascadeBanner.style.display = 'none';
      }
    }
  }

  private updateTutorialCue(cue: any): void {
    const indicator = document.getElementById('tutorial-indicator');
    if (!indicator) return;

    if (!cue) {
      indicator.style.display = 'none';
      return;
    }

    // Position indicator over the candidate loose piece
    const screenPos = this.gridToScreen(cue.fromCoord);
    indicator.style.display = 'block';
    indicator.style.left = `${screenPos.x + 10}px`;
    indicator.style.top = `${screenPos.y - 30}px`;
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

  // --- Coordinate Transformation & Rendering ---
  private getCellSize(): number {
    const session = this.flow.session;
    if (!session) return 40;
    const wrapper = document.getElementById('board-wrapper')!;
    const rect = wrapper.getBoundingClientRect();
    const cellW = rect.width / session.grid.columns;
    const cellH = rect.height / session.grid.rows;
    return Math.min(cellW, cellH);
  }

  private gridToScreen(coord: GridCoord): { x: number; y: number } {
    const session = this.flow.session;
    if (!session) return { x: 0, y: 0 };
    const cellSize = this.getCellSize();
    const wrapper = document.getElementById('board-wrapper')!;
    const rect = wrapper.getBoundingClientRect();

    const originX = (rect.width - session.grid.columns * cellSize) / 2;
    const originY = rect.height - cellSize;

    const x = originX + coord.col * cellSize;
    const y = originY - coord.row * cellSize;
    return { x, y };
  }

  private screenToGrid(x: number, y: number): GridCoord {
    const session = this.flow.session;
    if (!session) return { col: 0, row: 0 };
    const cellSize = this.getCellSize();
    const wrapper = document.getElementById('board-wrapper')!;
    const rect = wrapper.getBoundingClientRect();

    const originX = (rect.width - session.grid.columns * cellSize) / 2;
    const originY = rect.height - cellSize;

    const col = Math.floor((x - originX) / cellSize);
    const row = Math.floor((originY - y + cellSize) / cellSize);
    return { col, row };
  }

  // --- SVG Image Cached Loading ---
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

    // Check hit on loose piece
    for (const piece of loose) {
      if (piece.coord.col === coord.col && piece.coord.row === coord.row) {
        this.draggingPiece = piece;
        this.dragPointerPos = { x, y };
        this.dragOriginCoord = { ...piece.coord };
        AudioDirector.playPickPiece();
        this.canvas.setPointerCapture(e.pointerId);
        break;
      }
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

        // Tolerant snap radius of ~1.2 cells
        if (Math.abs(coord.col - slotAbsCol) <= 1 && Math.abs(coord.row - slotAbsRow) <= 1) {
          const res = this.flow.placePiece(piece.instanceId, target.instanceId, piece.slotId);
          if (res.success) {
            placed = true;
          }
        }
      }
    }

    if (!placed) {
      // Trigger wobble feedback & smooth return
      AudioDirector.playWrongDrop();
      const originScreen = this.gridToScreen(this.dragOriginCoord!);
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

  private render(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.ctx.clearRect(0, 0, rect.width, rect.height);

    const session = this.flow.session;
    if (!session || this.flow.phase === 'MAIN_MENU') return;

    const cellSize = this.getCellSize();

    // 1. Draw Incomplete & Placed Targets (using PuzzleCutter authentic presentation)
    for (const target of session.grid.getAllTargets()) {
      const def = session.ingredients[target.ingredientId];
      if (!def) continue;

      const screenPos = this.gridToScreen({
        col: target.anchor.col,
        row: target.anchor.row + def.height - 1
      });

      const targetSvg = PuzzleCutter.generateTargetSvg(
        def,
        target.missingSlotIds,
        target.placedSlotIds,
        def.width * cellSize
      );
      const cacheKey = `target_${target.ingredientId}_${target.placedSlotIds.join('_')}_${def.width * cellSize}`;
      const img = this.getOrCreateSvgImage(cacheKey, targetSvg);

      if (img.complete && img.naturalWidth > 0) {
        this.ctx.drawImage(
          img,
          screenPos.x,
          screenPos.y,
          def.width * cellSize,
          def.height * cellSize
        );
      }
    }

    // 2. Draw Loose Pieces (using authentic jigsaw tab/blank piece assets)
    const now = performance.now();
    for (const piece of session.grid.getAllLoosePieces()) {
      if (this.draggingPiece && this.draggingPiece.instanceId === piece.instanceId) {
        continue; // Render dragging piece on top layer
      }

      const def = session.ingredients[piece.ingredientId];
      if (!def) continue;

      let drawX = 0;
      let drawY = 0;

      // Handle wrong drop wobble
      const wobble = this.wobblePieces.get(piece.instanceId);
      if (wobble) {
        const elapsed = now - wobble.startTime;
        const targetScreen = this.gridToScreen(piece.coord);
        if (elapsed < 300) {
          const t = elapsed / 300;
          const wobbleOffset = Math.sin(t * Math.PI * 4) * (1 - t) * 12;
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

      const pieceAsset = PuzzleCutter.generateLoosePieceAsset(def, piece.slotId, cellSize);
      const cacheKey = `piece_${def.id}_${piece.slotId}_${cellSize}`;
      const img = this.getOrCreateSvgImage(cacheKey, pieceAsset.svgContent);

      if (img.complete && img.naturalWidth > 0) {
        this.ctx.drawImage(img, drawX, drawY, cellSize, cellSize);
      }
    }

    // 3. Draw Dragging Piece (with 1.10x scale, raised shadow, centered under finger)
    if (this.draggingPiece) {
      const def = session.ingredients[this.draggingPiece.ingredientId];
      if (def) {
        const pieceAsset = PuzzleCutter.generateLoosePieceAsset(def, this.draggingPiece.slotId, cellSize * 1.1);
        const cacheKey = `piece_drag_${def.id}_${this.draggingPiece.slotId}_${cellSize * 1.1}`;
        const img = this.getOrCreateSvgImage(cacheKey, pieceAsset.svgContent);

        if (img.complete && img.naturalWidth > 0) {
          const size = cellSize * 1.1;
          this.ctx.save();
          this.ctx.shadowColor = 'rgba(0,0,0,0.35)';
          this.ctx.shadowBlur = 16;
          this.ctx.shadowOffsetY = 8;
          this.ctx.drawImage(
            img,
            this.dragPointerPos.x - size / 2,
            this.dragPointerPos.y - size / 2,
            size,
            size
          );
          this.ctx.restore();
        }
      }
    }
  }
}

// Boot application
window.addEventListener('DOMContentLoaded', () => {
  new WebGameApp();
});
