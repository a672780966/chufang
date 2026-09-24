import { _decorator, Component, Node, Vec3, tween, UITransform, Graphics, Label, Color, UIOpacity } from 'cc';
import {
  GameSession,
  GridCoord,
  IngredientTarget,
  LoosePiece,
  CoreEventMap,
  DEFAULT_INGREDIENTS,
  IngredientDefinition,
  PuzzleGeometry,
  JigsawEdgeType,
  DragTutorialCue
} from '../../game-core/index';

const { ccclass, property } = _decorator;

@ccclass('BoardView')
export class BoardView extends Component {
  @property(Node)
  targetsContainer: Node | null = null;

  @property(Node)
  piecesContainer: Node | null = null;

  @property(Node)
  tutorialContainer: Node | null = null;

  private _session!: GameSession;
  private _cellWidth: number = 72;
  private _cellHeight: number = 72;
  private _activeTutorialCue: DragTutorialCue | null = null;

  init(session: GameSession) {
    this._session = session;
    this.calculateCellSize();
    this.renderInitialBoard();
  }

  private calculateCellSize() {
    const uiTransform = this.node.getComponent(UITransform);
    if (uiTransform) {
      this._cellWidth = uiTransform.width / this._session.grid.columns;
      this._cellHeight = uiTransform.height / this._session.grid.rows;
    }
  }

  gridToLocalPos(coord: GridCoord): Vec3 {
    const uiTransform = this.node.getComponent(UITransform);
    const originX = uiTransform ? -uiTransform.width / 2 : 0;
    const originY = uiTransform ? -uiTransform.height / 2 : 0;

    const x = originX + (coord.col + 0.5) * this._cellWidth;
    const y = originY + (coord.row + 0.5) * this._cellHeight;
    return new Vec3(x, y, 0);
  }

  renderInitialBoard() {
    this.targetsContainer?.removeAllChildren();
    this.piecesContainer?.removeAllChildren();

    for (const target of this._session.grid.getAllTargets()) {
      this.createTargetNode(target);
    }

    for (const piece of this._session.grid.getAllLoosePieces()) {
      this.createPieceNode(piece);
    }
  }

  /**
   * Translates PuzzleGeometry Bezier commands into Cocos Creator Graphics path commands.
   * Inverts Y to match Cocos 2D Cartesian (+Y upward) coordinate system.
   */
  private drawBezierPath(g: Graphics, commands: ReturnType<typeof PuzzleGeometry.generateSlotPathCommands>): void {
    for (const cmd of commands) {
      if (cmd.type === 'M') {
        g.moveTo(cmd.x, -cmd.y);
      } else if (cmd.type === 'L') {
        g.lineTo(cmd.x, -cmd.y);
      } else if (cmd.type === 'C') {
        g.bezierCurveTo(cmd.cp1x!, -cmd.cp1y!, cmd.cp2x!, -cmd.cp2y!, cmd.x, -cmd.y);
      } else if (cmd.type === 'Z') {
        g.close();
      }
    }
  }

  createTargetNode(target: IngredientTarget): Node {
    const def = DEFAULT_INGREDIENTS[target.ingredientId];
    const node = new Node(`Target_${target.instanceId}`);
    node.setPosition(this.gridToLocalPos(target.anchor));

    const uiTransform = node.addComponent(UITransform);
    uiTransform.setContentSize(
      (def ? def.width : 2) * this._cellWidth,
      (def ? def.height : 2) * this._cellHeight
    );

    this.drawTargetVisual(node, target, def);
    this.targetsContainer?.addChild(node);
    return node;
  }

