import { Grid } from './Grid';
import { Pathfinder } from './Pathfinding';
import { Store } from './Store';
import { Unit } from './Unit';
import { BuildingInstance, BuildingDef, FeatureType } from '../types';
import { BUILDINGS, getBuilding } from '../content/buildings';
import { JOBS } from '../content/jobs';
import { STARTING_RESOURCES, BEDS_PER_HOUSE, INITIAL_BEDS, VILLAGER_SPAWN_INTERVAL_MS, GRID_SIZE_X, GRID_SIZE_Y } from '../constants';
import { globalAudio } from './AudioSystem';
import { manhattanDistance } from '../iso';

export interface FloatingText {
  id: string;
  text: string;
  color: string;
  gridX: number;
  gridY: number;
  durationMs: number;
  elapsedMs: number;
}

export class World {
  public grid: Grid;
  public pathfinder: Pathfinder;
  public store: Store;
  public units: Unit[] = [];
  public buildings: BuildingInstance[] = [];
  public floatingTexts: FloatingText[] = [];
  public notifications: Array<{ id: string; text: string; time: string; type: 'info' | 'success' | 'warn' }> = [];

  private lastVillagerSpawnMs: number = 0;
  private unitIdCounter: number = 1;
  private buildingIdCounter: number = 1;
  private floatingIdCounter: number = 1;

  constructor(grid?: Grid, store?: Store) {
    this.grid = grid || Grid.generateScenario(GRID_SIZE_X, GRID_SIZE_Y, 'valley');
    this.pathfinder = new Pathfinder(this.grid);
    this.store = store || new Store(STARTING_RESOURCES);

    this.lastVillagerSpawnMs = Date.now();
  }

  /**
   * Initializes starter settlement with a Town Hall and initial villagers
   */
  initStarterSettlement(): void {
    const centerX = Math.floor(this.grid.width / 2) - 1;
    const centerY = Math.floor(this.grid.height / 2) - 1;

    // Place Town Hall (already constructed)
    const townHall = this.placeBuilding('town_hall', centerX, centerY, true);
    if (townHall) {
      // Pave surrounding roads
      for (let dx = -1; dx <= 2; dx++) {
        this.grid.setTile(centerX + dx, centerY - 1, { road: true });
        this.grid.setTile(centerX + dx, centerY + 2, { road: true });
      }
      for (let dy = -1; dy <= 2; dy++) {
        this.grid.setTile(centerX - 1, centerY + dy, { road: true });
        this.grid.setTile(centerX + 2, centerY + dy, { road: true });
      }

      // Spawn initial settlers
      for (let i = 0; i < 4; i++) {
        this.spawnUnit('villager', centerX + (i % 2), centerY + Math.floor(i / 2));
      }

      this.addNotification('Welcome to your new Settlement! Build a Sawmill and Quarry to begin your economy.', 'info');
    }
  }

  addNotification(text: string, type: 'info' | 'success' | 'warn' = 'info'): void {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    this.notifications.unshift({
      id: `notif_${Date.now()}_${Math.random()}`,
      text,
      time: timeStr,
      type,
    });
    if (this.notifications.length > 25) {
      this.notifications.pop();
    }
  }

  addFloatingText(text: string, gridX: number, gridY: number, color: string = '#ffffff'): void {
    this.floatingTexts.push({
      id: `ft_${this.floatingIdCounter++}`,
      text,
      color,
      gridX,
      gridY,
      durationMs: 1400,
      elapsedMs: 0,
    });
  }

  get totalBeds(): number {
    let beds = INITIAL_BEDS;
    for (const b of this.buildings) {
      if (b.isConstructed) {
        const def = getBuilding(b.defId);
        if (def && def.id === 'house') {
          beds += BEDS_PER_HOUSE;
        }
      }
    }
    return beds;
  }

  get population(): number {
    return this.units.length;
  }

  /**
   * Spawns a new unit at coordinates
   */
  spawnUnit(type: string = 'villager', gridX: number, gridY: number): Unit {
    const id = `unit_${this.unitIdCounter++}`;
    const name = type === 'soldier' ? `Guard #${this.unitIdCounter}` : `Settler #${this.unitIdCounter}`;
    const unit = new Unit({
      id,
      name,
      type,
      gridX,
      gridY,
      x: gridX,
      y: gridY,
      health: type === 'soldier' ? 180 : 100,
      maxHealth: type === 'soldier' ? 180 : 100,
    });
    this.units.push(unit);
    return unit;
  }

