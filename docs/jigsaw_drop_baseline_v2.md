# 《厨房拼图》Jigsaw Drop 变种玩法基线需求 V2.0

## 0. 文档目的

本文件用于重新冻结 `chufang` 项目的玩法基线。

依据仓库实际演化链：

`aedc5bbe`
→ Stage 1 Drop / 空间压力
→ Stage 2 平衡冻结
→ Stage 3 Progression
→ `aa971d85` DishPuzzle
→ `4afe34d0` Multi-Image Supply
→ Stage 4 Gold Sample / Ambient Actor
→ 当前 `13dd2e8`

本文件不新增玩法。

它的作用是：

**明确哪些是游戏本体，哪些是外围系统，哪些只是历史遗留实现。**

后续任何开发需求，如果与本文件冲突，应先停止开发并重新审查，而不是直接修改玩法。

---

# 1. 产品定义

本项目不是传统厨房经营游戏。

不是：

> 接订单  
> → 切菜  
> → 烹饪  
> → 装盘  
> → 出餐。

也不是 Match-3、合成、消除或时间管理游戏。

本项目的母体是：

# Jigsaw Drop

当前产品定义：

> **Jigsaw Drop × 餐厅营业主题的多图拼图整理游戏。**

玩家真正进行的操作始终发生在一个主拼图棋盘中。

厨房、订单、猫、打印机、营业额等系统负责：

- 赋予拼图目标意义；
- 提供营业反馈；
- 提供目标优先级；
- 提供完成后的奖励与连续出餐反馈。

它们不得发展成第二套核心操作系统。

---

# 2. 第一原则：玩家只玩拼图

玩家主操作必须保持极少。

核心动作：

```text
观察碎片
↓
识别属于哪张完整图片
↓
拖拽碎片 / Piece Group
↓
寻找正确空间关系
↓
正确邻接
↓
自动拼接
```

玩家不得被要求同时操作：

- 刀；
- 锅；
- 灶台；
- 烹饪进度条；
- 配料加工；
- 服务员；
- 顾客耐心；
- 厨房生产线。

这些都不属于核心玩法。

---

# 3. Jigsaw Drop 核心循环

游戏最核心循环冻结为：

```text
新拼图块进入棋盘
        ↓
多个图片的碎片混合存在
        ↓
观察 / 分类 / 空间整理
        ↓
拖动 Piece 或 Piece Group
        ↓
正确拼图块发生邻接
        ↓
合并为更大的 Piece Group
        ↓
继续整理其它碎片
        ↓
某张图片完成
        ↓
完整图片清除
        ↓
释放大片棋盘空间
        ↓
Completion Reflow
        ↓
新块继续进入
```

简称：

# DROP
→ SORT
→ MATCH
→ MERGE
→ SWITCH
→ COMPLETE
→ CLEAR
→ REFLOW
→ DROP

所有后续设计必须服务于这条循环。

---

# 4. 多图片并行是核心，不得退化成单图拼图

同一棋盘必须同时存在多个未完成图片。

Gold Sample 当前基准：

```text
春日早餐盘
田园沙拉
暖汤拉面
```

Day 1 当前 DishPuzzle 实现：

```text
3 个活跃 DishPuzzleInstance
```

同时存在。

玩家不能只处理：

```text
当前订单的一张图
```

然后拼完以后再获得：

```text
下一张图。
```

这种实现会退化成普通顺序拼图，不再是 Jigsaw Drop。

正确状态应当是：

```text
早餐的一部分
+
沙拉的一部分
+
拉面的一部分
+
已经连起来的若干 Piece Group
```

同时存在于棋盘。

---

# 5. Gold Sample 拼图规格

当前 Gold Sample 基线：

```text
3 × 3
9 pieces / Dish
```

三套正式图片：

```text
dish_breakfast
dish_salad
dish_ramen
```

每一个 Piece 必须属于一个明确的：

```text
DishPuzzleInstance
```

