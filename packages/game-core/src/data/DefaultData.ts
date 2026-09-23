import { IngredientDefinition, RecipeDefinition, DayConfig } from '../model/Types.js';

export const DEFAULT_INGREDIENTS: Record<string, IngredientDefinition> = {
  bread: {
    id: 'bread',
    name: '面包',
    emoji: '🍞',
    color: '#D4A373',
    width: 2,
    height: 2,
    footprint: [
      { col: 0, row: 0 }, { col: 1, row: 0 },
      { col: 0, row: 1 }, { col: 1, row: 1 }
    ],
    slots: [
      { slotId: 'b_0', label: '顶层面包皮', relativeCol: 0, relativeRow: 1, defaultCategory: 'normal' },
      { slotId: 'b_1', label: '麦香切面', relativeCol: 1, relativeRow: 1, defaultCategory: 'early' },
      { slotId: 'b_2', label: '松软芯部', relativeCol: 0, relativeRow: 0, defaultCategory: 'early' },
      { slotId: 'b_3', label: '底层面包片', relativeCol: 1, relativeRow: 0, defaultCategory: 'closure' }
    ]
  },
  beef: {
    id: 'beef',
    name: '牛肉',
    emoji: '🥩',
    color: '#9C3D54',
    width: 2,
    height: 3,
    footprint: [
      { col: 0, row: 0 }, { col: 1, row: 0 },
      { col: 0, row: 1 }, { col: 1, row: 1 },
      { col: 0, row: 2 }, { col: 1, row: 2 }
    ],
    slots: [
      { slotId: 'bf_0', label: '雪花纹理', relativeCol: 0, relativeRow: 2, defaultCategory: 'early' },
      { slotId: 'bf_1', label: '肉眼中心', relativeCol: 1, relativeRow: 2, defaultCategory: 'normal' },
      { slotId: 'bf_2', label: '厚切肉排', relativeCol: 0, relativeRow: 1, defaultCategory: 'normal' },
      { slotId: 'bf_3', label: '筋膜边缘', relativeCol: 1, relativeRow: 1, defaultCategory: 'early' },
      { slotId: 'bf_4', label: '底部油脂', relativeCol: 0, relativeRow: 0, defaultCategory: 'closure' }
    ]
  },
  chicken: {
    id: 'chicken',
    name: '鸡肉',
    emoji: '🍗',
    color: '#E09F3E',
    width: 2,
    height: 3,
    footprint: [
      { col: 0, row: 0 }, { col: 1, row: 0 },
      { col: 0, row: 1 }, { col: 1, row: 1 },
      { col: 0, row: 2 }
    ],
    slots: [
      { slotId: 'ck_0', label: '脆皮顶端', relativeCol: 0, relativeRow: 2, defaultCategory: 'early' },
      { slotId: 'ck_1', label: '多汁鸡肉A', relativeCol: 0, relativeRow: 1, defaultCategory: 'normal' },
      { slotId: 'ck_2', label: '多汁鸡肉B', relativeCol: 1, relativeRow: 1, defaultCategory: 'early' },
      { slotId: 'ck_3', label: '腿骨', relativeCol: 0, relativeRow: 0, defaultCategory: 'closure' },
      { slotId: 'ck_4', label: '关节软骨', relativeCol: 1, relativeRow: 0, defaultCategory: 'normal' }
    ]
  },
  egg: {
    id: 'egg',
    name: '鸡蛋',
    emoji: '🥚',
    color: '#FFF3B0',
    width: 2,
    height: 2,
    footprint: [
      { col: 0, row: 0 }, { col: 1, row: 0 },
      { col: 0, row: 1 }, { col: 1, row: 1 }
    ],
    slots: [
      { slotId: 'eg_0', label: '蛋白顶弧', relativeCol: 0, relativeRow: 1, defaultCategory: 'early' },
      { slotId: 'eg_1', label: '金黄蛋黄', relativeCol: 1, relativeRow: 1, defaultCategory: 'closure' },
      { slotId: 'eg_2', label: '溏心半边', relativeCol: 0, relativeRow: 0, defaultCategory: 'normal' },
      { slotId: 'eg_3', label: '底层蛋白', relativeCol: 1, relativeRow: 0, defaultCategory: 'early' }
    ]
  },
  lettuce: {
    id: 'lettuce',
    name: '生菜',
    emoji: '🥬',
    color: '#588157',
    width: 3,
    height: 2,
    footprint: [
      { col: 0, row: 0 }, { col: 1, row: 0 }, { col: 2, row: 0 },
      { col: 0, row: 1 }, { col: 1, row: 1 }, { col: 2, row: 1 }
    ],
    slots: [
      { slotId: 'lt_0', label: '波浪叶尖A', relativeCol: 0, relativeRow: 1, defaultCategory: 'early' },
      { slotId: 'lt_1', label: '鲜嫩叶脉', relativeCol: 1, relativeRow: 1, defaultCategory: 'normal' },
      { slotId: 'lt_2', label: '波浪叶尖B', relativeCol: 2, relativeRow: 1, defaultCategory: 'early' },
      { slotId: 'lt_3', label: '脆嫩菜梗', relativeCol: 0, relativeRow: 0, defaultCategory: 'normal' },
      { slotId: 'lt_4', label: '根部菜梗', relativeCol: 1, relativeRow: 0, defaultCategory: 'closure' }
    ]
  },
  tomato: {
    id: 'tomato',
    name: '番茄',
    emoji: '🍅',
    color: '#E63946',
    width: 2,
    height: 2,
    footprint: [
      { col: 0, row: 0 }, { col: 1, row: 0 },
      { col: 0, row: 1 }, { col: 1, row: 1 }
    ],
    slots: [
      { slotId: 'tm_0', label: '绿蒂', relativeCol: 0, relativeRow: 1, defaultCategory: 'closure' },
      { slotId: 'tm_1', label: '红润果顶', relativeCol: 1, relativeRow: 1, defaultCategory: 'early' },
      { slotId: 'tm_2', label: '多汁果肉', relativeCol: 0, relativeRow: 0, defaultCategory: 'normal' },
      { slotId: 'tm_3', label: '番茄切片', relativeCol: 1, relativeRow: 0, defaultCategory: 'early' }
    ]
  },
  rice: {
    id: 'rice',
    name: '米饭',
    emoji: '🍚',
    color: '#F4F1DE',
    width: 2,
    height: 3,
    footprint: [
      { col: 0, row: 0 }, { col: 1, row: 0 },
      { col: 0, row: 1 }, { col: 1, row: 1 },
      { col: 0, row: 2 }, { col: 1, row: 2 }
    ],
    slots: [
      { slotId: 'rc_0', label: '饱满米尖', relativeCol: 0, relativeRow: 2, defaultCategory: 'early' },
      { slotId: 'rc_1', label: '米粒核心A', relativeCol: 1, relativeRow: 2, defaultCategory: 'normal' },
      { slotId: 'rc_2', label: '热气白烟', relativeCol: 0, relativeRow: 1, defaultCategory: 'closure' },
      { slotId: 'rc_3', label: '米粒核心B', relativeCol: 1, relativeRow: 1, defaultCategory: 'normal' },
      { slotId: 'rc_4', label: '温润碗底A', relativeCol: 0, relativeRow: 0, defaultCategory: 'early' },
      { slotId: 'rc_5', label: '温润碗底B', relativeCol: 1, relativeRow: 0, defaultCategory: 'early' }
    ]
  },
  noodle: {
    id: 'noodle',
    name: '面条',
    emoji: '🍜',
    color: '#E9C46A',
    width: 2,
    height: 3,
    footprint: [
      { col: 0, row: 0 }, { col: 1, row: 0 },
      { col: 0, row: 1 }, { col: 1, row: 1 },
      { col: 0, row: 2 }, { col: 1, row: 2 }
    ],
    slots: [
      { slotId: 'nd_0', label: '弯曲面丝A', relativeCol: 0, relativeRow: 2, defaultCategory: 'early' },
      { slotId: 'nd_1', label: '浓郁汤面', relativeCol: 1, relativeRow: 2, defaultCategory: 'closure' },
      { slotId: 'nd_2', label: '拉面回环', relativeCol: 0, relativeRow: 1, defaultCategory: 'normal' },
      { slotId: 'nd_3', label: '筋道主干', relativeCol: 1, relativeRow: 1, defaultCategory: 'early' },
      { slotId: 'nd_4', label: '碗底面聚A', relativeCol: 0, relativeRow: 0, defaultCategory: 'early' },
      { slotId: 'nd_5', label: '碗底面聚B', relativeCol: 1, relativeRow: 0, defaultCategory: 'normal' }
    ]
  },
  cheese: {
    id: 'cheese',
    name: '芝士',
    emoji: '🧀',
    color: '#F9C74F',
    width: 2,
    height: 2,
    footprint: [
      { col: 0, row: 0 }, { col: 1, row: 0 },
      { col: 0, row: 1 }, { col: 1, row: 1 }
    ],
    slots: [
      { slotId: 'ch_0', label: '三角尖端', relativeCol: 0, relativeRow: 1, defaultCategory: 'early' },
      { slotId: 'ch_1', label: '气孔切面', relativeCol: 1, relativeRow: 1, defaultCategory: 'closure' },
      { slotId: 'ch_2', label: '浓香奶酪块', relativeCol: 0, relativeRow: 0, defaultCategory: 'normal' },
      { slotId: 'ch_3', label: '融化边缘', relativeCol: 1, relativeRow: 0, defaultCategory: 'early' }
    ]
  },
  potato: {
    id: 'potato',
    name: '土豆',
    emoji: '🥔',
    color: '#C6AC8F',
    width: 2,
    height: 2,
    footprint: [
      { col: 0, row: 0 }, { col: 1, row: 0 },
      { col: 0, row: 1 }, { col: 1, row: 1 }
    ],
    slots: [
      { slotId: 'pt_0', label: '椭圆顶部', relativeCol: 0, relativeRow: 1, defaultCategory: 'early' },
      { slotId: 'pt_1', label: '泥土斑点', relativeCol: 1, relativeRow: 1, defaultCategory: 'normal' },
      { slotId: 'pt_2', label: '沙面切面', relativeCol: 0, relativeRow: 0, defaultCategory: 'early' },
      { slotId: 'pt_3', label: '金黄内部', relativeCol: 1, relativeRow: 0, defaultCategory: 'closure' }
    ]
  }
};

