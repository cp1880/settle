import { TILE_WIDTH, TILE_HEIGHT } from './constants';

/**
 * Converts 2D grid coordinates (x, y) into Isometric Screen/World coordinates.
 * 2:1 isometric projection:
 * screenX = (x - y) * (TILE_WIDTH / 2)
 * screenY = (x + y) * (TILE_HEIGHT / 2)
 */
export function isoToScreen(
  gridX: number,
  gridY: number,
  tileW: number = TILE_WIDTH,
  tileH: number = TILE_HEIGHT
): { x: number; y: number } {
  return {
    x: ((gridX - gridY) * tileW) / 2,
    y: ((gridX + gridY) * tileH) / 2,
  };
}

/**
 * Converts Screen/World coordinates back into continuous 2D grid coordinates.
 * Inverse isometric projection:
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
 * Returns integer grid tile [x, y] from screen click position
 */
export function getGridTileAtScreen(
  screenX: number,
  screenY: number,
  tileW: number = TILE_WIDTH,
  tileH: number = TILE_HEIGHT
): { gridX: number; gridY: number } {
  const continuous = screenToIso(screenX, screenY, tileW, tileH);
  return {
    gridX: Math.floor(continuous.x),
    gridY: Math.floor(continuous.y),
  };
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