每一个 Piece 都具有自己在完整图片中的：

```text
slotCol
slotRow
邻接关系
```

只有来自同一 DishPuzzleInstance、且在完整图片中真实相邻的 Piece，才允许拼接。

---

# 6. Piece Group 是核心机制

拼图不能只处理单块。

正确邻接以后：

```text
Piece
+
Piece
↓
Piece Group
```

Piece Group 后续必须作为整体继续参与空间整理。

例如：

```text
■ ■
■ ■
```

四块已经正确拼好的区域，不应该被重新拆成四个独立元素。

玩家操作的是：

> 越来越大的拼图碎片组。

最终：

```text
9 Pieces
↓
1 Complete Dish Group
```

这是 Jigsaw Drop 区别于普通“拖块进固定槽位”的重要机制。

---

# 7. 禁止退化成固定目标槽拼图

当前 DishPuzzle 方向优先于早期 IngredientTarget 方向。

不要重新变成：

```text
棋盘上先放一个完整轮廓
↓
玩家拿碎片
↓
拖到指定空槽
↓
填进去
```

当前目标是：

```text
碎片本身存在于公共棋盘
↓
玩家整理碎片之间的空间关系
↓
碎片互相拼接
```

也就是：

**Piece-to-Piece。**

不是：

**Piece-to-Target-Slot。**

---

# 8. Drop / Supply 是游戏发动机

棋盘上的 Piece 不是一次性全部给完。

必须存在持续 Supply。

玩家进行游戏行为后，新的碎片继续进入棋盘。

Supply 的作用包括：

- 保持棋盘变化；
- 制造空间占用；
- 产生新的拼接机会；
- 让不同图片交叉成长；
- 防止玩家只处理一张静态拼图。

因此：

> 拼图不是静态题目。

而是一个持续变化的空间系统。

---

# 9. 空间压力，而不是时间压力

游戏冻结为：

```text
无倒计时
无订单超时
无步数限制
```

玩家失败压力不得来自：

```text
还剩 30 秒
还剩 5 步
顾客快生气了
```

压力来源必须主要是：

# 棋盘空间

随着新的碎片不断进入：

```text
可移动空间减少
↓
Group 变大
↓
不同图片互相阻挡
↓
玩家必须决定先处理什么
```

玩家通过完成图片：

```text
Complete Dish
↓
Clear
↓
释放空间
```

获得喘息。

因此核心张力是：

> **积压 → 整理 → 完成 → 大释放。**

---

# 10. 不允许每次移动都全局坍塌

Stage 4.1 已经修正过这一问题。

玩家移动一个 Group 后，不应立即触发整个棋盘：

```text
全部向下塌
```

否则：

- 玩家刚整理好的空间结构被破坏；
- 无法规划；
- 多图布局失去意义；
- 游戏退化成自动重排。

正常移动：

```text
只改变玩家移动的 Group
```

主要 Reflow 时机：

```text
完整 Dish 被清除
↓
棋盘产生大空洞
↓
Completion Reflow
```

也就是：

> **移动负责整理，完成负责重排。**

---

# 11. 缺件和目标切换必须自然存在

游戏不得保证：

```text
玩家开始拼 Salad
↓
接下来连续把 Salad 所有剩余碎片全部喂给玩家
```

这样会失去多图管理。

正常状态应该允许：

```text
Salad 快完成
↓
当前没有合适 Salad Piece
↓
玩家转去整理 Breakfast / Ramen
↓
新 Supply 到来
↓
重新发现 Salad 的机会
```

这类：

# 接近完成
→ 暂停
→ 切换目标
→ 再回来

是 Jigsaw Drop 型游戏的重要节奏。

但注意：

早期 Ingredient Core 的：

```text
closureHoldTurns = 2
closureStarvationTurns = 6
```

属于旧系统具体参数。

**不得直接把这些数值机械移植到 DishPuzzle。**

新 DishPuzzle 只需要保留这个设计目的：

