import { IngredientDefinition, RecipeDefinition, DayConfig, DEFAULT_PRESSURE_PROFILE, DEFAULT_DIRECTOR_PROFILE } from '../model/Types';

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
      // (0, 1) top-left
      {
        slotId: 'b_0',
        label: '顶皮左',
        relativeCol: 0,
        relativeRow: 1,
        defaultCategory: 'normal',
        edges: { top: 'flat', bottom: 'tab', left: 'flat', right: 'blank' }
      },
      // (1, 1) top-right
      {
        slotId: 'b_1',
        label: '顶皮右',
        relativeCol: 1,
        relativeRow: 1,
        defaultCategory: 'early',
        edges: { top: 'flat', bottom: 'blank', left: 'tab', right: 'flat' }
      },
      // (0, 0) bottom-left
      {
        slotId: 'b_2',
        label: '底芯左',
        relativeCol: 0,
        relativeRow: 0,
        defaultCategory: 'early',
        edges: { top: 'blank', bottom: 'flat', left: 'flat', right: 'tab' }
      },
      // (1, 0) bottom-right
      {
        slotId: 'b_3',
        label: '底芯右',
        relativeCol: 1,
        relativeRow: 0,
        defaultCategory: 'closure',
        edges: { top: 'tab', bottom: 'flat', left: 'blank', right: 'flat' }
      }
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
      // row 2 (top)
      {
        slotId: 'bf_0',
        label: '雪花顶A',
        relativeCol: 0,
        relativeRow: 2,
        defaultCategory: 'early',
        edges: { top: 'flat', bottom: 'tab', left: 'flat', right: 'blank' }
      },
      {
        slotId: 'bf_1',
        label: '雪花顶B',
        relativeCol: 1,
        relativeRow: 2,
        defaultCategory: 'normal',
        edges: { top: 'flat', bottom: 'blank', left: 'tab', right: 'flat' }
      },
      // row 1 (mid)
      {
        slotId: 'bf_2',
        label: '肉眼厚切',
        relativeCol: 0,
        relativeRow: 1,
        defaultCategory: 'normal',
        edges: { top: 'blank', bottom: 'tab', left: 'flat', right: 'tab' }
      },
      {
        slotId: 'bf_3',
        label: '筋膜中段',
        relativeCol: 1,
        relativeRow: 1,
        defaultCategory: 'early',
        edges: { top: 'tab', bottom: 'blank', left: 'blank', right: 'flat' }
      },
      // row 0 (bottom)
      {
        slotId: 'bf_4',
        label: '底排油边',
        relativeCol: 0,
        relativeRow: 0,
        defaultCategory: 'closure',
        edges: { top: 'blank', bottom: 'flat', left: 'flat', right: 'blank' }
      },
      {
        slotId: 'bf_5',
        label: '底排红肉',
        relativeCol: 1,
        relativeRow: 0,
        defaultCategory: 'early',
        edges: { top: 'tab', bottom: 'flat', left: 'tab', right: 'flat' }
      }
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
      { col: 0, row: 2 }, { col: 1, row: 2 }
    ],
    slots: [
      {
        slotId: 'ck_0',
        label: '金黄脆顶',
        relativeCol: 0,
        relativeRow: 2,
        defaultCategory: 'early',
        edges: { top: 'flat', bottom: 'tab', left: 'flat', right: 'tab' }
      },
      {
        slotId: 'ck_1',
        label: '脆皮尖端',
        relativeCol: 1,
        relativeRow: 2,
        defaultCategory: 'normal',
        edges: { top: 'flat', bottom: 'blank', left: 'blank', right: 'flat' }
      },
      {
        slotId: 'ck_2',
        label: '多汁鸡腿',
        relativeCol: 0,
        relativeRow: 1,
        defaultCategory: 'early',
        edges: { top: 'blank', bottom: 'blank', left: 'flat', right: 'tab' }
      },
      {
        slotId: 'ck_3',
        label: '鸡排中肉',
        relativeCol: 1,
        relativeRow: 1,
        defaultCategory: 'normal',
        edges: { top: 'tab', bottom: 'tab', left: 'blank', right: 'flat' }
      },
      {
        slotId: 'ck_4',
        label: '腿骨软骨',
        relativeCol: 0,
        relativeRow: 0,
        defaultCategory: 'closure',
        edges: { top: 'tab', bottom: 'flat', left: 'flat', right: 'blank' }
      },
      {
        slotId: 'ck_5',
        label: '腿根脆骨',
        relativeCol: 1,
        relativeRow: 0,
        defaultCategory: 'early',
        edges: { top: 'blank', bottom: 'flat', left: 'tab', right: 'flat' }
      }
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
      {
        slotId: 'eg_0',
        label: '蛋白顶弧',
        relativeCol: 0,
        relativeRow: 1,
        defaultCategory: 'early',
        edges: { top: 'flat', bottom: 'blank', left: 'flat', right: 'tab' }
      },
      {
        slotId: 'eg_1',
        label: '金黄蛋黄',
        relativeCol: 1,
        relativeRow: 1,
        defaultCategory: 'closure',
        edges: { top: 'flat', bottom: 'tab', left: 'blank', right: 'flat' }
      },
      {
        slotId: 'eg_2',
        label: '溏心半边',
        relativeCol: 0,
        relativeRow: 0,
        defaultCategory: 'normal',
        edges: { top: 'tab', bottom: 'flat', left: 'flat', right: 'blank' }
      },
      {
        slotId: 'eg_3',
        label: '底层蛋白',
        relativeCol: 1,
        relativeRow: 0,
        defaultCategory: 'early',
        edges: { top: 'blank', bottom: 'flat', left: 'tab', right: 'flat' }
      }
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
      // row 1 (top)
      {
        slotId: 'lt_0',
        label: '波浪叶左',
        relativeCol: 0,
        relativeRow: 1,
        defaultCategory: 'early',
        edges: { top: 'flat', bottom: 'tab', left: 'flat', right: 'tab' }
      },
      {
        slotId: 'lt_1',
        label: '鲜嫩叶脉',
        relativeCol: 1,
        relativeRow: 1,
        defaultCategory: 'normal',
        edges: { top: 'flat', bottom: 'blank', left: 'blank', right: 'tab' }
      },
      {
        slotId: 'lt_2',
        label: '波浪叶右',
        relativeCol: 2,
        relativeRow: 1,
        defaultCategory: 'early',
        edges: { top: 'flat', bottom: 'tab', left: 'blank', right: 'flat' }
      },
      // row 0 (bottom)
      {
        slotId: 'lt_3',
        label: '脆嫩梗左',
        relativeCol: 0,
        relativeRow: 0,
        defaultCategory: 'normal',
        edges: { top: 'blank', bottom: 'flat', left: 'flat', right: 'blank' }
      },
      {
        slotId: 'lt_4',
        label: '根部主梗',
        relativeCol: 1,
        relativeRow: 0,
        defaultCategory: 'closure',
        edges: { top: 'tab', bottom: 'flat', left: 'tab', right: 'blank' }
      },
      {
        slotId: 'lt_5',
        label: '脆嫩梗右',
        relativeCol: 2,
        relativeRow: 0,
        defaultCategory: 'early',
        edges: { top: 'blank', bottom: 'flat', left: 'tab', right: 'flat' }
      }
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
      {
        slotId: 'tm_0',
        label: '绿蒂叶冠',
        relativeCol: 0,
        relativeRow: 1,
        defaultCategory: 'closure',
        edges: { top: 'flat', bottom: 'tab', left: 'flat', right: 'blank' }
      },
      {
        slotId: 'tm_1',
        label: '红润果顶',
        relativeCol: 1,
        relativeRow: 1,
        defaultCategory: 'early',
        edges: { top: 'flat', bottom: 'blank', left: 'tab', right: 'flat' }
      },
      {
        slotId: 'tm_2',
        label: '多汁沙瓤',
        relativeCol: 0,
        relativeRow: 0,
        defaultCategory: 'normal',
        edges: { top: 'blank', bottom: 'flat', left: 'flat', right: 'tab' }
      },
      {
        slotId: 'tm_3',
        label: '果实下底',
        relativeCol: 1,
        relativeRow: 0,
        defaultCategory: 'early',
        edges: { top: 'tab', bottom: 'flat', left: 'blank', right: 'flat' }
      }
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
      {
        slotId: 'rc_0',
        label: '饱满米尖',
        relativeCol: 0,
        relativeRow: 2,
        defaultCategory: 'early',
        edges: { top: 'flat', bottom: 'blank', left: 'flat', right: 'tab' }
      },
      {
        slotId: 'rc_1',
        label: '热气白烟',
        relativeCol: 1,
        relativeRow: 2,
        defaultCategory: 'closure',
        edges: { top: 'flat', bottom: 'tab', left: 'blank', right: 'flat' }
      },
      {
        slotId: 'rc_2',
        label: '米粒核心A',
        relativeCol: 0,
        relativeRow: 1,
        defaultCategory: 'normal',
        edges: { top: 'tab', bottom: 'blank', left: 'flat', right: 'blank' }
      },
      {
        slotId: 'rc_3',
        label: '米粒核心B',
        relativeCol: 1,
        relativeRow: 1,
        defaultCategory: 'normal',
        edges: { top: 'blank', bottom: 'tab', left: 'tab', right: 'flat' }
      },
      {
        slotId: 'rc_4',
        label: '温润碗底A',
        relativeCol: 0,
        relativeRow: 0,
        defaultCategory: 'early',
        edges: { top: 'tab', bottom: 'flat', left: 'flat', right: 'tab' }
      },
      {
        slotId: 'rc_5',
        label: '温润碗底B',
        relativeCol: 1,
        relativeRow: 0,
        defaultCategory: 'early',
        edges: { top: 'blank', bottom: 'flat', left: 'blank', right: 'flat' }
      }
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
      {
        slotId: 'nd_0',
        label: '拉面顶弧',
        relativeCol: 0,
        relativeRow: 2,
        defaultCategory: 'early',
        edges: { top: 'flat', bottom: 'tab', left: 'flat', right: 'blank' }
      },
      {
        slotId: 'nd_1',
        label: '浓郁汤顶',
        relativeCol: 1,
        relativeRow: 2,
        defaultCategory: 'closure',
        edges: { top: 'flat', bottom: 'blank', left: 'tab', right: 'flat' }
      },
      {
        slotId: 'nd_2',
        label: '筋道回环',
        relativeCol: 0,
        relativeRow: 1,
        defaultCategory: 'normal',
        edges: { top: 'blank', bottom: 'tab', left: 'flat', right: 'tab' }
      },
      {
        slotId: 'nd_3',
        label: '汤汁主干',
        relativeCol: 1,
        relativeRow: 1,
        defaultCategory: 'early',
        edges: { top: 'tab', bottom: 'blank', left: 'blank', right: 'flat' }
      },
      {
        slotId: 'nd_4',
        label: '碗底面丝A',
        relativeCol: 0,
        relativeRow: 0,
        defaultCategory: 'early',
        edges: { top: 'blank', bottom: 'flat', left: 'flat', right: 'blank' }
      },
      {
        slotId: 'nd_5',
        label: '碗底面丝B',
        relativeCol: 1,
        relativeRow: 0,
        defaultCategory: 'normal',
        edges: { top: 'tab', bottom: 'flat', left: 'tab', right: 'flat' }
      }
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
      {
        slotId: 'ch_0',
        label: '三角尖端',
        relativeCol: 0,
        relativeRow: 1,
        defaultCategory: 'early',
        edges: { top: 'flat', bottom: 'tab', left: 'flat', right: 'blank' }
      },
      {
        slotId: 'ch_1',
        label: '气孔切面',
        relativeCol: 1,
        relativeRow: 1,
        defaultCategory: 'closure',
        edges: { top: 'flat', bottom: 'blank', left: 'tab', right: 'flat' }
      },
      {
        slotId: 'ch_2',
        label: '浓香奶酪',
        relativeCol: 0,
        relativeRow: 0,
        defaultCategory: 'normal',
        edges: { top: 'blank', bottom: 'flat', left: 'flat', right: 'tab' }
      },
      {
        slotId: 'ch_3',
        label: '融化边角',
        relativeCol: 1,
        relativeRow: 0,
        defaultCategory: 'early',
        edges: { top: 'tab', bottom: 'flat', left: 'blank', right: 'flat' }
      }
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
      {
        slotId: 'pt_0',
        label: '椭圆顶部',
        relativeCol: 0,
        relativeRow: 1,
        defaultCategory: 'early',
        edges: { top: 'flat', bottom: 'blank', left: 'flat', right: 'tab' }
      },
      {
        slotId: 'pt_1',
        label: '泥土斑点',
        relativeCol: 1,
        relativeRow: 1,
        defaultCategory: 'normal',
        edges: { top: 'flat', bottom: 'tab', left: 'blank', right: 'flat' }
      },
      {
        slotId: 'pt_2',
        label: '沙面切面',
        relativeCol: 0,
        relativeRow: 0,
        defaultCategory: 'early',
        edges: { top: 'tab', bottom: 'flat', left: 'flat', right: 'blank' }
      },
      {
        slotId: 'pt_3',
        label: '金黄内部',
        relativeCol: 1,
        relativeRow: 0,
        defaultCategory: 'closure',
        edges: { top: 'blank', bottom: 'flat', left: 'tab', right: 'flat' }
      }
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
    loosePieceComfortMax: 8,
    pressureProfile: { ...DEFAULT_PRESSURE_PROFILE },
    directorProfile: { ...DEFAULT_DIRECTOR_PROFILE }
  },
  {
    dayNumber: 2,
    businessGoal: 650,
    availableRecipeIds: ['salad', 'sandwich', 'burger', 'fries_basket'],
    recipeWeights: { salad: 2, sandwich: 3, burger: 2, fries_basket: 2 },
    targetIngredientCount: 4,
    loosePieceComfortMin: 6,
    loosePieceComfortMax: 9,
    pressureProfile: { ...DEFAULT_PRESSURE_PROFILE },
    directorProfile: { ...DEFAULT_DIRECTOR_PROFILE }
  },
  {
    dayNumber: 3,
    businessGoal: 900,
    availableRecipeIds: ['sandwich', 'burger', 'chicken_burger', 'beef_noodle', 'fried_rice'],
    recipeWeights: { sandwich: 2, burger: 3, chicken_burger: 2, beef_noodle: 3, fried_rice: 2 },
    targetIngredientCount: 4,
    loosePieceComfortMin: 6,
    loosePieceComfortMax: 9,
    pressureProfile: { ...DEFAULT_PRESSURE_PROFILE },
    directorProfile: { ...DEFAULT_DIRECTOR_PROFILE }
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
    loosePieceComfortMax: 9,
    pressureProfile: { ...DEFAULT_PRESSURE_PROFILE },
    directorProfile: { ...DEFAULT_DIRECTOR_PROFILE }
  }
];
