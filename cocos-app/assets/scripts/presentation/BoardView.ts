import { _decorator, Component, Node, Vec3, tween, UITransform, Graphics, Label, Color } from 'cc';
import {
  GameSession,
  GridCoord,
  IngredientTarget,
  LoosePiece,
  CoreEventMap,
  DEFAULT_INGREDIENTS,
  IngredientDefinition
} from '../../game-core/index.js';

const { ccclass, property } = _decorator;

@ccclass('BoardView')
export class BoardView extends Component {
  @property(Node)
  targetsContainer: Node | null = null;

  @property(Node)
  piecesContainer: Node | null = null;

  private _session!: GameSession;
  private _cellWidth: number = 72;
  private _cellHeight: number = 72;

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
    const baseColor = ingDef?.color ? Color.fromHEX(new Color(), ingDef.color) : new Color(200, 160, 100);

    // Draw each slot within the target footprint
    if (ingDef) {
      for (const slot of ingDef.slots) {
        const slotOffsetX = slot.relativeCol * this._cellWidth;
        const slotOffsetY = slot.relativeRow * this._cellHeight;
        const isFilled = target.placedSlotIds.includes(slot.slotId);

        const pad = 4;
        const w = this._cellWidth - pad * 2;
        const h = this._cellHeight - pad * 2;
        const x = slotOffsetX - this._cellWidth / 2 + pad;
        const y = slotOffsetY - this._cellHeight / 2 + pad;

        if (isFilled) {
          // Solid ingredient color for completed slot
          g.fillColor = baseColor;
          g.strokeColor = new Color(255, 255, 255, 200);
          g.lineWidth = 2;
          g.roundRect(x, y, w, h, 8);
          g.fill();
          g.stroke();

          // Slot checkmark label
          const slotLabelNode = new Node(`SlotLabel_${slot.slotId}`);
          slotLabelNode.setPosition(new Vec3(slotOffsetX, slotOffsetY, 0));
          const lbl = slotLabelNode.addComponent(Label);
          lbl.string = '✓';
          lbl.fontSize = 22;
          lbl.lineHeight = 24;
          lbl.color = Color.WHITE;
          targetNode.addChild(slotLabelNode);
        } else {
          // Hollow / semi-transparent receptacle for missing slot
          g.fillColor = new Color(30, 34, 45, 180);
          g.strokeColor = new Color(baseColor.r, baseColor.g, baseColor.b, 150);
          g.lineWidth = 1.5;
          g.roundRect(x, y, w, h, 8);
          g.fill();
          g.stroke();

          // Slot name label
          const slotLabelNode = new Node(`SlotLabel_${slot.slotId}`);
          slotLabelNode.setPosition(new Vec3(slotOffsetX, slotOffsetY, 0));
          const lbl = slotLabelNode.addComponent(Label);
          lbl.string = slot.label || slot.slotId;
          lbl.fontSize = 13;
          lbl.lineHeight = 15;
          lbl.color = new Color(220, 220, 230, 200);
          targetNode.addChild(slotLabelNode);
        }
      }

      // Title label: emoji + name + progress
      const titleNode = new Node('TitleLabel');
      const centerX = ((ingDef.width - 1) * this._cellWidth) / 2;
      const centerY = ((ingDef.height - 1) * this._cellHeight) / 2;
      titleNode.setPosition(new Vec3(centerX, centerY + (ingDef.height * this._cellHeight) / 2 + 10, 0));
      const titleLbl = titleNode.addComponent(Label);
      titleLbl.string = `${ingDef.emoji} ${ingDef.name} (${target.placedSlotIds.length}/${ingDef.slots.length})`;
      titleLbl.fontSize = 14;
      titleLbl.lineHeight = 16;
      titleLbl.color = Color.WHITE;
      targetNode.addChild(titleNode);
    }
  }

  createPieceNode(piece: LoosePiece): Node {
    const def = DEFAULT_INGREDIENTS[piece.ingredientId];
    const node = new Node(`Piece_${piece.instanceId}`);
    node.setPosition(this.gridToLocalPos(piece.coord));

    const uiTransform = node.addComponent(UITransform);
    uiTransform.setContentSize(this._cellWidth, this._cellHeight);

    // Visible Graphics: rounded jigsaw tile
    const g = node.addComponent(Graphics);
    const pad = 4;
    const w = this._cellWidth - pad * 2;
    const h = this._cellHeight - pad * 2;
    const x = -w / 2;
    const y = -h / 2;

    const baseColor = def?.color ? Color.fromHEX(new Color(), def.color) : new Color(220, 180, 110);
    g.fillColor = baseColor;
    g.strokeColor = Color.WHITE;
    g.lineWidth = 2.5;
    g.roundRect(x, y, w, h, 10);
    g.fill();
    g.stroke();

    // Piece Label (Emoji + Slot name)
    const labelNode = new Node('PieceLabel');
    const lbl = labelNode.addComponent(Label);
    const slotDef = def?.slots.find(s => s.slotId === piece.slotId);
    lbl.string = `${def?.emoji || '🧩'}\n${slotDef?.label || piece.slotId}`;
    lbl.fontSize = 13;
    lbl.lineHeight = 16;
    lbl.color = Color.WHITE;
    node.addChild(labelNode);

    this.piecesContainer?.addChild(node);
    return node;
  }

  onTargetSpawned(payload: CoreEventMap['TARGET_SPAWNED']) {
    const node = this.createTargetNode(payload.target);
    const fromPos = this.gridToLocalPos(payload.fromAnchor);
    const toPos = this.gridToLocalPos(payload.toAnchor);
    node.setPosition(fromPos);
    tween(node)
      .to(0.25, { position: toPos }, { easing: 'quadOut' })
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

    // Refresh target visual so the newly placed slot is rendered as filled
    const target = this._session.grid.getTarget(payload.targetInstanceId);
    if (target) {
      const targetNode = this.targetsContainer?.getChildByName(`Target_${payload.targetInstanceId}`);
      if (targetNode) {
        this.drawTargetVisual(targetNode, target);
      }
    }
  }

  onIngredientCompleted(payload: CoreEventMap['INGREDIENT_COMPLETED']) {
    const targetNode = this.targetsContainer?.getChildByName(`Target_${payload.target.instanceId}`);
    if (targetNode) {
      tween(targetNode)
        .to(0.12, { scale: new Vec3(1.2, 1.2, 1) })
        .to(0.2, { scale: new Vec3(0, 0, 1) })
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
