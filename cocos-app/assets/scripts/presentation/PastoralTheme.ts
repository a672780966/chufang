/**
 * PastoralTheme.ts (Cocos Creator Port)
 * Stage 3B: 日漫田园治愈系美食拼图 Design System Tokens
 */

import { Color } from 'cc';

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

    inkMain: '#403A34',
    inkSecondary: '#766E65',
    inkMuted: '#A09689',
    inkWhite: '#FFFFFF',

    honey: '#E8B85C',
    tomato: '#D96959',
    danger: '#E79B62',
    successGold: '#F3C969',
    snapGuide: 'rgba(253, 230, 138, 0.75)',

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

  ccColors: {
    bgWarmCream: Color.fromHEX(new Color(), '#F7F1E7'),
    bgLinen: Color.fromHEX(new Color(), '#EEE6D8'),
    woodLight: Color.fromHEX(new Color(), '#D8B58C'),
    woodDeep: Color.fromHEX(new Color(), '#8B6347'),
    sageMain: Color.fromHEX(new Color(), '#91AA82'),
    paper: Color.fromHEX(new Color(), '#FFFDF7'),
    inkMain: Color.fromHEX(new Color(), '#403A34'),
    inkSecondary: Color.fromHEX(new Color(), '#766E65'),
    honey: Color.fromHEX(new Color(), '#E8B85C'),
    tomato: Color.fromHEX(new Color(), '#D96959'),
    danger: Color.fromHEX(new Color(), '#E79B62')
  },

  radii: {
    small: 8,
    medium: 14,
    large: 22,
    board: 26
  },

  timings: {
    buttonPress: 0.09,
    pieceLift: 0.1,
    pieceSnap: 0.12,
    wrongReturn: 0.22,
    dishComplete: 0.55,
    boardFall: 0.25,
    receiptPrint: 0.24,
    receiptTear: 0.2
  }
};
