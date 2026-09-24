import { JigsawEdgeType } from '../model/Types';

export interface Point2D {
  x: number;
  y: number;
}

export interface BezierCommand {
  type: 'M' | 'L' | 'C' | 'Z';
  x: number;
  y: number;
  cp1x?: number;
  cp1y?: number;
  cp2x?: number;
  cp2y?: number;
}

export class PuzzleGeometry {
  /**
   * Generates Bezier curve commands for a single jigsaw edge between (x0, y0) and (x1, y1).
   * Direction is from (x0, y0) to (x1, y1).
   * Outward normal (tab) points to the right of the direction vector.
   * Inward normal (blank) points to the left of the direction vector.
   */
  static generateEdgeCommands(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    edgeType: JigsawEdgeType,
    tabScale: number = 0.22
  ): BezierCommand[] {
    if (edgeType === 'flat') {
      return [{ type: 'L', x: x1, y: y1 }];
    }

    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    if (len === 0) return [{ type: 'L', x: x1, y: y1 }];

    // Unit tangent vector along the edge
    const tx = dx / len;
    const ty = dy / len;

    // Normal vector pointing "outward" (to the right of direction)
    // Sign: +1 for tab (outward), -1 for blank (inward)
    const sign = edgeType === 'tab' ? 1 : -1;
    const nx = -ty * sign;
    const ny = tx * sign;

    const h = len * tabScale; // tab protrusion height

    // Function to compute absolute coordinate given (tangentRatio along edge, normalRatio)
    const pt = (u: number, v: number): Point2D => ({
      x: x0 + tx * (u * len) + nx * (v * h),
      y: y0 + ty * (u * len) + ny * (v * h)
    });

    // Classic 3-segment cubic Bezier jigsaw tab/blank:
    // Base edge -> Neck transition -> Bulbous Head -> Neck return -> Base edge
    const p1 = pt(0.35, 0.0);
    const p2_cp1 = pt(0.38, 0.05);
    const p2_cp2 = pt(0.32, 0.45);
    const p2 = pt(0.40, 0.85);

    const p3_cp1 = pt(0.45, 1.15);
    const p3_cp2 = pt(0.55, 1.15);
    const p3 = pt(0.60, 0.85);

    const p4_cp1 = pt(0.68, 0.45);
    const p4_cp2 = pt(0.62, 0.05);
    const p4 = pt(0.65, 0.0);

    return [
      { type: 'L', x: p1.x, y: p1.y },
      { type: 'C', cp1x: p2_cp1.x, cp1y: p2_cp1.y, cp2x: p2_cp2.x, cp2y: p2_cp2.y, x: p2.x, y: p2.y },
      { type: 'C', cp1x: p3_cp1.x, cp1y: p3_cp1.y, cp2x: p3_cp2.x, cp2y: p3_cp2.y, x: p3.x, y: p3.y },
      { type: 'C', cp1x: p4_cp1.x, cp1y: p4_cp1.y, cp2x: p4_cp2.x, cp2y: p4_cp2.y, x: p4.x, y: p4.y },
      { type: 'L', x: x1, y: y1 }
    ];
  }

  /**
   * Generates closed perimeter Bezier commands for a puzzle piece slot.
   * Clockwise traversal:
   * Top: (left, top) -> (right, top)
   * Right: (right, top) -> (right, bottom)
   * Bottom: (right, bottom) -> (left, bottom)
   * Left: (left, bottom) -> (left, top)
   */
  static generateSlotPathCommands(
    bounds: { x: number; y: number; width: number; height: number },
    edges: { top: JigsawEdgeType; right: JigsawEdgeType; bottom: JigsawEdgeType; left: JigsawEdgeType }
  ): BezierCommand[] {
    const { x, y, width, height } = bounds;
    const x0 = x;
    const y0 = y;
    const x1 = x + width;
    const y1 = y + height;

    const commands: BezierCommand[] = [];

    // Start at top-left
    commands.push({ type: 'M', x: x0, y: y0 });

    // 1. Top edge: (x0, y0) -> (x1, y0)
    // For top edge, moving right (+x), outward normal is up (-y)
    // Our generateEdgeCommands has right-hand normal: (tx=1, ty=0) -> (nx=0, ny=-1 * sign)
    // If sign = +1 (tab), ny = -1 (points up/outward). Correct!
    commands.push(...this.generateEdgeCommands(x0, y0, x1, y0, edges.top));

    // 2. Right edge: (x1, y0) -> (x1, y1)
    // Moving down (+y), outward normal is right (+x).
    // (tx=0, ty=1) -> nx = -1 * sign * (-1) = +1 for tab (points right/outward). Correct!
    commands.push(...this.generateEdgeCommands(x1, y0, x1, y1, edges.right));

    // 3. Bottom edge: (x1, y1) -> (x0, y1)
    // Moving left (-x), outward normal is down (+y).
    // (tx=-1, ty=0) -> ny = +1 for tab (points down/outward). Correct!
    commands.push(...this.generateEdgeCommands(x1, y1, x0, y1, edges.bottom));

    // 4. Left edge: (x0, y1) -> (x0, y0)
    // Moving up (-y), outward normal is left (-x).
    // (tx=0, ty=-1) -> nx = -1 for tab (points left/outward). Correct!
    commands.push(...this.generateEdgeCommands(x0, y1, x0, y0, edges.left));

    commands.push({ type: 'Z', x: x0, y: y0 });
    return commands;
  }

  /**
   * Converts a list of BezierCommands to an SVG path string 'd' attribute.
   */
  static commandsToSvgPath(commands: BezierCommand[]): string {
    return commands
      .map(cmd => {
        switch (cmd.type) {
          case 'M':
            return `M ${cmd.x.toFixed(2)} ${cmd.y.toFixed(2)}`;
          case 'L':
            return `L ${cmd.x.toFixed(2)} ${cmd.y.toFixed(2)}`;
          case 'C':
            return `C ${cmd.cp1x!.toFixed(2)} ${cmd.cp1y!.toFixed(2)} ${cmd.cp2x!.toFixed(2)} ${cmd.cp2y!.toFixed(2)} ${cmd.x.toFixed(2)} ${cmd.y.toFixed(2)}`;
          case 'Z':
            return 'Z';
        }
      })
      .join(' ');
  }
}
