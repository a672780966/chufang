import { IngredientDefinition, IngredientSlot } from '../model/Types';
import { PuzzleGeometry } from './PuzzleGeometry';
import { IngredientMasterGraphics } from './IngredientMasterGraphics';

export interface PieceVisualAsset {
  slotId: string;
  viewBox: string;
  width: number;
  height: number;
  svgContent: string;
}

export class PuzzleCutter {
  private static _pieceCache = new Map<string, PieceVisualAsset>();

  /**
   * Computes the bounding box of a slot within the 1024x1024 master coordinate space.
   */
  static getSlotBoundsInMaster(
    ingredient: IngredientDefinition,
    slot: IngredientSlot
  ): { x: number; y: number; width: number; height: number } {
    const masterSize = 1024;
    const cellW = masterSize / ingredient.width;
    const cellH = masterSize / ingredient.height;

    const x = slot.relativeCol * cellW;
    // relativeRow: 0 is bottom, height - 1 is top
    const y = (ingredient.height - 1 - slot.relativeRow) * cellH;

    return { x, y, width: cellW, height: cellH };
  }

  /**
   * Generates the SVG path 'd' attribute for a slot's jigsaw shape within the master coordinate system.
   */
  static getSlotPathD(ingredient: IngredientDefinition, slot: IngredientSlot): string {
    const bounds = this.getSlotBoundsInMaster(ingredient, slot);
    const commands = PuzzleGeometry.generateSlotPathCommands(bounds, slot.edges);
    return PuzzleGeometry.commandsToSvgPath(commands);
  }

