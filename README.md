# 食材拼图 × 外卖营业 (V1.0)

一款以 **Jigsaw 式多目标拼图与掉落整理** 为基础，结合 **外卖订单、备料库存与连续出餐（Production Cascade）** 的竖屏 2D 休闲小游戏。

---

## 核心设计原则

1. **玩家只玩拼图**：核心操作仅有观察散片、判断属于哪个食材、拖拽归位。成品菜永不进入棋盘。
2. **纯粹的空间压力**：零时间倒计时、零步数限制；唯一失败来源为确定性棋盘死局（`NoLegalBoardContinuation`）。
3. **分层解耦架构**：
   - `packages/game-core`：100% 纯 TypeScript 确定性游戏内核（零引擎依赖），采用 Command/Event/State 架构与 SeededRandom；
   - `packages/simulation`：Node.js 批量 Monte-Carlo 平衡性与死局仿真器；
   - `packages/web-greybox`：即时试玩网页灰盒，支持手势拖拽、磁吸吸附、热敏小票与 Web Audio 合成音效；
   - `cocos-app`：Cocos Creator 3.8.8 竖屏 2D 接入工程。

---

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 运行自动化测试
```bash
npm test
```

### 3. 运行 300 局 Monte-Carlo 平衡性仿真
```bash
npm run sim
```

### 4. 启动本地网页灰盒试玩
```bash
npm run dev
```
启动后在浏览器打开本地链接即可直接试玩体验。

---

## 目录结构

```
├── packages/
│   ├── game-core/              # 纯 TypeScript 确定性内核
│   │   ├── src/
│   │   │   ├── random/         # SeededRandom (Mulberry32)
│   │   │   ├── board/          # BoardGrid (8x12 隐藏网格) & DiscreteGravity
│   │   │   ├── inventory/      # PrepInventory (预留与消耗模型)
│   │   │   ├── order/          # OrderBag (受约束订单牌袋) & OrderSystem
│   │   │   ├── director/       # Two-Stage FlowDirector (Target + Piece Scheduler)
│   │   │   ├── detector/       # DeadlockDetector (4要素确定性死局判定)
│   │   │   ├── session/        # GameSession
│   │   │   └── data/           # DefaultData (10 种食材, 10 道菜品, 4 个关卡)
│   │   └── test/               # 核心单元测试
│   ├── simulation/             # 仿真跑数器 (Monte-Carlo Balance Runner)
│   └── web-greybox/            # 网页交互灰盒演示
└── cocos-app/                  # Cocos Creator 3.8.8 工程
    └── assets/scripts/
        ├── GameManager.ts
        └── presentation/
```
