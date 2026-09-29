# 《厨房拼图》Jigsaw Drop 变种玩法 (V2.0)

> **产品定义**：**Jigsaw Drop × 餐厅营业主题的多图拼图整理游戏。**  
> 详见权威基线文档：[docs/jigsaw_drop_baseline_v2.md](file:///c:/Users/admin/Music/chufang/docs/jigsaw_drop_baseline_v2.md)

---

## 一、核心设计第一原则

1. **玩家只玩拼图（Pure Jigsaw Drop）**：
   - 核心循环：`DROP ➔ SORT ➔ MATCH ➔ MERGE ➔ SWITCH ➔ COMPLETE ➔ CLEAR ➔ REFLOW ➔ DROP`；
   - 玩家唯一操作：观察碎片 ➔ 识别属于哪道料理 ➔ 拖拽碎片 / Piece Group ➔ 寻找正确空间关系 ➔ 邻接自动拼接（Piece-to-Piece）；
   - **禁止** 引入切菜、搅锅、灶台、烹饪进度条、顾客耐心等经营操作干扰核心拼图体验。

2. **多图并行，而非单图顺序拼图**：
   - 棋盘上始终同时并存多道未完成菜品（Gold Sample 3×3 9块标准：春日早餐盘、田园沙拉、暖汤拉面）；
   - 棋盘由不同菜品的碎片与越来越大的 Piece Group 共同构成，支持自然的缺件等待与目标切换。

3. **纯粹的空间压力，而非时间压力**：
   - **零倒计时、零步数限制、零订单超时惩罚**；
   - 紧张感来源于新碎片持续掉落占满棋盘的空间压迫；
   - 消除完整菜品瞬间触发 **大空间释放（Completion Reflow）**，构成核心快感节律。

4. **分层解耦体系**：
   - **Gameplay Core Layer**：`DishPuzzleManager`、`DishPuzzlePiece`、`PieceGroup`、`DishPieceSupplyScheduler`（权威拼图领域模型）；
   - **Meta Goal Layer**：`OrderSystem`、`PreparedDishBuffer`（备餐盘，容量2）、`Production Cascade`（连续出餐闭环）、`Business Goal`（当日营业额目标）；
   - **Ambient Presentation Layer**：猫咪主厨（`CatActorPlayer`）与小票机（`PrinterActorPlayer`）作为独立环境演员，由拼图事件单向驱动，不反向干预玩法。

---

## 二、快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 运行自动化测试套件
```bash
npm test
```

### 3. 类型检查与构建验证
```bash
npm run typecheck
```

### 4. 启动本地网页灰盒试玩
```bash
npm run dev
```
启动后在浏览器打开本地链接即可直接在真实舞台上体验 Jigsaw Drop 与环境双 Actor。

---

## 三、仓库目录与架构映射

```
├── docs/
│   ├── jigsaw_drop_baseline_v2.md    # 《厨房拼图》Jigsaw Drop 玩法基线需求 V2.0 (权威文件)
│   └── stage4_3_runtime_acceptance.md # Stage 4.3 双 Actor 运行时验收报告
├── packages/
│   ├── game-core/                    # 纯 TypeScript 确定性游戏内核
│   │   ├── src/
│   │   │   ├── puzzle/               # 【当前玩法权威】DishPuzzle 领域模型 (Piece, Group, Manager, Supply)
│   │   │   ├── order/                # 订单系统、OrderBag、备餐缓存与连续出餐
│   │   │   ├── session/              # GameSession 协调器
│   │   │   ├── random/               # SeededRandom (Mulberry32 确定性随机器)
│   │   │   ├── data/                 # Gold Sample 菜品 Manifest 与关卡配置
│   │   │   ├── progression/          # 战役流程、存档系统与教程引导
│   │   │   ├── board/                # (Legacy) 早期食材掉落网格与离散重力
│   │   │   ├── director/             # (Legacy) 早期食材目标调度器
│   │   │   ├── detector/             # (Legacy) 早期食材槽位死局检测
│   │   │   └── inventory/            # (Legacy) 早期预留库存模型
│   │   └── test/                     # 核心单元测试套件 (53 项全绿)
│   ├── simulation/                   # 仿真套件 (Monte-Carlo 跑数器，待向新 Core 迁移)
│   └── web-greybox/                  # 网页运行环境 (含 CatActorPlayer & PrinterActorPlayer)
└── cocos-app/                        # Cocos Creator 3.8.8 接入工程
```
