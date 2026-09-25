/**
 * DishTextureManager.ts
 * Manages preloading and blitting of real AI-generated Master Dish Art and cut Puzzle Pieces.
 * Replaces procedural SVG and emoji rendering with production-grade raster textures.
 */

export interface DishPieceInfo {
  imagePath: string;
  image: HTMLImageElement | null;
}

export class DishTextureManager {
  private static _pieceCache = new Map<string, HTMLImageElement>();
  private static _dishMasterCache = new Map<string, HTMLImageElement>();
  private static _initialized = false;

  // Master Dish Art mapping for recipes
  static readonly DISH_MASTERS: Record<string, string> = {
    salad: '/assets/dishes/dish_salad_master.jpg',
    sandwich: '/assets/dishes/dish_breakfast_master.jpg',
    bacon_sandwich: '/assets/dishes/dish_breakfast_master.jpg',
    beef_noodle: '/assets/dishes/dish_ramen_master.jpg',
    chicken_noodle: '/assets/dishes/dish_ramen_master.jpg',
    burger: '/assets/dishes/dish_breakfast_master.jpg',
    bacon_burger: '/assets/dishes/dish_breakfast_master.jpg',
    egg_rice: '/assets/dishes/dish_breakfast_master.jpg',
    beef_rice: '/assets/dishes/dish_ramen_master.jpg',
    curry_chicken_rice: '/assets/dishes/dish_ramen_master.jpg',
    mushroom_soup: '/assets/dishes/dish_salad_master.jpg',
    veggie_platter: '/assets/dishes/dish_salad_master.jpg',
    fries_basket: '/assets/dishes/dish_breakfast_master.jpg'
  };

  /**
   * Deterministic mapping from (ingredientId, slotId) to cut piece textures.
   */
  static getPieceImagePath(ingredientId: string, slotId: string): string {
    // 1. Salad components (tomato, lettuce, corn, mushroom)
    if (ingredientId === 'tomato') {
      const map: Record<string, string> = {
        t_0: '/assets/dishes/piece_dish_salad_slot_1_2.png',
        t_1: '/assets/dishes/piece_dish_salad_slot_2_2.png',
        t_2: '/assets/dishes/piece_dish_salad_slot_0_1.png',
        t_3: '/assets/dishes/piece_dish_salad_slot_1_0.png'
      };
      return map[slotId] || '/assets/dishes/piece_dish_salad_slot_1_2.png';
    }

    if (ingredientId === 'lettuce') {
      const map: Record<string, string> = {
        l_0: '/assets/dishes/piece_dish_salad_slot_0_2.png',
        l_1: '/assets/dishes/piece_dish_salad_slot_2_1.png',
        l_2: '/assets/dishes/piece_dish_salad_slot_0_0.png',
        l_3: '/assets/dishes/piece_dish_salad_slot_2_0.png'
      };
      return map[slotId] || '/assets/dishes/piece_dish_salad_slot_0_2.png';
    }

    if (ingredientId === 'corn') {
      const cornSlots = [
        'piece_dish_salad_slot_1_1.png',
        'piece_dish_salad_slot_1_1.png',
        'piece_dish_salad_slot_1_1.png',
        'piece_dish_salad_slot_1_1.png',
        'piece_dish_salad_slot_1_0.png',
        'piece_dish_salad_slot_1_2.png',
        'piece_dish_salad_slot_0_1.png',
        'piece_dish_salad_slot_2_1.png'
      ];
      const idx = parseInt(slotId.replace(/\D/g, ''), 10) || 0;
      return `/assets/dishes/${cornSlots[idx % cornSlots.length]}`;
    }

    if (ingredientId === 'mushroom') {
      return '/assets/dishes/piece_dish_salad_slot_2_1.png';
    }

    // 2. Breakfast components (bread, egg, bacon, cheese)
    if (ingredientId === 'bread') {
      const map: Record<string, string> = {
        b_0: '/assets/dishes/piece_dish_breakfast_slot_0_2.png',
        b_1: '/assets/dishes/piece_dish_breakfast_slot_1_2.png',
        b_2: '/assets/dishes/piece_dish_breakfast_slot_0_1.png',
        b_3: '/assets/dishes/piece_dish_breakfast_slot_0_0.png'
      };
      return map[slotId] || '/assets/dishes/piece_dish_breakfast_slot_0_2.png';
    }

    if (ingredientId === 'egg') {
      const map: Record<string, string> = {
        eg_0: '/assets/dishes/piece_dish_breakfast_slot_1_1.png',
        eg_1: '/assets/dishes/piece_dish_breakfast_slot_1_0.png',
        eg_2: '/assets/dishes/piece_dish_salad_slot_0_1.png',
        eg_3: '/assets/dishes/piece_dish_salad_slot_1_0.png'
      };
      return map[slotId] || '/assets/dishes/piece_dish_breakfast_slot_1_1.png';
    }

    if (ingredientId === 'bacon') {
      const map: Record<string, string> = {
        bc_0: '/assets/dishes/piece_dish_breakfast_slot_2_1.png',
        bc_1: '/assets/dishes/piece_dish_breakfast_slot_2_0.png',
        bc_2: '/assets/dishes/piece_dish_breakfast_slot_1_0.png',
        bc_3: '/assets/dishes/piece_dish_breakfast_slot_2_1.png',
        bc_4: '/assets/dishes/piece_dish_breakfast_slot_2_0.png',
        bc_5: '/assets/dishes/piece_dish_breakfast_slot_1_0.png'
      };
      return map[slotId] || '/assets/dishes/piece_dish_breakfast_slot_2_0.png';
    }

    if (ingredientId === 'cheese') {
      return '/assets/dishes/piece_dish_breakfast_slot_2_1.png';
    }

    // 3. Ramen components (noodle, beef, onion, etc.)
    if (ingredientId === 'noodle') {
      const map: Record<string, string> = {
        nd_0: '/assets/dishes/piece_dish_ramen_slot_0_2.png',
        nd_1: '/assets/dishes/piece_dish_ramen_slot_1_2.png',
        nd_2: '/assets/dishes/piece_dish_ramen_slot_0_1.png',
        nd_3: '/assets/dishes/piece_dish_ramen_slot_2_1.png',
        nd_4: '/assets/dishes/piece_dish_ramen_slot_0_0.png',
        nd_5: '/assets/dishes/piece_dish_ramen_slot_1_0.png'
      };
      return map[slotId] || '/assets/dishes/piece_dish_ramen_slot_0_1.png';
    }

    if (ingredientId === 'beef') {
      const map: Record<string, string> = {
        bf_0: '/assets/dishes/piece_dish_ramen_slot_1_0.png',
        bf_1: '/assets/dishes/piece_dish_ramen_slot_2_0.png',
        bf_2: '/assets/dishes/piece_dish_ramen_slot_1_1.png',
        bf_3: '/assets/dishes/piece_dish_ramen_slot_2_1.png',
        bf_4: '/assets/dishes/piece_dish_ramen_slot_1_0.png',
        bf_5: '/assets/dishes/piece_dish_ramen_slot_2_0.png'
      };
      return map[slotId] || '/assets/dishes/piece_dish_ramen_slot_1_0.png';
    }

    if (ingredientId === 'onion') {
      return '/assets/dishes/piece_dish_ramen_slot_1_1.png';
    }

    // Default fallback to center of salad
    return '/assets/dishes/piece_dish_salad_slot_1_1.png';
  }

