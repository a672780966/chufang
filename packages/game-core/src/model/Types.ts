export interface GridCoord {
  col: number;
  row: number; // row 0 is bottom, row (totalRows - 1) is top
}

export interface BoardProfile {
  id: string;
  columns: number;
  rows: number;
  spawnBufferRows: number;
}

export const DEFAULT_BOARD_PROFILE: BoardProfile = {
  id: 'standard_8x12',
  columns: 8,
  rows: 12,
  spawnBufferRows: 2
};

export type ReleaseCategory = 'early' | 'normal' | 'closure';

export interface PieceSlotDefinition {
  slotId: string;
  label: string;
  relativeCol: number;
  relativeRow: number;
  defaultCategory?: ReleaseCategory;
}

export interface IngredientDefinition {
  id: string;
  name: string;
  emoji: string;
  color: string;
  /** Bounding box width and height */
  width: number;
  height: number;
  /** Relative cell offsets occupied on grid (e.g. [[0,0], [1,0], [0,1], [1,1]]) */
  footprint: GridCoord[];
  /** Discrete puzzle slots */
  slots: PieceSlotDefinition[];
}

export interface IngredientTarget {
  instanceId: string;
  ingredientId: string;
  /** Bottom-left anchor on board */
  anchor: GridCoord;
  /** All occupied absolute grid coords */
  occupiedCoords: GridCoord[];
  /** Slots already filled */
  placedSlotIds: string[];
  /** Slots still waiting for pieces */
  missingSlotIds: string[];
  /** Static release plan assigned at creation time */
  pieceReleasePlan: Record<string, ReleaseCategory>;
  /** Age / turns since creation */
  ageTurns: number;
}

export interface LoosePiece {
  instanceId: string;
  ingredientId: string;
  targetInstanceId: string;
  slotId: string;
  coord: GridCoord;
}

export interface RecipeRequirement {
  ingredientId: string;
  count: number;
}

export interface RecipeDefinition {
  id: string;
  name: string;
  emoji: string;
  baseRevenue: number;
  requirements: RecipeRequirement[];
}

export interface OrderItemProgress {
  ingredientId: string;
  needed: number;
  reserved: number;
  consumed: number;
}

export interface Order {
  orderId: string;
  recipeId: string;
  dishName: string;
  emoji: string;
  baseRevenue: number;
  items: OrderItemProgress[];
  isFulfilled: boolean;
}

export interface DayConfig {
  dayNumber: number;
  businessGoal: number;
  availableRecipeIds: string[];
  recipeWeights: Record<string, number>;
  /** Target count of simultaneous active ingredient targets on board (e.g. 3~5) */
  targetIngredientCount: number;
  /** Target comfortable range of loose pieces (e.g. 6~8) */
  loosePieceComfortMin: number;
  loosePieceComfortMax: number;
  boardProfile?: BoardProfile;
}

export type NextOrderPreviewMode = 'NONE' | 'DISH_ONLY' | 'FULL_RECIPE';

export interface NextOrderPreview {
  mode: NextOrderPreviewMode;
  dishName?: string;
  emoji?: string;
  requirements?: RecipeRequirement[];
}

export interface GameStats {
  totalRevenue: number;
  ordersCompleted: number;
  ingredientsCompleted: number;
  piecesPlaced: number;
  maxCascadeChain: number;
  cascadeEventsCount: number;
  totalSettlingSteps: number;
  deadlockChecks: number;
}
