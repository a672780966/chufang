/**
 * DishManifest.ts
 * Single source of truth for the Production Image Generation Pipeline.
 * Specifies prompts, constraints, approved SHA256 hashes, and puzzle layout for all dishes.
 */

export interface DishManifestEntry {
  dishId: string;
  name: string;
  category: string;
  generationPrompt: string;
  constraints: string[];
  masterAsset: string;
  approvedHash: string;
  puzzleRowsCols: { rows: number; cols: number };
  totalPieces: number;
  orderRevenue: number;
  pieceAssetPrefix: string;
  atlasAsset: string;
  visualDifficulty?: 'EASY' | 'MEDIUM' | 'HARD';
}

export const DISH_MANIFEST: Record<string, DishManifestEntry> = {
  dish_breakfast: {
    dishId: 'dish_breakfast',
    name: '春日早餐盘',
    category: 'Breakfast',
    visualDifficulty: 'MEDIUM',
    generationPrompt:
      'Ghibli anime style, a delicious Japanese cafe breakfast platter, top-down 1:1 view. A golden thick butter toast with crisp browned edges, a sunny-side up egg with runny orange yolk, crispy smoked bacon ribbons, fresh cherry tomato wedges, arugula salad, brie cheese slice with cracked black pepper. Served in a clean white porcelain round plate fully visible. Soft daylight, warm pastel colors, high appetite appeal, watercolor texture, clean aesthetic.',
    constraints: [
      '1:1 square composition',
      'Complete dish centered with full circular ceramic plate rim visible',
      'Clean background with subtle soft studio shadow',
      'Distinct visual elements in 6-10 regions (toast, yolk, egg white, bacon, greens, tomato, cheese)',
      'Cross-seam pattern continuity for jigsaw adjacency cues'
    ],
    masterAsset: '/assets/dishes/dish_breakfast_master.jpg',
    approvedHash: '80342B5EC130F05C45929D356B5BA149BB959A5AA7BC15675F8B6320B7B1AABE',
    puzzleRowsCols: { rows: 3, cols: 3 },
    totalPieces: 9,
    orderRevenue: 85,
    pieceAssetPrefix: '/assets/dishes/piece_dish_breakfast_slot_',
    atlasAsset: '/assets/dishes/atlas_dish_breakfast.png'
  },
  dish_salad: {
    dishId: 'dish_salad',
    name: '田园沙拉',
    category: 'Salad',
    visualDifficulty: 'MEDIUM',
    generationPrompt:
      'Ghibli anime style, a refreshing Japanese garden salad bowl, flat lay 1:1 centered view. Fresh crisp lettuce leaves, soft-boiled ajitama egg halved showing glistening jammy orange yolks, sweet yellow corn kernels clustered at center, ripe red tomato wedges, sautéed brown button mushroom slices, purple onion rings, crushed walnuts. Served in a shallow celadon ceramic pottery bowl with complete rim visible. Warm pastel ambient light, appetizing, clean minimal background.',
    constraints: [
      '1:1 square composition',
      'Complete dish centered with full circular celadon ceramic bowl rim visible',
      'Clean background with subtle soft studio shadow',
      'Distinct visual elements in 6-10 regions (corn center, eggs, tomatoes, mushrooms, purple onion, lettuce)',
      'Cross-seam pattern continuity for jigsaw adjacency cues'
    ],
    masterAsset: '/assets/dishes/dish_salad_master.jpg',
    approvedHash: '464DBA9C95C00C3B8D8A4D0CCEAFB7B625130FA4F2A426F535D4A37B846DC142',
    puzzleRowsCols: { rows: 3, cols: 3 },
    totalPieces: 9,
    orderRevenue: 70,
    pieceAssetPrefix: '/assets/dishes/piece_dish_salad_slot_',
    atlasAsset: '/assets/dishes/atlas_dish_salad.png'
  },
  dish_ramen: {
    dishId: 'dish_ramen',
    name: '豚骨拉面',
    category: 'Ramen',
    visualDifficulty: 'EASY',
    generationPrompt:
      'Ghibli anime style, comforting Japanese shoyu ramen, top-down 1:1 view. Steaming clear amber broth, wavy yellow ramen noodles visible, two tender rolled chashu pork slices, halved ajitama ramen egg, bright chopped scallions, dark nori seaweed sheet, pink spiral narutomaki fish cake slice. Served in a deep blue and white traditional ceramic ramen bowl with visible rim. Highly appetizing, anime movie food illustration, clean minimal background.',
    constraints: [
      '1:1 square composition',
      'Complete dish centered with full circular ceramic ramen bowl rim visible',
      'Clean background with subtle soft studio shadow',
      'Distinct visual elements in 6-10 regions (chashu, egg, scallions, nori, naruto swirl, noodles, broth)',
      'Cross-seam pattern continuity for jigsaw adjacency cues'
    ],
    masterAsset: '/assets/dishes/dish_ramen_master.jpg',
    approvedHash: '7FCE8C677B21909679A62456057E5304C38999A3FC04217F8544AD66853C9D18',
    puzzleRowsCols: { rows: 3, cols: 3 },
    totalPieces: 9,
    orderRevenue: 90,
    pieceAssetPrefix: '/assets/dishes/piece_dish_ramen_slot_',
    atlasAsset: '/assets/dishes/atlas_dish_ramen.png'
  },
  dish_curry_rice: {
    dishId: 'dish_curry_rice',
    name: '金黄咖喱饭',
    category: 'Curry',
    visualDifficulty: 'MEDIUM',
    generationPrompt:
      'Ghibli anime style, delicious Japanese golden curry rice, top-down 1:1 flat lay view. An oval white ceramic dish centered in the frame. On one side fluffy white pearl rice, on the other side rich glossy golden-brown Japanese curry sauce with tender beef cubes, carrot chunks, and soft potato cubes, garnished with a sprinkle of fresh green parsley and red fukujinzuke pickles. Soft daylight, warm cozy ambient lighting, watercolor textures, mouthwatering anime movie food, clean minimal background.',
    constraints: [
      '1:1 square composition',
      'Complete dish centered with full oval ceramic plate rim visible',
      'Clean background with subtle soft studio shadow',
      'Distinct visual elements in 6-10 regions (white rice, golden curry, beef chunks, potatoes, carrots, parsley, fukujinzuke)',
      'Cross-seam pattern continuity for jigsaw adjacency cues'
    ],
    masterAsset: '/assets/dishes/dish_curry_rice_master.jpg',
    approvedHash: '4F0A8858993F145671F5D1FA1D9C446C8CB9CB0C4182675540B19CD13F073AC5',
    puzzleRowsCols: { rows: 3, cols: 3 },
    totalPieces: 9,
    orderRevenue: 80,
    pieceAssetPrefix: '/assets/dishes/piece_dish_curry_rice_slot_',
    atlasAsset: '/assets/dishes/atlas_dish_curry_rice.png'
  },
  dish_tomato_pasta: {
    dishId: 'dish_tomato_pasta',
    name: '番茄肉酱意面',
    category: 'Pasta',
    visualDifficulty: 'EASY',
    generationPrompt:
      'Ghibli anime style, delicious Italian tomato bolognese pasta, top-down 1:1 flat lay view. A round white porcelain shallow pasta bowl centered in the frame with visible rim. In the center, twirled al dente golden spaghetti generously coated in rich glistening red tomato meat sauce, topped with sprinkled white parmesan cheese and vibrant fresh green basil leaves, cherry tomato garnish. Soft warm ambient lighting, watercolor textures, highly appetizing anime food illustration, clean minimal background.',
    constraints: [
      '1:1 square composition',
      'Complete dish centered with full circular ceramic bowl rim visible',
      'Clean background with subtle soft studio shadow',
      'Distinct visual elements in 6-10 regions (spaghetti coils, red bolognese sauce, parmesan cheese, basil leaves, cherry tomatoes)',
      'Cross-seam pattern continuity for jigsaw adjacency cues'
    ],
    masterAsset: '/assets/dishes/dish_tomato_pasta_master.jpg',
    approvedHash: '2BFB574724716E4BA625B73D3E780D8D905FFEE4DB1511B29679E13DC0F7679F',
    puzzleRowsCols: { rows: 3, cols: 3 },
    totalPieces: 9,
    orderRevenue: 85,
    pieceAssetPrefix: '/assets/dishes/piece_dish_tomato_pasta_slot_',
    atlasAsset: '/assets/dishes/atlas_dish_tomato_pasta.png'
  },
  dish_avocado_chicken_bowl: {
    dishId: 'dish_avocado_chicken_bowl',
    name: '牛油果鸡肉碗',
    category: 'Healthy',
    visualDifficulty: 'HARD',
    generationPrompt:
      'Ghibli anime style, healthy avocado grilled chicken grain bowl, top-down 1:1 flat lay view. A round ceramic pottery bowl centered in the frame with complete circular rim visible. Arranged neatly inside: perfectly fanned creamy green sliced avocado, tender golden grilled chicken breast slices with dark char grill marks, shredded purple cabbage, sweet yellow corn kernels, fluffy quinoa, edamame beans, toasted white sesame seeds, light drizzle of sesame dressing. Soft natural daylight, watercolor textures, vibrant appetizing anime movie food, clean minimal background.',
    constraints: [
      '1:1 square composition',
      'Complete dish centered with full circular ceramic bowl rim visible',
      'Clean background with subtle soft studio shadow',
      'Distinct visual elements in 6-10 regions (avocado fan, grilled chicken strips, shredded purple cabbage, corn, quinoa, edamame)',
      'Cross-seam pattern continuity for jigsaw adjacency cues'
    ],
    masterAsset: '/assets/dishes/dish_avocado_chicken_bowl_master.jpg',
    approvedHash: '84505167BBD5B71548C6E84A38424DAB9E587617E3A4F8D0B51253FE6E0652F3',
    puzzleRowsCols: { rows: 3, cols: 3 },
    totalPieces: 9,
    orderRevenue: 95,
    pieceAssetPrefix: '/assets/dishes/piece_dish_avocado_chicken_bowl_slot_',
    atlasAsset: '/assets/dishes/atlas_dish_avocado_chicken_bowl.png'
  },
  dish_shrimp_fried_rice: {
    dishId: 'dish_shrimp_fried_rice',
    name: '鲜虾蛋炒饭',
    category: 'Rice',
    visualDifficulty: 'HARD',
    generationPrompt:
      'Ghibli anime style, delicious Chinese shrimp and egg fried rice, top-down 1:1 flat lay view. A round dark navy ceramic plate with distinct dark rim centered in the frame. Golden fluffy fried rice grains evenly glistening, generously mixed with golden scrambled egg curds, plump juicy pink cooked shrimp distributed across the plate, vibrant green sweet peas, diced orange carrots, and finely chopped scallions. Clear texture across the entire plate with no plain blank areas. Soft warm ambient lighting, watercolor textures, highly appetizing anime food illustration, clean minimal background.',
    constraints: [
      '1:1 square composition',
      'Complete dish centered with full circular dark ceramic plate rim visible',
      'Clean background with subtle soft studio shadow',
      'Distinct visual elements in 6-10 regions (pink curved shrimp, golden egg curds, green peas, carrots, scallions, rice grains)',
      'Cross-seam pattern continuity for jigsaw adjacency cues'
    ],
    masterAsset: '/assets/dishes/dish_shrimp_fried_rice_master.jpg',
    approvedHash: 'E3CA60877A28C145B7DEAA7B4A8B9792100139E41352404B96EE88C6F45D5933',
    puzzleRowsCols: { rows: 3, cols: 3 },
    totalPieces: 9,
    orderRevenue: 75,
    pieceAssetPrefix: '/assets/dishes/piece_dish_shrimp_fried_rice_slot_',
    atlasAsset: '/assets/dishes/atlas_dish_shrimp_fried_rice.png'
  },
  dish_grilled_steak: {
    dishId: 'dish_grilled_steak',
    name: '炭烤牛排拼盘',
    category: 'Steak',
    visualDifficulty: 'MEDIUM',
    generationPrompt:
      'Ghibli anime style, a mouthwatering grilled sirloin steak platter, top-down 1:1 flat lay view. A round off-white ceramic dinner plate centered in the frame with visible rim. In the center, thick juicy grilled beef steak sliced to show medium-rare pink center with bold dark crosshatch char grill marks, melting herb garlic butter on top, flanked by golden crispy roasted baby potato halves, bright green charred asparagus spears, and blistered red cherry tomatoes on the vine. Deep rich brown tones, glistening meat juices, appetizing anime food illustration, clean minimal background.',
    constraints: [
      '1:1 square composition',
      'Complete dish centered with full circular ceramic platter rim visible',
      'Clean background with subtle soft studio shadow',
      'Distinct visual elements in 6-10 regions (steak slices, char crosshatch, melting herb butter, baby potatoes, green asparagus, cherry tomatoes)',
      'Cross-seam pattern continuity for jigsaw adjacency cues'
    ],
    masterAsset: '/assets/dishes/dish_grilled_steak_master.jpg',
    approvedHash: '680D0BA523796492117344A0EB6A3A8FD1640045F009379CF0D80B66327D51B0',
    puzzleRowsCols: { rows: 3, cols: 3 },
    totalPieces: 9,
    orderRevenue: 110,
    pieceAssetPrefix: '/assets/dishes/piece_dish_grilled_steak_slot_',
    atlasAsset: '/assets/dishes/atlas_dish_grilled_steak.png'
  }
};

/**
 * Backward compatibility alias for Stage 5A test suites and references.
 * Preserves the exact 3 Gold Sample dishes.
 */
export const GOLD_SAMPLE_DISH_MANIFEST: Record<string, DishManifestEntry> = {
  dish_breakfast: DISH_MANIFEST.dish_breakfast,
  dish_salad: DISH_MANIFEST.dish_salad,
  dish_ramen: DISH_MANIFEST.dish_ramen
};
