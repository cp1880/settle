import { UnitDef, UnitState, CarryResource } from '../types';

export class Unit {
  public data: UnitDef;

  constructor(def: Partial<UnitDef> & { id: string; name: string }) {
    this.data = {
      id: def.id,
      name: def.name,
      type: def.type || 'villager',
      state: def.state || 'idle',
      x: def.x ?? def.gridX ?? 0,
      y: def.y ?? def.gridY ?? 0,
      gridX: def.gridX ?? 0,
      gridY: def.gridY ?? 0,
      targetX: def.targetX,
      targetY: def.targetY,
      path: def.path || [],
      jobId: def.jobId,
      assignedBuildingId: def.assignedBuildingId,
      carry: def.carry,
      workTimeRemainingMs: def.workTimeRemainingMs ?? 0,
      workTotalMs: def.workTotalMs ?? 0,
      health: def.health ?? 100,
      maxHealth: def.maxHealth ?? 100,
      facing: def.facing || 'SE',
    };
  }

  get id(): string {
    return this.data.id;
  }
  get state(): UnitState {
    return this.data.state;
  }
  get gridX(): number {
    return this.data.gridX;
  }
  get gridY(): number {
    return this.data.gridY;
  }
  get x(): number {
    return this.data.x;
  }
  get y(): number {
    return this.data.y;
  }
  get carry(): CarryResource | undefined {
    return this.data.carry;
  }

  setState(state: UnitState): void {
    this.data.state = state;
  }

  setPath(path: [number, number][]): void {
    this.data.path = [...path];
    if (path.length > 0) {
      const [firstX, firstY] = path[0];
      this.updateFacing(firstX, firstY);
    }
  }

  setCarry(res?: CarryResource): void {
    this.data.carry = res;
  }

  updateFacing(targetGridX: number, targetGridY: number): void {
    const dx = targetGridX - this.data.gridX;
    const dy = targetGridY - this.data.gridY;

    if (dx > 0) {
      this.data.facing = dy > 0 ? 'SE' : 'NE';
    } else if (dx < 0) {
      this.data.facing = dy < 0 ? 'NW' : 'SW';
    } else {
      if (dy > 0) this.data.facing = 'SE';
      else if (dy < 0) this.data.facing = 'NW';
    }
  }

  /**
   * Advances unit position along path with speed
   * Speed on roads is faster
   */
  updateMovement(deltaSec: number, isCurrentTileRoad: boolean): boolean {
    if (!this.data.path || this.data.path.length === 0) {
      return true; // Finished path
    }

    const nextTile = this.data.path[0];
    const targetX = nextTile[0];
    const targetY = nextTile[1];

    const moveSpeed = (isCurrentTileRoad ? 3.8 : 2.0) * deltaSec;

    const dx = targetX - this.data.x;
    const dy = targetY - this.data.y;
    const dist = Math.hypot(dx, dy);

    this.updateFacing(targetX, targetY);

    if (dist <= moveSpeed) {
      // Arrived at next waypoint
      this.data.x = targetX;
      this.data.y = targetY;
      this.data.gridX = targetX;
      this.data.gridY = targetY;
      this.data.path.shift();

      return this.data.path.length === 0; // true if reached final destination
    } else {
      // Step closer
      this.data.x += (dx / dist) * moveSpeed;
      this.data.y += (dy / dist) * moveSpeed;
      this.data.gridX = Math.round(this.data.x);
      this.data.gridY = Math.round(this.data.y);
      return false;
    }
  }
}