  drawTargetVisual(targetNode: Node, target: IngredientTarget, def?: IngredientDefinition) {
    targetNode.removeAllChildren();
    let g = targetNode.getComponent(Graphics);
    if (!g) {
      g = targetNode.addComponent(Graphics);
    }
    g.clear();

    const ingDef = def || DEFAULT_INGREDIENTS[target.ingredientId];
    if (!ingDef) return;

    const baseColor = ingDef.color ? Color.fromHEX(new Color(), ingDef.color) : new Color(200, 160, 100);
    const halfW = this._cellWidth / 2;
    const halfH = this._cellHeight / 2;

    // Draw each jigsaw slot inside the target footprint
    for (const slot of ingDef.slots) {
      const isFilled = target.placedSlotIds.includes(slot.slotId);
      const isTutorialTarget = this._activeTutorialCue &&
        this._activeTutorialCue.targetInstanceId === target.instanceId &&
        this._activeTutorialCue.slotId === slot.slotId;

      // Slot local anchor position relative to target bottom-left
      const slotCenterX = slot.relativeCol * this._cellWidth;
      const slotCenterY = slot.relativeRow * this._cellHeight;

      // Slot bounds centered at (slotCenterX, -slotCenterY in SVG coords)
      const slotBounds = {
        x: slotCenterX - halfW + 2,
        y: -slotCenterY - halfH + 2,
        width: this._cellWidth - 4,
        height: this._cellHeight - 4
      };

      const pathCommands = PuzzleGeometry.generateSlotPathCommands(slotBounds, slot.edges);

      if (isFilled) {
        // Completed slot: Rich authentic ingredient color with crisp light border
        g.fillColor = baseColor;
        g.strokeColor = new Color(255, 255, 255, 230);
        g.lineWidth = 2.5;
        this.drawBezierPath(g, pathCommands);
        g.fill();
        g.stroke();
      } else {
        // Missing slot: Translucent silhouette receptacle
        g.fillColor = new Color(22, 26, 36, 175);
        g.strokeColor = isTutorialTarget
          ? new Color(245, 158, 11, 240) // Pulsing tutorial amber
          : new Color(baseColor.r, baseColor.g, baseColor.b, 140);
        g.lineWidth = isTutorialTarget ? 3.5 : 1.8;
        this.drawBezierPath(g, pathCommands);
        g.fill();
        g.stroke();
      }
    }

    // Title label: Ingredient Name + Completion progress (e.g. "番茄 2/4")
    const titleNode = new Node('TitleLabel');
    const centerX = ((ingDef.width - 1) * this._cellWidth) / 2;
    const centerY = ((ingDef.height - 1) * this._cellHeight) / 2 + (this._cellHeight * 0.5) + 12;
    titleNode.setPosition(new Vec3(centerX, centerY, 0));
    const titleLbl = titleNode.addComponent(Label);
    titleLbl.string = `${ingDef.name} (${target.placedSlotIds.length}/${ingDef.slots.length})`;
    titleLbl.fontSize = 14;
    titleLbl.lineHeight = 16;
    titleLbl.color = new Color(240, 240, 245);
    targetNode.addChild(titleNode);
  }

  createPieceNode(piece: LoosePiece): Node {
    const def = DEFAULT_INGREDIENTS[piece.ingredientId];
    const node = new Node(`Piece_${piece.instanceId}`);
    node.setPosition(this.gridToLocalPos(piece.coord));

    const uiTransform = node.addComponent(UITransform);
    uiTransform.setContentSize(this._cellWidth, this._cellHeight);

    // Visible Graphics: Authentic jigsaw Bezier tabs & blanks
    const g = node.addComponent(Graphics);
    const slotDef = def?.slots.find(s => s.slotId === piece.slotId);

    const baseColor = def?.color ? Color.fromHEX(new Color(), def.color) : new Color(220, 180, 110);
    const halfW = this._cellWidth / 2;
    const halfH = this._cellHeight / 2;

    const bounds = {
      x: -halfW + 3,
      y: -halfH + 3,
      width: this._cellWidth - 6,
      height: this._cellHeight - 6
    };

    const edges: { top: JigsawEdgeType; right: JigsawEdgeType; bottom: JigsawEdgeType; left: JigsawEdgeType } =
      slotDef?.edges || { top: 'flat', right: 'flat', bottom: 'flat', left: 'flat' };

    const commands = PuzzleGeometry.generateSlotPathCommands(bounds, edges);

    // 1. Subtle drop shadow contour
    g.strokeColor = new Color(0, 0, 0, 70);
    g.lineWidth = 4;
    this.drawBezierPath(g, commands);
    g.stroke();

    // 2. Main body fill & crisp outline
    g.fillColor = baseColor;
    g.strokeColor = new Color(255, 255, 255, 240);
    g.lineWidth = 2.5;
    this.drawBezierPath(g, commands);
    g.fill();
    g.stroke();

    this.piecesContainer?.addChild(node);
    return node;
  }