> 不单线喂满，同时不能永久饿死某张图。

---

# 12. Multi-Image Supply 原则

当前 `DishPieceSupplyScheduler` 的设计方向正确：

当前订单 Dish 可以获得较高 Supply 权重。

其它活跃 Dish 仍然必须获得 Supply。

接近完成 Dish 可以增加优先级。

长时间没有获得 Piece 的 Dish 必须有 starvation protection。

因此：

```text
Current Order
≠
唯一允许掉落的 Dish
```

而应该是：

```text
当前订单：较高优先级
其它图片：持续存在
长期缺件：提高 Supply
接近完成：适度促进
```

最终目的：

> 棋盘始终是多图片并行系统。

---

# 13. 完成与清屏

当某个 DishPuzzleInstance：

```text
9 / 9 Pieces
```

正确组成完整图片时：

```text
DISH_COMPLETED
```

随后进入：

```text
完成表现
↓
DISH_CLEARED
↓
释放棋盘空间
↓
Completion Reflow
↓
DISH_SERVED
```

完成 Dish 必须产生明显的：

# 大空间释放

这是整个 Drop 循环最重要的正反馈之一。

---

# 14. 餐厅系统的位置

餐厅系统属于：

# Meta Goal Layer

而不是：

# Core Manipulation Layer

Jigsaw Drop Core 负责：

```text
Piece
Group
Board
Drop
Merge
Complete
Clear
Reflow
```

Restaurant Layer 负责：

```text
Order
Prepared Dish
Revenue
Business Goal
Cascade
Day Progression
```

两者通过：

```text
DISH_SERVED
```

连接。

---

# 15. 当前订单的作用

订单不是：

> 命令棋盘只能生成这一道菜。

订单的作用是：

> 告诉玩家当前完成哪张图片最直接有价值。

所以：

```text
Current Order
↓
可以影响 Supply 权重
↓
可以影响视觉提示
↓
可以决定立即出餐还是备餐
```

但不得：

```text
Current Order
↓
锁死其它图片
```

---

# 16. Prepared Dish Buffer

如果玩家先完成了一道：

```text
不是当前订单需要的菜
```

不应处罚玩家。

完成的 Dish 可以进入：

```text
PreparedDishBuffer
```

当前实现容量：

```text
2
```

它的设计意义是：

> 玩家可以因为当前棋盘局面，提前完成未来可能需要的菜。

这使“整理哪张图”不完全被当前订单绑死。

---

# 17. Production Cascade

Prepared Dish 不是独立收集系统。

它服务于：

# Production Cascade

基本链条：

```text
完成当前订单
↓
新订单出现
↓
PreparedDishBuffer 中正好已有对应 Dish
↓
立即出餐
↓
下一订单
↓
如果再次命中
↓
继续 Cascade
```

这属于外围奖励闭环。

不得再额外创造第二套：

```text
Combo
连击
连单系统
```

Production Cascade 本身就是这一功能。

---

# 18. 营业目标

一局 / Day 的宏观目标：

```text
Revenue >= Business Goal
```

达到目标：

```text
DAY_CLEARED
```

因此游戏有：

> 长期营业目标。

但没有：

> 单局倒计时。

---

# 19. 猫的正确定位

Cat Actor 不是 Gameplay Actor。

Cat Actor 是：

# Ambient Presentation Actor

即：

```text
游戏事件
↓
猫做反应
```

而不是：

```text
玩家操作猫
↓
猫产生游戏状态
```

允许：

```text
订单等待 → Idle
玩家拼图过程中 → Chop / Stir 等环境动作
完成菜 → Pass
完成营业 → Win
```

这些动作只负责：

- 增加生命感；
- 表示餐厅正在运作；
- 给拼图事件增加反馈。

禁止让猫产生新的玩法要求。

---

# 20. Printer 的正确定位

Printer 同样属于：

# Presentation + Order UI

负责：

