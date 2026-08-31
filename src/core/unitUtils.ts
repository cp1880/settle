import { Unit } from './Unit';
import { World } from './World';
import { isoToScreen } from '../iso';
import { TILE_HEIGHT } from '../constants';

export interface UnitScreenBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

/**
 * Calculates the exact on-screen world coordinate center (cx, cy) for a unit.
 * Accounts for 3D continuous terrain elevation, movement interpolation, and
 * sub-tile equidistant spacing when multiple settlers share the same tile.
 */
export function getUnitScreenPosition(unit: Unit, world?: World): { cx: number; cy: number } {
  const isMoving =
    unit.state.startsWith('move') ||
    unit.state === 'deliver' ||
    (unit.data.path && unit.data.path.length > 0);

  let subOffsetX = 0.5;
  let subOffsetY = 0.5;

  if (world && !isMoving) {
    const tileUnits = world.units.filter(
      (u) => Math.floor(u.x) === Math.floor(unit.x) && Math.floor(u.y) === Math.floor(unit.y)
    );
    if (tileUnits.length > 1) {
      const slot = tileUnits.findIndex((u) => u.id === unit.id);
      const offsets = [
        { dx: 0.35, dy: 0.35 },
        { dx: 0.65, dy: 0.35 },
        { dx: 0.35, dy: 0.65 },
        { dx: 0.65, dy: 0.65 },
      ];
      const assigned = offsets[slot % offsets.length];
      subOffsetX = assigned.dx;
      subOffsetY = assigned.dy;
    }
  }

  const continuousX = isMoving ? unit.x + 0.5 : Math.floor(unit.x) + subOffsetX;
  const continuousY = isMoving ? unit.y + 0.5 : Math.floor(unit.y) + subOffsetY;

  if (world) {
    const pos = world.grid.getContinuousScreenPos(continuousX, continuousY);
    return { cx: pos.x, cy: pos.y };
  } else {
    const s = isoToScreen(unit.x, unit.y);
    return { cx: s.x, cy: s.y + TILE_HEIGHT / 2 };
  }
}

/**
 * Generates the bounding box for clicking/hovering on an individual settler.
 * Generous hit area around the settler sprite.
 */
export function getUnitClickBounds(unit: Unit, world: World): UnitScreenBounds {
  const { cx, cy } = getUnitScreenPosition(unit, world);
  // Width: 26px, Height: 36px (covers feet at bottom to hat/backpack above head)
  const width = 26;
  const height = 36;
  const x = cx - width / 2;
  const y = cy - height + 4; // covers cy - 32 to cy + 4
  return { x, y, width, height, centerX: cx, centerY: cy };
}

/**
 * Finds the unit at the given world coordinates (if cursor is hovering its bounding box).
 * Prioritizes topmost / front units if overlapping.
 */
export function getUnitAtScreenPos(worldX: number, worldY: number, world: World): Unit | null {
  const candidates: { unit: Unit; dist: number; depth: number }[] = [];

  for (const unit of world.units) {
    const bounds = getUnitClickBounds(unit, world);
    if (
      worldX >= bounds.x &&
      worldX <= bounds.x + bounds.width &&
      worldY >= bounds.y &&
      worldY <= bounds.y + bounds.height
    ) {
      const dist = Math.hypot(worldX - bounds.centerX, worldY - (bounds.centerY - bounds.height / 2));
      const depth = unit.x + unit.y;
      candidates.push({ unit, dist, depth });
    }
  }

  if (candidates.length === 0) return null;

  // Sort by depth descending (front-most unit first), then closest to center
  candidates.sort((a, b) => b.depth - a.depth || a.dist - b.dist);
  return candidates[0].unit;
}