  setTutorialCue(cue: DragTutorialCue | null): void {
    this._activeTutorialCue = cue;
    // Re-render targets to highlight cue target
    if (this._session) {
      for (const target of this._session.grid.getAllTargets()) {
        const targetNode = this.targetsContainer?.getChildByName(`Target_${target.instanceId}`);
        if (targetNode) {
          this.drawTargetVisual(targetNode, target);
        }
      }
    }
  }

  onTargetSpawned(payload: CoreEventMap['TARGET_SPAWNED']) {
    const node = this.createTargetNode(payload.target);
    const fromPos = this.gridToLocalPos(payload.fromAnchor);
    const toPos = this.gridToLocalPos(payload.toAnchor);
    node.setPosition(fromPos);
    tween(node)
      .to(0.24, { position: toPos }, { easing: 'quadOut' })
      .start();
  }

  onPieceSpawned(payload: CoreEventMap['PIECE_SPAWNED']) {
    const node = this.createPieceNode(payload.piece);
    const fromPos = this.gridToLocalPos(payload.fromCoord);
    const toPos = this.gridToLocalPos(payload.toCoord);
    node.setPosition(fromPos);
    tween(node)
      .to(0.22, { position: toPos }, { easing: 'quadOut' })
      .start();
  }

  onPiecePlaced(payload: CoreEventMap['PIECE_PLACED']) {
    const pieceNode = this.piecesContainer?.getChildByName(`Piece_${payload.pieceInstanceId}`);
    if (pieceNode) {
      tween(pieceNode)
        .to(0.12, { scale: new Vec3(0, 0, 1) })
        .call(() => pieceNode.destroy())
        .start();
    }

    const target = this._session.grid.getTarget(payload.targetInstanceId);
    if (target) {
      const targetNode = this.targetsContainer?.getChildByName(`Target_${payload.targetInstanceId}`);
      if (targetNode) {
        this.drawTargetVisual(targetNode, target);
        // Subtle placement pop
        tween(targetNode)
          .to(0.06, { scale: new Vec3(1.05, 1.05, 1) })
          .to(0.1, { scale: new Vec3(1, 1, 1) })
          .start();
      }
    }
  }

  onIngredientCompleted(payload: CoreEventMap['INGREDIENT_COMPLETED']) {
    const targetNode = this.targetsContainer?.getChildByName(`Target_${payload.target.instanceId}`);
    if (targetNode) {
      tween(targetNode)
        .to(0.14, { scale: new Vec3(1.18, 1.18, 1) })
        .to(0.18, { scale: new Vec3(0, 0, 1) })
        .call(() => targetNode.destroy())
        .start();
    }
  }

  onBoardSettled(payload: CoreEventMap['BOARD_SETTLED']) {
    for (const item of payload.movedTargets) {
      const node = this.targetsContainer?.getChildByName(`Target_${item.instanceId}`);
      if (node) {
        const dest = this.gridToLocalPos(item.toAnchor);
        tween(node).to(0.22, { position: dest }, { easing: 'quadOut' }).start();
      }
    }

    for (const item of payload.movedPieces) {
      const node = this.piecesContainer?.getChildByName(`Piece_${item.instanceId}`);
      if (node) {
        const dest = this.gridToLocalPos(item.toCoord);
        tween(node).to(0.22, { position: dest }, { easing: 'quadOut' }).start();
      }
    }
  }
}
