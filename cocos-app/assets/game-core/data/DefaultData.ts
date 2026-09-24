import {
  IngredientDefinition,
  RecipeDefinition,
  DayConfig,
  STAGE2_FROZEN_PRESSURE_PROFILE,
  STAGE2_FROZEN_DIRECTOR_PROFILE,
  DEFAULT_PRESSURE_PROFILE,
  DEFAULT_DIRECTOR_PROFILE
} from '../model/Types';

export const DEFAULT_INGREDIENTS: Record<string, IngredientDefinition> = {
  // 1. 面包 (Bread) - 2x2, Simple (4 pcs)
  bread: {
    id: 'bread',
    name: '面包',
    displayName: '黄金吐司',
    emoji: '🍞',
    color: '#D4A373',
    sourceAsset: 'assets/textures/ingredients/bread.png',
    difficultyClass: 'Simple',
    unlockDay: 1,
    visualPalette: {
      primary: '#D4A373',
      secondary: '#FAEDCD',
      accent: '#BC6C25',
      stroke: '#582F0E',
      shadow: 'rgba(88, 47, 14, 0.25)'
    },
    width: 2,
    height: 2,
    footprint: [
      { col: 0, row: 0 }, { col: 1, row: 0 },
      { col: 0, row: 1 }, { col: 1, row: 1 }
    ],
    slots: [
      {
        slotId: 'b_0',
        label: '顶皮左',
        relativeCol: 0,
        relativeRow: 1,
        defaultCategory: 'normal',
        edges: { top: 'flat', bottom: 'tab', left: 'flat', right: 'blank' }
      },
      {
        slotId: 'b_1',
        label: '顶皮右',
        relativeCol: 1,
        relativeRow: 1,
        defaultCategory: 'early',
        edges: { top: 'flat', bottom: 'blank', left: 'tab', right: 'flat' }
      },
      {
        slotId: 'b_2',
        label: '底芯左',
        relativeCol: 0,
        relativeRow: 0,
        defaultCategory: 'early',
        edges: { top: 'blank', bottom: 'flat', left: 'flat', right: 'tab' }
      },
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

  // 2. 鸡蛋 (Egg) - 2x2, Simple (4 pcs)
  egg: {
    id: 'egg',
    name: '鸡蛋',
    displayName: '农场土鸡蛋',
    emoji: '🍳',
    color: '#FFE49E',
    sourceAsset: 'assets/textures/ingredients/egg.png',
    difficultyClass: 'Simple',
    unlockDay: 1,
    visualPalette: {
      primary: '#FFE49E',
      secondary: '#FFF3B0',
      accent: '#FB8500',
      stroke: '#3D348B',
      shadow: 'rgba(61, 52, 139, 0.2)'
    },
    width: 2,
    height: 2,
    footprint: [
      { col: 0, row: 0 }, { col: 1, row: 0 },
      { col: 0, row: 1 }, { col: 1, row: 1 }
    ],
    slots: [
      {
        slotId: 'eg_0',
        label: '蛋白上左',
        relativeCol: 0,
        relativeRow: 1,
        defaultCategory: 'early',
        edges: { top: 'flat', bottom: 'tab', left: 'flat', right: 'blank' }
      },
      {
        slotId: 'eg_1',
        label: '蛋黄核心',
        relativeCol: 1,
        relativeRow: 1,
        defaultCategory: 'closure',
        edges: { top: 'flat', bottom: 'blank', left: 'tab', right: 'flat' }
      },
      {
        slotId: 'eg_2',
        label: '蛋白焦边',
        relativeCol: 0,
        relativeRow: 0,
        defaultCategory: 'normal',
        edges: { top: 'blank', bottom: 'flat', left: 'flat', right: 'tab' }
      },
      {
        slotId: 'eg_3',
        label: '蛋白下右',
        relativeCol: 1,
        relativeRow: 0,
        defaultCategory: 'early',
        edges: { top: 'tab', bottom: 'flat', left: 'blank', right: 'flat' }
      }
    ]
  },

  // 3. 生菜 (Lettuce) - 2x2, Simple (4 pcs)
  lettuce: {
    id: 'lettuce',
    name: '生菜',
    displayName: '脆嫩球生菜',
    emoji: '🥬',
    color: '#70C1B3',
    sourceAsset: 'assets/textures/ingredients/lettuce.png',
    difficultyClass: 'Simple',
    unlockDay: 1,
    visualPalette: {
      primary: '#70C1B3',
      secondary: '#A8DADC',
      accent: '#2A9D8F',
      stroke: '#1B4332',
      shadow: 'rgba(27, 67, 50, 0.25)'
    },
    width: 2,
    height: 2,
    footprint: [
      { col: 0, row: 0 }, { col: 1, row: 0 },
      { col: 0, row: 1 }, { col: 1, row: 1 }
    ],
    slots: [
      {
        slotId: 'lt_0',
        label: '叶浪顶左',
        relativeCol: 0,
        relativeRow: 1,
        defaultCategory: 'early',
        edges: { top: 'flat', bottom: 'tab', left: 'flat', right: 'blank' }
      },
      {
        slotId: 'lt_1',
        label: '叶脉顶右',
        relativeCol: 1,
        relativeRow: 1,
        defaultCategory: 'normal',
        edges: { top: 'flat', bottom: 'blank', left: 'tab', right: 'flat' }
      },
      {
        slotId: 'lt_2',
        label: '脆梗底左',
        relativeCol: 0,
        relativeRow: 0,
        defaultCategory: 'early',
        edges: { top: 'blank', bottom: 'flat', left: 'flat', right: 'tab' }
      },
      {
        slotId: 'lt_3',
        label: '卷心底右',
        relativeCol: 1,
        relativeRow: 0,
        defaultCategory: 'closure',
        edges: { top: 'tab', bottom: 'flat', left: 'blank', right: 'flat' }
      }
    ]
  },

  // 4. 番茄 (Tomato) - 2x2, Simple (4 pcs)
  tomato: {
    id: 'tomato',
    name: '番茄',
    displayName: '熟成红番茄',
    emoji: '🍅',
    color: '#E63946',
    sourceAsset: 'assets/textures/ingredients/tomato.png',
    difficultyClass: 'Simple',
    unlockDay: 1,
    visualPalette: {
      primary: '#E63946',
      secondary: '#F1A208',
      accent: '#588157',
      stroke: '#4A0E17',
      shadow: 'rgba(74, 14, 23, 0.25)'
    },
    width: 2,
    height: 2,
    footprint: [
      { col: 0, row: 0 }, { col: 1, row: 0 },
      { col: 0, row: 1 }, { col: 1, row: 1 }
    ],
    slots: [
      {
        slotId: 'tm_0',
        label: '绿蒂叶瓣',
        relativeCol: 0,
        relativeRow: 1,
        defaultCategory: 'early',
        edges: { top: 'flat', bottom: 'tab', left: 'flat', right: 'blank' }
      },
      {
        slotId: 'tm_1',
        label: '果肩高光',
        relativeCol: 1,
        relativeRow: 1,
        defaultCategory: 'early',
        edges: { top: 'flat', bottom: 'blank', left: 'tab', right: 'flat' }
      },
      {
        slotId: 'tm_2',
        label: '多汁果肉',
        relativeCol: 0,
        relativeRow: 0,
        defaultCategory: 'normal',
        edges: { top: 'blank', bottom: 'flat', left: 'flat', right: 'tab' }
      },
      {
        slotId: 'tm_3',
        label: '果脐底弧',
        relativeCol: 1,
        relativeRow: 0,
        defaultCategory: 'closure',
        edges: { top: 'tab', bottom: 'flat', left: 'blank', right: 'flat' }
      }
    ]
  },

  // 5. 芝士 (Cheese) - 2x2, Simple (4 pcs)
  cheese: {
    id: 'cheese',
    name: '芝士',
    displayName: '浓醇车达芝士',
    emoji: '🧀',
    color: '#FFB703',
    sourceAsset: 'assets/textures/ingredients/cheese.png',
    difficultyClass: 'Simple',
    unlockDay: 2,
    visualPalette: {
      primary: '#FFB703',
      secondary: '#FD9E02',
      accent: '#FB8500',
      stroke: '#78350F',
      shadow: 'rgba(120, 53, 15, 0.25)'
    },
    width: 2,
    height: 2,
    footprint: [
      { col: 0, row: 0 }, { col: 1, row: 0 },
      { col: 0, row: 1 }, { col: 1, row: 1 }
    ],
    slots: [
      {
        slotId: 'ch_0',
        label: '斜切尖端',
        relativeCol: 0,
        relativeRow: 1,
        defaultCategory: 'early',
        edges: { top: 'flat', bottom: 'tab', left: 'flat', right: 'blank' }
      },
      {
        slotId: 'ch_1',
        label: '气孔坡面',
        relativeCol: 1,
        relativeRow: 1,
        defaultCategory: 'normal',
        edges: { top: 'flat', bottom: 'blank', left: 'tab', right: 'flat' }
      },
      {
        slotId: 'ch_2',
        label: '厚重底座',
        relativeCol: 0,
        relativeRow: 0,
        defaultCategory: 'closure',
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

  // 6. 牛肉 (Beef) - 2x3, Normal (6 pcs)
  beef: {
    id: 'beef',
    name: '牛肉',
    displayName: '谷饲厚切牛肉',
    emoji: '🥩',
    color: '#9C3D54',
    sourceAsset: 'assets/textures/ingredients/beef.png',
    difficultyClass: 'Normal',
    unlockDay: 2,
    visualPalette: {
      primary: '#9C3D54',
      secondary: '#C25975',
      accent: '#FAEDCD',
      stroke: '#4A1525',
      shadow: 'rgba(74, 21, 37, 0.3)'
    },
    width: 2,
    height: 3,
    footprint: [
      { col: 0, row: 0 }, { col: 1, row: 0 },
      { col: 0, row: 1 }, { col: 1, row: 1 },
      { col: 0, row: 2 }, { col: 1, row: 2 }
    ],
    slots: [
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
      {
        slotId: 'bf_4',
        label: '油边底左',
        relativeCol: 0,
        relativeRow: 0,
        defaultCategory: 'closure',
        edges: { top: 'blank', bottom: 'flat', left: 'flat', right: 'blank' }
      },
      {
        slotId: 'bf_5',
        label: '肥瘦相间',
        relativeCol: 1,
        relativeRow: 0,
        defaultCategory: 'normal',
        edges: { top: 'tab', bottom: 'flat', left: 'tab', right: 'flat' }
      }
    ]
  },

  // 7. 鸡肉 (Chicken) - 2x3, Normal (6 pcs)
  chicken: {
    id: 'chicken',
    name: '鸡肉',
    displayName: '多汁香煎鸡胸',
    emoji: '🍗',
    color: '#E9C46A',
    sourceAsset: 'assets/textures/ingredients/chicken.png',
    difficultyClass: 'Normal',
    unlockDay: 3,
    visualPalette: {
      primary: '#E9C46A',
      secondary: '#F4A261',
      accent: '#E76F51',
      stroke: '#7C3F1D',
      shadow: 'rgba(124, 63, 29, 0.25)'
    },
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
        label: '脆皮尖角',
        relativeCol: 0,
        relativeRow: 2,
        defaultCategory: 'early',
        edges: { top: 'flat', bottom: 'tab', left: 'flat', right: 'blank' }
      },
      {
        slotId: 'ck_1',
        label: '金黄肉排顶',
        relativeCol: 1,
        relativeRow: 2,
        defaultCategory: 'normal',
        edges: { top: 'flat', bottom: 'blank', left: 'tab', right: 'flat' }
      },
      {
        slotId: 'ck_2',
        label: '香料纹理',
        relativeCol: 0,
        relativeRow: 1,
        defaultCategory: 'early',
        edges: { top: 'blank', bottom: 'tab', left: 'flat', right: 'tab' }
      },
      {
        slotId: 'ck_3',
        label: '肉汁中心',
        relativeCol: 1,
        relativeRow: 1,
        defaultCategory: 'normal',
        edges: { top: 'tab', bottom: 'blank', left: 'blank', right: 'flat' }
      },
      {
        slotId: 'ck_4',
        label: '焦香边缘',
        relativeCol: 0,
        relativeRow: 0,
        defaultCategory: 'normal',
        edges: { top: 'blank', bottom: 'flat', left: 'flat', right: 'blank' }
      },
      {
        slotId: 'ck_5',
        label: '厚肉底座',
        relativeCol: 1,
        relativeRow: 0,
        defaultCategory: 'closure',
        edges: { top: 'tab', bottom: 'flat', left: 'tab', right: 'flat' }
      }
    ]
  },

  // 8. 土豆 (Potato) - 2x2, Simple (4 pcs)
  potato: {
    id: 'potato',
    name: '土豆',
    displayName: '粉糯黄土豆',
    emoji: '🥔',
    color: '#C6AC8F',
    sourceAsset: 'assets/textures/ingredients/potato.png',
    difficultyClass: 'Simple',
    unlockDay: 4,
    visualPalette: {
      primary: '#C6AC8F',
      secondary: '#EAE2B7',
      accent: '#8D7B68',
      stroke: '#493829',
      shadow: 'rgba(73, 56, 41, 0.25)'
    },
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
  },

  // 9. 米饭 (Rice) - 2x2, Simple (4 pcs)
  rice: {
    id: 'rice',
    name: '米饭',
    displayName: '香糯越光米',
    emoji: '🍚',
    color: '#F8F9FA',
    sourceAsset: 'assets/textures/ingredients/rice.png',
    difficultyClass: 'Simple',
    unlockDay: 4,
    visualPalette: {
      primary: '#F8F9FA',
      secondary: '#E9ECEF',
      accent: '#CED4DA',
      stroke: '#495057',
      shadow: 'rgba(73, 80, 87, 0.2)'
    },
    width: 2,
    height: 2,
    footprint: [
      { col: 0, row: 0 }, { col: 1, row: 0 },
      { col: 0, row: 1 }, { col: 1, row: 1 }
    ],
    slots: [
      {
        slotId: 'rc_0',
        label: '米尖小丘',
        relativeCol: 0,
        relativeRow: 1,
        defaultCategory: 'early',
        edges: { top: 'flat', bottom: 'tab', left: 'flat', right: 'blank' }
      },
      {
        slotId: 'rc_1',
        label: '热气蒸腾',
        relativeCol: 1,
        relativeRow: 1,
        defaultCategory: 'normal',
        edges: { top: 'flat', bottom: 'blank', left: 'tab', right: 'flat' }
      },
      {
        slotId: 'rc_2',
        label: '碗边米粒',
        relativeCol: 0,
        relativeRow: 0,
        defaultCategory: 'early',
        edges: { top: 'blank', bottom: 'flat', left: 'flat', right: 'tab' }
      },
      {
        slotId: 'rc_3',
        label: '紧实底盘',
        relativeCol: 1,
        relativeRow: 0,
        defaultCategory: 'closure',
        edges: { top: 'tab', bottom: 'flat', left: 'blank', right: 'flat' }
      }
    ]
  },

  // 10. 面条 (Noodle) - 2x3, Normal (6 pcs)
  noodle: {
    id: 'noodle',
    name: '面条',
    displayName: '手工劲道拉面',
    emoji: '🍜',
    color: '#F3C68F',
    sourceAsset: 'assets/textures/ingredients/noodle.png',
    difficultyClass: 'Normal',
    unlockDay: 5,
    visualPalette: {
      primary: '#F3C68F',
      secondary: '#E0A96D',
      accent: '#C68B59',
      stroke: '#5A3825',
      shadow: 'rgba(90, 56, 37, 0.25)'
    },
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
        label: '筷挑面冠',
        relativeCol: 0,
        relativeRow: 2,
        defaultCategory: 'early',
        edges: { top: 'flat', bottom: 'tab', left: 'flat', right: 'blank' }
      },
      {
        slotId: 'nd_1',
        label: '汤面弧度',
        relativeCol: 1,
        relativeRow: 2,
        defaultCategory: 'normal',
        edges: { top: 'flat', bottom: 'blank', left: 'tab', right: 'flat' }
      },
      {
        slotId: 'nd_2',
        label: '弯曲面缕A',
        relativeCol: 0,
        relativeRow: 1,
        defaultCategory: 'early',
        edges: { top: 'blank', bottom: 'tab', left: 'flat', right: 'tab' }
      },
      {
        slotId: 'nd_3',
        label: '弯曲面缕B',
        relativeCol: 1,
        relativeRow: 1,
        defaultCategory: 'normal',
        edges: { top: 'tab', bottom: 'blank', left: 'blank', right: 'flat' }
      },
      {
        slotId: 'nd_4',
        label: '浓汤底部',
        relativeCol: 0,
        relativeRow: 0,
        defaultCategory: 'closure',
        edges: { top: 'blank', bottom: 'flat', left: 'flat', right: 'blank' }
      },
      {
        slotId: 'nd_5',
        label: '瓷碗托底',
        relativeCol: 1,
        relativeRow: 0,
        defaultCategory: 'normal',
        edges: { top: 'tab', bottom: 'flat', left: 'tab', right: 'flat' }
      }
    ]
  },

  // 11. 洋葱 (Onion) - 2x2, Simple (4 pcs)
  onion: {
    id: 'onion',
    name: '洋葱',
    displayName: '甜脆紫洋葱',
    emoji: '🧅',
    color: '#B5838D',
    sourceAsset: 'assets/textures/ingredients/onion.png',
    difficultyClass: 'Simple',
    unlockDay: 6,
    visualPalette: {
      primary: '#B5838D',
      secondary: '#6D597A',
      accent: '#E5989B',
      stroke: '#35223A',
      shadow: 'rgba(53, 34, 58, 0.25)'
    },
    width: 2,
    height: 2,
    footprint: [
      { col: 0, row: 0 }, { col: 1, row: 0 },
      { col: 0, row: 1 }, { col: 1, row: 1 }
    ],
    slots: [
      {
        slotId: 'on_0',
        label: '紫衣顶芽',
        relativeCol: 0,
        relativeRow: 1,
        defaultCategory: 'early',
        edges: { top: 'flat', bottom: 'tab', left: 'flat', right: 'blank' }
      },
      {
        slotId: 'on_1',
        label: '同心圆圈',
        relativeCol: 1,
        relativeRow: 1,
        defaultCategory: 'normal',
        edges: { top: 'flat', bottom: 'blank', left: 'tab', right: 'flat' }
      },
      {
        slotId: 'on_2',
        label: '多层嫩肉',
        relativeCol: 0,
        relativeRow: 0,
        defaultCategory: 'early',
        edges: { top: 'blank', bottom: 'flat', left: 'flat', right: 'tab' }
      },
      {
        slotId: 'on_3',
        label: '葱根须节',
        relativeCol: 1,
        relativeRow: 0,
        defaultCategory: 'closure',
        edges: { top: 'tab', bottom: 'flat', left: 'blank', right: 'flat' }
      }
    ]
  },

  // 12. 胡萝卜 (Carrot) - 2x3, Normal (6 pcs)
  carrot: {
    id: 'carrot',
    name: '胡萝卜',
    displayName: '清甜红胡萝卜',
    emoji: '🥕',
    color: '#F77F00',
    sourceAsset: 'assets/textures/ingredients/carrot.png',
    difficultyClass: 'Normal',
    unlockDay: 7,
    visualPalette: {
      primary: '#F77F00',
      secondary: '#FCBF49',
      accent: '#2A9D8F',
      stroke: '#582F0E',
      shadow: 'rgba(88, 47, 14, 0.25)'
    },
    width: 2,
    height: 3,
    footprint: [
      { col: 0, row: 0 }, { col: 1, row: 0 },
      { col: 0, row: 1 }, { col: 1, row: 1 },
      { col: 0, row: 2 }, { col: 1, row: 2 }
    ],
    slots: [
      {
        slotId: 'cr_0',
        label: '绿缨根茎',
        relativeCol: 0,
        relativeRow: 2,
        defaultCategory: 'early',
        edges: { top: 'flat', bottom: 'tab', left: 'flat', right: 'blank' }
      },
      {
        slotId: 'cr_1',
        label: '橙红肩顶',
        relativeCol: 1,
        relativeRow: 2,
        defaultCategory: 'normal',
        edges: { top: 'flat', bottom: 'blank', left: 'tab', right: 'flat' }
      },
      {
        slotId: 'cr_2',
        label: '横向节纹',
        relativeCol: 0,
        relativeRow: 1,
        defaultCategory: 'early',
        edges: { top: 'blank', bottom: 'tab', left: 'flat', right: 'tab' }
      },
      {
        slotId: 'cr_3',
        label: '饱满中段',
        relativeCol: 1,
        relativeRow: 1,
        defaultCategory: 'normal',
        edges: { top: 'tab', bottom: 'blank', left: 'blank', right: 'flat' }
      },
      {
        slotId: 'cr_4',
        label: '细长下段',
        relativeCol: 0,
        relativeRow: 0,
        defaultCategory: 'normal',
        edges: { top: 'blank', bottom: 'flat', left: 'flat', right: 'blank' }
      },
      {
        slotId: 'cr_5',
        label: '锥形根尖',
        relativeCol: 1,
        relativeRow: 0,
        defaultCategory: 'closure',
        edges: { top: 'tab', bottom: 'flat', left: 'tab', right: 'flat' }
      }
    ]
  },

  // 13. 培根 (Bacon) - 2x3, Normal (6 pcs)
  bacon: {
    id: 'bacon',
    name: '培根',
    displayName: '烟熏厚切培根',
    emoji: '🥓',
    color: '#D62828',
    sourceAsset: 'assets/textures/ingredients/bacon.png',
    difficultyClass: 'Normal',
    unlockDay: 8,
    visualPalette: {
      primary: '#D62828',
      secondary: '#F28482',
      accent: '#F4F1DE',
      stroke: '#4C1014',
      shadow: 'rgba(76, 16, 20, 0.25)'
    },
    width: 2,
    height: 3,
    footprint: [
      { col: 0, row: 0 }, { col: 1, row: 0 },
      { col: 0, row: 1 }, { col: 1, row: 1 },
      { col: 0, row: 2 }, { col: 1, row: 2 }
    ],
    slots: [
      {
        slotId: 'bc_0',
        label: '波浪红肉顶',
        relativeCol: 0,
        relativeRow: 2,
        defaultCategory: 'early',
        edges: { top: 'flat', bottom: 'tab', left: 'flat', right: 'blank' }
      },
      {
        slotId: 'bc_1',
        label: '白脂条纹顶',
        relativeCol: 1,
        relativeRow: 2,
        defaultCategory: 'normal',
        edges: { top: 'flat', bottom: 'blank', left: 'tab', right: 'flat' }
      },
      {
        slotId: 'bc_2',
        label: '烟熏焦褐',
        relativeCol: 0,
        relativeRow: 1,
        defaultCategory: 'early',
        edges: { top: 'blank', bottom: 'tab', left: 'flat', right: 'tab' }
      },
      {
        slotId: 'bc_3',
        label: '肥瘦相间中',
        relativeCol: 1,
        relativeRow: 1,
        defaultCategory: 'normal',
        edges: { top: 'tab', bottom: 'blank', left: 'blank', right: 'flat' }
      },
      {
        slotId: 'bc_4',
        label: '微卷肉梢',
        relativeCol: 0,
        relativeRow: 0,
        defaultCategory: 'closure',
        edges: { top: 'blank', bottom: 'flat', left: 'flat', right: 'blank' }
      },
      {
        slotId: 'bc_5',
        label: '酥脆底边',
        relativeCol: 1,
        relativeRow: 0,
        defaultCategory: 'normal',
        edges: { top: 'tab', bottom: 'flat', left: 'tab', right: 'flat' }
      }
    ]
  },

  // 14. 蘑菇 (Mushroom) - 2x2, Simple (4 pcs)
  mushroom: {
    id: 'mushroom',
    name: '蘑菇',
    displayName: '鲜采口蘑',
    emoji: '🍄',
    color: '#8D7B68',
    sourceAsset: 'assets/textures/ingredients/mushroom.png',
    difficultyClass: 'Simple',
    unlockDay: 9,
    visualPalette: {
      primary: '#8D7B68',
      secondary: '#A79277',
      accent: '#D0B8A8',
      stroke: '#3C2A21',
      shadow: 'rgba(60, 42, 33, 0.25)'
    },
    width: 2,
    height: 2,
    footprint: [
      { col: 0, row: 0 }, { col: 1, row: 0 },
      { col: 0, row: 1 }, { col: 1, row: 1 }
    ],
    slots: [
      {
        slotId: 'ms_0',
        label: '圆润伞盖左',
        relativeCol: 0,
        relativeRow: 1,
        defaultCategory: 'early',
        edges: { top: 'flat', bottom: 'tab', left: 'flat', right: 'blank' }
      },
      {
        slotId: 'ms_1',
        label: '伞盖斑点右',
        relativeCol: 1,
        relativeRow: 1,
        defaultCategory: 'normal',
        edges: { top: 'flat', bottom: 'blank', left: 'tab', right: 'flat' }
      },
      {
        slotId: 'ms_2',
        label: '伞褶阴影',
        relativeCol: 0,
        relativeRow: 0,
        defaultCategory: 'early',
        edges: { top: 'blank', bottom: 'flat', left: 'flat', right: 'tab' }
      },
      {
        slotId: 'ms_3',
        label: '肥厚菇柄',
        relativeCol: 1,
        relativeRow: 0,
        defaultCategory: 'closure',
        edges: { top: 'tab', bottom: 'flat', left: 'blank', right: 'flat' }
      }
    ]
  },

  // 15. 鲜虾 (Shrimp) - 2x3, Normal (6 pcs)
  shrimp: {
    id: 'shrimp',
    name: '鲜虾',
    displayName: '野生红明虾',
    emoji: '🦐',
    color: '#FF6B6B',
    sourceAsset: 'assets/textures/ingredients/shrimp.png',
    difficultyClass: 'Normal',
    unlockDay: 10,
    visualPalette: {
      primary: '#FF6B6B',
      secondary: '#FFA07A',
      accent: '#FFFFFF',
      stroke: '#8B2635',
      shadow: 'rgba(139, 38, 53, 0.25)'
    },
    width: 2,
    height: 3,
    footprint: [
      { col: 0, row: 0 }, { col: 1, row: 0 },
      { col: 0, row: 1 }, { col: 1, row: 1 },
      { col: 0, row: 2 }, { col: 1, row: 2 }
    ],
    slots: [
      {
        slotId: 'sh_0',
        label: '虾须弯角',
        relativeCol: 0,
        relativeRow: 2,
        defaultCategory: 'early',
        edges: { top: 'flat', bottom: 'tab', left: 'flat', right: 'blank' }
      },
      {
        slotId: 'sh_1',
        label: '红润虾头',
        relativeCol: 1,
        relativeRow: 2,
        defaultCategory: 'normal',
        edges: { top: 'flat', bottom: 'blank', left: 'tab', right: 'flat' }
      },
      {
        slotId: 'sh_2',
        label: '虾身节甲A',
        relativeCol: 0,
        relativeRow: 1,
        defaultCategory: 'early',
        edges: { top: 'blank', bottom: 'tab', left: 'flat', right: 'tab' }
      },
      {
        slotId: 'sh_3',
        label: '虾身节甲B',
        relativeCol: 1,
        relativeRow: 1,
        defaultCategory: 'normal',
        edges: { top: 'tab', bottom: 'blank', left: 'blank', right: 'flat' }
      },
      {
        slotId: 'sh_4',
        label: '晶莹虾肉',
        relativeCol: 0,
        relativeRow: 0,
        defaultCategory: 'normal',
        edges: { top: 'blank', bottom: 'flat', left: 'flat', right: 'blank' }
      },
      {
        slotId: 'sh_5',
        label: '分叉虾尾',
        relativeCol: 1,
        relativeRow: 0,
        defaultCategory: 'closure',
        edges: { top: 'tab', bottom: 'flat', left: 'tab', right: 'flat' }
      }
    ]
  },

  // 16. 玉米 (Corn) - 2x4, Complex (8 pcs)
  corn: {
    id: 'corn',
    name: '玉米',
    displayName: '甜脆双色玉米',
    emoji: '🌽',
    color: '#FFD166',
    sourceAsset: 'assets/textures/ingredients/corn.png',
    difficultyClass: 'Complex',
    unlockDay: 11,
    visualPalette: {
      primary: '#FFD166',
      secondary: '#06D6A0',
      accent: '#F77F00',
      stroke: '#582F0E',
      shadow: 'rgba(88, 47, 14, 0.25)'
    },
    width: 2,
    height: 4,
    footprint: [
      { col: 0, row: 0 }, { col: 1, row: 0 },
      { col: 0, row: 1 }, { col: 1, row: 1 },
      { col: 0, row: 2 }, { col: 1, row: 2 },
      { col: 0, row: 3 }, { col: 1, row: 3 }
    ],
    slots: [
      {
        slotId: 'cn_0',
        label: '青绿苞叶顶左',
        relativeCol: 0,
        relativeRow: 3,
        defaultCategory: 'early',
        edges: { top: 'flat', bottom: 'tab', left: 'flat', right: 'blank' }
      },
      {
        slotId: 'cn_1',
        label: '苞叶飘拂顶右',
        relativeCol: 1,
        relativeRow: 3,
        defaultCategory: 'normal',
        edges: { top: 'flat', bottom: 'blank', left: 'tab', right: 'flat' }
      },
      {
        slotId: 'cn_2',
        label: '金黄嫩粒上左',
        relativeCol: 0,
        relativeRow: 2,
        defaultCategory: 'early',
        edges: { top: 'blank', bottom: 'tab', left: 'flat', right: 'tab' }
      },
      {
        slotId: 'cn_3',
        label: '珍珠玉粒上右',
        relativeCol: 1,
        relativeRow: 2,
        defaultCategory: 'normal',
        edges: { top: 'tab', bottom: 'blank', left: 'blank', right: 'flat' }
      },
      {
        slotId: 'cn_4',
        label: '整齐粒行下左',
        relativeCol: 0,
        relativeRow: 1,
        defaultCategory: 'normal',
        edges: { top: 'blank', bottom: 'tab', left: 'flat', right: 'blank' }
      },
      {
        slotId: 'cn_5',
        label: '饱满粒层下右',
        relativeCol: 1,
        relativeRow: 1,
        defaultCategory: 'early',
        edges: { top: 'tab', bottom: 'blank', left: 'tab', right: 'flat' }
      },
      {
        slotId: 'cn_6',
        label: '硬质芯底左',
        relativeCol: 0,
        relativeRow: 0,
        defaultCategory: 'normal',
        edges: { top: 'blank', bottom: 'flat', left: 'flat', right: 'tab' }
      },
      {
        slotId: 'cn_7',
        label: '粗壮穗梗底右',
        relativeCol: 1,
        relativeRow: 0,
        defaultCategory: 'closure',
        edges: { top: 'tab', bottom: 'flat', left: 'blank', right: 'flat' }
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
      { ingredientId: 'cheese', count: 1 },
      { ingredientId: 'lettuce', count: 1 }
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
  egg_rice: {
    id: 'egg_rice',
    name: '黄金蛋炒饭',
    emoji: '🍳',
    baseRevenue: 85,
    requirements: [
      { ingredientId: 'rice', count: 1 },
      { ingredientId: 'egg', count: 1 },
      { ingredientId: 'onion', count: 1 }
    ]
  },
  chicken_burger: {
    id: 'chicken_burger',
    name: '香脆鸡肉堡',
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
    baseRevenue: 140,
    requirements: [
      { ingredientId: 'noodle', count: 1 },
      { ingredientId: 'beef', count: 1 },
      { ingredientId: 'onion', count: 1 }
    ]
  },
  chicken_noodle: {
    id: 'chicken_noodle',
    name: '香煎鸡丝面',
    emoji: '🍲',
    baseRevenue: 110,
    requirements: [
      { ingredientId: 'noodle', count: 1 },
      { ingredientId: 'chicken', count: 1 },
      { ingredientId: 'carrot', count: 1 }
    ]
  },
  beef_rice: {
    id: 'beef_rice',
    name: '日式肥牛盖浇饭',
    emoji: '🍱',
    baseRevenue: 150,
    requirements: [
      { ingredientId: 'rice', count: 1 },
      { ingredientId: 'beef', count: 1 },
      { ingredientId: 'onion', count: 1 },
      { ingredientId: 'egg', count: 1 }
    ]
  },
  bacon_sandwich: {
    id: 'bacon_sandwich',
    name: '厚切培根三明治',
    emoji: '🥪',
    baseRevenue: 125,
    requirements: [
      { ingredientId: 'bread', count: 1 },
      { ingredientId: 'bacon', count: 1 },
      { ingredientId: 'cheese', count: 1 },
      { ingredientId: 'tomato', count: 1 }
    ]
  },
  veggie_platter: {
    id: 'veggie_platter',
    name: '温润时蔬沙拉盘',
    emoji: '🥗',
    baseRevenue: 115,
    requirements: [
      { ingredientId: 'carrot', count: 1 },
      { ingredientId: 'mushroom', count: 1 },
      { ingredientId: 'corn', count: 1 },
      { ingredientId: 'lettuce', count: 1 }
    ]
  },
  curry_chicken_rice: {
    id: 'curry_chicken_rice',
    name: '浓香咖喱鸡肉饭',
    emoji: '🍛',
    baseRevenue: 140,
    requirements: [
      { ingredientId: 'rice', count: 1 },
      { ingredientId: 'chicken', count: 1 },
      { ingredientId: 'potato', count: 1 },
      { ingredientId: 'carrot', count: 1 }
    ]
  },
  mushroom_soup: {
    id: 'mushroom_soup',
    name: '法式奶油蘑菇浓汤',
    emoji: '🥣',
    baseRevenue: 85,
    requirements: [
      { ingredientId: 'mushroom', count: 1 },
      { ingredientId: 'onion', count: 1 },
      { ingredientId: 'cheese', count: 1 }
    ]
  },
  bacon_burger: {
    id: 'bacon_burger',
    name: '培根双层厚牛堡',
    emoji: '🍔',
    baseRevenue: 165,
    requirements: [
      { ingredientId: 'bread', count: 1 },
      { ingredientId: 'beef', count: 1 },
      { ingredientId: 'bacon', count: 1 },
      { ingredientId: 'cheese', count: 1 },
      { ingredientId: 'tomato', count: 1 }
    ]
  },
  seafood_noodle: {
    id: 'seafood_noodle',
    name: '鲜虾海鲜拉面',
    emoji: '🍜',
    baseRevenue: 155,
    requirements: [
      { ingredientId: 'noodle', count: 1 },
      { ingredientId: 'shrimp', count: 1 },
      { ingredientId: 'egg', count: 1 },
      { ingredientId: 'onion', count: 1 }
    ]
  },
  shrimp_fried_rice: {
    id: 'shrimp_fried_rice',
    name: '鲜虾扬州炒饭',
    emoji: '🍚',
    baseRevenue: 165,
    requirements: [
      { ingredientId: 'rice', count: 1 },
      { ingredientId: 'shrimp', count: 1 },
      { ingredientId: 'egg', count: 1 },
      { ingredientId: 'corn', count: 1 },
      { ingredientId: 'carrot', count: 1 }
    ]
  },
  bbq_platter: {
    id: 'bbq_platter',
    name: '豪华美式烤肉拼盘',
    emoji: '🍖',
    baseRevenue: 195,
    requirements: [
      { ingredientId: 'beef', count: 1 },
      { ingredientId: 'chicken', count: 1 },
      { ingredientId: 'bacon', count: 1 },
      { ingredientId: 'corn', count: 1 }
    ]
  },
  deluxe_bento: {
    id: 'deluxe_bento',
    name: '全家福豪华便当',
    emoji: '🍱',
    baseRevenue: 230,
    requirements: [
      { ingredientId: 'rice', count: 1 },
      { ingredientId: 'beef', count: 1 },
      { ingredientId: 'chicken', count: 1 },
      { ingredientId: 'shrimp', count: 1 },
      { ingredientId: 'egg', count: 1 },
      { ingredientId: 'carrot', count: 1 }
    ]
  }
};

export const DEFAULT_DAYS: DayConfig[] = [
  // Day 1: 极简上手 (2 targets, 1 recipe, goal 200)
  {
    dayNumber: 1,
    businessGoal: 200,
    availableRecipeIds: ['salad'],
    recipeWeights: { salad: 1 },
    targetIngredientCount: 2,
    loosePieceComfortMin: 3,
    loosePieceComfortMax: 5,
    pressureProfile: { ...STAGE2_FROZEN_PRESSURE_PROFILE },
    directorProfile: { ...STAGE2_FROZEN_DIRECTOR_PROFILE }
  },

  // Day 2: 理解订单 (2 targets, 2 recipes, goal 350)
  {
    dayNumber: 2,
    businessGoal: 350,
    availableRecipeIds: ['salad', 'burger'],
    recipeWeights: { salad: 2, burger: 2 },
    targetIngredientCount: 2,
    loosePieceComfortMin: 4,
    loosePieceComfortMax: 7,
    pressureProfile: { ...STAGE2_FROZEN_PRESSURE_PROFILE },
    directorProfile: { ...STAGE2_FROZEN_DIRECTOR_PROFILE }
  },

  // Day 3: 理解营业目标 (3 targets, 2 recipes, goal 500)
  {
    dayNumber: 3,
    businessGoal: 500,
    availableRecipeIds: ['salad', 'burger'],
    recipeWeights: { salad: 2, burger: 3 },
    targetIngredientCount: 3,
    loosePieceComfortMin: 5,
    loosePieceComfortMax: 8,
    pressureProfile: { ...STAGE2_FROZEN_PRESSURE_PROFILE },
    directorProfile: { ...STAGE2_FROZEN_DIRECTOR_PROFILE }
  },

  // Day 4: 多目标选择 (3 targets, 3 recipes, goal 650)
  {
    dayNumber: 4,
    businessGoal: 650,
    availableRecipeIds: ['salad', 'sandwich', 'fries_basket'],
    recipeWeights: { salad: 2, sandwich: 2, fries_basket: 2 },
    targetIngredientCount: 3,
    loosePieceComfortMin: 5,
    loosePieceComfortMax: 8,
    pressureProfile: { ...STAGE2_FROZEN_PRESSURE_PROFILE },
    directorProfile: { ...STAGE2_FROZEN_DIRECTOR_PROFILE }
  },

  // Day 5: 第一次空间压力 (3 targets, 3 recipes, goal 800)
  {
    dayNumber: 5,
    businessGoal: 800,
    availableRecipeIds: ['sandwich', 'burger', 'chicken_burger'],
    recipeWeights: { sandwich: 2, burger: 2, chicken_burger: 2 },
    targetIngredientCount: 3,
    loosePieceComfortMin: 6,
    loosePieceComfortMax: 9,
    pressureProfile: { ...STAGE2_FROZEN_PRESSURE_PROFILE },
    directorProfile: { ...STAGE2_FROZEN_DIRECTOR_PROFILE }
  },

  // Day 6: 当前订单优先 (4 targets, 4 recipes, goal 950)
  {
    dayNumber: 6,
    businessGoal: 950,
    availableRecipeIds: ['burger', 'chicken_burger', 'beef_noodle', 'egg_rice'],
    recipeWeights: { burger: 2, chicken_burger: 2, beef_noodle: 2, egg_rice: 2 },
    targetIngredientCount: 4,
    loosePieceComfortMin: 6,
    loosePieceComfortMax: 9,
    pressureProfile: { ...STAGE2_FROZEN_PRESSURE_PROFILE },
    directorProfile: { ...STAGE2_FROZEN_DIRECTOR_PROFILE }
  },

  // Day 7: 出现下一单预告 (4 targets, 4 recipes, goal 1100)
  {
    dayNumber: 7,
    businessGoal: 1100,
    availableRecipeIds: ['sandwich', 'bacon_sandwich', 'beef_noodle', 'chicken_noodle'],
    recipeWeights: { sandwich: 2, bacon_sandwich: 2, beef_noodle: 2, chicken_noodle: 2 },
    targetIngredientCount: 4,
    loosePieceComfortMin: 6,
    loosePieceComfortMax: 9,
    pressureProfile: { ...STAGE2_FROZEN_PRESSURE_PROFILE },
    directorProfile: { ...STAGE2_FROZEN_DIRECTOR_PROFILE }
  },

  // Day 8: 提前备料明显有效 (4 targets, 5 recipes, goal 1300)
  {
    dayNumber: 8,
    businessGoal: 1300,
    availableRecipeIds: ['bacon_sandwich', 'curry_chicken_rice', 'beef_rice', 'veggie_platter', 'fries_basket'],
    recipeWeights: { bacon_sandwich: 2, curry_chicken_rice: 2, beef_rice: 2, veggie_platter: 2, fries_basket: 2 },
    targetIngredientCount: 4,
    loosePieceComfortMin: 6,
    loosePieceComfortMax: 9,
    pressureProfile: { ...STAGE2_FROZEN_PRESSURE_PROFILE },
    directorProfile: { ...STAGE2_FROZEN_DIRECTOR_PROFILE }
  },

  // Day 9: 第一次自然 Cascade (4 targets, 5 recipes, goal 1500)
  {
    dayNumber: 9,
    businessGoal: 1500,
    availableRecipeIds: ['bacon_burger', 'mushroom_soup', 'curry_chicken_rice', 'beef_noodle', 'egg_rice'],
    recipeWeights: { bacon_burger: 3, mushroom_soup: 2, curry_chicken_rice: 2, beef_noodle: 2, egg_rice: 2 },
    targetIngredientCount: 4,
    loosePieceComfortMin: 6,
    loosePieceComfortMax: 9,
    pressureProfile: { ...STAGE2_FROZEN_PRESSURE_PROFILE },
    directorProfile: { ...STAGE2_FROZEN_DIRECTOR_PROFILE }
  },

  // Day 10: 复杂菜单组合 (4 targets, 6 recipes, goal 1700)
  {
    dayNumber: 10,
    businessGoal: 1700,
    availableRecipeIds: ['seafood_noodle', 'shrimp_fried_rice', 'bacon_burger', 'chicken_noodle', 'veggie_platter', 'mushroom_soup'],
    recipeWeights: { seafood_noodle: 2, shrimp_fried_rice: 2, bacon_burger: 2, chicken_noodle: 2, veggie_platter: 2, mushroom_soup: 2 },
    targetIngredientCount: 4,
    loosePieceComfortMin: 6,
    loosePieceComfortMax: 9,
    pressureProfile: { ...STAGE2_FROZEN_PRESSURE_PROFILE },
    directorProfile: { ...STAGE2_FROZEN_DIRECTOR_PROFILE }
  },

  // Day 11: 高压力营业日 (4 targets, 7 recipes, goal 2000)
  {
    dayNumber: 11,
    businessGoal: 2000,
    availableRecipeIds: ['bbq_platter', 'seafood_noodle', 'shrimp_fried_rice', 'bacon_burger', 'beef_rice', 'curry_chicken_rice', 'salad'],
    recipeWeights: { bbq_platter: 3, seafood_noodle: 2, shrimp_fried_rice: 2, bacon_burger: 2, beef_rice: 2, curry_chicken_rice: 2, salad: 1 },
    targetIngredientCount: 4,
    loosePieceComfortMin: 6,
    loosePieceComfortMax: 10,
    pressureProfile: { ...STAGE2_FROZEN_PRESSURE_PROFILE },
    directorProfile: { ...STAGE2_FROZEN_DIRECTOR_PROFILE }
  },

  // Day 12: 综合考试 (4 targets, 8 recipes, goal 2400)
  {
    dayNumber: 12,
    businessGoal: 2400,
    availableRecipeIds: ['deluxe_bento', 'bbq_platter', 'seafood_noodle', 'bacon_burger', 'shrimp_fried_rice', 'beef_noodle', 'sandwich', 'mushroom_soup'],
    recipeWeights: { deluxe_bento: 3, bbq_platter: 2, seafood_noodle: 2, bacon_burger: 2, shrimp_fried_rice: 2, beef_noodle: 2, sandwich: 1, mushroom_soup: 1 },
    targetIngredientCount: 4,
    loosePieceComfortMin: 6,
    loosePieceComfortMax: 10,
    pressureProfile: { ...STAGE2_FROZEN_PRESSURE_PROFILE },
    directorProfile: { ...STAGE2_FROZEN_DIRECTOR_PROFILE }
  }
];
