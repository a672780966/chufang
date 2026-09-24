import { IngredientDefinition, RecipeDefinition, VisualPalette } from '../model/Types';
import { DEFAULT_INGREDIENTS, DEFAULT_RECIPES } from '../data/DefaultData';
import { IngredientMasterGraphics } from './IngredientMasterGraphics';
import { PuzzleCutter, PieceVisualAsset } from './PuzzleCutter';

export interface IngredientAssetEntry {
  id: string;
  name: string;
  displayName: string;
  emoji: string;
  palette: VisualPalette;
  audioCue: string;
  masterSvg: string;
  getPieceAsset: (slotId: string, size?: number) => PieceVisualAsset;
  getTargetSvg: (missingSlots: string[], placedSlots: string[], size?: number) => string;
}

export interface AudioAssetEntry {
  eventId: string;
  soundType: 'procedural';
  description: string;
}

export class AssetRegistry {
  private static _ingredientEntries = new Map<string, IngredientAssetEntry>();

  /**
   * Initializes the registry with default ingredients and recipes.
   */
  static getIngredient(id: string): IngredientAssetEntry {
    let entry = this._ingredientEntries.get(id);
    if (!entry) {
      const def = DEFAULT_INGREDIENTS[id];
      if (!def) {
        throw new Error(`Ingredient not found in registry: ${id}`);
      }

      const audioCueMap: Record<string, string> = {
        beef: 'sizzle_heavy',
        bacon: 'sizzle_crisp',
        chicken: 'fry_crunch',
        bread: 'toaster_ding',
        egg: 'egg_crack',
        cheese: 'melt_stretch',
        noodle: 'slurp_pot',
        rice: 'steam_pot',
        potato: 'crunch_chop',
        tomato: 'knife_slice_wet',
        lettuce: 'leaf_crisp',
        onion: 'knife_dice',
        carrot: 'knife_chop_crisp',
        mushroom: 'saute_soft',
        shrimp: 'sizzle_quick',
        corn: 'pop_light'
      };

      entry = {
        id: def.id,
        name: def.name,
        displayName: def.displayName || def.name,
        emoji: def.emoji,
        palette: def.visualPalette || {
          primary: def.color,
          secondary: def.color,
          accent: '#FFFFFF',
          stroke: '#333333',
          shadow: 'rgba(0,0,0,0.2)'
        },
        audioCue: audioCueMap[id] || 'kitchen_prep',
        masterSvg: IngredientMasterGraphics.getMasterSvg(id),
        getPieceAsset: (slotId: string, size?: number) =>
          PuzzleCutter.generateLoosePieceAsset(def, slotId, size),
        getTargetSvg: (missingSlots: string[], placedSlots: string[], size?: number) =>
          PuzzleCutter.generateTargetSvg(def, missingSlots, placedSlots, size)
      };

      this._ingredientEntries.set(id, entry);
    }
    return entry;
  }

  static getRecipe(id: string): RecipeDefinition | undefined {
    return DEFAULT_RECIPES[id];
  }

  static getAllIngredients(): IngredientAssetEntry[] {
    return Object.keys(DEFAULT_INGREDIENTS).map(id => this.getIngredient(id));
  }
}
