/**
 * PastoralTheme.ts
 * Stage 3B: 日漫田园治愈系美食拼图 Design System Tokens
 *
 * Visual Core:
 * - Clean, warm, healing, Japanese cafe / morning kitchen atmosphere.
 * - Maximum surface area in Cream White, Linen, and Warm Light Wood.
 * - Saturated colors exclusively from fresh foods and dishes.
 */

export interface ColorTokens {
  // Backgrounds & Base Materials
  bgWarmCream: string;
  bgLinen: string;
  woodLight: string;
  woodDeep: string;
  woodBorder: string;
  sageLight: string;
  sageMain: string;
  skyMist: string;
  paper: string;
  paperShadow: string;

  // Typography & Inks
  inkMain: string;
  inkSecondary: string;
  inkMuted: string;
  inkWhite: string;
  inkDark: string;

  // Accents & Feedback States
  honey: string;
  tomato: string;
  danger: string;
  successGold: string;
  snapGuide: string;

  // Jigsaw Board & Canvas specific
  targetPlate: string;
  targetBorder: string;
  cardboard: string;
  socketBg: string;
  socketDashed: string;

  // High-frequency Food Palettes
  foodTomato: string;
  foodLettuce: string;
  foodEgg: string;
  foodBread: string;
  foodBeef: string;
  foodCheese: string;
  foodRice: string;
  foodNoodle: string;
  foodCurry: string;
  foodBacon: string;
  foodMushroom: string;
  foodShrimp: string;
}

export interface ShadowTokens {
  small: string;
  medium: string;
  floating: string;
  woodPlate: string;
  receiptFold: string;
  piece: string;
  pieceLifted: string;
  targetPlate: string;
}

export interface RadiusTokens {
  small: number;
  medium: number;
  large: number;
  plate: number;
  board: number;
  pill: number;
}

export interface TimingTokens {
  buttonPress: number;
  pieceLift: number;
  pieceSnap: number;
  wrongReturn: number;
  groupMerge: number;
  dishComplete: number;
  boardFall: number;
  receiptPrint: number;
  receiptTear: number;
  cascadeInterval: number;
  dayClearTransition: number;
}

export const PastoralTheme = {
  colors: {
    bgWarmCream: '#F7F1E7',
    bgLinen: '#EEE6D8',
    woodLight: '#D8B58C',
    woodDeep: '#8B6347',
    woodBorder: '#C49E72',
    sageLight: '#DCE5D4',
    sageMain: '#91AA82',
    skyMist: '#CBDDE0',
    paper: '#FFFDF7',
    paperShadow: 'rgba(70, 55, 40, 0.12)',

    inkMain: '#403A34',
    inkSecondary: '#766E65',
    inkMuted: '#A09689',
    inkWhite: '#FFFFFF',
    inkDark: '#3A2E22',

    honey: '#E8B85C',
    tomato: '#D96959',
    danger: '#E79B62',
    successGold: '#F3C969',
    snapGuide: 'rgba(253, 230, 138, 0.75)',

    // Jigsaw Board & Canvas specific
    targetPlate: 'rgba(255, 255, 255, 0.94)',
    targetBorder: '#E5DAC8',
    cardboard: '#FFFDF7',
    socketBg: 'rgba(238, 230, 216, 0.65)',
    socketDashed: 'rgba(175, 148, 120, 0.45)',

    // Food Colors
    foodTomato: '#E75A4D',
    foodLettuce: '#6FB98F',
    foodEgg: '#F6C953',
    foodBread: '#DDA15E',
    foodBeef: '#8C4336',
    foodCheese: '#FFD166',
    foodRice: '#FAF7F0',
    foodNoodle: '#F4D35E',
    foodCurry: '#C27827',
    foodBacon: '#DF6A68',
    foodMushroom: '#8D7B68',
    foodShrimp: '#FF6B6B'
  },

  shadows: {
    small: '0 2px 6px rgba(65, 45, 30, 0.10)',
    medium: '0 5px 14px rgba(65, 45, 30, 0.14)',
    floating: '0 10px 24px rgba(65, 45, 30, 0.18)',
    woodPlate: '0 4px 10px rgba(88, 55, 30, 0.12)',
    receiptFold: '0 6px 16px rgba(60, 45, 30, 0.12)',
    piece: 'rgba(70, 55, 40, 0.16)',
    pieceLifted: 'rgba(70, 55, 40, 0.24)',
    targetPlate: 'rgba(139, 99, 71, 0.08)'
  },

  radii: {
    small: 8,
    medium: 14,
    large: 22,
    plate: 14,
    board: 26,
    pill: 999
  },

  timings: {
    buttonPress: 90,
    pieceLift: 100,
    pieceSnap: 120,
    wrongReturn: 220,
    groupMerge: 180,
    dishComplete: 550,
    boardFall: 250,
    receiptPrint: 240,
    receiptTear: 200,
    cascadeInterval: 300,
    dayClearTransition: 700
  },

  typography: {
    fontFamilyTitle: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif`,
    fontFamilyBody: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif`,
    fontFamilyReceipt: `"Courier New", Courier, monospace, "PingFang SC"`
  }
};