  /**
   * Attempts to place a building
   */
  placeBuilding(
    defId: string,
    gridX: number,
    gridY: number,
    instantBuild: boolean = false
  ): BuildingInstance | null {
    const def = getBuilding(defId);
    if (!def) return null;

    // Check affordance (unless instant)
    if (!instantBuild && !this.store.canAfford(def.cost)) {
      return null;
    }

    // Check grid space
    if (!this.grid.canPlaceBuilding(gridX, gridY, def.size.w, def.size.h, def.allowedTerrains)) {
      return null;
    }

    if (!instantBuild) {
      this.store.deduct(def.cost);
      globalAudio.play('build_start');
    }

    const buildingId = `bld_${this.buildingIdCounter++}`;
    const building: BuildingInstance = {
      id: buildingId,
      defId,
      x: gridX,
      y: gridY,
      isConstructed: instantBuild,
      buildProgressMs: instantBuild ? def.buildMs : 0,
      totalBuildMs: def.buildMs,
      inventory: {},
      assignedWorkerIds: [],
    };

    // Mark tiles occupied
    for (let dy = 0; dy < def.size.h; dy++) {
      for (let dx = 0; dx < def.size.w; dx++) {
        this.grid.setTile(gridX + dx, gridY + dy, {
          buildingId,
          bridge: defId === 'bridge' ? true : undefined,
          // If building on road or tree, remove tree
          feature: undefined,
        });
      }
    }

    this.buildings.push(building);

    // Update storehouse capacities if instant
    if (instantBuild && def.capacity && def.id === 'storehouse') {
      this.updateStoreCapacity();
    }

    if (!instantBuild) {
      this.addNotification(`Under construction: ${def.name}`, 'info');
      // Prioritize dispatching builders to the new foundation site immediately
      this.autoAssignWorkers();
    }

    return building;
  }

  /**
   * Places a road tile
   */
  placeRoad(gridX: number, gridY: number): boolean {
    const tile = this.grid.getTile(gridX, gridY);
    if (!tile || tile.terrain === 'water' || tile.buildingId) {
      return false;
    }
    if (tile.road) return true;

    if (!this.store.deduct(BUILDINGS.road.cost)) {
      return false;
    }

    this.grid.setTile(gridX, gridY, { road: true, feature: undefined });
    globalAudio.play('road_place');
    return true;
  }

  /**
   * Demolishes building or clears road
   */
  demolish(gridX: number, gridY: number): boolean {
    const tile = this.grid.getTile(gridX, gridY);
    if (!tile) return false;

    if (tile.buildingId) {
      const bldIndex = this.buildings.findIndex((b) => b.id === tile.buildingId);
      if (bldIndex >= 0) {
        const bld = this.buildings[bldIndex];
        const def = getBuilding(bld.defId);
        if (def && def.id === 'town_hall') {
          this.addNotification('Cannot demolish Town Hall!', 'warn');
          return false;
        }

        // Clear tiles
        if (def) {
          for (let dy = 0; dy < def.size.h; dy++) {
            for (let dx = 0; dx < def.size.w; dx++) {
              this.grid.setTile(bld.x + dx, bld.y + dy, { buildingId: undefined, bridge: undefined });
            }
          }
        }

        // Free assigned workers
        for (const u of this.units) {
          if (u.data.assignedBuildingId === bld.id) {
            u.data.assignedBuildingId = undefined;
            u.data.jobId = undefined;
            u.setState('idle');
          }
        }

        this.buildings.splice(bldIndex, 1);
        this.updateStoreCapacity();
        this.addNotification(`Demolished ${def?.name || 'Building'}`, 'info');
        globalAudio.play('hammer');
        return true;
      }
    } else if (tile.road) {
      this.grid.setTile(gridX, gridY, { road: false });
      globalAudio.play('click');
      return true;
    }

    return false;
  }

  updateStoreCapacity(): void {
    let extra = 0;
    for (const b of this.buildings) {
      if (b.isConstructed && b.defId === 'storehouse') {
        extra += BUILDINGS.storehouse.capacity || 500;
      }
    }
    this.store.setExtraCapacity(extra);
  }