```text
订单出现
↓
打印 / 吐纸
```

它可以表现：

- 当前订单；
- 订单更替；
- 订单完成。

不得变成：

- 点击打印机领取任务；
- 管理订单队列；
- 打印小游戏。

---

# 21. Cat 与 Printer 必须完全独立

两者不应成为一个大动画。

结构应保持：

```text
Puzzle Board

Printer Actor
独立

Cat Actor
独立
```

它们只通过游戏事件同步。

Stage 4.2 / 4.3 已经建立的 Sealed Actor Clip 方向继续保留。

---

# 22. 当前 UI 主次关系

屏幕绝对主角：

# Puzzle Board

右侧 / 边缘厨房环境属于：

# Ambient Area

之前确定的窄条布局方向继续成立：

```text
约 79%：
Puzzle Gameplay

约 21%：
Printer + Cat + Ambient Kitchen
```

实际尺寸可以适配设备调整。

但视觉主次不得反转。

玩家第一眼必须看见：

> 拼图。

而不是：

> 厨房动画。

---

# 23. 当前新旧 Core 的权威划分

仓库目前存在两代实现。

## Legacy Core

包括：

```text
IngredientTarget
LoosePiece
PrepInventory
FlowDirector
INGREDIENT_COMPLETED
Piece-to-Target
```

它来自项目早期：

> “食材碎片拼成食材”的版本。

---

## Current Gameplay Direction

包括：

```text
DishPuzzlePiece
PieceGroup
DishPuzzleInstance
DishPuzzleManager
DishPieceSupplyScheduler
DISH_COMPLETED
DISH_CLEARED
DISH_SERVED
```

它来自 Gold Sample 后：

> “完整菜品图片的 Jigsaw Drop”版本。

---

# 24. 权威裁决

从本基线开始：

# DishPuzzle 路径是当前玩法设计权威。

Legacy Ingredient Core 可以暂时因为：

- 仿真；
- 旧测试；
- 兼容代码；
- 历史实现；

继续存在。

但是：

**不得再根据 Legacy Ingredient Core 反向修改当前玩法。**

也不得继续为 Legacy Core 增加新玩法能力。

后续需要逐步判断：

```text
保留
迁移
替换
删除
```

而不是让两套系统永久并行演化。

---

# 25. Stage 2 参数的地位修正

`STAGE2_FROZEN_PRESSURE_PROFILE`

和：

`STAGE2_FROZEN_DIRECTOR_PROFILE`

是旧 Ingredient Core 上经过仿真冻结的参数。

它们证明了很多重要设计原则，例如：

- 空间压力需要随操作增加；
- Supply 不能失控；
- 不能产生 Softlock；
- 需要 starvation protection；
- 当前目标可以获得权重；
- 系统必须确定性。

这些：

# 设计原则继续有效。

但是其具体数值：

# 不能自动视为 DishPuzzle 的正式平衡参数。

DishPuzzle 完成迁移以后，应针对新的：

```text
Piece
Group
3×3 Dish
Multi-Image Board
Completion Reflow
```

重新做平衡验证。

---

# 26. 12 Day Progression 的地位修正

仓库现有：

```text
Day 1 ～ Day 12
```

Progression、SaveSystem、Tutorial、Business Goal 等框架可以继续保留。

但是很多：

```text
Recipe
Ingredient
Target Count
Legacy FlowDirector 参数
```

来自旧 Ingredient Core。

因此不能直接把现有 12 Day 内容表视为：

> 已完成的 DishPuzzle 12 关正式内容。

正确状态：

```text
Campaign Framework
已存在

DishPuzzle Content Progression
需要在新 Core 上重新验证
```

尤其不能为了兼容旧 Day 配置而把新玩法重新改回食材拼图。

---

# 27. NEXT ORDER 的地位

仓库原 Stage 3 定义：

```text
Day 7
解锁下一单预告
```

Cocos 当前实现仍按 Day 7 gating。

Web Greybox 当前存在：

