import { TILE_WIDTH, TILE_HEIGHT } from './constants';

/**
 * Converts 2D grid coordinates (x, y) into Isometric Screen/World coordinates.
 * 2:1 isometric projection with vertical elevation offset:
 * screenX = (x - y) * (TILE_WIDTH / 2)
 * screenY = (x + y) * (TILE_HEIGHT / 2) - elevationOffset
 */
export function isoToScreen(
  gridX: number,
  gridY: number,
  elevationOffset: number = 0,
  tileW: number = TILE_WIDTH,
  tileH: number = TILE_HEIGHT
): { x: number; y: number } {
  return {
    x: ((gridX - gridY) * tileW) / 2,
    y: ((gridX + gridY) * tileH) / 2 - elevationOffset,
  };
}

/**
 * Checks if a point (px, py) lies inside a convex quadrilateral defined by 4 vertices in clockwise or counterclockwise order.
 */
export function pointInQuad(
  px: number,
  py: number,
  v0: { x: number; y: number },
  v1: { x: number; y: number },
  v2: { x: number; y: number },
  v3: { x: number; y: number }
): boolean {
  const cross = (
    ax: number,
    ay: number,
    bx: number,
    by: number,
    cx: number,
    cy: number
  ) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);

  const d0 = cross(v0.x, v0.y, v1.x, v1.y, px, py);
  const d1 = cross(v1.x, v1.y, v2.x, v2.y, px, py);
  const d2 = cross(v2.x, v2.y, v3.x, v3.y, px, py);
  const d3 = cross(v3.x, v3.y, v0.x, v0.y, px, py);

  const hasNeg = (d0 < 0) || (d1 < 0) || (d2 < 0) || (d3 < 0);
  const hasPos = (d0 > 0) || (d1 > 0) || (d2 > 0) || (d3 > 0);

  return !(hasNeg && hasPos);
}

/**
 * Converts Screen/World coordinates back into continuous 2D grid coordinates.
 * Inverse isometric projection (flat plane assumption):
 * gridX = (screenX / (TILE_WIDTH / 2) + screenY / (TILE_HEIGHT / 2)) / 2
 * gridY = (screenY / (TILE_HEIGHT / 2) - screenX / (TILE_WIDTH / 2)) / 2
 */
export function screenToIso(
  screenX: number,
  screenY: number,
  tileW: number = TILE_WIDTH,
  tileH: number = TILE_HEIGHT
): { x: number; y: number } {
  const halfW = tileW / 2;
  const halfH = tileH / 2;
  const gx = (screenX / halfW + screenY / halfH) / 2;
  const gy = (screenY / halfH - screenX / halfW) / 2;
  return { x: gx, y: gy };
}

/**
 * Returns integer grid tile [x, y] from screen click position,
 * with optional elevation-aware quadrilateral collision testing.
 */
export function getGridTileAtScreen(
  screenX: number,
  screenY: number,
  tileW: number = TILE_WIDTH,
  tileH: number = TILE_HEIGHT,
  gridElevationGetter?: (gx: number, gy: number) => {
    top: { x: number; y: number };
    right: { x: number; y: number };
    bottom: { x: number; y: number };
    left: { x: number; y: number };
  } | null
): { gridX: number; gridY: number } {
  const continuous = screenToIso(screenX, screenY, tileW, tileH);
  const flatX = Math.floor(continuous.x);
  const flatY = Math.floor(continuous.y);

  if (!gridElevationGetter) {
    return { gridX: flatX, gridY: flatY };
  }

  // Check candidate tiles around the flat estimate (ordered from closest foreground to background)
  for (let dy = 2; dy >= -1; dy--) {
    for (let dx = 2; dx >= -1; dx--) {
      const gx = flatX + dx;
      const gy = flatY + dy;
      const quad = gridElevationGetter(gx, gy);
      if (quad) {
        if (pointInQuad(screenX, screenY, quad.top, quad.right, quad.bottom, quad.left)) {
          return { gridX: gx, gridY: gy };
        }
      }
    }
  }

  return { gridX: flatX, gridY: flatY };
}

/**
 * Calculates Manhattan distance between two grid coordinates
 */
export function manhattanDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

/**
 * Calculates Euclidean distance
 */
export function euclideanDistance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy);
}
