/**
 * DishTextureManager.ts
 * Manages preloading and blitting of real AI-generated Master Dish Art and cut Puzzle Pieces.
 * Pure identity lookup: dishId + slotId / (dishCol, dishRow).
 * ZERO fake ingredient-to-dish mappings!
 */

export class DishTextureManager {
  private static _pieceCache = new Map<string, HTMLImageElement>();
  private static _dishMasterCache = new Map<string, HTMLImageElement>();
  private static _initialized = false;

  // Master Dish Art mapping for Gold Sample dishes
  static readonly DISH_MASTERS: Record<string, string> = {
    dish_breakfast: '/assets/dishes/dish_breakfast_master.jpg',
    dish_salad: '/assets/dishes/dish_salad_master.jpg',
    dish_ramen: '/assets/dishes/dish_ramen_master.jpg',
    // Recipe aliases for order system
    breakfast: '/assets/dishes/dish_breakfast_master.jpg',
    salad: '/assets/dishes/dish_salad_master.jpg',
    ramen: '/assets/dishes/dish_ramen_master.jpg',
    sandwich: '/assets/dishes/dish_breakfast_master.jpg',
    beef_noodle: '/assets/dishes/dish_ramen_master.jpg'
  };

  /**
   * Deterministic image path from (dishId, slotId).
   * Example: getPiecePath('dish_salad', 'slot_1_2') -> '/assets/dishes/piece_dish_salad_slot_1_2.png'
   */
  static getPiecePath(dishId: string, slotId: string): string {
    return `/assets/dishes/piece_${dishId}_${slotId}.png`;
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

    // Preload All 27 Cut Pieces for the 3 Gold Sample dishes
    const dishes = ['dish_breakfast', 'dish_salad', 'dish_ramen'];
    for (const dishId of dishes) {
      for (let c = 0; c < 3; c++) {
        for (let r = 0; r < 3; r++) {
          const url = this.getPiecePath(dishId, `slot_${c}_${r}`);
          if (!this._pieceCache.has(url)) {
            const img = new Image();
            img.src = url;
            this._pieceCache.set(url, img);
          }
        }
      }
    }
  }

  /**
   * Direct piece texture getter using dishId and slotId (e.g. 'slot_0_1').
   */
  static getPieceImage(dishId: string, slotId: string): HTMLImageElement | null {
    this.init();
    const path = this.getPiecePath(dishId, slotId);
    let img = this._pieceCache.get(path);
    if (!img) {
      img = new Image();
      img.src = path;
      this._pieceCache.set(path, img);
    }
    return (img.complete && img.naturalWidth > 0) ? img : null;
  }

  /**
   * Helper piece texture getter using (col, row).
   */
  static getPieceImageByCoord(dishId: string, col: number, row: number): HTMLImageElement | null {
    return this.getPieceImage(dishId, `slot_${col}_${row}`);
  }

  /**
   * Master Dish Art getter.
   */
  static getDishMasterImage(dishId: string): HTMLImageElement | null {
    this.init();
    const url = this.DISH_MASTERS[dishId] || '/assets/dishes/dish_salad_master.jpg';
    let img = this._dishMasterCache.get(url);
    if (!img) {
      img = new Image();
      img.src = url;
      this._dishMasterCache.set(url, img);
    }
    return (img.complete && img.naturalWidth > 0) ? img : null;
  }
}
