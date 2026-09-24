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
  spawnBufferRows: 4 // Rows 12, 13, 14, 15 reserved for top Spawn Zone to accommodate Complex ingredients
};

export type ReleaseCategory = 'early' | 'normal' | 'closure';

export type JigsawEdgeType = 'flat' | 'tab' | 'blank';

export interface JigsawEdges {
  top: JigsawEdgeType;
  bottom: JigsawEdgeType;
  left: JigsawEdgeType;
  right: JigsawEdgeType;
}

export interface PieceSlotDefinition {
  slotId: string;
  label: string;
  relativeCol: number;
  relativeRow: number;
  defaultCategory?: ReleaseCategory;
  edges: JigsawEdges;
}

export type IngredientDifficulty = 'Simple' | 'Normal' | 'Complex';

export interface VisualPalette {
  primary: string;
  secondary: string;
  accent: string;
  stroke: string;
  shadow: string;
}

export interface IngredientDefinition {
  id: string;
  name: string;
  displayName?: string;
  emoji: string;
  color: string;
  sourceAsset?: string;
  difficultyClass?: IngredientDifficulty;
  unlockDay?: number;
  visualPalette?: VisualPalette;
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
  /** Turns elapsed since entering near-completion state (<= 1 missing slot) */
  nearCompletionTurns?: number;
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

export interface PressureProfile {
  /** Base loose pieces spawned into board per non-clearing placement (normally 1) */
  baseInflowPerPlacement: number;
  /** Interval of consecutive non-clearing placements that triggers bonus drop (e.g. 3) */
  bonusInterval: number;
  /** Number of bonus loose pieces to drop at bonusInterval (e.g. 1) */
  bonusAmount: number;
  /** Threshold of consecutive non-clearing placements to trigger escalation (e.g. 6) */
  escalationThreshold: number;
  /** Interval during escalation (e.g. 2) */
  escalationInterval: number;
  /** Number of loose pieces to drop during escalation (e.g. 1) */
  escalationAmount: number;
  /** If true, pause bonus drops when board is in BOARD_DANGER, retaining only base inflow */
  pauseBonusOnDanger: boolean;
}

export const STAGE2_FROZEN_PRESSURE_PROFILE: PressureProfile = {
  baseInflowPerPlacement: 1,
  bonusInterval: 4,
  bonusAmount: 1,
  escalationThreshold: 8,
  escalationInterval: 2,
  escalationAmount: 1,
  pauseBonusOnDanger: true
};

export const DEFAULT_PRESSURE_PROFILE: PressureProfile = STAGE2_FROZEN_PRESSURE_PROFILE;

export interface FlowDirectorProfile {
  /** Target Spawn: weight bonus for ingredients needed by current order */
  targetCurrentOrderWeight: number;
  /** Target Spawn: weight bonus for ingredients needed by next order fact */
  targetNextOrderFactWeight: number;
  /** Target Spawn: inventory deficit bonus when available stock is 0 */
  targetInventoryZeroBonus: number;
  /** Target Spawn: inventory overflow penalty per item when available stock >= 2 */
  targetInventoryOverflowPenalty: number;
  /** Target Spawn: duplicate penalty if target ingredient is already on board */
  targetDuplicatePenalty: number;

  /** Loose Piece: weight bonus for missing slots of current order targets */
  pieceCurrentOrderWeight: number;
  /** Loose Piece: weight bonus for missing slots of next order targets */
  pieceNextOrderFactWeight: number;
  /** Loose Piece: near-completion bonus when target is >= 70% or has <= 1 slot missing */
  pieceNearCompletionBonus: number;
  /** Loose Piece: early release slot bonus */
  pieceEarlyWeightBonus: number;
  /** Loose Piece: progress threshold ratio before closure piece can be released */
  closureThresholdRatio: number;
  /** Loose Piece: turns elapsed before closure starvation guard triggers */
  closureStarvationTurns: number;
  /** Loose Piece: turns to withhold closure piece once only closure slot remains, to induce anticipation and target switching (default: 2) */
  closureHoldTurns: number;
  /** Loose Piece: closure piece bonus weight once eligible */
  closureWeightBonus: number;
}

export const STAGE2_FROZEN_DIRECTOR_PROFILE: FlowDirectorProfile = {
  targetCurrentOrderWeight: 40,
  targetNextOrderFactWeight: 10,
  targetInventoryZeroBonus: 15,
  targetInventoryOverflowPenalty: 25,
  targetDuplicatePenalty: 60,

  pieceCurrentOrderWeight: 25,
  pieceNextOrderFactWeight: 5,
  pieceNearCompletionBonus: 10,
  pieceEarlyWeightBonus: 20,
  closureThresholdRatio: 0.75,
  closureStarvationTurns: 6,
  closureHoldTurns: 2,
  closureWeightBonus: 25
};

export const DEFAULT_DIRECTOR_PROFILE: FlowDirectorProfile = STAGE2_FROZEN_DIRECTOR_PROFILE;

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
  pressureProfile?: PressureProfile;
  directorProfile?: FlowDirectorProfile;
}

export type NextOrderPreviewMode = 'NONE' | 'DISH_ONLY' | 'FULL_RECIPE';

export interface NextOrderPreview {
  mode: NextOrderPreviewMode;
  dishId?: string;
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

export type GamePhase =
  | 'BOOT'
  | 'MAIN_MENU'
  | 'DAY_INTRO'
  | 'PLAYING'
  | 'RESOLVING'
  | 'DAY_CLEAR'
  | 'DAY_FAILED'
  | 'PAUSED';

export interface DayCompletionRecord {
  clearedAt: number;
  bestRevenue: number;
  bestCascade: number;
  stars: number;
  piecesPlaced: number;
  ordersCompleted: number;
}

export interface PlayerSettings {
  soundEnabled: boolean;
  musicEnabled: boolean;
  hapticsEnabled: boolean;
}

export interface CampaignState {
  highestUnlockedDay: number;
  completedDays: Record<number, DayCompletionRecord>;
  tutorialFlags: Record<string, boolean>;
  settings: PlayerSettings;
}