  /**
   * Preloads all piece textures and master dish images.
   */
  static init(): void {
    if (this._initialized) return;
    this._initialized = true;

    // Preload Master Images
    for (const [_, url] of Object.entries(this.DISH_MASTERS)) {
      if (!this._dishMasterCache.has(url)) {
        const img = new Image();
        img.src = url;
        this._dishMasterCache.set(url, img);
      }
    }

    // Preload All 27 Cut Pieces
    const prefixes = ['dish_breakfast', 'dish_salad', 'dish_ramen'];
    for (const prefix of prefixes) {
      for (let c = 0; c < 3; c++) {
        for (let r = 0; r < 3; r++) {
          const url = `/assets/dishes/piece_${prefix}_slot_${c}_${r}.png`;
          if (!this._pieceCache.has(url)) {
            const img = new Image();
            img.src = url;
            this._pieceCache.set(url, img);
          }
        }
      }
    }
  }

  static getPieceImage(ingredientId: string, slotId: string): HTMLImageElement | null {
    this.init();
    const path = this.getPieceImagePath(ingredientId, slotId);
    let img = this._pieceCache.get(path);
    if (!img) {
      img = new Image();
      img.src = path;
      this._pieceCache.set(path, img);
    }
    return (img.complete && img.naturalWidth > 0) ? img : null;
  }

  static getDishMasterImage(recipeId: string): HTMLImageElement | null {
    this.init();
    const url = this.DISH_MASTERS[recipeId] || '/assets/dishes/dish_salad_master.jpg';
    let img = this._dishMasterCache.get(url);
    if (!img) {
      img = new Image();
      img.src = url;
      this._dishMasterCache.set(url, img);
    }
    return (img.complete && img.naturalWidth > 0) ? img : null;
  }
}
