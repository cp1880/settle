import { World, FloatingText } from './World';
import { Unit } from './Unit';
import { BuildingInstance } from '../types';
import { isoToScreen } from '../iso';
import { TILE_WIDTH, TILE_HEIGHT } from '../constants';
import { getBuilding } from '../content/buildings';
import { JOBS } from '../content/jobs';
import { getUnitScreenPosition, getUnitClickBounds } from './unitUtils';

export interface RenderOptions {
  selectedGridX?: number;
  selectedGridY?: number;
  selectedBuildingId?: string;
  selectedUnitId?: string;
  hoveredUnitId?: string;
  selectedResourceNode?: { x: number; y: number } | null;
  buildPreview?: {
    defId: string;
    gridX: number;
    gridY: number;
    isValid: boolean;
  };
  roadToolActive?: boolean;
  timeOfDay?: 'day' | 'sunset' | 'night';
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private animTimeMs: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create Canvas 2D context');
    this.ctx = ctx;
  }

  render(
    world: World,
    camera: { x: number; y: number; zoom: number },
    options: RenderOptions = {}
  ): void {
    this.animTimeMs = performance.now();
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // 1. Clear & setup transform
    ctx.save();
    ctx.fillStyle = '#0f172a'; // Deep slate background
    ctx.fillRect(0, 0, width, height);

    // Apply Camera (scaled around viewport center, centered on world coordinate camera.x, camera.y)
    ctx.translate(width / 2, height / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    // 2. Draw Base Ground Terrain
    this.drawTerrain(world);

    // 3. Draw Depth-Sorted Dynamic Objects (Features, Buildings, Units)
    this.drawDepthSortedObjects(world, options);

    // 4. Draw Build Placement Preview Ghost (if in build mode)
    if (options.buildPreview) {
      this.drawBuildPreview(options.buildPreview, world);
    }

    // 5. Draw Tile Selection Highlight
    if (options.selectedGridX !== undefined && options.selectedGridY !== undefined) {
      this.drawSelectionHighlight(options.selectedGridX, options.selectedGridY, world);
    }

    // 6. Draw Floating Texts & Particles
    this.drawFloatingTexts(world.floatingTexts, world);

    // 7. Ambient Lighting Tint
    if (options.timeOfDay && options.timeOfDay !== 'day') {
      this.drawAmbientLighting(width, height, options.timeOfDay, camera);
    }

    ctx.restore();
  }

  private drawTerrain(world: World): void {
    const ctx = this.ctx;
    const grid = world.grid;

    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const tile = grid.getTile(x, y);
        if (!tile) continue;

        const corners = grid.getTileCorners(x, y);

        // Draw diamond quadrilateral using the 4 elevated corners
        ctx.beginPath();
        ctx.moveTo(corners.top.x, corners.top.y);
        ctx.lineTo(corners.right.x, corners.right.y);
        ctx.lineTo(corners.bottom.x, corners.bottom.y);
        ctx.lineTo(corners.left.x, corners.left.y);
        ctx.closePath();

        // Base tile fill
        if (tile.terrain === 'water') {
          // Dynamic water ripple colors
          const wave = Math.sin((x * 2 + y * 2 + this.animTimeMs / 600));
          ctx.fillStyle = wave > 0.3 ? '#2563eb' : wave > -0.3 ? '#1d4ed8' : '#1e40af';
          ctx.fill();

          // Shoreline foam / shallow water highlight
          ctx.strokeStyle = 'rgba(147, 197, 253, 0.35)';
          ctx.lineWidth = 1;
          ctx.stroke();
        } else {
          // Dynamic land colors responding to elevation
          const elevNorm = tile.elevation || 0.3;
          const isAlt = (x + y) % 2 === 0;

          if (tile.terrain === 'grass') {
            if (elevNorm > 0.52) {
              // Sunny highland grass
              ctx.fillStyle = isAlt ? '#7cb322' : '#6ea31b';
            } else if (elevNorm > 0.28) {
              // Rolling midland plains
              ctx.fillStyle = isAlt ? '#5c9622' : '#52871c';
            } else {
              // Lush lowland valley
              ctx.fillStyle = isAlt ? '#457a1e' : '#3d6e18';
            }
          } else if (tile.terrain === 'forest') {
            if (elevNorm > 0.52) {
              ctx.fillStyle = isAlt ? '#2d6a4f' : '#245a42';
            } else {
              ctx.fillStyle = isAlt ? '#1b4332' : '#143628';
            }
          } else if (tile.terrain === 'rocky') {
            if (elevNorm > 0.72) {
              // Granite mountain peak
              ctx.fillStyle = isAlt ? '#94a3b8' : '#64748b';
            } else {
              // Rocky highland slope
              ctx.fillStyle = isAlt ? '#64748b' : '#475569';
            }
          }
          ctx.fill();

          // 3D Slope directional relief lighting (Sunlight from North-West / Top-Left)
          const slope = grid.getTileSlopeFactor(x, y);
          if (slope > 0.04) {
            // Lit slope facing sun
            ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.35, slope * 0.32)})`;
            ctx.fill();
          } else if (slope < -0.04) {
            // Shaded slope in shadow
            ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(0.40, -slope * 0.36)})`;
            ctx.fill();
          }

          // Subtle tile gridlines
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.14)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // Draw road overlay
        if (tile.road) {
          this.drawRoadTile(x, y, corners);
        }
      }
    }
  }

  private drawRoadTile(
    gx: number,
    gy: number,
    corners: {
      top: { x: number; y: number };
      right: { x: number; y: number };
      bottom: { x: number; y: number };
      left: { x: number; y: number };
    }
  ): void {
    const ctx = this.ctx;
    const { top, right, bottom, left } = corners;

    ctx.save();

    // 1. Full diamond paved slab base
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(right.x, right.y);
    ctx.lineTo(bottom.x, bottom.y);
    ctx.lineTo(left.x, left.y);
    ctx.closePath();

    // Clean light grey slate paver base
    const isAlt = (gx + gy) % 2 === 0;
    ctx.fillStyle = isAlt ? '#cbd5e1' : '#94a3b8';
    ctx.fill();

    // Solid slate stone perimeter border
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 2. Cobblestone / Flagstone geometric paver joints
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.7)';
    ctx.lineWidth = 1.2;

    // NW-SE diagonal divider
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(bottom.x, bottom.y);
    ctx.moveTo(left.x, left.y);
    ctx.lineTo(right.x, right.y);
    ctx.stroke();

    // Secondary paving slab sub-divisions
    ctx.beginPath();
    ctx.moveTo((top.x + left.x) / 2, (top.y + left.y) / 2);
    ctx.lineTo((bottom.x + right.x) / 2, (bottom.y + right.y) / 2);
    ctx.moveTo((top.x + right.x) / 2, (top.y + right.y) / 2);
    ctx.lineTo((bottom.x + left.x) / 2, (bottom.y + left.y) / 2);
    ctx.stroke();

    // 3. Crisp white stone top bevel highlight
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(left.x, left.y);
    ctx.lineTo(top.x, top.y);
    ctx.lineTo(right.x, right.y);
    ctx.stroke();

    ctx.restore();
  }

  private drawDepthSortedObjects(world: World, options: RenderOptions): void {
    interface DepthItem {
      depth: number;
      type: 'feature' | 'building' | 'unit';
      data: any;
    }

    const items: DepthItem[] = [];
    const grid = world.grid;

    // 1. Terrain Features (trees, rocks, ore seams)
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const tile = grid.getTile(x, y);
        if (tile && (tile.feature || tile.terrain === 'rocky')) {
          items.push({
            depth: x + y + 0.3,
            type: 'feature',
            data: {
              x,
              y,
              feature: tile.feature || (tile.terrain === 'rocky' ? 'rock_outcrop' : undefined),
              terrain: tile.terrain,
              remaining: tile.resourceRemaining,
              max: tile.resourceMax,
            },
          });
        }
      }
    }

    // 2. Buildings
    for (const bld of world.buildings) {
      const def = getBuilding(bld.defId);
      const size = def?.size || { w: 1, h: 1 };
      const isRoadOrBridge = def?.id === 'bridge' || def?.id === 'road';
      items.push({
        depth: isRoadOrBridge ? bld.x + bld.y + 0.05 : bld.x + bld.y + size.w + size.h - 0.7,
        type: 'building',
        data: bld,
      });
    }

    // 3. Units
    for (const unit of world.units) {
      items.push({
        depth: unit.x + unit.y + 0.8,
        type: 'unit',
        data: unit,
      });
    }

    // Sort ascending by depth (Painter's Algorithm)
    items.sort((a, b) => a.depth - b.depth);

    // Draw in sorted order
    for (const item of items) {
      if (item.type === 'feature') {
        const isSelected =
          options.selectedResourceNode?.x === item.data.x &&
          options.selectedResourceNode?.y === item.data.y;
        this.drawFeature(item.data.x, item.data.y, item.data.feature, item.data.terrain, isSelected, world);
      } else if (item.type === 'building') {
        this.drawBuilding(item.data, options.selectedBuildingId === item.data.id, world);
      } else if (item.type === 'unit') {
        this.drawUnit(
          item.data,
          options.selectedUnitId === item.data.id,
          options.hoveredUnitId === item.data.id,
          world
        );
      }
    }
  }

  private drawFeature(
    gx: number,
    gy: number,
    feature: string | undefined,
    terrain: string,
    isSelected?: boolean,
    world?: World
  ): void {
    const ctx = this.ctx;
    const center = world ? world.grid.getTileCenterScreen(gx, gy) : { x: isoToScreen(gx, gy).x, y: isoToScreen(gx, gy).y + TILE_HEIGHT / 2 };
    const centerX = center.x;
    const centerY = center.y;

    // Selection ring if clicked
    if (isSelected) {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(centerX, centerY + 4, 26, 13, 0, 0, Math.PI * 2);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.restore();
    }

    if (feature === 'tree') {
      // Animated gentle swaying tree (subtle ~6-8% tile width sway at the top, fixed trunk)
      const windPhase = (this.animTimeMs / 1200) + gx * 0.6 + gy * 0.8;
      const maxSway = TILE_WIDTH * 0.06; // ~7.6px max sway (~6% of tile width)
      const sway = Math.sin(windPhase) * maxSway;

      // Tree trunk shadow
      ctx.beginPath();
      ctx.ellipse(centerX, centerY + 8, 14, 7, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.fill();

      // Tree trunk
      ctx.fillStyle = '#6d4c41';
      ctx.fillRect(centerX - 4, centerY - 14, 8, 22);

      // Layered pine/oak foliage with proportional sway based on height
      const layers = [
        { y: centerY - 16, r: 18, c: '#1e4620', swayFactor: 0.3 },
        { y: centerY - 28, r: 15, c: '#2e7d32', swayFactor: 0.65 },
        { y: centerY - 38, r: 11, c: '#43a047', swayFactor: 1.0 },
      ];

      for (const layer of layers) {
        ctx.beginPath();
        ctx.arc(centerX + sway * layer.swayFactor, layer.y, layer.r, 0, Math.PI * 2);
        ctx.fillStyle = layer.c;
        ctx.fill();
        ctx.strokeStyle = '#1b5e20';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    } else if (feature === 'iron_seam') {
      // Iron Ore Deposit: Darker rock base (medium charcoal-slate) with rich reddish-rust ore veins & specks
      // Ground contact shadow
      ctx.beginPath();
      ctx.ellipse(centerX, centerY + 6, 17, 8, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
      ctx.fill();

      // Main craggy dark rock body (darker than stone, lighter than pure coal)
      ctx.beginPath();
      ctx.moveTo(centerX - 16, centerY + 4);
      ctx.lineTo(centerX - 11, centerY - 16);
      ctx.lineTo(centerX - 2, centerY - 23);
      ctx.lineTo(centerX + 8, centerY - 20);
      ctx.lineTo(centerX + 16, centerY - 5);
      ctx.lineTo(centerX + 13, centerY + 6);
      ctx.closePath();
      ctx.fillStyle = '#3f3f46'; // Medium-dark slate/charcoal rock
      ctx.fill();
      ctx.strokeStyle = '#27272a';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Rock facet - lit plane
      ctx.beginPath();
      ctx.moveTo(centerX - 11, centerY - 16);
      ctx.lineTo(centerX - 2, centerY - 23);
      ctx.lineTo(centerX + 2, centerY - 10);
      ctx.lineTo(centerX - 7, centerY - 4);
      ctx.closePath();
      ctx.fillStyle = '#52525b';
      ctx.fill();

      // Secondary smaller rock flank
      ctx.beginPath();
      ctx.moveTo(centerX + 5, centerY + 4);
      ctx.lineTo(centerX + 11, centerY - 10);
      ctx.lineTo(centerX + 18, centerY - 3);
      ctx.lineTo(centerX + 16, centerY + 7);
      ctx.closePath();
      ctx.fillStyle = '#333338';
      ctx.fill();
      ctx.strokeStyle = '#27272a';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Red/Rust mineral ore veins
      ctx.strokeStyle = '#991b1b'; // Deep rust red
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(centerX - 8, centerY - 14);
      ctx.lineTo(centerX - 1, centerY - 8);
      ctx.lineTo(centerX + 6, centerY - 12);
      ctx.stroke();

      ctx.strokeStyle = '#c2410c'; // Burnt rust orange
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(centerX - 12, centerY + 1);
      ctx.lineTo(centerX - 5, centerY - 3);
      ctx.lineTo(centerX + 3, centerY + 2);
      ctx.stroke();

      // Scattered specks & chunks of reddish-rust iron ore
      const oreSpecks = [
        { x: centerX - 6, y: centerY - 12, r: 2.2, color: '#dc2626' }, // Crimson rust
        { x: centerX - 1, y: centerY - 18, r: 2.5, color: '#ea580c' }, // Rich rust orange
        { x: centerX + 4, y: centerY - 11, r: 2.0, color: '#b91c1c' }, // Deep red
        { x: centerX - 9, y: centerY - 2, r: 1.8, color: '#ea580c' },  // Rust speck
        { x: centerX + 1, y: centerY - 4, r: 2.6, color: '#f97316' },  // Bright rust ore
        { x: centerX + 7, y: centerY - 1, r: 2.0, color: '#dc2626' },  // Red mineral
        { x: centerX + 13, y: centerY - 6, r: 1.8, color: '#ea580c' }, // Flank speck
        { x: centerX - 3, y: centerY + 3, r: 1.6, color: '#c2410c' },  // Base speck
      ];

      for (const s of oreSpecks) {
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = s.color;
        ctx.fill();

        // Metallic/mineral glint highlight on top edge of specks
        ctx.beginPath();
        ctx.arc(s.x - 0.5, s.y - 0.5, s.r * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = '#fed7aa'; // Warm light peach/amber glint
        ctx.fill();
      }
    } else if (feature === 'coal_seam') {
      // Coal Deposit: Jet black glassy crystal shards & dark seams
      ctx.beginPath();
      ctx.ellipse(centerX, centerY + 5, 15, 7, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fill();

      // Sharp crystalline black coal cluster
      ctx.beginPath();
      ctx.moveTo(centerX - 13, centerY + 2);
      ctx.lineTo(centerX - 5, centerY - 18);
      ctx.lineTo(centerX + 2, centerY - 21);
      ctx.lineTo(centerX + 9, centerY - 12);
      ctx.lineTo(centerX + 15, centerY + 3);
      ctx.closePath();
      ctx.fillStyle = '#18181b'; // Pitch/Jet black
      ctx.fill();
      ctx.strokeStyle = '#09090b';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Shiny obsidian/anthracite crystal facet highlights
      ctx.beginPath();
      ctx.moveTo(centerX - 5, centerY - 18);
      ctx.lineTo(centerX + 2, centerY - 21);
      ctx.lineTo(centerX - 1, centerY - 8);
      ctx.closePath();
      ctx.fillStyle = '#27272a';
      ctx.fill();

      // Bright specular edge reflections
      ctx.strokeStyle = 'rgba(212, 212, 216, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(centerX - 5, centerY - 18);
      ctx.lineTo(centerX + 2, centerY - 21);
      ctx.stroke();
    } else if (feature === 'rock_outcrop' || terrain === 'rocky') {
      // Rock boulders
      ctx.beginPath();
      ctx.ellipse(centerX, centerY + 6, 16, 8, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fill();

      // Main rock
      ctx.beginPath();
      ctx.moveTo(centerX - 16, centerY + 4);
      ctx.lineTo(centerX - 10, centerY - 18);
      ctx.lineTo(centerX + 6, centerY - 22);
      ctx.lineTo(centerX + 16, centerY - 6);
      ctx.lineTo(centerX + 12, centerY + 6);
      ctx.closePath();
      ctx.fillStyle = '#78716c';
      ctx.fill();
      ctx.strokeStyle = '#57534e';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Highlight facet
      ctx.beginPath();
      ctx.moveTo(centerX - 10, centerY - 18);
      ctx.lineTo(centerX + 6, centerY - 22);
      ctx.lineTo(centerX, centerY - 6);
      ctx.closePath();
      ctx.fillStyle = '#a8a29e';
      ctx.fill();
    }
  }

  private drawBuilding(bld: BuildingInstance, isSelected: boolean, world?: World): void {
    const ctx = this.ctx;
    const def = getBuilding(bld.defId);
    if (!def) return;

    const sizeW = def.size.w;
    const sizeH = def.size.h;

    // Building ground center with elevation applied
    const center = world
      ? world.grid.getBuildingCenterScreen(bld.x, bld.y, sizeW, sizeH)
      : { x: isoToScreen(bld.x, bld.y).x, y: isoToScreen(bld.x, bld.y).y + ((sizeW + sizeH) * TILE_HEIGHT) / 4 };
    const centerX = center.x;
    const centerY = center.y;

    ctx.save();

    // 1. Selection indicator on ground
    if (isSelected) {
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, sizeW * 34, sizeH * 18, 0, 0, Math.PI * 2);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // 2. If under construction, draw scaffolding & progress ring
    if (!bld.isConstructed) {
      this.drawScaffolding(centerX, centerY, bld, def);
      ctx.restore();
      return;
    }

    // 3. Render Finished Building Architecture
    switch (def.id) {
      case 'bridge':
        this.drawBridgeArt(centerX, centerY, bld, world);
        break;
      case 'town_hall':
        this.drawTownHallArt(centerX, centerY);
        break;
      case 'storehouse':
        this.drawStorehouseArt(centerX, centerY);
        break;
      case 'sawmill':
        this.drawSawmillArt(centerX, centerY);
        break;
      case 'quarry':
        this.drawQuarryArt(centerX, centerY);
        break;
      case 'coal_mine':
      case 'iron_mine':
        this.drawMineArt(centerX, centerY, def.id === 'iron_mine');
        break;
      case 'smithy':
        this.drawSmithyArt(centerX, centerY);
        break;
      case 'house':
        this.drawHouseArt(centerX, centerY);
        break;
      case 'barracks':
        this.drawBarracksArt(centerX, centerY, bld.trainingProgressMs !== undefined);
        break;
      case 'wall':
        this.drawWallArt(centerX, centerY);
        break;
      case 'gate':
        this.drawGateArt(centerX, centerY);
        break;
      case 'road':
        if (world) {
          this.drawRoadTile(bld.x, bld.y, world.grid.getTileCorners(bld.x, bld.y));
        }
        break;
      case 'turret':
        this.drawTurretArt(centerX, centerY);
        break;
      default:
        this.drawGenericBuilding(centerX, centerY, def.name);
    }

    // 4. Productivity Status Indicators
    if (bld.isConstructed && def.workJob && world) {
      const jobDef = JOBS[def.workJob];
      const hasWorkers = bld.assignedWorkerIds.length > 0;
      const badgeY = centerY - (def.size.h * 26 + 22);

      if (!hasWorkers) {
        // No worker assigned icon
        this.drawBuildingStatusBadge(centerX, badgeY, 'no_worker', 'No Worker');
      } else if (jobDef) {
        // Check if missing store input materials
        const storeInputs = jobDef.inputs.filter((i) => i.from === 'store');
        let missingLabel: string | null = null;
        for (const input of storeInputs) {
          if (world.store.get(input.res) < input.qty) {
            missingLabel = input.res === 'log' ? 'No Logs' : input.res === 'coal' ? 'No Coal' : input.res === 'iron_ore' ? 'No Iron Ore' : 'No Input';
            break;
          }
        }

        if (missingLabel) {
          this.drawBuildingStatusBadge(centerX, badgeY, 'no_materials', missingLabel);
        }
      }
    }

    ctx.restore();
  }

  private drawBuildingStatusBadge(
    cx: number,
    baseCy: number,
    type: 'no_worker' | 'no_materials',
    label: string
  ): void {
    const ctx = this.ctx;
    // Subtle vertical floating bob
    const bob = Math.sin(this.animTimeMs / 250) * 3;
    const cy = baseCy + bob;

    ctx.save();

    const isWorkerAlert = type === 'no_worker';
    const pillW = isWorkerAlert ? 78 : 82;
    const pillH = 18;
    const pillR = 9;

    // Drop shadow
    ctx.beginPath();
    ctx.roundRect(cx - pillW / 2 + 1, cy - pillH / 2 + 2, pillW, pillH, pillR);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fill();

    // Main Badge Body
    ctx.beginPath();
    ctx.roundRect(cx - pillW / 2, cy - pillH / 2, pillW, pillH, pillR);
    ctx.fillStyle = isWorkerAlert ? '#d97706' : '#dc2626'; // Amber vs Red
    ctx.fill();
    ctx.strokeStyle = isWorkerAlert ? '#78350f' : '#7f1d1d';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Little downward pointer triangle
    ctx.beginPath();
    ctx.moveTo(cx - 4, cy + pillH / 2 - 1);
    ctx.lineTo(cx + 4, cy + pillH / 2 - 1);
    ctx.lineTo(cx, cy + pillH / 2 + 4);
    ctx.closePath();
    ctx.fillStyle = isWorkerAlert ? '#d97706' : '#dc2626';
    ctx.fill();

    // Draw Vector Icon inside badge
    const iconX = cx - pillW / 2 + 10;
    const iconY = cy;

    if (isWorkerAlert) {
      // Worker silhouette + exclamation mark
      // Head
      ctx.beginPath();
      ctx.arc(iconX, iconY - 3, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      // Shoulders
      ctx.beginPath();
      ctx.arc(iconX, iconY + 5, 4, Math.PI, 0);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      // Amber exclamation mark on top
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', iconX + 6, iconY - 2);
    } else {
      // Material / Crate box icon
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(iconX - 4, iconY - 4, 8, 8);
      ctx.beginPath();
      ctx.moveTo(iconX - 4, iconY - 4);
      ctx.lineTo(iconX + 4, iconY + 4);
      ctx.moveTo(iconX + 4, iconY - 4);
      ctx.lineTo(iconX - 4, iconY + 4);
      ctx.stroke();
    }

    // Label Text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, iconX + 7, cy + 3);

    ctx.restore();
  }

  private drawScaffolding(cx: number, cy: number, bld: BuildingInstance, def: any): void {
    const ctx = this.ctx;
    const progress = Math.min(1, bld.buildProgressMs / bld.totalBuildMs);

    if (bld.defId === 'bridge') {
      // Water stilts and unfinished wooden trestles for bridge
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx - 30, cy + 10);
      ctx.lineTo(cx - 30, cy - 12);
      ctx.moveTo(cx + 30, cy + 10);
      ctx.lineTo(cx + 30, cy - 12);
      ctx.moveTo(cx - 35, cy - 12);
      ctx.lineTo(cx + 35, cy - 12);
      ctx.stroke();

      // Planks laid down so far
      ctx.fillStyle = '#b45309';
      ctx.fillRect(cx - 24, cy - 15, 48 * progress, 5);

      // Wood shavings floating on water
      ctx.fillStyle = '#d97706';
      ctx.fillRect(cx - 12, cy + 6, 4, 2);
      ctx.fillRect(cx + 10, cy + 10, 3, 2);
    } else {
      // Foundation shadow
      ctx.beginPath();
      ctx.ellipse(cx, cy, 32, 16, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fill();

      // Wooden timber scaffold frame
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 3;
      ctx.strokeRect(cx - 24, cy - 35, 48, 35);
      ctx.beginPath();
      ctx.moveTo(cx - 24, cy - 35);
      ctx.lineTo(cx + 24, cy);
      ctx.moveTo(cx + 24, cy - 35);
      ctx.lineTo(cx - 24, cy);
      ctx.stroke();
    }

    // Progress bar above scaffolding
    const barW = 44;
    const barH = 7;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(cx - barW / 2 - 1, cy - 42 - 1, barW + 2, barH + 2);

    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(cx - barW / 2, cy - 42, barW * progress, barH);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.floor(progress * 100)}%`, cx, cy - 46);
  }

  private drawTownHallArt(cx: number, cy: number): void {
    const ctx = this.ctx;
    // Ground Shadow
    ctx.beginPath();
    ctx.ellipse(cx, cy + 8, 48, 24, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fill();

    // Stone base walls
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(cx - 36, cy - 32, 72, 36);

    // Dark timber corner trims
    ctx.fillStyle = '#78350f';
    ctx.fillRect(cx - 36, cy - 32, 8, 36);
    ctx.fillRect(cx + 28, cy - 32, 8, 36);

    // Grand archway door
    ctx.fillStyle = '#451a03';
    ctx.beginPath();
    ctx.arc(cx, cy - 4, 10, Math.PI, 0);
    ctx.fillRect(cx - 10, cy - 4, 20, 10);
    ctx.fill();

    // Red clay tiled roof
    ctx.beginPath();
    ctx.moveTo(cx - 44, cy - 32);
    ctx.lineTo(cx, cy - 65);
    ctx.lineTo(cx + 44, cy - 32);
    ctx.closePath();
    ctx.fillStyle = '#dc2626';
    ctx.fill();
    ctx.strokeStyle = '#991b1b';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Bell Tower
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(cx - 10, cy - 85, 20, 22);

    ctx.beginPath();
    ctx.moveTo(cx - 14, cy - 85);
    ctx.lineTo(cx, cy - 102);
    ctx.lineTo(cx + 14, cy - 85);
    ctx.closePath();
    ctx.fillStyle = '#b91c1c';
    ctx.fill();

    // Banner Flag fluttering
    const flagWave = Math.sin(this.animTimeMs / 300) * 4;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 102);
    ctx.lineTo(cx, cy - 116);
    ctx.lineTo(cx + 12 + flagWave, cy - 110);
    ctx.lineTo(cx, cy - 104);
    ctx.fillStyle = '#fbbf24';
    ctx.fill();
  }

  private drawStorehouseArt(cx: number, cy: number): void {
    const ctx = this.ctx;
    // Shadow
    ctx.beginPath();
    ctx.ellipse(cx, cy + 6, 42, 20, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fill();

    // Timber walls
    ctx.fillStyle = '#b45309';
    ctx.fillRect(cx - 32, cy - 28, 64, 30);

    // Horizontal plank lines
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 1;
    for (let y = cy - 22; y <= cy; y += 6) {
      ctx.beginPath();
      ctx.moveTo(cx - 32, y);
      ctx.lineTo(cx + 32, y);
      ctx.stroke();
    }

    // Wide double warehouse doors
    ctx.fillStyle = '#451a03';
    ctx.fillRect(cx - 14, cy - 16, 28, 18);
    ctx.strokeStyle = '#fef08a';
    ctx.strokeRect(cx - 14, cy - 16, 28, 18);

    // Blue slate pitched roof
    ctx.beginPath();
    ctx.moveTo(cx - 38, cy - 28);
    ctx.lineTo(cx, cy - 54);
    ctx.lineTo(cx + 38, cy - 28);
    ctx.closePath();
    ctx.fillStyle = '#0284c7';
    ctx.fill();
    ctx.strokeStyle = '#0369a1';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Crates outside
    ctx.fillStyle = '#d97706';
    ctx.fillRect(cx + 18, cy - 4, 10, 10);
    ctx.fillRect(cx - 28, cy - 2, 8, 8);
  }

  private drawSawmillArt(cx: number, cy: number): void {
    const ctx = this.ctx;
    // Shadow
    ctx.beginPath();
    ctx.ellipse(cx, cy + 6, 38, 18, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fill();

    // Open-shed wood frame
    ctx.fillStyle = '#a16207';
    ctx.fillRect(cx - 28, cy - 24, 56, 26);

    // Animated water wheel or sawblade rotation
    const rot = (this.animTimeMs / 200) % (Math.PI * 2);
    ctx.save();
    ctx.translate(cx - 14, cy - 8);
    ctx.rotate(rot);
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Timber log pile on platform
    ctx.fillStyle = '#78350f';
    ctx.fillRect(cx + 4, cy - 12, 18, 6);
    ctx.fillRect(cx + 6, cy - 18, 14, 6);

    // Green shingle roof
    ctx.beginPath();
    ctx.moveTo(cx - 34, cy - 24);
    ctx.lineTo(cx, cy - 46);
    ctx.lineTo(cx + 34, cy - 24);
    ctx.closePath();
    ctx.fillStyle = '#15803d';
    ctx.fill();
    ctx.strokeStyle = '#166534';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  private drawQuarryArt(cx: number, cy: number): void {
    const ctx = this.ctx;
    // Deep stone pit
    ctx.beginPath();
    ctx.ellipse(cx, cy + 4, 36, 18, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#44403c';
    ctx.fill();
    ctx.strokeStyle = '#78716c';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Crane Derrick / Pulley tower
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy + 4);
    ctx.lineTo(cx - 12, cy - 44);
    ctx.lineTo(cx + 16, cy - 36);
    ctx.stroke();

    // Hanging rope & stone block
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx + 16, cy - 36);
    ctx.lineTo(cx + 16, cy - 16);
    ctx.stroke();

    ctx.fillStyle = '#a8a29e';
    ctx.fillRect(cx + 10, cy - 16, 12, 10);
  }

  private drawMineArt(cx: number, cy: number, isIron: boolean): void {
    const ctx = this.ctx;
    // Mine entrance hill
    ctx.beginPath();
    ctx.moveTo(cx - 34, cy + 4);
    ctx.lineTo(cx - 16, cy - 38);
    ctx.lineTo(cx + 20, cy - 42);
    ctx.lineTo(cx + 36, cy + 4);
    ctx.closePath();
    ctx.fillStyle = isIron ? '#78350f' : '#292524';
    ctx.fill();
    ctx.strokeStyle = isIron ? '#b45309' : '#57534e';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Wooden tunnel arch
    ctx.fillStyle = '#0c0a09';
    ctx.fillRect(cx - 12, cy - 20, 24, 22);

    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 3;
    ctx.strokeRect(cx - 12, cy - 20, 24, 22);

    // Ore carts outside
    ctx.fillStyle = isIron ? '#f59e0b' : '#44403c';
    ctx.fillRect(cx + 16, cy - 6, 12, 8);
  }

  private drawSmithyArt(cx: number, cy: number): void {
    const ctx = this.ctx;
    // Shadow
    ctx.beginPath();
    ctx.ellipse(cx, cy + 6, 38, 18, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fill();

    // Stone masonry workshop
    ctx.fillStyle = '#57534e';
    ctx.fillRect(cx - 28, cy - 26, 56, 28);

    // Glowing forge window
    const glow = 0.6 + Math.sin(this.animTimeMs / 180) * 0.4;
    ctx.fillStyle = `rgba(249, 115, 22, ${glow})`;
    ctx.fillRect(cx - 8, cy - 14, 16, 12);

    // Chimney with smoke
    ctx.fillStyle = '#292524';
    ctx.fillRect(cx + 14, cy - 50, 10, 26);

    // Smoke particles
    const smokeY = (this.animTimeMs / 40) % 30;
    ctx.beginPath();
    ctx.arc(cx + 19 + Math.sin(smokeY) * 3, cy - 52 - smokeY, 4 + smokeY * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(168, 162, 158, ${0.7 - smokeY / 45})`;
    ctx.fill();

    // Iron roof
    ctx.beginPath();
    ctx.moveTo(cx - 34, cy - 26);
    ctx.lineTo(cx, cy - 48);
    ctx.lineTo(cx + 34, cy - 26);
    ctx.closePath();
    ctx.fillStyle = '#475569';
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  private drawHouseArt(cx: number, cy: number): void {
    const ctx = this.ctx;
    // Shadow
    ctx.beginPath();
    ctx.ellipse(cx, cy + 6, 32, 16, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fill();

    // White plaster walls
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(cx - 22, cy - 22, 44, 24);

    // Timber beams
    ctx.fillStyle = '#78350f';
    ctx.fillRect(cx - 22, cy - 22, 5, 24);
    ctx.fillRect(cx + 17, cy - 22, 5, 24);

    // Cozy door & window
    ctx.fillStyle = '#451a03';
    ctx.fillRect(cx - 6, cy - 12, 12, 14);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(cx + 8, cy - 14, 6, 6);

    // Red peaked roof
    ctx.beginPath();
    ctx.moveTo(cx - 28, cy - 22);
    ctx.lineTo(cx, cy - 46);
    ctx.lineTo(cx + 28, cy - 22);
    ctx.closePath();
    ctx.fillStyle = '#b91c1c';
    ctx.fill();
    ctx.strokeStyle = '#991b1b';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  private drawBarracksArt(cx: number, cy: number, isTraining: boolean): void {
    const ctx = this.ctx;
    // Shadow
    ctx.beginPath();
    ctx.ellipse(cx, cy + 6, 40, 20, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fill();

    // Fortified stone base
    ctx.fillStyle = '#64748b';
    ctx.fillRect(cx - 30, cy - 28, 60, 30);

    // Crenellations on roof edge
    ctx.fillStyle = '#475569';
    for (let x = cx - 30; x <= cx + 24; x += 10) {
      ctx.fillRect(x, cy - 35, 6, 7);
    }

    // Heavy iron-banded doors
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(cx - 10, cy - 16, 20, 18);

    // Crossed Swords crest
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 6, cy - 24);
    ctx.lineTo(cx + 6, cy - 14);
    ctx.moveTo(cx + 6, cy - 24);
    ctx.lineTo(cx - 6, cy - 14);
    ctx.stroke();

    // Training indicator / Sparring sparks
    if (isTraining) {
      const spark = Math.sin(this.animTimeMs / 100);
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(cx + spark * 12, cy - 45, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawWallArt(cx: number, cy: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#64748b';
    ctx.fillRect(cx - 16, cy - 22, 32, 24);

    // Battlements
    ctx.fillStyle = '#475569';
    ctx.fillRect(cx - 16, cy - 28, 8, 6);
    ctx.fillRect(cx + 8, cy - 28, 8, 6);

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - 16, cy - 22, 32, 24);
  }

  private drawGateArt(cx: number, cy: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#64748b';
    ctx.fillRect(cx - 18, cy - 28, 10, 30);
    ctx.fillRect(cx + 8, cy - 28, 10, 30);

    // Archway
    ctx.fillStyle = '#78350f';
    ctx.fillRect(cx - 8, cy - 32, 16, 6);

    // Portcullis iron bars
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 4, cy - 26);
    ctx.lineTo(cx - 4, cy - 2);
    ctx.moveTo(cx + 4, cy - 26);
    ctx.lineTo(cx + 4, cy - 2);
    ctx.stroke();
  }

  private drawTurretArt(cx: number, cy: number): void {
    const ctx = this.ctx;
    // Circular stone watchtower
    ctx.fillStyle = '#475569';
    ctx.fillRect(cx - 14, cy - 42, 28, 44);

    // Top watch platform
    ctx.fillStyle = '#334155';
    ctx.fillRect(cx - 18, cy - 50, 36, 8);

    // Ballista / Archer bow
    const aimAngle = (this.animTimeMs / 1000) % (Math.PI * 2);
    ctx.save();
    ctx.translate(cx, cy - 54);
    ctx.rotate(Math.sin(aimAngle) * 0.6);
    ctx.fillStyle = '#b45309';
    ctx.fillRect(-8, -3, 16, 6);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(0, -1, 12, 2);
    ctx.restore();
  }

  private drawBridgeArt(cx: number, cy: number, bld: BuildingInstance, world?: World): void {
    const ctx = this.ctx;
    const gx = bld.x;
    const gy = bld.y;

    // Check neighboring tiles to see if bridge connects along axes
    let connectN = false;
    let connectS = false;
    let connectW = false;
    let connectE = false;

    if (world) {
      const tileN = world.grid.getTile(gx, gy - 1);
      const tileS = world.grid.getTile(gx, gy + 1);
      const tileW = world.grid.getTile(gx - 1, gy);
      const tileE = world.grid.getTile(gx + 1, gy);

      connectN = !!(tileN && (tileN.bridge || tileN.terrain !== 'water'));
      connectS = !!(tileS && (tileS.bridge || tileS.terrain !== 'water'));
      connectW = !!(tileW && (tileW.bridge || tileW.terrain !== 'water'));
      connectE = !!(tileE && (tileE.bridge || tileE.terrain !== 'water'));
    }

    // 1. Water Pilings / Wooden Stilts (4 structural posts driven into water)
    const stilts = [
      { x: cx - 44, y: cy - 6 },
      { x: cx + 44, y: cy - 6 },
      { x: cx, y: cy + 18 },
      { x: cx, y: cy - 20 },
    ];

    for (const st of stilts) {
      // Water foam / ripple at base
      ctx.beginPath();
      ctx.ellipse(st.x, st.y + 13, 5, 2.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(224, 242, 254, 0.45)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(147, 197, 253, 0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Stilt column
      ctx.fillStyle = '#451a03'; // Dark wood shadow
      ctx.fillRect(st.x - 3, st.y, 6, 14);
      ctx.fillStyle = '#78350f'; // Wood beam highlight
      ctx.fillRect(st.x - 2, st.y, 4, 14);
    }

    // 2. Heavy Timber Stringers / Longitudinal Beams
    ctx.strokeStyle = '#5c3a21';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx - 52, cy);
    ctx.lineTo(cx, cy + 26);
    ctx.lineTo(cx + 52, cy);
    ctx.lineTo(cx, cy - 26);
    ctx.closePath();
    ctx.stroke();

    // 3. Wooden Decking Platform (Raised 4px above water)
    const deckElev = 4;
    const topX = cx;
    const topY = cy - 28 - deckElev;
    const rightX = cx + 58;
    const rightY = cy - deckElev;
    const bottomX = cx;
    const bottomY = cy + 28 - deckElev;
    const leftX = cx - 58;
    const leftY = cy - deckElev;

    // 3D Timber Fascia Edges
    // Bottom-Left rim (in shadow)
    ctx.beginPath();
    ctx.moveTo(leftX, leftY);
    ctx.lineTo(bottomX, bottomY);
    ctx.lineTo(bottomX, bottomY + deckElev);
    ctx.lineTo(leftX, leftY + deckElev);
    ctx.closePath();
    ctx.fillStyle = '#5c3a21';
    ctx.fill();
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Bottom-Right rim (illuminated)
    ctx.beginPath();
    ctx.moveTo(bottomX, bottomY);
    ctx.lineTo(rightX, rightY);
    ctx.lineTo(rightX, rightY + deckElev);
    ctx.lineTo(bottomX, bottomY + deckElev);
    ctx.closePath();
    ctx.fillStyle = '#78350f';
    ctx.fill();
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Main Deck Base
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.lineTo(rightX, rightY);
    ctx.lineTo(bottomX, bottomY);
    ctx.lineTo(leftX, leftY);
    ctx.closePath();
    ctx.fillStyle = '#92400e';
    ctx.fill();

    // 4. Wooden Deck Planks (Interleaved rich golden cedar / amber oak planks)
    const plankColors = [
      '#b45309',
      '#d97706',
      '#c2410c',
      '#a16207',
      '#b45309',
      '#d97706',
      '#cd853f',
      '#92400e',
    ];

    const numPlanks = 8;
    for (let i = 0; i < numPlanks; i++) {
      const t0 = i / numPlanks;
      const t1 = (i + 1) / numPlanks;

      // Calculate plank corners along diamond edges (NW to SE orientation)
      const p1x = leftX + (topX - leftX) * t0;
      const p1y = leftY + (topY - leftY) * t0;
      const p2x = leftX + (topX - leftX) * t1;
      const p2y = leftY + (topY - leftY) * t1;

      const p3x = bottomX + (rightX - bottomX) * t1;
      const p3y = bottomY + (rightY - bottomY) * t1;
      const p4x = bottomX + (rightX - bottomX) * t0;
      const p4y = bottomY + (rightY - bottomY) * t0;

      ctx.beginPath();
      ctx.moveTo(p1x, p1y);
      ctx.lineTo(p2x, p2y);
      ctx.lineTo(p3x, p3y);
      ctx.lineTo(p4x, p4y);
      ctx.closePath();

      ctx.fillStyle = plankColors[i % plankColors.length];
      ctx.fill();

      // Dark plank separation groove
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Top wood-grain highlight line
      ctx.beginPath();
      ctx.moveTo(p1x + 2, p1y + 1);
      ctx.lineTo(p4x - 2, p4y + 1);
      ctx.strokeStyle = 'rgba(253, 224, 71, 0.35)';
      ctx.lineWidth = 0.8;
      ctx.stroke();

      // Nail / peg studs on plank ends
      ctx.fillStyle = '#291809';
      ctx.beginPath();
      ctx.arc(p1x + 4, p1y + 2, 1, 0, Math.PI * 2);
      ctx.arc(p4x - 4, p4y - 2, 1, 0, Math.PI * 2);
      ctx.fill();
    }

    // 5. Wooden Guard Rails & Posts
    const cornerPosts = [
      { x: leftX + 4, y: leftY },
      { x: rightX - 4, y: rightY },
      { x: topX, y: topY + 3 },
      { x: bottomX, y: bottomY - 3 },
    ];

    for (const post of cornerPosts) {
      // Post shadow
      ctx.fillStyle = '#451a03';
      ctx.fillRect(post.x - 2, post.y - 12, 4, 12);
      // Post face
      ctx.fillStyle = '#92400e';
      ctx.fillRect(post.x - 1, post.y - 12, 2, 12);
      // Post cap
      ctx.fillStyle = '#b45309';
      ctx.fillRect(post.x - 2.5, post.y - 14, 5, 2.5);
    }

    // Handrails on sides not connecting to other land/bridges
    // NW side (top to left)
    if (!connectW && !connectN) {
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(leftX + 4, leftY - 9);
      ctx.lineTo(topX, topY - 6);
      ctx.stroke();
    }
    // SE side (bottom to right)
    if (!connectE && !connectS) {
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(bottomX, bottomY - 12);
      ctx.lineTo(rightX - 4, rightY - 9);
      ctx.stroke();
    }
    // SW side (left to bottom)
    if (!connectW && !connectS) {
      ctx.strokeStyle = '#5c3a21';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(leftX + 4, leftY - 9);
      ctx.lineTo(bottomX, bottomY - 12);
      ctx.stroke();
    }
    // NE side (top to right)
    if (!connectN && !connectE) {
      ctx.strokeStyle = '#92400e';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(topX, topY - 6);
      ctx.lineTo(rightX - 4, rightY - 9);
      ctx.stroke();
    }
  }

  private drawGenericBuilding(cx: number, cy: number, name: string): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#64748b';
    ctx.fillRect(cx - 24, cy - 24, 48, 24);
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(name, cx, cy - 10);
  }

  private drawUnit(unit: Unit, isSelected: boolean, isHovered: boolean = false, world?: World): void {
    const ctx = this.ctx;

    const { cx, cy } = getUnitScreenPosition(unit, world);
    const isMoving = unit.state.startsWith('move') || unit.state === 'deliver' || (unit.data.path && unit.data.path.length > 0);
    const walkBounce = isMoving ? Math.abs(Math.sin(this.animTimeMs / 120)) * 4 : 0;

    // 1. Clickable Area Faint Box & Tooltip on Hover
    if (isHovered && world) {
      const bounds = getUnitClickBounds(unit, world);
      ctx.save();

      // Faint rounded rectangle representing the individual settler's clickable area
      const r = 5;
      ctx.beginPath();
      ctx.moveTo(bounds.x + r, bounds.y);
      ctx.lineTo(bounds.x + bounds.width - r, bounds.y);
      ctx.quadraticCurveTo(bounds.x + bounds.width, bounds.y, bounds.x + bounds.width, bounds.y + r);
      ctx.lineTo(bounds.x + bounds.width, bounds.y + bounds.height - r);
      ctx.quadraticCurveTo(bounds.x + bounds.width, bounds.y + bounds.height, bounds.x + bounds.width - r, bounds.y + bounds.height);
      ctx.lineTo(bounds.x + r, bounds.y + bounds.height);
      ctx.quadraticCurveTo(bounds.x, bounds.y + bounds.height, bounds.x, bounds.y + bounds.height - r);
      ctx.lineTo(bounds.x, bounds.y + r);
      ctx.quadraticCurveTo(bounds.x, bounds.y, bounds.x + r, bounds.y);
      ctx.closePath();

      // Soft glowing fill and crisp border
      ctx.fillStyle = 'rgba(56, 189, 248, 0.14)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Floating hover badge with settler name & job above the clickable box
      const jobDef = unit.data.jobId ? JOBS[unit.data.jobId] : null;
      const roleText = jobDef ? jobDef.name : unit.data.type === 'soldier' ? 'Guard' : 'Villager';
      const labelText = `${unit.data.name} • ${roleText}`;

      ctx.font = 'bold 9px system-ui, -apple-system, sans-serif';
      const textMetrics = ctx.measureText(labelText);
      const tagW = Math.max(36, textMetrics.width + 12);
      const tagH = 16;
      const tagX = cx - tagW / 2;
      const tagY = bounds.y - tagH - 3;

      // Dark badge pill background
      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
      ctx.lineWidth = 1;

      const pr = 4;
      ctx.beginPath();
      ctx.moveTo(tagX + pr, tagY);
      ctx.lineTo(tagX + tagW - pr, tagY);
      ctx.quadraticCurveTo(tagX + tagW, tagY, tagX + tagW, tagY + pr);
      ctx.lineTo(tagX + tagW, tagY + tagH - pr);
      ctx.quadraticCurveTo(tagX + tagW, tagY + tagH, tagX + tagW - pr, tagY + tagH);
      ctx.lineTo(tagX + pr, tagY + tagH);
      ctx.quadraticCurveTo(tagX, tagY + tagH, tagX, tagY + tagH - pr);
      ctx.lineTo(tagX, tagY + pr);
      ctx.quadraticCurveTo(tagX, tagY, tagX + pr, tagY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Badge text
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, cx, tagY + tagH / 2 + 0.5);

      ctx.restore();
    }

    // Unit Ground Shadow
    ctx.beginPath();
    ctx.ellipse(cx, cy, 8, 4, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fill();

    // Selection ring
    if (isSelected) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, 14, 7, 0, 0, Math.PI * 2);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    const unitY = cy - walkBounce;

    if (unit.data.type === 'soldier') {
      // Soldier Unit
      // Body armor
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(cx - 5, unitY - 16, 10, 12);

      // Steel Helmet
      ctx.beginPath();
      ctx.arc(cx, unitY - 20, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#cbd5e1';
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.stroke();

      // Shield on left arm
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(cx - 9, unitY - 14, 4, 9);

      // Sword in right hand
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx + 6, unitY - 8);
      ctx.lineTo(cx + 9, unitY - 20);
      ctx.stroke();
    } else {
      // Villager / Worker Unit
      // Tunic
      const isLumberjack = unit.data.jobId === 'lumberjack';
      const isMiner = unit.data.jobId?.includes('miner');
      const isBuilder = unit.data.jobId === 'builder';

      ctx.fillStyle = isLumberjack ? '#15803d' : isMiner ? '#475569' : isBuilder ? '#d97706' : '#854d0e';
      ctx.fillRect(cx - 4, unitY - 14, 8, 11);

      // Head
      ctx.beginPath();
      ctx.arc(cx, unitY - 18, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#fbcfe8'; // Skin tone
      ctx.fill();

      // Cap / Hat
      ctx.fillStyle = isBuilder ? '#f59e0b' : '#334155';
      ctx.beginPath();
      ctx.arc(cx, unitY - 20, 4.5, Math.PI, 0);
      ctx.fill();

      // Hand tool if working
      if (unit.state === 'work' || unit.state === 'build') {
        const swing = Math.sin(this.animTimeMs / 100) * 8;
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx + 4, unitY - 10);
        ctx.lineTo(cx + 10 + swing, unitY - 16 + swing);
        ctx.stroke();
      }

      // Carried resource on back
      if (unit.carry) {
        ctx.fillStyle = unit.carry.res === 'log' ? '#78350f' : unit.carry.res === 'wood' ? '#d7ccc8' : unit.carry.res === 'stone' ? '#94a3b8' : '#fbbf24';
        ctx.fillRect(cx - 3, unitY - 26, 6, 6);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.strokeRect(cx - 3, unitY - 26, 6, 6);
      }
    }
  }

  private drawBuildPreview(
    preview: { defId: string; gridX: number; gridY: number; isValid: boolean },
    world?: World
  ): void {
    const ctx = this.ctx;
    const def = getBuilding(preview.defId);
    if (!def) return;

    for (let dy = 0; dy < def.size.h; dy++) {
      for (let dx = 0; dx < def.size.w; dx++) {
        const gx = preview.gridX + dx;
        const gy = preview.gridY + dy;
        const corners = world
          ? world.grid.getTileCorners(gx, gy)
          : {
              top: isoToScreen(gx, gy),
              right: { x: isoToScreen(gx, gy).x + TILE_WIDTH / 2, y: isoToScreen(gx, gy).y + TILE_HEIGHT / 2 },
              bottom: { x: isoToScreen(gx, gy).x, y: isoToScreen(gx, gy).y + TILE_HEIGHT },
              left: { x: isoToScreen(gx, gy).x - TILE_WIDTH / 2, y: isoToScreen(gx, gy).y + TILE_HEIGHT / 2 },
            };

        ctx.beginPath();
        ctx.moveTo(corners.top.x, corners.top.y);
        ctx.lineTo(corners.right.x, corners.right.y);
        ctx.lineTo(corners.bottom.x, corners.bottom.y);
        ctx.lineTo(corners.left.x, corners.left.y);
        ctx.closePath();

        ctx.fillStyle = preview.isValid ? 'rgba(74, 222, 128, 0.45)' : 'rgba(239, 68, 68, 0.45)';
        ctx.fill();
        ctx.strokeStyle = preview.isValid ? '#22c55e' : '#ef4444';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }

  private drawSelectionHighlight(gx: number, gy: number, world?: World): void {
    const ctx = this.ctx;
    const corners = world
      ? world.grid.getTileCorners(gx, gy)
      : {
          top: isoToScreen(gx, gy),
          right: { x: isoToScreen(gx, gy).x + TILE_WIDTH / 2, y: isoToScreen(gx, gy).y + TILE_HEIGHT / 2 },
          bottom: { x: isoToScreen(gx, gy).x, y: isoToScreen(gx, gy).y + TILE_HEIGHT },
          left: { x: isoToScreen(gx, gy).x - TILE_WIDTH / 2, y: isoToScreen(gx, gy).y + TILE_HEIGHT / 2 },
        };

    ctx.beginPath();
    ctx.moveTo(corners.top.x, corners.top.y);
    ctx.lineTo(corners.right.x, corners.right.y);
    ctx.lineTo(corners.bottom.x, corners.bottom.y);
    ctx.lineTo(corners.left.x, corners.left.y);
    ctx.closePath();

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private drawFloatingTexts(texts: FloatingText[], world?: World): void {
    const ctx = this.ctx;
    for (const ft of texts) {
      const center = world
        ? world.grid.getTileCenterScreen(ft.gridX, ft.gridY)
        : { x: isoToScreen(ft.gridX, ft.gridY).x, y: isoToScreen(ft.gridX, ft.gridY).y + TILE_HEIGHT / 2 };
      const floatUp = (ft.elapsedMs / ft.durationMs) * 35;
      const alpha = 1 - ft.elapsedMs / ft.durationMs;

      ctx.save();
      ctx.fillStyle = ft.color;
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 4;
      ctx.fillText(ft.text, center.x, center.y - 10 - floatUp);
      ctx.restore();
    }
  }

  private drawAmbientLighting(
    width: number,
    height: number,
    timeOfDay: 'sunset' | 'night',
    camera: { x: number; y: number; zoom: number }
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    if (timeOfDay === 'sunset') {
      ctx.fillStyle = 'rgba(249, 115, 22, 0.18)';
    } else if (timeOfDay === 'night') {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
    }
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
}
