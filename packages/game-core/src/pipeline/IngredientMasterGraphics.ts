/**
 * IngredientMasterGraphics
 * Provides 1024x1024 procedural SVG master illustrations for all 16 official ingredients.
 * Follows the Stage 3 Art Direction:
 * - 1024 x 1024 resolution
 * - Transparent background
 * - Centered subject, clear silhouette, high appetizing color contrast
 * - 2D mobile illustration style (warm, appetizing, bold outlines, gentle gradients)
 * - Zero external image asset dependencies!
 */

export interface MasterGraphicDefinition {
  ingredientId: string;
  width: number;
  height: number;
  viewBox: string;
  svgContent: string;
}

export class IngredientMasterGraphics {
  private static _cache = new Map<string, string>();

  /**
   * Generates the SVG string (1024x1024) for an ingredient.
   */
  static getMasterSvg(ingredientId: string): string {
    const cached = this._cache.get(ingredientId);
    if (cached) return cached;

    const def = this._definitions[ingredientId];
    if (!def) {
      // Fallback graphic for unknown ingredient
      const fallback = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
        <rect width="1024" height="1024" fill="#F8F9FA"/>
        <circle cx="512" cy="512" r="400" fill="#E9ECEF" stroke="#CED4DA" stroke-width="16"/>
        <text x="512" y="540" font-family="sans-serif" font-size="120" text-anchor="middle" fill="#6C757D">${ingredientId}</text>
      </svg>`;
      return fallback;
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${def.viewBox}" width="${def.width}" height="${def.height}">
      <defs>
        <filter id="subtle-shadow" x="-5%" y="-5%" width="115%" height="115%">
          <feDropShadow dx="0" dy="16" stdDeviation="16" flood-color="rgba(0,0,0,0.18)"/>
        </filter>
        <radialGradient id="egg-yolk-grad" cx="40%" cy="40%" r="60%">
          <stop offset="0%" stop-color="#FFDD00"/>
          <stop offset="65%" stop-color="#FF9E00"/>
          <stop offset="100%" stop-color="#E85D04"/>
        </radialGradient>
        <radialGradient id="tomato-grad" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#FF4D4D"/>
          <stop offset="70%" stop-color="#D90429"/>
          <stop offset="100%" stop-color="#800016"/>
        </radialGradient>
        <linearGradient id="bread-crust" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#9C6644"/>
          <stop offset="40%" stop-color="#B08968"/>
          <stop offset="100%" stop-color="#7F4F24"/>
        </linearGradient>
        <linearGradient id="bread-crumb" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#FFF1D6"/>
          <stop offset="100%" stop-color="#EED7A1"/>
        </linearGradient>
        <linearGradient id="beef-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#7F4F24"/>
          <stop offset="50%" stop-color="#582F0E"/>
          <stop offset="100%" stop-color="#331A05"/>
        </linearGradient>
        <linearGradient id="bacon-fat" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#FDF0D5"/>
          <stop offset="50%" stop-color="#FFFFFF"/>
          <stop offset="100%" stop-color="#FDF0D5"/>
        </linearGradient>
      </defs>
      ${def.svgContent}
    </svg>`;

    this._cache.set(ingredientId, svg);
    return svg;
  }

  private static _definitions: Record<string, MasterGraphicDefinition> = {
    // 1. 面包 (Bread)
    bread: {
      ingredientId: 'bread',
      width: 1024,
      height: 1024,
      viewBox: '0 0 1024 1024',
      svgContent: `
        <g id="bread-layer" filter="url(#subtle-shadow)">
          <!-- Crust outer silhouette -->
          <path d="M 212 360 C 212 200, 340 140, 512 140 C 684 140, 812 200, 812 360 C 830 520, 812 760, 780 840 C 750 880, 274 880, 244 840 C 212 760, 194 520, 212 360 Z"
            fill="url(#bread-crust)" stroke="#582F0E" stroke-width="24" stroke-linejoin="round"/>
          <!-- Crumb body -->
          <path d="M 248 380 C 248 240, 360 180, 512 180 C 664 180, 776 240, 776 380 C 790 520, 774 740, 750 810 C 720 840, 304 840, 274 810 C 250 740, 234 520, 248 380 Z"
            fill="url(#bread-crumb)"/>
          <!-- Pores & Toasting marks -->
          <ellipse cx="380" cy="420" rx="36" ry="24" fill="#DDB892" opacity="0.6"/>
          <ellipse cx="640" cy="460" rx="44" ry="28" fill="#DDB892" opacity="0.6"/>
          <ellipse cx="500" cy="620" rx="52" ry="32" fill="#DDB892" opacity="0.5"/>
          <ellipse cx="340" cy="680" rx="28" ry="20" fill="#DDB892" opacity="0.6"/>
          <ellipse cx="660" cy="710" rx="32" ry="22" fill="#DDB892" opacity="0.6"/>
          <!-- Butter/gloss highlight -->
          <path d="M 320 280 C 400 230, 624 230, 704 280" stroke="#FFF9EB" stroke-width="18" stroke-linecap="round" fill="none" opacity="0.8"/>
        </g>
      `
    },

    // 2. 煎蛋 (Egg)
    egg: {
      ingredientId: 'egg',
      width: 1024,
      height: 1024,
      viewBox: '0 0 1024 1024',
      svgContent: `
        <g id="egg-layer" filter="url(#subtle-shadow)">
          <!-- Crispy lace base -->
          <path d="M 240 500 C 160 360, 300 200, 480 180 C 660 160, 860 260, 860 460 C 860 660, 740 840, 520 860 C 300 880, 180 780, 180 640 C 180 570, 210 530, 240 500 Z"
            fill="#FFF9E6" stroke="#DDA15E" stroke-width="20" stroke-linejoin="round"/>
          <!-- Golden crisp fringe -->
          <path d="M 230 680 Q 200 730 250 780 Q 380 880 550 850 Q 730 830 820 690" fill="none" stroke="#BC6C25" stroke-width="14" stroke-linecap="round" opacity="0.7"/>
          <!-- Plump 3D Yolk -->
          <circle cx="530" cy="480" r="190" fill="url(#egg-yolk-grad)" stroke="#9E2A2B" stroke-width="12"/>
          <!-- Gloss highlight -->
          <ellipse cx="470" cy="410" rx="55" ry="32" transform="rotate(-30 470 410)" fill="#FFFFFF" opacity="0.85"/>
          <circle cx="430" cy="460" r="14" fill="#FFFFFF" opacity="0.7"/>
        </g>
      `
    },

    // 3. 生菜 (Lettuce)
    lettuce: {
      ingredientId: 'lettuce',
      width: 1024,
      height: 1024,
      viewBox: '0 0 1024 1024',
      svgContent: `
        <g id="lettuce-layer" filter="url(#subtle-shadow)">
          <!-- Ruffled crisp outer edge -->
          <path d="M 280 280 C 220 340, 160 480, 200 620 C 240 760, 380 840, 520 860 C 680 880, 820 780, 840 620 C 860 460, 800 320, 700 240 C 600 160, 420 180, 340 220 Z"
            fill="#52B788" stroke="#1B4332" stroke-width="22" stroke-linejoin="round"/>
          <!-- Inner leaf curl & layers -->
          <path d="M 320 320 C 260 420, 280 660, 400 760 C 520 860, 680 800, 740 680 C 800 560, 760 380, 660 300 C 560 220, 400 240, 320 320 Z"
            fill="#74C69D"/>
          <!-- Leaf stem / ribs -->
          <path d="M 512 860 C 510 680, 480 480, 450 360" stroke="#D8F3DC" stroke-width="26" stroke-linecap="round" fill="none"/>
          <path d="M 490 620 C 430 570, 350 560, 290 580" stroke="#B7E4C7" stroke-width="16" stroke-linecap="round" fill="none"/>
          <path d="M 500 520 C 570 480, 660 490, 720 520" stroke="#B7E4C7" stroke-width="16" stroke-linecap="round" fill="none"/>
          <!-- Fresh dew highlights -->
          <circle cx="360" cy="420" r="16" fill="#FFFFFF" opacity="0.6"/>
          <circle cx="680" cy="620" r="14" fill="#FFFFFF" opacity="0.6"/>
        </g>
      `
    },

    // 4. 番茄 (Tomato)
    tomato: {
      ingredientId: 'tomato',
      width: 1024,
      height: 1024,
      viewBox: '0 0 1024 1024',
      svgContent: `
        <g id="tomato-layer" filter="url(#subtle-shadow)">
          <!-- Ripe tomato body -->
          <circle cx="512" cy="530" r="350" fill="url(#tomato-grad)" stroke="#4A0E17" stroke-width="24"/>
          <!-- Inner pulp cavity patterns -->
          <ellipse cx="400" cy="460" rx="80" ry="60" transform="rotate(-25 400 460)" fill="#740015" stroke="#9E2A2B" stroke-width="8"/>
          <ellipse cx="624" cy="460" rx="80" ry="60" transform="rotate(25 624 460)" fill="#740015" stroke="#9E2A2B" stroke-width="8"/>
          <ellipse cx="420" cy="640" rx="75" ry="55" transform="rotate(20 420 640)" fill="#740015" stroke="#9E2A2B" stroke-width="8"/>
          <ellipse cx="604" cy="640" rx="75" ry="55" transform="rotate(-20 604 640)" fill="#740015" stroke="#9E2A2B" stroke-width="8"/>
          <!-- Jelly seeds -->
          <ellipse cx="400" cy="460" rx="16" ry="10" fill="#FFF3B0"/>
          <ellipse cx="624" cy="460" rx="16" ry="10" fill="#FFF3B0"/>
          <ellipse cx="420" cy="640" rx="16" ry="10" fill="#FFF3B0"/>
          <ellipse cx="604" cy="640" rx="16" ry="10" fill="#FFF3B0"/>
          <!-- Green calyx (Stem) on top -->
          <path d="M 512 210 Q 520 120 540 80" stroke="#2D6A4F" stroke-width="22" stroke-linecap="round" fill="none"/>
          <path d="M 512 210 L 410 170 L 460 220 L 370 260 L 460 265 L 430 330 L 512 270 L 594 330 L 564 265 L 654 260 L 564 220 L 614 170 Z"
            fill="#40916C" stroke="#1B4332" stroke-width="12" stroke-linejoin="round"/>
          <!-- High gloss sheen -->
          <path d="M 330 380 A 260 260 0 0 1 650 300" stroke="#FFFFFF" stroke-width="20" stroke-linecap="round" fill="none" opacity="0.6"/>
        </g>
      `
    },

    // 5. 芝士 (Cheese)
    cheese: {
      ingredientId: 'cheese',
      width: 1024,
      height: 1024,
      viewBox: '0 0 1024 1024',
      svgContent: `
        <g id="cheese-layer" filter="url(#subtle-shadow)">
          <!-- Melted sharp cheese slice -->
          <path d="M 220 260 L 804 260 L 824 760 L 200 760 Z"
            fill="#FFB703" stroke="#D48B00" stroke-width="22" stroke-linejoin="round"/>
          <!-- Distinctive cheese holes / pores -->
          <circle cx="340" cy="380" r="48" fill="#FB8500"/>
          <circle cx="330" cy="370" r="44" fill="#E07A5F" opacity="0.4"/>
          <circle cx="680" cy="420" r="62" fill="#FB8500"/>
          <circle cx="670" cy="410" r="56" fill="#E07A5F" opacity="0.4"/>
          <circle cx="480" cy="560" r="54" fill="#FB8500"/>
          <circle cx="310" cy="650" r="38" fill="#FB8500"/>
          <circle cx="650" cy="660" r="46" fill="#FB8500"/>
          <!-- Golden highlight rim -->
          <line x1="240" y1="285" x2="784" y2="285" stroke="#FFE49E" stroke-width="16" stroke-linecap="round"/>
        </g>
      `
    },

    // 6. 牛肉 (Beef Patty)
    beef: {
      ingredientId: 'beef',
      width: 1024,
      height: 1024,
      viewBox: '0 0 1024 1024',
      svgContent: `
        <g id="beef-layer" filter="url(#subtle-shadow)">
          <!-- Thick seared burger patty -->
          <ellipse cx="512" cy="512" rx="360" ry="340" fill="url(#beef-grad)" stroke="#2B1506" stroke-width="24"/>
          <!-- Grill crosshatch marks -->
          <line x1="300" y1="360" x2="724" y2="660" stroke="#1D0E04" stroke-width="28" stroke-linecap="round"/>
          <line x1="240" y1="500" x2="664" y2="800" stroke="#1D0E04" stroke-width="28" stroke-linecap="round"/>
          <line x1="360" y1="220" x2="784" y2="520" stroke="#1D0E04" stroke-width="28" stroke-linecap="round"/>
          <line x1="300" y1="660" x2="724" y2="360" stroke="#1D0E04" stroke-width="28" stroke-linecap="round"/>
          <line x1="240" y1="520" x2="664" y2="220" stroke="#1D0E04" stroke-width="28" stroke-linecap="round"/>
          <!-- Pepper & seasoning flakes -->
          <circle cx="420" cy="460" r="8" fill="#000000"/>
          <circle cx="580" cy="420" r="8" fill="#000000"/>
          <circle cx="500" cy="540" r="7" fill="#000000"/>
          <circle cx="620" cy="580" r="9" fill="#000000"/>
          <circle cx="380" cy="600" r="8" fill="#000000"/>
          <!-- Juicy sizzle sheen -->
          <path d="M 380 320 A 240 220 0 0 1 640 280" stroke="#A66A38" stroke-width="16" stroke-linecap="round" fill="none" opacity="0.8"/>
        </g>
      `
    },

    // 7. 鸡肉 (Chicken Cutlet)
    chicken: {
      ingredientId: 'chicken',
      width: 1024,
      height: 1024,
      viewBox: '0 0 1024 1024',
      svgContent: `
        <g id="chicken-layer" filter="url(#subtle-shadow)">
          <!-- Crispy fried golden cutlet -->
          <path d="M 280 360 C 200 480, 240 680, 360 780 C 500 890, 720 860, 810 720 C 890 580, 840 400, 720 300 C 600 210, 380 230, 280 360 Z"
            fill="#F39C12" stroke="#B9770E" stroke-width="22" stroke-linejoin="round"/>
          <!-- Panko crispy crust texture -->
          <ellipse cx="440" cy="480" rx="30" ry="16" fill="#F8C471"/>
          <ellipse cx="620" cy="440" rx="36" ry="18" fill="#F8C471"/>
          <ellipse cx="520" cy="620" rx="32" ry="18" fill="#F8C471"/>
          <ellipse cx="680" cy="620" rx="28" ry="16" fill="#F8C471"/>
          <ellipse cx="380" cy="640" rx="34" ry="18" fill="#F8C471"/>
          <!-- Herb parsley flakes -->
          <circle cx="480" cy="420" r="9" fill="#27AE60"/>
          <circle cx="560" cy="540" r="8" fill="#27AE60"/>
          <circle cx="420" cy="560" r="8" fill="#27AE60"/>
          <circle cx="650" cy="520" r="9" fill="#27AE60"/>
        </g>
      `
    },

    // 8. 土豆 (Potato)
    potato: {
      ingredientId: 'potato',
      width: 1024,
      height: 1024,
      viewBox: '0 0 1024 1024',
      svgContent: `
        <g id="potato-layer" filter="url(#subtle-shadow)">
          <!-- Fluffy potato silhouette -->
          <path d="M 300 280 C 180 360, 160 560, 240 720 C 320 860, 600 880, 740 800 C 880 700, 880 480, 800 340 C 720 200, 420 180, 300 280 Z"
            fill="#E0A96D" stroke="#774936" stroke-width="22" stroke-linejoin="round"/>
          <!-- Starch core / baked slit -->
          <ellipse cx="512" cy="512" rx="240" ry="190" fill="#F7D070"/>
          <!-- Butter pat in the center -->
          <rect x="440" y="450" width="144" height="110" rx="20" fill="#FFF3B0" stroke="#F1A208" stroke-width="10"/>
          <line x1="450" y1="560" x2="574" y2="560" stroke="#F48C06" stroke-width="12" stroke-linecap="round"/>
          <!-- Russet potato eyes -->
          <ellipse cx="280" cy="460" rx="16" ry="8" fill="#6A381F"/>
          <ellipse cx="740" cy="460" rx="18" ry="10" fill="#6A381F"/>
          <ellipse cx="640" cy="740" rx="18" ry="9" fill="#6A381F"/>
        </g>
      `
    },

    // 9. 米饭 (Rice)
    rice: {
      ingredientId: 'rice',
      width: 1024,
      height: 1024,
      viewBox: '0 0 1024 1024',
      svgContent: `
        <g id="rice-layer" filter="url(#subtle-shadow)">
          <!-- Steaming mound of pearly rice -->
          <ellipse cx="512" cy="560" rx="360" ry="300" fill="#F8F9FA" stroke="#ADB5BD" stroke-width="22"/>
          <!-- Rice grain pile details -->
          <ellipse cx="440" cy="440" rx="32" ry="16" transform="rotate(-20 440 440)" fill="#FFFFFF" stroke="#DEE2E6" stroke-width="6"/>
          <ellipse cx="520" cy="420" rx="32" ry="16" transform="rotate(30 520 420)" fill="#FFFFFF" stroke="#DEE2E6" stroke-width="6"/>
          <ellipse cx="590" cy="450" rx="32" ry="16" transform="rotate(-15 590 450)" fill="#FFFFFF" stroke="#DEE2E6" stroke-width="6"/>
          <ellipse cx="480" cy="510" rx="32" ry="16" transform="rotate(45 480 510)" fill="#FFFFFF" stroke="#DEE2E6" stroke-width="6"/>
          <ellipse cx="560" cy="520" rx="32" ry="16" transform="rotate(-35 560 520)" fill="#FFFFFF" stroke="#DEE2E6" stroke-width="6"/>
          <ellipse cx="400" cy="540" rx="32" ry="16" transform="rotate(10 400 540)" fill="#FFFFFF" stroke="#DEE2E6" stroke-width="6"/>
          <ellipse cx="640" cy="530" rx="32" ry="16" transform="rotate(25 640 530)" fill="#FFFFFF" stroke="#DEE2E6" stroke-width="6"/>
          <!-- Black sesame garnish -->
          <circle cx="512" cy="460" r="8" fill="#212529"/>
          <circle cx="470" cy="470" r="7" fill="#212529"/>
          <circle cx="550" cy="480" r="7" fill="#212529"/>
          <!-- Steam whisps -->
          <path d="M 440 260 Q 420 200 450 140" stroke="#CED4DA" stroke-width="12" stroke-linecap="round" fill="none" opacity="0.6"/>
          <path d="M 520 250 Q 550 190 520 130" stroke="#CED4DA" stroke-width="12" stroke-linecap="round" fill="none" opacity="0.6"/>
          <path d="M 600 270 Q 580 210 610 150" stroke="#CED4DA" stroke-width="12" stroke-linecap="round" fill="none" opacity="0.6"/>
        </g>
      `
    },

    // 10. 面条 (Noodle)
    noodle: {
      ingredientId: 'noodle',
      width: 1024,
      height: 1024,
      viewBox: '0 0 1024 1024',
      svgContent: `
        <g id="noodle-layer" filter="url(#subtle-shadow)">
          <!-- Broth backing -->
          <ellipse cx="512" cy="512" rx="360" ry="340" fill="#F4A261" stroke="#A75D00" stroke-width="22"/>
          <!-- Swirling springy ramen noodle strands -->
          <path d="M 280 420 Q 420 300 560 440 T 780 400" stroke="#FFF3B0" stroke-width="32" stroke-linecap="round" fill="none"/>
          <path d="M 240 500 Q 380 620 540 480 T 790 540" stroke="#FFE680" stroke-width="32" stroke-linecap="round" fill="none"/>
          <path d="M 290 600 Q 440 480 580 620 T 750 630" stroke="#FFF3B0" stroke-width="32" stroke-linecap="round" fill="none"/>
          <path d="M 360 360 Q 500 500 660 360 T 740 480" stroke="#FFE680" stroke-width="28" stroke-linecap="round" fill="none"/>
          <!-- Chopped green scallion garnish -->
          <ellipse cx="440" cy="480" rx="20" ry="12" fill="#2A9D8F" stroke="#1D3557" stroke-width="6"/>
          <ellipse cx="580" cy="520" rx="20" ry="12" fill="#2A9D8F" stroke="#1D3557" stroke-width="6"/>
          <ellipse cx="520" cy="380" rx="18" ry="10" fill="#2A9D8F" stroke="#1D3557" stroke-width="6"/>
          <ellipse cx="640" cy="440" rx="18" ry="10" fill="#2A9D8F" stroke="#1D3557" stroke-width="6"/>
        </g>
      `
    },

    // 11. 洋葱 (Onion)
    onion: {
      ingredientId: 'onion',
      width: 1024,
      height: 1024,
      viewBox: '0 0 1024 1024',
      svgContent: `
        <g id="onion-layer" filter="url(#subtle-shadow)">
          <!-- Purple red onion outer ring -->
          <circle cx="512" cy="512" r="350" fill="#FAF0CA" stroke="#7209B7" stroke-width="36"/>
          <!-- Inner ring 2 -->
          <circle cx="512" cy="512" r="270" fill="#FFFFFF" stroke="#B5179E" stroke-width="28"/>
          <!-- Inner ring 3 -->
          <circle cx="512" cy="512" r="190" fill="#FAF0CA" stroke="#7209B7" stroke-width="24"/>
          <!-- Onion heart -->
          <circle cx="512" cy="512" r="100" fill="#4CC9F0" stroke="#560BAD" stroke-width="20"/>
          <circle cx="512" cy="512" r="50" fill="#7209B7"/>
          <!-- Radial striations -->
          <line x1="512" y1="162" x2="512" y2="242" stroke="#7209B7" stroke-width="12" stroke-linecap="round"/>
          <line x1="512" y1="782" x2="512" y2="862" stroke="#7209B7" stroke-width="12" stroke-linecap="round"/>
          <line x1="162" y1="512" x2="242" y2="512" stroke="#7209B7" stroke-width="12" stroke-linecap="round"/>
          <line x1="782" y1="512" x2="862" y2="512" stroke="#7209B7" stroke-width="12" stroke-linecap="round"/>
        </g>
      `
    },

    // 12. 胡萝卜 (Carrot)
    carrot: {
      ingredientId: 'carrot',
      width: 1024,
      height: 1024,
      viewBox: '0 0 1024 1024',
      svgContent: `
        <g id="carrot-layer" filter="url(#subtle-shadow)">
          <!-- Carrot coin slice -->
          <circle cx="512" cy="512" r="350" fill="#FB5607" stroke="#9E2A2B" stroke-width="24"/>
          <!-- Xylem core ring -->
          <circle cx="512" cy="512" r="180" fill="#FFBE0B" stroke="#F77F00" stroke-width="16"/>
          <circle cx="512" cy="512" r="80" fill="#FCBF49"/>
          <!-- Starburst rays from core -->
          <line x1="512" y1="210" x2="512" y2="300" stroke="#FF7B00" stroke-width="14" stroke-linecap="round"/>
          <line x1="512" y1="724" x2="512" y2="814" stroke="#FF7B00" stroke-width="14" stroke-linecap="round"/>
          <line x1="210" y1="512" x2="300" y2="512" stroke="#FF7B00" stroke-width="14" stroke-linecap="round"/>
          <line x1="724" y1="512" x2="814" y2="512" stroke="#FF7B00" stroke-width="14" stroke-linecap="round"/>
          <line x1="298" y1="298" x2="368" y2="368" stroke="#FF7B00" stroke-width="14" stroke-linecap="round"/>
          <line x1="656" y1="656" x2="726" y2="726" stroke="#FF7B00" stroke-width="14" stroke-linecap="round"/>
          <line x1="298" y1="726" x2="368" y2="656" stroke="#FF7B00" stroke-width="14" stroke-linecap="round"/>
          <line x1="656" y1="368" x2="726" y2="298" stroke="#FF7B00" stroke-width="14" stroke-linecap="round"/>
        </g>
      `
    },

    // 13. 培根 (Bacon)
    bacon: {
      ingredientId: 'bacon',
      width: 1024,
      height: 1024,
      viewBox: '0 0 1024 1024',
      svgContent: `
        <g id="bacon-layer" filter="url(#subtle-shadow)">
          <!-- Wavy cured bacon strip -->
          <path d="M 200 420 Q 350 260 500 420 T 824 420 L 824 640 Q 674 800 500 640 T 200 640 Z"
            fill="#B7094C" stroke="#590D22" stroke-width="24" stroke-linejoin="round"/>
          <!-- Marbled fat ribbon 1 -->
          <path d="M 210 470 Q 355 330 500 470 T 814 470" stroke="#FFF0F5" stroke-width="36" stroke-linecap="round" fill="none"/>
          <!-- Marbled fat ribbon 2 -->
          <path d="M 210 570 Q 355 430 500 570 T 814 570" stroke="#FFE4E6" stroke-width="28" stroke-linecap="round" fill="none"/>
          <!-- Crispy caramelized edges -->
          <path d="M 200 420 Q 350 260 500 420 T 824 420" stroke="#480CA8" stroke-width="14" stroke-linecap="round" fill="none" opacity="0.6"/>
          <path d="M 200 640 Q 350 480 500 640 T 824 640" stroke="#480CA8" stroke-width="14" stroke-linecap="round" fill="none" opacity="0.6"/>
        </g>
      `
    },

    // 14. 蘑菇 (Mushroom)
    mushroom: {
      ingredientId: 'mushroom',
      width: 1024,
      height: 1024,
      viewBox: '0 0 1024 1024',
      svgContent: `
        <g id="mushroom-layer" filter="url(#subtle-shadow)">
          <!-- Stalk base -->
          <path d="M 430 460 L 410 820 C 410 860, 614 860, 614 820 L 594 460 Z"
            fill="#EDE0D4" stroke="#7F5539" stroke-width="20" stroke-linejoin="round"/>
          <!-- Umbrella cap -->
          <path d="M 200 480 C 200 240, 340 160, 512 160 C 684 160, 824 240, 824 480 C 824 530, 770 540, 680 520 C 580 500, 444 500, 344 520 C 254 540, 200 530, 200 480 Z"
            fill="#B08968" stroke="#582F0E" stroke-width="24" stroke-linejoin="round"/>
          <!-- Delicate gills under cap -->
          <line x1="320" y1="510" x2="380" y2="460" stroke="#7F5539" stroke-width="10" stroke-linecap="round"/>
          <line x1="420" y1="495" x2="445" y2="455" stroke="#7F5539" stroke-width="10" stroke-linecap="round"/>
          <line x1="604" y1="495" x2="579" y2="455" stroke="#7F5539" stroke-width="10" stroke-linecap="round"/>
          <line x1="704" y1="510" x2="644" y2="460" stroke="#7F5539" stroke-width="10" stroke-linecap="round"/>
          <!-- Cap highlight -->
          <path d="M 320 280 Q 512 210 704 280" stroke="#E6CCB2" stroke-width="20" stroke-linecap="round" fill="none" opacity="0.8"/>
        </g>
      `
    },

    // 15. 虾仁 (Shrimp)
    shrimp: {
      ingredientId: 'shrimp',
      width: 1024,
      height: 1024,
      viewBox: '0 0 1024 1024',
      svgContent: `
        <g id="shrimp-layer" filter="url(#subtle-shadow)">
          <!-- Curled king shrimp body -->
          <path d="M 300 240 C 480 140, 740 200, 800 420 C 850 600, 720 780, 520 840 C 380 880, 280 780, 320 680 C 360 580, 480 620, 540 580 C 600 540, 620 440, 560 360 C 500 280, 380 300, 300 240 Z"
            fill="#FF758F" stroke="#A4133C" stroke-width="24" stroke-linejoin="round"/>
          <!-- Segment lines -->
          <path d="M 580 200 Q 640 280 580 340" stroke="#FF4D6D" stroke-width="16" stroke-linecap="round" fill="none"/>
          <path d="M 720 320 Q 740 420 640 440" stroke="#FF4D6D" stroke-width="16" stroke-linecap="round" fill="none"/>
          <path d="M 750 480 Q 720 580 620 560" stroke="#FF4D6D" stroke-width="16" stroke-linecap="round" fill="none"/>
          <path d="M 640 680 Q 580 740 500 680" stroke="#FF4D6D" stroke-width="16" stroke-linecap="round" fill="none"/>
          <!-- Shrimp tail fan -->
          <path d="M 280 780 L 180 840 L 220 760 L 160 700 L 260 720 Z"
            fill="#FF4D6D" stroke="#A4133C" stroke-width="14" stroke-linejoin="round"/>
          <!-- Gloss highlight -->
          <path d="M 440 200 Q 640 210 720 320" stroke="#FFF0F3" stroke-width="20" stroke-linecap="round" fill="none" opacity="0.8"/>
        </g>
      `
    },

    // 16. 玉米 (Corn)
    corn: {
      ingredientId: 'corn',
      width: 1024,
      height: 1024,
      viewBox: '0 0 1024 1024',
      svgContent: `
        <g id="corn-layer" filter="url(#subtle-shadow)">
          <!-- Cob body -->
          <rect x="300" y="240" width="424" height="544" rx="160" fill="#FFCA3A" stroke="#C49B00" stroke-width="24"/>
          <!-- Kernels grid (glossy rounded nuggets) -->
          <!-- Row 1 -->
          <rect x="360" y="320" width="80" height="60" rx="16" fill="#FFD670" stroke="#E0A900" stroke-width="8"/>
          <rect x="472" y="320" width="80" height="60" rx="16" fill="#FFD670" stroke="#E0A900" stroke-width="8"/>
          <rect x="584" y="320" width="80" height="60" rx="16" fill="#FFD670" stroke="#E0A900" stroke-width="8"/>
          <!-- Row 2 -->
          <rect x="340" y="420" width="80" height="60" rx="16" fill="#FFD670" stroke="#E0A900" stroke-width="8"/>
          <rect x="440" y="420" width="80" height="60" rx="16" fill="#FFD670" stroke="#E0A900" stroke-width="8"/>
          <rect x="540" y="420" width="80" height="60" rx="16" fill="#FFD670" stroke="#E0A900" stroke-width="8"/>
          <rect x="640" y="420" width="60" height="60" rx="16" fill="#FFD670" stroke="#E0A900" stroke-width="8"/>
          <!-- Row 3 -->
          <rect x="340" y="520" width="80" height="60" rx="16" fill="#FFD670" stroke="#E0A900" stroke-width="8"/>
          <rect x="440" y="520" width="80" height="60" rx="16" fill="#FFD670" stroke="#E0A900" stroke-width="8"/>
          <rect x="540" y="520" width="80" height="60" rx="16" fill="#FFD670" stroke="#E0A900" stroke-width="8"/>
          <rect x="640" y="520" width="60" height="60" rx="16" fill="#FFD670" stroke="#E0A900" stroke-width="8"/>
          <!-- Row 4 -->
          <rect x="360" y="620" width="80" height="60" rx="16" fill="#FFD670" stroke="#E0A900" stroke-width="8"/>
          <rect x="472" y="620" width="80" height="60" rx="16" fill="#FFD670" stroke="#E0A900" stroke-width="8"/>
          <rect x="584" y="620" width="80" height="60" rx="16" fill="#FFD670" stroke="#E0A900" stroke-width="8"/>
          <!-- Green husk leaves framing bottom -->
          <path d="M 280 660 Q 240 820 400 860 L 512 800 L 624 860 Q 784 820 744 660 Z"
            fill="#80B918" stroke="#55A630" stroke-width="16" stroke-linejoin="round"/>
        </g>
      `
    }
  };
}