export const DEFAULT_RECIPES: Record<string, RecipeDefinition> = {
  salad: {
    id: 'salad',
    name: '田园沙拉',
    emoji: '🥗',
    baseRevenue: 70,
    requirements: [
      { ingredientId: 'lettuce', count: 1 },
      { ingredientId: 'tomato', count: 1 },
      { ingredientId: 'egg', count: 1 }
    ]
  },
  sandwich: {
    id: 'sandwich',
    name: '经典三明治',
    emoji: '🥪',
    baseRevenue: 100,
    requirements: [
      { ingredientId: 'bread', count: 1 },
      { ingredientId: 'egg', count: 1 },
      { ingredientId: 'lettuce', count: 1 },
      { ingredientId: 'cheese', count: 1 }
    ]
  },
  burger: {
    id: 'burger',
    name: '双层芝士汉堡',
    emoji: '🍔',
    baseRevenue: 130,
    requirements: [
      { ingredientId: 'bread', count: 1 },
      { ingredientId: 'beef', count: 1 },
      { ingredientId: 'lettuce', count: 1 },
      { ingredientId: 'tomato', count: 1 },
      { ingredientId: 'cheese', count: 1 }
    ]
  },
  chicken_burger: {
    id: 'chicken_burger',
    name: '脆皮鸡肉堡',
    emoji: '🍗',
    baseRevenue: 120,
    requirements: [
      { ingredientId: 'bread', count: 1 },
      { ingredientId: 'chicken', count: 1 },
      { ingredientId: 'lettuce', count: 1 },
      { ingredientId: 'tomato', count: 1 }
    ]
  },
  beef_noodle: {
    id: 'beef_noodle',
    name: '招牌红烧牛肉面',
    emoji: '🍜',
    baseRevenue: 150,
    requirements: [
      { ingredientId: 'noodle', count: 1 },
      { ingredientId: 'beef', count: 1 },
      { ingredientId: 'egg', count: 1 },
      { ingredientId: 'tomato', count: 1 }
    ]
  },
  chicken_noodle: {
    id: 'chicken_noodle',
    name: '浓汤鸡肉面',
    emoji: '🍲',
    baseRevenue: 130,
    requirements: [
      { ingredientId: 'noodle', count: 1 },
      { ingredientId: 'chicken', count: 1 },
      { ingredientId: 'egg', count: 1 }
    ]
  },
  fried_rice: {
    id: 'fried_rice',
    name: '黄金蛋炒饭',
    emoji: '🍳',
    baseRevenue: 90,
    requirements: [
      { ingredientId: 'rice', count: 1 },
      { ingredientId: 'egg', count: 1 },
      { ingredientId: 'lettuce', count: 1 }
    ]
  },
  beef_rice: {
    id: 'beef_rice',
    name: '日式牛肉盖饭',
    emoji: '🍱',
    baseRevenue: 140,
    requirements: [
      { ingredientId: 'rice', count: 1 },
      { ingredientId: 'beef', count: 1 },
      { ingredientId: 'egg', count: 1 }
    ]
  },
  fries_basket: {
    id: 'fries_basket',
    name: '芝士薯条拼盘',
    emoji: '🍟',
    baseRevenue: 60,
    requirements: [
      { ingredientId: 'potato', count: 1 },
      { ingredientId: 'cheese', count: 1 }
    ]
  },
  deluxe_bento: {
    id: 'deluxe_bento',
    name: '全家福豪华便当',
    emoji: '🍱',
    baseRevenue: 180,
    requirements: [
      { ingredientId: 'rice', count: 1 },
      { ingredientId: 'beef', count: 1 },
      { ingredientId: 'chicken', count: 1 },
      { ingredientId: 'egg', count: 1 }
    ]
  }
};