  /**
   * Main simulation tick
   */
  update(deltaTimeMs: number): void {
    const deltaSec = deltaTimeMs / 1000;

    // 1. Update floating text particles
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.elapsedMs += deltaTimeMs;
      if (ft.elapsedMs >= ft.durationMs) {
        this.floatingTexts.splice(i, 1);
      }
    }

    // 2. Update rate calculations in Store
    this.store.updateRates();

    // 3. Update construction & training on buildings
    this.updateBuildings(deltaTimeMs);

    // 4. Update and dispatch units
    this.updateUnits(deltaTimeMs, deltaSec);

    // 5. Check population growth
    this.checkPopulationGrowth(deltaTimeMs);
  }

  private updateBuildings(deltaTimeMs: number): void {
    for (const b of this.buildings) {
      const def = getBuilding(b.defId);
      if (!def) continue;

      // Construction progression
      if (!b.isConstructed) {
        // Advanced by builders actively working on it
        if (b.buildProgressMs >= b.totalBuildMs) {
          b.isConstructed = true;
          b.assignedWorkerIds = [];
          this.updateStoreCapacity();
          this.addFloatingText('Completed! ✨', b.x + def.size.w / 2, b.y, '#4caf50');
          this.addNotification(`Construction finished: ${def.name}`, 'success');
          globalAudio.play('build_complete');
        }
      } else {
        // Active building logic (Barracks training / Turret defense)
        if (def.trains && b.trainingProgressMs !== undefined) {
          b.trainingProgressMs += deltaTimeMs;
          if (b.trainingProgressMs >= def.trains.timeMs) {
            b.trainingProgressMs = undefined;
            // Spawn trained soldier
            const entrance = this.pathfinder.findNearestBuildingEntrance(b.x, b.y, b.x, b.y, def.size.w, def.size.h);
            const spawnX = entrance ? entrance[0] : b.x;
            const spawnY = entrance ? entrance[1] : b.y;
            this.spawnUnit('soldier', spawnX, spawnY);
            this.addFloatingText('Soldier Trained! ⚔️', b.x + 1, b.y, '#e57373');
            this.addNotification('A new Soldier has been trained and equipped at the Barracks!', 'success');
            globalAudio.play('train_soldier');
          }
        }
      }
    }
  }

  /**
   * Starts soldier training at a Barracks if resources are available
   */
  trainSoldierAtBarracks(buildingId: string): boolean {
    const bld = this.buildings.find((b) => b.id === buildingId);
    if (!bld || !bld.isConstructed || bld.defId !== 'barracks') return false;
    if (bld.trainingProgressMs !== undefined) return false; // Already training

    const def = getBuilding('barracks');
    if (!def || !def.trains) return false;

    // Check resources (1 sword, 1 shield) and at least 1 idle villager
    if (!this.store.canAfford(def.trains.requires)) {
      this.addNotification('Need 1 Sword & 1 Shield in storage to train a Soldier!', 'warn');
      return false;
    }

    const idleVillager = this.units.find((u) => u.data.type === 'villager' && u.state === 'idle');
    if (!idleVillager) {
      this.addNotification('Need an idle Villager to train as a Soldier!', 'warn');
      return false;
    }

    // Deduct weapons & convert villager
    this.store.deduct(def.trains.requires);
    const vIndex = this.units.indexOf(idleVillager);
    if (vIndex >= 0) {
      this.units.splice(vIndex, 1);
    }

    bld.trainingProgressMs = 0;
    this.addNotification('Training soldier at Barracks...', 'info');
    globalAudio.play('hammer');
    return true;
  }

  private updateUnits(deltaTimeMs: number, deltaSec: number): void {
    // 1. Assign idle workers to unstaffed buildings or construction sites
    this.autoAssignWorkers();

    // 2. Step each unit state machine
    for (const unit of this.units) {
      // Safety clamp so villagers can never escape or get NaN / off-map coordinates
      if (
        isNaN(unit.data.x) ||
        isNaN(unit.data.y) ||
        unit.data.x < 0 ||
        unit.data.y < 0 ||
        unit.data.x >= this.grid.width ||
        unit.data.y >= this.grid.height
      ) {
        const th = this.buildings.find((b) => b.defId === 'town_hall');
        unit.data.x = th ? th.x + 1 : 10;
        unit.data.y = th ? th.y + 2 : 10;
        unit.data.gridX = Math.floor(unit.data.x);
        unit.data.gridY = Math.floor(unit.data.y);
        unit.data.path = [];
        unit.setState('idle');
      }

      const currentTile = this.grid.getTile(unit.gridX, unit.gridY);
      const isRoadOrBridge = currentTile?.road || currentTile?.bridge || false;

      switch (unit.state) {
        case 'idle': {
          // Worker is waiting for next task assignment
          break;
        }

        case 'move_to_source':
        case 'move_to_building':
        case 'move_to_store':
        case 'patrol': {
          const reached = unit.updateMovement(deltaSec, isRoadOrBridge);
          if (reached) {
            this.handleUnitArrived(unit);
          }
          break;
        }

        case 'work':
        case 'build': {
          unit.data.workTimeRemainingMs -= deltaTimeMs;

          // Trigger occasional sound while working
          if (Math.random() < 0.08) {
            const job = unit.data.jobId ? JOBS[unit.data.jobId] : undefined;
            if (job?.toolType === 'axe') globalAudio.play('chop');
            else if (job?.toolType === 'pickaxe') globalAudio.play('mine');
            else if (job?.toolType === 'saw') globalAudio.play('saw');
            else globalAudio.play('hammer');
          }

          if (unit.data.workTimeRemainingMs <= 0) {
            this.handleUnitWorkComplete(unit);
          }
          break;
        }

        case 'carry': {
          // Finding route to storage
          this.routeUnitToNearestStore(unit);
          break;
        }

        case 'deliver': {
          // Deposit carried resource
          if (unit.carry) {
            const added = this.store.add(unit.carry.res, unit.carry.qty);
            if (added > 0) {
              this.addFloatingText(`+${added} ${unit.carry.res}`, unit.gridX, unit.gridY, '#81c784');
              globalAudio.play('deliver');
            } else {
              this.addFloatingText('Storage Full!', unit.gridX, unit.gridY, '#ffb74d');
            }
            unit.setCarry(undefined);
          }
          unit.setState('idle');
          break;
        }
      }
    }
  }

  /**
   * Manually assigns a specific job/profession to a unit
   */
  assignUnitJob(unitId: string, jobId: string | null): boolean {
    const unit = this.units.find((u) => u.id === unitId);
    if (!unit || unit.data.type === 'soldier') return false;

    // Clear previous building assignment
    if (unit.data.assignedBuildingId) {
      const prevBld = this.buildings.find((b) => b.id === unit.data.assignedBuildingId);
      if (prevBld) {
        prevBld.assignedWorkerIds = prevBld.assignedWorkerIds.filter((id) => id !== unit.id);
      }
      unit.data.assignedBuildingId = undefined;
    }

    // Reset path
    unit.setPath([]);

    // 1. Unassign / Free Settler
    if (!jobId || jobId === 'free') {
      unit.data.jobId = undefined;
      unit.setState('idle');
      this.addFloatingText('Free Settler', unit.gridX, unit.gridY, '#94a3b8');
      globalAudio.play('click');
      return true;
    }

    const job = JOBS[jobId];
    if (!job) return false;

    unit.data.jobId = jobId;

    // 2. Assign as Master Builder
    if (jobId === 'builder') {
      const unbuilt = this.buildings.find((b) => !b.isConstructed);
      if (unbuilt) {
        unit.data.assignedBuildingId = unbuilt.id;
        if (!unbuilt.assignedWorkerIds.includes(unit.id)) {
          unbuilt.assignedWorkerIds.push(unit.id);
        }
        this.routeWorkerToBuilding(unit, unbuilt);
        this.addFloatingText('Master Builder 🔨', unit.gridX, unit.gridY, '#fbbf24');
      } else {
        unit.setState('idle');
        this.addFloatingText('Builder (Awaiting Site) 🔨', unit.gridX, unit.gridY, '#fbbf24');
      }
      globalAudio.play('hammer');
      return true;
    }

    // 3. Assign to production building
    if (job.atBuilding) {
      const targetBld = this.buildings.find((b) => b.defId === job.atBuilding && b.isConstructed);
      if (targetBld) {
        unit.data.assignedBuildingId = targetBld.id;
        if (!targetBld.assignedWorkerIds.includes(unit.id)) {
          targetBld.assignedWorkerIds.push(unit.id);
        }
        this.dispatchWorkerJob(unit);
        this.addFloatingText(`${job.name} ✨`, unit.gridX, unit.gridY, '#38bdf8');
      } else {
        this.addNotification(`No constructed ${job.atBuilding} found for ${job.name}. Villager assigned as gatherer.`, 'warn');
        this.dispatchWorkerJob(unit);
      }
    } else {
      // 4. Terrain gathering job (e.g. Lumberjack)
      this.dispatchWorkerJob(unit);
      this.addFloatingText(`${job.name} 🪓`, unit.gridX, unit.gridY, '#4ade80');
    }

    globalAudio.play('click');
    return true;
  }

  private autoAssignWorkers(): void {
    // 1. Maintain worker lists on all buildings
    for (const b of this.buildings) {
      b.assignedWorkerIds = b.assignedWorkerIds.filter((id) => {
        const u = this.units.find((unit) => unit.id === id);
        return u && u.data.assignedBuildingId === b.id;
      });
    }

    // 2. PRIORITY #1: Check unbuilt buildings that need builders
    const unbuilt = this.buildings.filter((b) => !b.isConstructed);
    for (const b of unbuilt) {
      while (b.assignedWorkerIds.length < 2) {
        const builder = this.findNearestCandidateBuilder(b.x, b.y);
        if (!builder) break;
        builder.data.jobId = 'builder';
        builder.data.assignedBuildingId = b.id;
        b.assignedWorkerIds.push(builder.id);
        this.routeWorkerToBuilding(builder, b);
      }
    }

    // 3. PRIORITY #2: Check constructed production buildings that need workers
    for (const b of this.buildings) {
      if (!b.isConstructed) continue;
      const def = getBuilding(b.defId);
      if (!def || !def.workJob || !def.maxWorkers) continue;

      while (b.assignedWorkerIds.length < def.maxWorkers) {
        const idleWorker = this.findNearestIdleWorker(b.x, b.y);
        if (!idleWorker) break;
        idleWorker.data.jobId = def.workJob;
        idleWorker.data.assignedBuildingId = b.id;
        b.assignedWorkerIds.push(idleWorker.id);
        this.dispatchWorkerJob(idleWorker);
      }
    }

    // 4. Re-dispatch workers who are assigned to a building and currently idle
    for (const u of this.units) {
      if (u.data.type === 'villager' && u.state === 'idle' && u.data.assignedBuildingId) {
        const b = this.buildings.find((bld) => bld.id === u.data.assignedBuildingId);
        if (b) {
          if (!b.isConstructed) {
            u.data.jobId = 'builder';
            this.routeWorkerToBuilding(u, b);
          } else {
            this.dispatchWorkerJob(u);
          }
        } else {
          u.data.assignedBuildingId = undefined;
          u.data.jobId = undefined;
        }
      }
    }

    // 5. Default settler behavior: unassigned idle villagers actively chop timber to stock sawmill and gather materials
    for (const u of this.units) {
      if (u.data.type === 'villager' && u.state === 'idle' && !u.data.assignedBuildingId) {
        // If unbuilt structures exist, become builder!
        const unbuiltBld = this.buildings.find((b) => !b.isConstructed && b.assignedWorkerIds.length < 2);
        if (unbuiltBld) {
          u.data.jobId = 'builder';
          u.data.assignedBuildingId = unbuiltBld.id;
          unbuiltBld.assignedWorkerIds.push(u.id);
          this.routeWorkerToBuilding(u, unbuiltBld);
          continue;
        }

        // Otherwise gather timber
        const treeTile = this.findNearestFeatureTile(u.gridX, u.gridY, 'tree');
        if (treeTile) {
          u.data.jobId = 'lumberjack';
          const path = this.pathfinder.findPath(u.gridX, u.gridY, treeTile[0], treeTile[1], true);
          if (path && path.length > 0) {
            u.data.targetX = treeTile[0];
            u.data.targetY = treeTile[1];
            u.setPath(path);
            u.setState('move_to_source');
          }
        }
      }
    }
  }

  private findNearestCandidateBuilder(fromX: number, fromY: number): Unit | null {
    // 1. Look for idle villager without building assignment
    let best: Unit | null = null;
    let minDist = Infinity;
    for (const u of this.units) {
      if (u.data.type === 'villager' && u.state === 'idle' && !u.data.assignedBuildingId) {
        const d = manhattanDistance(fromX, fromY, u.gridX, u.gridY);
        if (d < minDist) {
          minDist = d;
          best = u;
        }
      }
    }
    if (best) return best;

    // 2. Look for idle worker with builder job
    for (const u of this.units) {
      if (u.data.type === 'villager' && u.data.jobId === 'builder' && !u.data.assignedBuildingId) {
        const d = manhattanDistance(fromX, fromY, u.gridX, u.gridY);
        if (d < minDist) {
          minDist = d;
          best = u;
        }
      }
    }
    if (best) return best;

    // 3. Draft unassigned woodcutters to prioritize construction
    for (const u of this.units) {
      if (u.data.type === 'villager' && !u.data.assignedBuildingId && u.data.jobId === 'lumberjack') {
        const d = manhattanDistance(fromX, fromY, u.gridX, u.gridY);
        if (d < minDist) {
          minDist = d;
          best = u;
        }
      }
    }
    return best;
  }

  private findNearestIdleWorker(fromX: number, fromY: number): Unit | null {
    let best: Unit | null = null;
    let minDist = Infinity;
    for (const u of this.units) {
      if (u.data.type === 'villager' && u.state === 'idle' && !u.data.assignedBuildingId) {
        const d = manhattanDistance(fromX, fromY, u.gridX, u.gridY);
        if (d < minDist) {
          minDist = d;
          best = u;
        }
      }
    }
    return best;
  }

  private routeWorkerToBuilding(worker: Unit, building: BuildingInstance): void {
    const def = getBuilding(building.defId);
    if (!def) return;
    const entrance = this.pathfinder.findNearestBuildingEntrance(
      worker.gridX,
      worker.gridY,
      building.x,
      building.y,
      def.size.w,
      def.size.h
    );

    const workTargetX = entrance
      ? entrance[0]
      : Math.min(this.grid.width - 1, Math.max(0, building.x + Math.floor(def.size.w / 2)));
    const workTargetY = entrance
      ? entrance[1]
      : Math.min(this.grid.height - 1, Math.max(0, building.y + def.size.h));

    if (worker.gridX === workTargetX && worker.gridY === workTargetY) {
      worker.data.targetX = workTargetX;
      worker.data.targetY = workTargetY;
      this.handleUnitArrived(worker);
      return;
    }

    const path = this.pathfinder.findPath(worker.gridX, worker.gridY, workTargetX, workTargetY);
    if (path && path.length > 0) {
      worker.setPath(path);
      worker.data.targetX = workTargetX;
      worker.data.targetY = workTargetY;
      worker.setState('move_to_building');
      return;
    }

    // Direct placement outside the building so worker is always in plain sight
    worker.data.x = workTargetX;
    worker.data.y = workTargetY;
    worker.data.gridX = workTargetX;
    worker.data.gridY = workTargetY;
    worker.data.targetX = workTargetX;
    worker.data.targetY = workTargetY;
    this.handleUnitArrived(worker);
  }

  private dispatchWorkerJob(worker: Unit): void {
    const jobId = worker.data.jobId;
    if (!jobId) return;
    const job = JOBS[jobId];
    if (!job) return;

    // Check if worker needs to harvest from terrain (e.g. lumberjack, quarry stone miner, mine ores)
    const terrainInput = job.inputs.find((i) => i.from === 'terrain');

    if (terrainInput) {
      let featureTarget: FeatureType = 'tree';
      if (terrainInput.res === 'stone') featureTarget = 'rock_outcrop';
      else if (terrainInput.res === 'coal') featureTarget = 'coal_seam';
      else if (terrainInput.res === 'iron_ore') featureTarget = 'iron_seam';

      const targetTile = this.findNearestFeatureTile(worker.gridX, worker.gridY, featureTarget);
      if (targetTile) {
        const path = this.pathfinder.findPath(worker.gridX, worker.gridY, targetTile[0], targetTile[1], true);
        if (path && path.length > 0) {
          worker.data.targetX = targetTile[0];
          worker.data.targetY = targetTile[1];
          worker.setPath(path);
          worker.setState('move_to_source');
          return;
        }
      }

      // If no terrain target in reach, but stationed at a building (like Stone Quarry or Mine), work directly at the building!
      if (worker.data.assignedBuildingId) {
        const bld = this.buildings.find((b) => b.id === worker.data.assignedBuildingId);
        if (bld && bld.isConstructed) {
          this.routeWorkerToBuilding(worker, bld);
          return;
        }
      }
    }

    // Check if worker works at their assigned building (Sawmill, Smithy, etc.)
    if (worker.data.assignedBuildingId) {
      const bld = this.buildings.find((b) => b.id === worker.data.assignedBuildingId);
      if (bld && bld.isConstructed) {
        // If job has store inputs (e.g. logs for sawmill, coal+iron for smithy), check store
        const storeInputs = job.inputs.filter((i) => i.from === 'store');
        let canDoJob = true;
        for (const input of storeInputs) {
          if (this.store.get(input.res) < input.qty) {
            canDoJob = false;
            break;
          }
        }

        if (canDoJob) {
          // Deduct inputs from store and start work at building
          for (const input of storeInputs) {
            this.store.deduct([{ res: input.res, qty: input.qty }]);
          }
          this.routeWorkerToBuilding(worker, bld);
          return;
        } else {
          // If Sawmill lacks logs, go chop a tree to bring logs back!
          if (job.id === 'sawyer') {
            const treeTile = this.findNearestFeatureTile(worker.gridX, worker.gridY, 'tree');
            if (treeTile) {
              const prevJob = worker.data.jobId;
              worker.data.jobId = 'lumberjack';
              const path = this.pathfinder.findPath(worker.gridX, worker.gridY, treeTile[0], treeTile[1], true);
              if (path && path.length > 0) {
                worker.data.targetX = treeTile[0];
                worker.data.targetY = treeTile[1];
                worker.setPath(path);
                worker.setState('move_to_source');
                return;
              }
              worker.data.jobId = prevJob;
            }
          }
        }
      }
    }

    // Fallback: wait idle
    worker.setState('idle');
  }

  private handleUnitArrived(unit: Unit): void {
    // 1. Check if arriving to build an unconstructed building
    if (unit.data.jobId === 'builder' && unit.data.assignedBuildingId) {
      const bld = this.buildings.find((b) => b.id === unit.data.assignedBuildingId);
      if (bld && !bld.isConstructed) {
        unit.data.workTotalMs = 3000;
        unit.data.workTimeRemainingMs = 3000;
        unit.setState('build');
        return;
      }
    }

    if (unit.state === 'move_to_source') {
      // Arrived at terrain feature (tree/rock/ore)
      const job = unit.data.jobId ? JOBS[unit.data.jobId] : undefined;
      const workTime = job?.workMs || 4000;
      unit.data.workTotalMs = workTime;
      unit.data.workTimeRemainingMs = workTime;
      unit.setState('work');
    } else if (unit.state === 'move_to_building' || unit.state === 'idle') {
      // Check if factory worker (Sawyer / Weaponsmith / Miner)
      const job = unit.data.jobId ? JOBS[unit.data.jobId] : undefined;
      if (job) {
        unit.data.workTotalMs = job.workMs;
        unit.data.workTimeRemainingMs = job.workMs;
        unit.setState('work');
      } else {
        unit.setState('idle');
      }
    } else if (unit.state === 'move_to_store') {
      unit.setState('deliver');
    }
  }

  private handleUnitWorkComplete(unit: Unit): void {
    const job = unit.data.jobId ? JOBS[unit.data.jobId] : undefined;

    // Builder finished a construction cycle
    if (unit.state === 'build' && unit.data.assignedBuildingId) {
      const bld = this.buildings.find((b) => b.id === unit.data.assignedBuildingId);
      if (bld && !bld.isConstructed) {
        bld.buildProgressMs += 3500;
        this.addFloatingText('🔨 Working...', bld.x + 1, bld.y, '#ffcc80');

        if (bld.buildProgressMs < bld.totalBuildMs) {
          // Continue building
          unit.data.workTotalMs = 3000;
          unit.data.workTimeRemainingMs = 3000;
          unit.setState('build');
          return;
        } else {
          // Construction complete!
          bld.isConstructed = true;
          this.updateStoreCapacity();
          const def = getBuilding(bld.defId);
          this.addFloatingText('Completed! ✨', bld.x + (def ? def.size.w / 2 : 1), bld.y, '#4caf50');
          this.addNotification(`Construction finished: ${def?.name || 'Building'}`, 'success');
          globalAudio.play('build_complete');

          // The builder of a building defaults to being the active worker of that building!
          if (def && def.workJob && def.maxWorkers > 0 && bld.assignedWorkerIds.length <= def.maxWorkers) {
            unit.data.jobId = def.workJob;
            unit.data.assignedBuildingId = bld.id;
            if (!bld.assignedWorkerIds.includes(unit.id)) {
              bld.assignedWorkerIds.push(unit.id);
            }
            unit.setState('idle');
            this.dispatchWorkerJob(unit);
            return;
          }

          unit.data.assignedBuildingId = undefined;
          unit.data.jobId = undefined;
          unit.setState('idle');
          return;
        }
      }
    }

    // Gathering or processing output
    if (job && job.outputs.length > 0) {
      // Randomly pick output if multiple (e.g. Weaponsmith sword or shield)
      const output = job.outputs[Math.floor(Math.random() * job.outputs.length)];

      // If harvested tree, deplete the tree tile
      if (job.id === 'lumberjack' && unit.data.targetX !== undefined && unit.data.targetY !== undefined) {
        const targetTile = this.grid.getTile(unit.data.targetX, unit.data.targetY);
        if (targetTile && targetTile.feature === 'tree') {
          this.grid.setTile(unit.data.targetX, unit.data.targetY, { feature: undefined });
        }
      }

      unit.setCarry({ res: output.res, qty: output.qty });
      this.routeUnitToNearestStore(unit);
    } else {
      unit.setState('idle');
    }
  }

  private routeUnitToNearestStore(unit: Unit): void {
    // Find nearest Town Hall or Storehouse
    const stores = this.buildings.filter(
      (b) => b.isConstructed && (b.defId === 'town_hall' || b.defId === 'storehouse')
    );

    let bestEntrance: [number, number] | null = null;
    let minDist = Infinity;

    for (const s of stores) {
      const def = getBuilding(s.defId);
      if (!def) continue;
      const entrance = this.pathfinder.findNearestBuildingEntrance(
        unit.gridX,
        unit.gridY,
        s.x,
        s.y,
        def.size.w,
        def.size.h
      );
      if (entrance) {
        const d = manhattanDistance(unit.gridX, unit.gridY, entrance[0], entrance[1]);
        if (d < minDist) {
          minDist = d;
          bestEntrance = entrance;
        }
      }
    }

    if (bestEntrance) {
      const path = this.pathfinder.findPath(unit.gridX, unit.gridY, bestEntrance[0], bestEntrance[1]);
      if (path && path.length > 0) {
        unit.setPath(path);
        unit.setState('move_to_store');
        return;
      }
    }

    // Direct deliver if adjacent
    unit.setState('deliver');
  }

  private findNearestFeatureTile(fromX: number, fromY: number, feature: FeatureType): [number, number] | null {
    let best: [number, number] | null = null;
    let minDist = Infinity;

    for (let y = 0; y < this.grid.height; y++) {
      for (let x = 0; x < this.grid.width; x++) {
        const tile = this.grid.getTile(x, y);
        if (tile && (tile.feature === feature || (feature === 'rock_outcrop' && tile.terrain === 'rocky'))) {
          const d = manhattanDistance(fromX, fromY, x, y);
          if (d < minDist) {
            minDist = d;
            best = [x, y];
          }
        }
      }
    }

    return best;
  }

  private checkPopulationGrowth(deltaTimeMs: number): void {
    const now = Date.now();
    if (now - this.lastVillagerSpawnMs >= VILLAGER_SPAWN_INTERVAL_MS) {
      this.lastVillagerSpawnMs = now;

      if (this.population < this.totalBeds) {
        const townHall = this.buildings.find((b) => b.isConstructed && b.defId === 'town_hall');
        if (townHall) {
          const entrance = this.pathfinder.findNearestBuildingEntrance(
            townHall.x,
            townHall.y,
            townHall.x,
            townHall.y,
            2,
            2
          );
          const spawnX = entrance ? entrance[0] : townHall.x;
          const spawnY = entrance ? entrance[1] : townHall.y;

          this.spawnUnit('villager', spawnX, spawnY);
          this.addFloatingText('New Settler Arrived! 👶', spawnX, spawnY, '#ffb74d');
          this.addNotification('A new settler has moved into your colony!', 'info');
        }
      }
    }
  }
}
