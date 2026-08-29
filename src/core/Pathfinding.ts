import { Grid } from './Grid';
import { manhattanDistance } from '../iso';

interface Node {
  key: string;
  x: number;
  y: number;
  g: number;
  h: number;
  f: number;
  parent?: Node;
}

export class Pathfinder {
  private grid: Grid;

  constructor(grid: Grid) {
    this.grid = grid;
  }

  /**
   * Finds optimal path from (startX, startY) to (endX, endY) using A* algorithm
   * Roads have cost = 1, Grass = 3, Forest = 4, Rocky = 5, Water = Infinity
   */
  findPath(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    allowAdjacentEnd: boolean = false
  ): [number, number][] | null {
    if (startX === endX && startY === endY) {
      return [[startX, startY]];
    }

    if (!allowAdjacentEnd && !this.grid.isWalkable(endX, endY)) {
      return null;
    }

    const openMap = new Map<string, Node>();
    const closedSet = new Set<string>();

    const startNode: Node = {
      key: `${startX},${startY}`,
      x: startX,
      y: startY,
      g: 0,
      h: manhattanDistance(startX, startY, endX, endY),
      f: manhattanDistance(startX, startY, endX, endY),
    };

    openMap.set(startNode.key, startNode);

    let iterations = 0;
    const maxIterations = 3000; // Guard against huge loops

    while (openMap.size > 0 && iterations++ < maxIterations) {
      // Find node with minimum f cost
      let current: Node | null = null;
      let minF = Infinity;

      for (const node of openMap.values()) {
        if (node.f < minF) {
          minF = node.f;
          current = node;
        }
      }

      if (!current) break;

      // Reached destination or adjacent tile if requested
      if (
        (current.x === endX && current.y === endY) ||
        (allowAdjacentEnd && manhattanDistance(current.x, current.y, endX, endY) === 1)
      ) {
        return this.reconstructPath(current);
      }

      openMap.delete(current.key);
      closedSet.add(current.key);

      const neighbors = this.grid.getNeighbors(current.x, current.y);

      for (const [nx, ny] of neighbors) {
        const neighborKey = `${nx},${ny}`;
        if (closedSet.has(neighborKey)) continue;

        // If this is the goal tile and allowAdjacentEnd is false, check walkability
        const isGoal = nx === endX && ny === endY;
        if (!isGoal && !this.grid.isWalkable(nx, ny)) {
          continue;
        }

        const stepCost = this.grid.getCost(nx, ny);
        if (stepCost === Infinity && !isGoal) continue;

        const tentativeG = current.g + (stepCost === Infinity ? 3 : stepCost);

        const existingNeighbor = openMap.get(neighborKey);

        if (!existingNeighbor || tentativeG < existingNeighbor.g) {
          const h = manhattanDistance(nx, ny, endX, endY);
          const newNode: Node = {
            key: neighborKey,
            x: nx,
            y: ny,
            g: tentativeG,
            h,
            f: tentativeG + h,
            parent: current,
          };
          openMap.set(neighborKey, newNode);
        }
      }
    }

    return null; // No reachable path found
  }

  /**
   * Finds nearest walkable tile to target coordinate
   */
  findNearestWalkable(targetX: number, targetY: number, maxRadius: number = 8): [number, number] | null {
    if (this.grid.isWalkable(targetX, targetY)) {
      return [targetX, targetY];
    }

    for (let r = 1; r <= maxRadius; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.abs(dx) + Math.abs(dy) === r) {
            const nx = targetX + dx;
            const ny = targetY + dy;
            if (this.grid.isWalkable(nx, ny)) {
              return [nx, ny];
            }
          }
        }
      }
    }
    return null;
  }

  /**
   * Finds nearest walkable neighbor adjacent to a multi-tile building (x, y, w, h)
   */
  findNearestBuildingEntrance(
    fromX: number,
    fromY: number,
    bX: number,
    bY: number,
    bW: number,
    bH: number
  ): [number, number] | null {
    const candidates: [number, number][] = [];

    for (let x = bX; x < bX + bW; x++) {
      candidates.push([x, bY - 1]); // North edge
      candidates.push([x, bY + bH]); // South edge
    }
    for (let y = bY; y < bY + bH; y++) {
      candidates.push([bX - 1, y]); // West edge
      candidates.push([bX + bW, y]); // East edge
    }

    let best: [number, number] | null = null;
    let minDist = Infinity;

    for (const [cx, cy] of candidates) {
      if (this.grid.isWalkable(cx, cy)) {
        const d = manhattanDistance(fromX, fromY, cx, cy);
        if (d < minDist) {
          minDist = d;
          best = [cx, cy];
        }
      }
    }

    return best;
  }

  private reconstructPath(endNode: Node): [number, number][] {
    const path: [number, number][] = [];
    let curr: Node | undefined = endNode;
    while (curr) {
      path.unshift([curr.x, curr.y]);
      curr = curr.parent;
    }
    return path;
  }
}