export const DEFAULT_DAYS: DayConfig[] = [
  {
    dayNumber: 1,
    businessGoal: 400,
    availableRecipeIds: ['salad', 'sandwich'],
    recipeWeights: { salad: 3, sandwich: 3 },
    targetIngredientCount: 3,
    loosePieceComfortMin: 5,
    loosePieceComfortMax: 7
  },
  {
    dayNumber: 2,
    businessGoal: 650,
    availableRecipeIds: ['salad', 'sandwich', 'burger', 'fries_basket'],
    recipeWeights: { salad: 2, sandwich: 3, burger: 2, fries_basket: 2 },
    targetIngredientCount: 4,
    loosePieceComfortMin: 6,
    loosePieceComfortMax: 8
  },
  {
    dayNumber: 3,
    businessGoal: 900,
    availableRecipeIds: ['sandwich', 'burger', 'chicken_burger', 'beef_noodle', 'fried_rice'],
    recipeWeights: { sandwich: 2, burger: 3, chicken_burger: 2, beef_noodle: 3, fried_rice: 2 },
    targetIngredientCount: 4,
    loosePieceComfortMin: 6,
    loosePieceComfortMax: 8
  },
  {
    dayNumber: 4,
    businessGoal: 1200,
    availableRecipeIds: [
      'burger',
      'chicken_burger',
      'beef_noodle',
      'chicken_noodle',
      'fried_rice',
      'beef_rice',
      'deluxe_bento'
    ],
    recipeWeights: {
      burger: 2,
      chicken_burger: 2,
      beef_noodle: 3,
      chicken_noodle: 2,
      fried_rice: 2,
      beef_rice: 3,
      deluxe_bento: 2
    },
    targetIngredientCount: 4,
    loosePieceComfortMin: 6,
    loosePieceComfortMax: 8
  }
];
