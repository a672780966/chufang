# Stage 5B Round 2A: Dish Asset Expansion & Visual Classification Set Report

## 一、阶段执行成果概览

在 **Stage 5B Round 2A** 中，我们严格遵循 Jigsaw Drop 核心规范，将正式可拼 Dish 从原有的 **3 道 Gold Sample 扩展至 8 道高品质手绘风格完整可运行菜品**。

- **新增 5 道正式菜品**：金黄咖喱饭、番茄肉酱意面、牛油果鸡肉碗、鲜虾蛋炒饭、炭烤牛排拼盘；
- **全管线切片与图集**：1024×1024 Master 原画通过确定性三次贝塞尔互补卡口算法（Deterministic Bezier Tab/Blank Complementary Slicing）裁切为 72 个独立卡纸拼图碎片（8 × 9）与 8 个 Atlas PNG/JSON 图集；
- **双端 1:1 绝对一致性**：Web (`packages/web-greybox/public/assets/dishes/`) 与 Cocos (`cocos-app/assets/textures/dishes/`) 96 个资产文件字节级完全一致；
- **权威数据源统一**：`DishManifest.ts` 与 `DishCatalog.ts` 统一收录 8 道菜品，同时保留向后兼容别名 `GOLD_SAMPLE_DISH_CATALOG` / `GOLD_SAMPLE_DISH_MANIFEST`；
- **全量自动化测试**：新增 5 组针对性测试套件，全仓库 **104/104 项测试（37 个测试套件）100% PASS**，TypeScript 0 编译错误；
- **真实 CDP 录屏产出**：通过 Chrome DevTools Protocol 录制 3 部真实棋盘交互与结算 MP4 视频。

---

## 二、8 道正式可拼 Dish 资产矩阵

| 菜品 ID | 中文名称 | 分类 | 基础售价 | 视觉难度 | Master SHA256 (首16位) | 碎片数 | 边框/容器特征 |
| :--- | :--- | :--- | :---: | :---: | :--- | :---: | :--- |
| `dish_breakfast` | 春日早餐盘 | Breakfast | ¥85 | MEDIUM | `80342B5EC130F05C...` | 9 | 圆形白瓷盘，吐司/流心蛋/培根 |
| `dish_salad` | 田园沙拉 | Salad | ¥70 | MEDIUM | `464DBA9C95C00C3B...` | 9 | 浅青瓷陶碗，生菜/溏心蛋/玉米粒 |
| `dish_ramen` | 豚骨拉面 | Ramen | ¥90 | EASY | `7FCE8C677B219096...` | 9 | 蓝白传统拉面碗，琥珀汤/叉烧/鸣门卷 |
| `dish_curry_rice` | 金黄咖喱饭 | Curry | ¥80 | MEDIUM | `4F0A8858993F1456...` | 9 | 椭圆白瓷深盘，白米饭/浓金咖喱肉块 |
| `dish_tomato_pasta` | 番茄肉酱意面 | Pasta | ¥85 | EASY | `2BFB574724716E4B...` | 9 | 圆形浅口意面碗，朱红肉酱/螺旋面/干酪 |
| `dish_avocado_chicken_bowl` | 牛油果鸡肉碗 | Healthy | ¥95 | HARD | `84505167BBD5B715...` | 9 | 粗陶日式钵，扇形牛油果/烤鸡胸/紫甘蓝 |
| `dish_shrimp_fried_rice` | 鲜虾蛋炒饭 | Rice | ¥75 | HARD | `E3CA60877A28C145...` | 9 | 深宝蓝釉面盘，金黄炒饭/粉虾/青豆 |
| `dish_grilled_steak` | 炭烤牛排拼盘 | Steak | ¥110 | MEDIUM | `680D0BA523796492...` | 9 | 浅米灰大平盘，焦黑菱形烤痕/芦笋/土豆 |

---

## 三、视觉混淆度与分类覆盖度论证

> **核心问题：为什么这 8 道菜品足以支撑 Jigsaw Drop 核心体验的验证？**

单图与多图拼图的核心分水岭在于**视觉分类（Visual Classification）与注意力分流（Attention Disambiguation）**。如果所有菜品底色反差过大（例如红、蓝、绿），玩家只需依靠色块直觉盲拼，丢失了拼图游戏的“找件、读纹理、比对咬合”乐趣；而如果所有菜品缺乏排他特征，则会退化为辨识疲劳。

这 8 道菜品构成了精心设计的 **多维视觉辨识矩阵**：

1. **同色系高阶干扰对 (Warm Yellow Family)**：
   - `dish_breakfast` vs `dish_curry_rice` vs `dish_shrimp_fried_rice`
   - 三者均具有大量金黄与米白像素。玩家必须依靠**椭圆盘沿弧度**（咖喱）、**宝蓝深色盘沿**（炒饭）、**吐司焦边与培根**（早餐盘）进行第二层特征过滤。
