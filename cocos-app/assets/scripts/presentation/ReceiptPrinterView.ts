import { _decorator, Component, Node, Label, tween, Vec3, Graphics, Color, UITransform } from 'cc';
import {
  GameSession,
  CoreEventMap,
  DEFAULT_INGREDIENTS
} from '../../game-core/index.js';

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
  nextOrderLabel: Label | null = null;

  @property(Label)
  cascadeBannerLabel: Label | null = null;

  private _session!: GameSession;

  init(session: GameSession) {
    this._session = session;
    this.ensureVisualNodes();
    this.updatePaper();
  }

  private ensureVisualNodes() {
    let uiTransform = this.node.getComponent(UITransform);
    if (!uiTransform) {
      uiTransform = this.node.addComponent(UITransform);
      uiTransform.setContentSize(680, 220);
    }

    if (!this.paperNode) {
      let paper = this.node.getChildByName('Paper');
      if (!paper) {
        paper = new Node('Paper');
        this.node.addChild(paper);
      }
      this.paperNode = paper;
    }

    // Draw receipt paper graphics
    let g = this.paperNode.getComponent(Graphics);
    if (!g) {
      g = this.paperNode.addComponent(Graphics);
    }
    g.clear();

    // Receipt Paper Background (light warm white with subtle drop shadow)
    g.fillColor = new Color(250, 248, 245);
    g.strokeColor = new Color(200, 195, 185);
    g.lineWidth = 2;
    g.roundRect(-320, -100, 640, 200, 12);
    g.fill();
    g.stroke();

    // Top printer slot slit
    g.fillColor = new Color(40, 44, 52);
    g.roundRect(-330, 95, 660, 14, 6);
    g.fill();

    // Ensure labels exist
    if (!this.dishNameLabel) {
      let node = this.paperNode.getChildByName('DishName');
      if (!node) {
        node = new Node('DishName');
        node.setPosition(new Vec3(-180, 50, 0));
        this.paperNode.addChild(node);
      }
      this.dishNameLabel = node.getComponent(Label) || node.addComponent(Label);
      this.dishNameLabel.fontSize = 22;
      this.dishNameLabel.lineHeight = 26;
      this.dishNameLabel.color = new Color(30, 30, 35);
    }

    if (!this.revenueLabel) {
      let node = this.paperNode.getChildByName('Revenue');
      if (!node) {
        node = new Node('Revenue');
        node.setPosition(new Vec3(220, 50, 0));
        this.paperNode.addChild(node);
      }
      this.revenueLabel = node.getComponent(Label) || node.addComponent(Label);
      this.revenueLabel.fontSize = 24;
      this.revenueLabel.lineHeight = 28;
      this.revenueLabel.color = new Color(210, 45, 45);
    }

    if (!this.checklistLabel) {
      let node = this.paperNode.getChildByName('Checklist');
      if (!node) {
        node = new Node('Checklist');
        node.setPosition(new Vec3(0, 0, 0));
        this.paperNode.addChild(node);
      }
      this.checklistLabel = node.getComponent(Label) || node.addComponent(Label);
      this.checklistLabel.fontSize = 17;
      this.checklistLabel.lineHeight = 22;
      this.checklistLabel.color = new Color(70, 75, 85);
    }

    if (!this.nextOrderLabel) {
      let node = this.paperNode.getChildByName('NextOrder');
      if (!node) {
        node = new Node('NextOrder');
        node.setPosition(new Vec3(0, -55, 0));
        this.paperNode.addChild(node);
      }
      this.nextOrderLabel = node.getComponent(Label) || node.addComponent(Label);
      this.nextOrderLabel.fontSize = 15;
      this.nextOrderLabel.lineHeight = 18;
      this.nextOrderLabel.color = new Color(130, 135, 145);
    }

    if (!this.cascadeBannerLabel) {
      let node = this.node.getChildByName('CascadeBanner');
      if (!node) {
        node = new Node('CascadeBanner');
        node.setPosition(new Vec3(0, -110, 0));
        node.active = false;
        this.node.addChild(node);
      }
      this.cascadeBannerLabel = node.getComponent(Label) || node.addComponent(Label);
      this.cascadeBannerLabel.fontSize = 24;
      this.cascadeBannerLabel.lineHeight = 28;
      this.cascadeBannerLabel.color = new Color(255, 195, 0);
    }
  }

  onOrderCreated(payload: CoreEventMap['ORDER_CREATED']) {
    this.updatePaper();
    if (this.paperNode) {
      // Paper drop / print slide animation
      this.paperNode.setPosition(new Vec3(0, 50, 0));
      tween(this.paperNode)
        .to(0.25, { position: new Vec3(0, 0, 0) }, { easing: 'cubicOut' })
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
        .by(0.18, { position: new Vec3(0, -60, 0) })
        .to(0.12, { scale: new Vec3(0.7, 0.7, 1) })
        .call(() => {
          this.paperNode?.setPosition(new Vec3(0, 0, 0));
          this.paperNode?.setScale(new Vec3(1, 1, 1));
          this.updatePaper();
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
    if (!this._session) return;
    const order = this._session.orderSystem.currentOrder;
    if (!order) return;

    if (this.dishNameLabel) {
      this.dishNameLabel.string = `${order.orderId} ${order.emoji} ${order.dishName}`;
    }
    if (this.revenueLabel) {
      this.revenueLabel.string = `+¥${order.baseRevenue}`;
    }
    if (this.checklistLabel) {
      const lines = order.items.map(item => {
        const def = DEFAULT_INGREDIENTS[item.ingredientId];
        const isDone = item.reserved >= item.needed;
        const name = def ? `${def.emoji}${def.name}` : item.ingredientId;
        return `${isDone ? '✅' : '⬜'} ${name}(${item.reserved}/${item.needed})`;
      });
      this.checklistLabel.string = lines.join('   ');
    }

    if (this.nextOrderLabel) {
      const preview = this._session.orderSystem.getNextOrderPreview();
      if (preview && preview.dishName) {
        this.nextOrderLabel.string = `下一单预告: ${preview.emoji || '🍽️'} ${preview.dishName}`;
      } else {
        this.nextOrderLabel.string = '营业目标达成在即！';
      }
    }
  }
}
