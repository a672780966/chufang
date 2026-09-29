# 《厨房拼图》Jigsaw Drop 变种玩法基线 V2.0 权威审计与对齐报告

> **基线文档引用**：[docs/jigsaw_drop_baseline_v2.md](file:///c:/Users/admin/Music/chufang/docs/jigsaw_drop_baseline_v2.md)  
> **执行日期**：2026-09-29  
> **执行目标**：严格依照《Jigsaw Drop 变种玩法基线需求 V2.0》，冻结玩法基线、完成新旧 Core 运行路径权威审计、核验 Web/Cocos 状态解释一致性，并制定 DishPuzzle 专属平衡仿真迁移路线图。

---

## 一、P0：玩法基线修复完成报告

### 1. 权威基线文档归档
- 已将完整需求书无删减录入工程文档库：[docs/jigsaw_drop_baseline_v2.md](file:///c:/Users/admin/Music/chufang/docs/jigsaw_drop_baseline_v2.md)；
- 确立最高层定义：
  > **“在持续掉落、同时包含多张料理图片的有限棋盘中，不断整理、拼接、切换目标并完成整张料理拼图；完成图片释放空间，而订单、备餐、连续出餐和餐厅动画把这一套 Jigsaw Drop 循环包装成一次餐厅营业。”**

### 2. 根目录 `README.md` 修正
- [README.md](file:///c:/Users/admin/Music/chufang/README.md) 全面重构，彻底废除旧版“判断属于哪个食材、拖拽归位”、“成品菜永不进入棋盘”的食材插槽描述；
- 明确产品核心机制：
  - **核心动作**：`DROP ➔ SORT ➔ MATCH ➔ MERGE ➔ SWITCH ➔ COMPLETE ➔ CLEAR ➔ REFLOW ➔ DROP`；
  - **拼图模型**：Piece-to-Piece，多块连结为 Piece Group，9 块合体完成完整菜品（Gold Sample 基准：春日早餐盘、田园沙拉、暖汤拉面）；
  - **纯粹空间压力**：零倒计时、零步数限制、零顾客耐心；
  - **分层解耦**：Jigsaw Drop Core（拼图权威） + Meta Goal Layer（订单与备餐） + Ambient Actor（猫与打印机环境伴随）。

---

## 二、P1：新旧 Core 权威审计报告

### 1. 两代 Core 的物理划分与资产归属

| 体系 | 模块文件 | 核心数据结构 / 事件 | 当前定位 |
| :--- | :--- | :--- | :--- |
| **Legacy Core**<br>(早期食材拼图) | `packages/game-core/src/model/Types.ts`<br>`packages/game-core/src/board/BoardGrid.ts`<br>`packages/game-core/src/board/DiscreteGravity.ts`<br>`packages/game-core/src/director/FlowDirector.ts`<br>`packages/game-core/src/detector/DeadlockDetector.ts`<br>`packages/game-core/src/inventory/PrepInventory.ts` | `LoosePiece`<br>`IngredientTarget`<br>`PrepInventory`<br>`FlowDirector`<br>`INGREDIENT_COMPLETED`<br>`BOARD_BLOCKED` | **历史遗产 / 仿真测试支撑**<br>仅供兼容旧测试与旧仿真跑数，**禁止向其追加任何新玩法逻辑**。 |
| **DishPuzzle Core**<br>(权威 Jigsaw Drop) | `packages/game-core/src/puzzle/DishPuzzlePiece.ts`<br>`packages/game-core/src/puzzle/DishPuzzleInstance.ts`<br>`packages/game-core/src/puzzle/DishPuzzleManager.ts`<br>`packages/game-core/src/puzzle/DishPieceSupplyScheduler.ts`<br>`packages/game-core/src/data/DishManifest.ts` | `DishPuzzlePiece`<br>`PieceGroup`<br>`DishPuzzleInstance`<br>`DishPuzzleManager`<br>`DISH_COMPLETED`<br>`DISH_CLEARED`<br>`DISH_SERVED` | **当前玩法设计唯一权威**<br>所有玩家交互、棋盘演算、出餐结算、伴随动画完全基于此体系运转。 |

### 2. 真实运行时使用路径审计 (Execution Path Audit)

1. **Web Greybox 运行时 (`packages/web-greybox/`)**：
   - **完全由 DishPuzzle Core 驱动**；
   - `startDay()` 绑定 `session.dishPuzzleManager`，棋盘加载 Day 1 预连结多图布局（17 块碎片，涵盖早餐、沙拉、拉面）；
   - 交互完全为 Group 拖拽与拼图邻接判定；出餐完全由 `clearCompletedGroup()` ➔ `DISH_SERVED` 触发；
   - 旧版 `session.placePiece()` 路径已从玩家交互链中彻底下线。

2. **Cocos 运行时 (`cocos-app/`)**：
   - `BoardView.ts` 与 `TouchController.ts` 已在 Stage 4 迁移至 `session.dishPuzzleManager`；
   - 触控坐标映射 `TouchController.screenToBoardLocal` 严格调用 `dishPuzzleManager.tryMoveGroup()`；
   - 渲染完全基于 `dishPuzzleManager.getAllPieces()` 与 PieceGroup。

3. **测试套件 (`packages/game-core/test/`)**：
   - **双轨并存**：
     - 测试 1~3 (`CocosPlayableChain.test.ts`) & 测试 4 (`DishPuzzle.test.ts`)：覆盖 DishPuzzle 权威机制（16 项细分断言，覆盖多图初始化、Group 刚体位移、邻接吸附、9 块出餐、多单闭环与当日通关）；
     - 测试 5~22：覆盖 Legacy Core 的单点功能（`SeededRandom`、旧 `DeadlockDetector`、旧 `FlowDirector`、旧 `PrepInventory`、旧 `Stage2` 冻结参数校验等）。

4. **仿真套件 (`packages/simulation/`)**：
   - **仍然绑定在 Legacy Core**；
   - `SimulationRunner.ts`、`BalanceHarness.ts`、`Stage3SyntheticValidator.ts` 均基于旧版 `session.placePiece()` 和 `FlowDirector` 运行；
   - **重大审计发现**：当前旧仿真跑通（300 局 Monte-Carlo 零死局）仅证明了旧食材插槽模式在数学上的收敛性，**并不代表当前 3×3 DishPuzzle Jigsaw Drop 模式的平衡数据已收敛**。必须启动 P3 仿真套件迁移。

### 3. DishPuzzle Core 需补齐的原有核心能力清单

为使 DishPuzzle 完全自洽并彻底摆脱对 Legacy Core 的历史依赖，需在新 Core 中完成以下补齐：

1. **空间压力与掉落节律 (Spatial Pressure & Drop Cadence)**：
   - 现状：当前 `schedulePieceAcrossActiveDishes(count, biasDishId)` 在出餐与单步移动时补件。
   - 需补齐：确立显式的非消除步空间堆积规则与最高棋盘容积阈值（如保持 18~24 块活跃碎片），防止棋盘空旷化或失控溢出。
2. **死局检测器 (DishPuzzle Deadlock Detector)**：
   - 现状：现有 `DeadlockDetector.ts` 检查的是旧食材槽位空缺；
   - 需补齐：针对 Piece-to-Piece 开发 `DishPuzzleDeadlockDetector`，在棋盘空间满载时，确定性判定“是否存在任意合法邻接位移”或“备餐盘是否仍可容纳出餐”。
3. **确定性与无偏随机器 (Determinism)**：
   - 已由 `SeededRandom(seed)` 保证，需确保 Supply 算法中的 dish 选取与补片索引严格维持 100% 轨迹重现。
4. **DishPuzzle 专属 Monte-Carlo 仿真器**：
   - 在 `packages/simulation` 下新增 `DishPuzzleSimulationRunner.ts`，模拟真实机器人在 Piece-to-Piece 规则下的多图拼装决策。

---

## 三、P2：Web / Cocos Parity 审计报告

### 1. 棋盘坐标与几何对齐
- **Web Greybox**：通过 `getBoardOrigin()` 动态获取亚麻布棋盘（~79% 视窗）尺寸，实时计算 `cellSize` 与网格原点 `(originX, originY)`，支持 Group 整体刚体相对位移。
- **Cocos Creator**：`BoardView.ts` 与 `TouchController.ts` 基于设计分辨率计算棋盘局部坐标 `gridToLocalPos`，经由测试套件 `CocosPlayableChain.test.ts` 严格验证，两端在网格转换、命中半径、多块吸附判定上**保持 100% 数学等价**。

### 2. Next Order Preview 规则对齐修正
- **冲突现状**：
  - Cocos `ReceiptPrinterView.ts` 遵循 Stage 3 原生规则：`dayNumber < 7` 显示“🔒 第 7 天解锁”；
  - Web Greybox 原先仅判定 `dayNumber === 1` 隐藏，导致 Day 2~6 提前透出下一单。
- **修复对齐**：
  - 依照基线第 27 条“应当由 Presentation 向权威 Progression 对齐，NEXT Order 不得擅自提前成为 Day 1 基础机制”；
  - 已将 [main.ts](file:///c:/Users/admin/Music/chufang/packages/web-greybox/src/main.ts#L416-L432) 的展示判定严格统一为 `session.dayConfig.dayNumber < 7` 隐藏，实现 Web 与 Cocos 绝对对齐。

### 3. 环境 Actor 表现层分工
- **Web Greybox**：完整搭载 `CatActorPlayer`（Spritesheet 离屏 Canvas + WebP）与 `PrinterActorPlayer`，作为 82px 伴随舞台标准范例；
- **Cocos**：已内建 `ReceiptPrinterView`，猫咪动画包将在下一阶段依据 Sealed Actor 规范集成。

---

## 四、P3：DishPuzzle Balance 迁移与落地路线图

根据基线第 25 条裁决：`STAGE2_FROZEN` 具体数值不能自动视为 DishPuzzle 的正式平衡参数。后续平衡工程分四步推进：

```
[Step 1: 新死局判定器] ➔ [Step 2: DishPuzzle 仿真器] ➔ [Step 3: 500+ Seed 蒙卡扫描] ➔ [Step 4: 12-Day 关卡重平衡]
```

1. **Step 1：构建 `DishPuzzleDeadlockDetector`**
   - 算法：遍历棋盘所有 PieceGroup，检测是否存在任意向空闲单元格的位移能形成合法邻接；
   - 判定无解且顶部入料口不可下落时，权威触发 `BOARD_BLOCKED`。
2. **Step 2：构建 `DishPuzzleSimulationRunner`**
   - 建立面向 Piece-to-Piece 的启发式 AI（贪心连结优先、目标菜品聚焦、备餐盘缓存利用）；
   - 脱离 DOM / Canvas，直接在内存中执行批量多图掉落跑数。
3. **Step 3：500+ Seeds 蒙特卡洛平衡调优**
   - 测定新指标：
     - 平均完餐步数（Turns to Complete）；
     - 棋盘空间占用率（Board Occupancy Rate，健康区间 45%~75%）；
     - 饥饿保护触发频次（Starvation Frequency）；
     - 级联出餐达成率（Production Cascade Ratio）。
4. **Step 4：12 关战役配置（Day Progression）重构**
   - 废除基于旧食材数量的关卡参数，改为基于“活跃菜品组合、入场初始预连结度、目标营业额”的全新 12 关参数配置。

---

## 五、结论与当前基线冻结宣言

1. **P0 已完成**：[jigsaw_drop_baseline_v2.md](file:///c:/Users/admin/Music/chufang/docs/jigsaw_drop_baseline_v2.md) 已作为最高法典生效，[README.md](file:///c:/Users/admin/Music/chufang/README.md) 描述已更新无遗留错误；
2. **P1 已厘清**：DishPuzzle 为唯一玩法核心，Legacy Core 仅保留作为历史回归对比与旧测试支撑；
3. **P2 已对齐**：Web 与 Cocos 对棋盘、操作、以及 Next Order Gating（Day 7）做出完全一致的解释；
4. **全套自动化测试**：53 / 53 通过，TypeScript 检查 0 错误。
