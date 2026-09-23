import { _decorator, Component, Node, Label, tween, Vec3 } from 'cc';
import {
  GameSession,
  CoreEventMap,
  DEFAULT_INGREDIENTS
} from '../../../packages/game-core/src/index.js';

const { ccclass, property } = _decorator;

@ccclass('ReceiptPrinterView')
export class ReceiptPrinterView extends Component {
  @property(Node)
  paperNode: Node | null = null;

  @property(Label)
  dishNameLabel: Label | null = null;

  @property(Label)
  revenueLabel: Label | null = null;

  @property(Label)
  checklistLabel: Label | null = null;

  @property(Label)
  cascadeBannerLabel: Label | null = null;

  private _session!: GameSession;

  init(session: GameSession) {
    this._session = session;
    this.updatePaper();
  }

  onOrderCreated(payload: CoreEventMap['ORDER_CREATED']) {
    this.updatePaper();
    if (this.paperNode) {
      // Paper drop / print slide animation
      this.paperNode.setPosition(new Vec3(0, 50, 0));
      tween(this.paperNode)
        .to(0.2, { position: new Vec3(0, 0, 0) }, { easing: 'cubicOut' })
        .start();
    }
  }

  onOrderProgress(payload: CoreEventMap['ORDER_PROGRESS']) {
    this.updatePaper();
  }

  onOrderCompleted(payload: CoreEventMap['ORDER_COMPLETED']) {
    if (this.paperNode) {
      // Paper tear and fly out
      tween(this.paperNode)
        .by(0.15, { position: new Vec3(0, -80, 0) })
        .to(0.1, { scale: new Vec3(0.5, 0.5, 1) })
        .call(() => {
          this.paperNode?.setPosition(new Vec3(0, 0, 0));
          this.paperNode?.setScale(new Vec3(1, 1, 1));
        })
        .start();
    }
  }

  onCascadeStep(payload: CoreEventMap['CASCADE_STEP']) {
    if (this.cascadeBannerLabel) {
      this.cascadeBannerLabel.node.active = true;
      this.cascadeBannerLabel.string = `⚡ CASCADE x${payload.chainIndex}! +${Math.round((payload.multiplier - 1) * 100)}%`;
      this.cascadeBannerLabel.node.setScale(new Vec3(0.5, 0.5, 1));

      tween(this.cascadeBannerLabel.node)
        .to(0.15, { scale: new Vec3(1.2, 1.2, 1) }, { easing: 'backOut' })
        .delay(0.8)
        .to(0.15, { scale: new Vec3(0, 0, 1) })
        .call(() => {
          if (this.cascadeBannerLabel) this.cascadeBannerLabel.node.active = false;
        })
        .start();
    }
  }

  private updatePaper() {
    const order = this._session.orderSystem.currentOrder;
    if (!order) return;

    if (this.dishNameLabel) {
      this.dishNameLabel.string = `${order.orderId} ${order.emoji} ${order.dishName}`;
    }
    if (this.revenueLabel) {
      this.revenueLabel.string = `¥${order.baseRevenue}`;
    }
    if (this.checklistLabel) {
      const lines = order.items.map(item => {
        const def = DEFAULT_INGREDIENTS[item.ingredientId];
        const isDone = item.reserved >= item.needed;
        return `${isDone ? '✓' : '□'} ${def ? def.name : item.ingredientId}`;
      });
      this.checklistLabel.string = lines.join('  ');
    }
  }
}