```text
Day 1 隐藏
Day 2+ 显示
```

两者冲突。

当前处理原则：

**不得通过修改玩法解决这种冲突。**

应当由 Presentation 向权威 Progression 对齐。

在重新审查 Day Progression 前：

```text
NEXT Order
不得擅自提前成为 Day 1 基础机制。
```

---

# 28. 失败条件

不得加入：

```text
时间耗尽
步数耗尽
订单超时
顾客耐心归零
```

核心失败应来自：

> 棋盘已经无法继续产生合法游戏。

即：

```text
No Legal Board Continuation
```

具体 Deadlock 判定在 DishPuzzle 新 Core 中需要重新验证和实现。

不能因为旧 Ingredient DeadlockDetector 已存在，就默认它已经正确覆盖 DishPuzzle。

---

# 29. 确定性原则

相同：

```text
Seed
+
Game State
+
Player Action
```

应得到可重现结果。

特别是：

- Piece Supply；
- Dish selection；
- Reflow；
- Deadlock；
- Campaign test；

不得由无法复现的随机行为控制。

Presentation 动画可以非权威。

Gameplay State 必须确定。

---

# 30. 禁止玩法漂移清单

后续需求默认禁止加入以下内容，除非重新开启玩法设计阶段：

- 烹饪小游戏；
- 切菜小游戏；
- 搅锅小游戏；
- 灶台操作；
- 顾客耐心值；
- 订单倒计时；
- 总倒计时；
- 步数限制；
- Match-3；
- 合成升级；
- 战斗；
- 技能；
- 猫主动操作；
- 厨房生产线；
- 多个操作界面来回切换；
- 单订单单图片模式；
- 只掉当前订单碎片；
- 每次拖动后全局重力坍塌；
- 把 PreparedDishBuffer 发展成库存管理游戏；
- 再建立一套 Combo 替代 Production Cascade；
- 为动画需求修改拼图规则。

---

# 31. 判断新功能是否合法的唯一测试

以后任何新功能先问：

> 它是否强化了 Jigsaw Drop 的核心循环？

也就是是否强化：

```text
Drop
多图混合
空间判断
Piece Group
目标切换
Complete
Clear
Reflow
空间释放
```

如果答案是：

> 否，它主要让游戏更像厨房经营。

则默认：

# 不加入。

---

# 32. 当前开发优先级

现在不要继续设计新玩法。

当前正确顺序：

## P0：玩法基线修复

将本基线写入仓库正式文档。

同时修正 README，不能继续用旧：

```text
“判断属于哪个食材、拖拽归位”
```

描述当前 Gold Sample。

---

## P1：新旧 Core 权威审计

确认：

```text
Ingredient Core
```

目前还有哪些运行路径真正被使用。

明确：

```text
DishPuzzle Core
```

需要补齐哪些原有能力：

- 空间压力；
- Drop cadence；
- Deadlock；
- Determinism；
- Simulation。

---

## P2：Web / Cocos Parity

检查：

```text
Web Greybox
Cocos
```

是否对同一 Gameplay State 做相同解释。

Presentation 不得自己创造规则。

---

## P3：DishPuzzle Balance

等新 Core 功能完整后，再重新进行：

```text
Monte-Carlo
Synthetic Playtest
Human Playtest
```

重新确定 DishPuzzle 的正式：

- Supply；
- Active Dish 数量；
- Board Occupancy；
- Completion Frequency；
- Starvation；
- Deadlock；
- Recovery；

参数。

---

# 33. 最终一句话基线

本项目的核心不是：

> “经营一家餐厅并做菜。”

而是：

> **“在持续掉落、同时包含多张料理图片的有限棋盘中，不断整理、拼接、切换目标并完成整张料理拼图；完成图片释放空间，而订单、备餐、连续出餐和餐厅动画把这一套 Jigsaw Drop 循环包装成一次餐厅营业。”**

这句话是当前玩法最高层定义。