2. **生鲜蔬果高阶干扰对 (Fresh Green Family)**：
   - `dish_salad` vs `dish_avocado_chicken_bowl`
   - 两者均为绿色系碗装健康轻食。玩家依靠**平滑切刀牛油果扇面 + 紫甘蓝排他条纹**（鸡肉碗）与**羽状卷曲生菜 + 整颗番茄块**（沙拉）实现快速区隔。
3. **主食面食轮廓对照 (Noodle / Broth Family)**：
   - `dish_ramen` vs `dish_tomato_pasta`
   - 汤面与干拌肉酱面的视觉对比，前者拥有琥珀液态流体感，后者为致密旋转线圈与鲜艳番茄红酱。
4. **重色下沉锚点 (Dark Savory Cluster)**：
   - `dish_grilled_steak`
   - 焦褐肉排与醒目菱形烤印在棋盘上形成明显的视觉重心，为多图混杂时的空间整理提供清晰的坐标参考。

---

## 四、自动化测试套件与覆盖指标

全量测试位于 `packages/game-core/test/`，共 37 个测试套件，104 个用例全部通过：

1. **[`DishAssetCatalog.test.ts`](file:///c:/Users/admin/Music/chufang/packages/game-core/test/DishAssetCatalog.test.ts)**：
   - 验证 `DISH_CATALOG` 注册全部 8 道菜品，校验每道菜品名称、单价、emoji、分类、visualDifficulty；
   - 验证 `GOLD_SAMPLE_DISH_CATALOG` 保持 3 道原始菜品兼容别名。
2. **[`DishManifestIntegrity.test.ts`](file:///c:/Users/admin/Music/chufang/packages/game-core/test/DishManifestIntegrity.test.ts)**：
   - 验证 `DISH_MANIFEST` 注册全部 8 道菜品，校验提示词、约束、3×3 规格与 64 位大写十六进制 SHA256；
   - 读取磁盘实际 master 文件，计算 SHA256 校验码并严格比对，**8 道菜品哈希 100% 字节匹配**。
3. **[`DishAtlasIntegrity.test.ts`](file:///c:/Users/admin/Music/chufang/packages/game-core/test/DishAtlasIntegrity.test.ts)**：
   - 检验 8 道菜品的 `atlas_<id>.png` 与 `atlas_<id>.json` 元数据；
   - 验证 72 个碎片的 slotId、col、row、edges（外边缘 flat 校验）和 atlasRect 坐标无重叠。
4. **[`EightDishRuntime.test.ts`](file:///c:/Users/admin/Music/chufang/packages/game-core/test/EightDishRuntime.test.ts)**：
   - 验证 `DishPuzzleManager` 实例创建、碎片生成、卡口互补计算对 8 道菜品完全通用；
   - 验证新菜品（如 `dish_curry_rice`）9 块装配后正确触发 `DISH_COMPLETED` 与即时清理；
   - 验证 `OrderBag` 在多菜品权重配置下能够均匀且确定性地出单。
5. **[`DishAssetParity.test.ts`](file:///c:/Users/admin/Music/chufang/packages/game-core/test/DishAssetParity.test.ts)**：
   - 检验 Web 目录与 Cocos 目录对应文件，**96 个文件全部逐字节相等**。

---

## 五、CDP 实机视频录制与验收文件

通过 Chrome DevTools Protocol 配合原生 FFmpeg 编码生成的实机视频与 QA Sheet：

1. **`stage5b_r2a_new_dishes_board.mp4`**：
   - 展示金黄咖喱饭、番茄肉酱意面、牛油果鸡肉碗在棋盘上的实际拼装与贝塞尔咬合吸附。
2. **`stage5b_r2a_mixed_three_dish.mp4`**：
   - 运行 Triad C（田园沙拉 + 牛油果鸡肉碗 + 炭烤牛排拼盘）混杂场景，演示玩家对同色系碎片的准确归类与拖拽聚合。
3. **`stage5b_r2a_complete_each_new_dish.mp4`**：
   - 演示金黄咖喱饭与番茄肉酱意面的最终拼合、庆典高光、9 片立即清除、端出上菜及飘字入账全流程。

### 配套审查图表与数据报告：
- **8 菜全原画审查单**：`docs/dish_set_8_master_contact_sheet.png`
- **24 片混搭辨识测试单**：`docs/dish_set_8_mixed_piece_test.png`
- **8 道菜独立拼图切片 QA 单**：`docs/dish_dish_<id>_jigsaw_qa.png` (共 8 张)
- **视觉混淆度矩阵文档**：`docs/stage5b_round2a_visual_confusion_matrix.md`
- **资产哈希比对报表**：`docs/stage5b_round2a_asset_hash_report.json`