  /**
   * Cuts and generates a standalone Loose Piece SVG asset.
   * Includes authentic tab/blank geometry, stroke outline, and master graphic texture.
   */
  static generateLoosePieceAsset(
    ingredient: IngredientDefinition,
    slotId: string,
    targetDisplaySize: number = 120
  ): PieceVisualAsset {
    const cacheKey = `${ingredient.id}_${slotId}_${targetDisplaySize}`;
    const cached = this._pieceCache.get(cacheKey);
    if (cached) return cached;

    const slot = ingredient.slots.find(s => s.slotId === slotId);
    if (!slot) {
      throw new Error(`Slot ${slotId} not found in ingredient ${ingredient.id}`);
    }

    const bounds = this.getSlotBoundsInMaster(ingredient, slot);
    const pathD = this.getSlotPathD(ingredient, slot);

    // Padding around bounds to accommodate tab protrusions (up to ~35% cell size)
    const padding = Math.max(bounds.width, bounds.height) * 0.35;
    const minX = bounds.x - padding;
    const minY = bounds.y - padding;
    const vbW = bounds.width + padding * 2;
    const vbH = bounds.height + padding * 2;

    const clipId = `clip_${ingredient.id}_${slotId}`;
    const masterSvg = IngredientMasterGraphics.getMasterSvg(ingredient.id);

    // Extract inner content of master SVG (strip wrapping <svg> and </svg>)
    const innerContent = masterSvg.replace(/<svg[^>]*>/, '').replace(/<\/svg>/, '');

    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX.toFixed(1)} ${minY.toFixed(1)} ${vbW.toFixed(1)} ${vbH.toFixed(1)}" width="${targetDisplaySize}" height="${targetDisplaySize}">
      <defs>
        <clipPath id="${clipId}">
          <path d="${pathD}" />
        </clipPath>
        <filter id="loose-piece-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="rgba(0,0,0,0.3)"/>
        </filter>
      </defs>
      <!-- Piece body clipped from master illustration -->
      <g filter="url(#loose-piece-shadow)">
        <g clip-path="url(#${clipId})">
          ${innerContent}
        </g>
        <!-- Crisp interlocking jigsaw edge stroke -->
        <path d="${pathD}" fill="none" stroke="${ingredient.visualPalette?.stroke || '#333333'}" stroke-width="10" stroke-linejoin="round"/>
        <!-- Delicate inner highlight for appetizing 3D feel -->
        <path d="${pathD}" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="3" stroke-linejoin="round"/>
      </g>
    </svg>`;

    const asset: PieceVisualAsset = {
      slotId,
      viewBox: `${minX} ${minY} ${vbW} ${vbH}`,
      width: targetDisplaySize,
      height: targetDisplaySize,
      svgContent
    };

    this._pieceCache.set(cacheKey, asset);
    return asset;
  }

  /**
   * Generates the authentic Target visual presentation.
   * Rather than a flat text box, displays the complete ingredient silhouette with:
   * - Placed slots filled with the vibrant food texture and subtle jigsaw seams.
   * - Missing slots cleanly carved out with recessed inset shadow and outline.
   */
  static generateTargetSvg(
    ingredient: IngredientDefinition,
    missingSlotIds: string[],
    placedSlotIds: string[],
    displaySize: number = 240
  ): string {
    const masterSvg = IngredientMasterGraphics.getMasterSvg(ingredient.id);
    const innerContent = masterSvg.replace(/<svg[^>]*>/, '').replace(/<\/svg>/, '');

    const placedPaths: string[] = [];
    const missingPaths: string[] = [];

    for (const slot of ingredient.slots) {
      const pathD = this.getSlotPathD(ingredient, slot);
      if (placedSlotIds.includes(slot.slotId)) {
        placedPaths.push(pathD);
      } else {
        missingPaths.push(pathD);
      }
    }

    // Target SVG rendering:
    // 1. Recessed plate background
    // 2. Missing slot sockets (cutouts with inset shadow)
    // 3. Placed pieces filled in with food texture
    // 4. Subtle seam lines between pieces
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="${displaySize}" height="${displaySize}">
      <defs>
        <!-- Recessed socket gradient -->
        <linearGradient id="socket-recess" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#E2E8F0" stop-opacity="0.85"/>
          <stop offset="100%" stop-color="#CBD5E1" stop-opacity="0.95"/>
        </linearGradient>
        <filter id="socket-inner-shadow">
          <feOffset dx="0" dy="4"/>
          <feGaussianBlur stdDeviation="6" result="offset-blur"/>
          <feComposite operator="out" in="SourceGraphic" in2="offset-blur" result="inverse"/>
          <feFlood flood-color="black" flood-opacity="0.25" result="color"/>
          <feComposite operator="in" in="color" in2="inverse" result="shadow"/>
          <feComposite operator="over" in="shadow" in2="SourceGraphic"/>
        </filter>
        ${placedSlotIds
          .map((id, idx) => {
            const slot = ingredient.slots.find(s => s.slotId === id);
            if (!slot) return '';
            const pathD = this.getSlotPathD(ingredient, slot);
            return `<clipPath id="target_clip_${ingredient.id}_${id}"><path d="${pathD}"/></clipPath>`;
          })
          .join('\n')}
      </defs>

      <!-- Target Base Silhouette / Recessed Sockets -->
      <g id="missing-sockets">
        ${missingPaths
          .map(
            d => `
          <path d="${d}" fill="url(#socket-recess)" stroke="#94A3B8" stroke-width="6" stroke-dasharray="8 6"/>
          <path d="${d}" fill="rgba(0,0,0,0.06)"/>
        `
          )
          .join('\n')}
      </g>

      <!-- Placed Slots Filled with Real Master Texture -->
      <g id="placed-pieces">
        ${placedSlotIds
          .map(id => {
            const slot = ingredient.slots.find(s => s.slotId === id);
            if (!slot) return '';
            const pathD = this.getSlotPathD(ingredient, slot);
            return `
            <g clip-path="url(#target_clip_${ingredient.id}_${id})">
              ${innerContent}
            </g>
            <path d="${pathD}" fill="none" stroke="${ingredient.visualPalette?.stroke || '#475569'}" stroke-width="8" stroke-linejoin="round" opacity="0.6"/>
          `;
          })
          .join('\n')}
      </g>
    </svg>`;

    return svg;
  }
}
