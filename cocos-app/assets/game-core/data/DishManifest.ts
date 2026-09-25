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
}

export const GOLD_SAMPLE_DISH_MANIFEST: Record<string, DishManifestEntry> = {
  dish_breakfast: {
    dishId: 'dish_breakfast',
    name: '春日早餐盘',
    category: 'Breakfast',
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
    name: '暖汤拉面',
    category: 'Noodles',
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
    orderRevenue: 95,
    pieceAssetPrefix: '/assets/dishes/piece_dish_ramen_slot_',
    atlasAsset: '/assets/dishes/atlas_dish_ramen.png'
  }
};
