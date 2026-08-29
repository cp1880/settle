import { World, FloatingText } from './World';
import { Unit } from './Unit';
import { BuildingInstance } from '../types';
import { isoToScreen } from '../iso';
import { TILE_WIDTH, TILE_HEIGHT } from '../constants';
import { getBuilding } from '../content/buildings';

export interface RenderOptions {
  selectedGridX?: number;
  selectedGridY?: number;
  selectedBuildingId?: string;
  selectedUnitId?: string;
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
      this.drawBuildPreview(options.buildPreview);
    }

    // 5. Draw Tile Selection Highlight
    if (options.selectedGridX !== undefined && options.selectedGridY !== undefined) {
      this.drawSelectionHighlight(options.selectedGridX, options.selectedGridY);
    }

    // 6. Draw Floating Texts & Particles
    this.drawFloatingTexts(world.floatingTexts);

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

        const screen = isoToScreen(x, y);

        // Draw diamond
        ctx.beginPath();
        ctx.moveTo(screen.x, screen.y);
        ctx.lineTo(screen.x + TILE_WIDTH / 2, screen.y + TILE_HEIGHT / 2);
        ctx.lineTo(screen.x, screen.y + TILE_HEIGHT);
        ctx.lineTo(screen.x - TILE_WIDTH / 2, screen.y + TILE_HEIGHT / 2);
        ctx.closePath();

        // Base tile fill
        if (tile.terrain === 'water') {
          // Dynamic water ripple colors
          const wave = Math.sin((x * 2 + y * 2 + this.animTimeMs / 600));
          ctx.fillStyle = wave > 0.3 ? '#2563eb' : wave > -0.3 ? '#1d4ed8' : '#1e40af';
          ctx.fill();

          // Subtle shoreline foam
          ctx.strokeStyle = 'rgba(147, 197, 253, 0.3)';
          ctx.lineWidth = 1;
          ctx.stroke();
        } else {
          // Land tile colors
          if (tile.terrain === 'grass') {
            const check = (x + y) % 2 === 0;
            ctx.fillStyle = check ? '#3b7a57' : '#336a4b';
          } else if (tile.terrain === 'forest') {
            ctx.fillStyle = '#245237';
          } else if (tile.terrain === 'rocky') {
            ctx.fillStyle = '#6b7280';
          }
          ctx.fill();

          // Subtle tile grid gridlines
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // Draw road overlay
        if (tile.road) {
          this.drawRoadTile(x, y, screen.x, screen.y);
        }
      }
    }
  }

  private drawRoadTile(gx: number, gy: number, sx: number, sy: number): void {
    const ctx = this.ctx;
    const halfW = TILE_WIDTH / 2;
    const halfH = TILE_HEIGHT / 2;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(sx, sy + 6);
    ctx.lineTo(sx + halfW - 12, sy + halfH);
    ctx.lineTo(sx, sy + TILE_HEIGHT - 6);
    ctx.lineTo(sx - halfW + 12, sy + halfH);
    ctx.closePath();

    ctx.fillStyle = '#9ca3af'; // Cobblestone gray
    ctx.fill();

    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
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
        if (tile && tile.feature) {
          items.push({
            depth: x + y + 0.3,
            type: 'feature',
            data: { x, y, feature: tile.feature, terrain: tile.terrain },
          });
        }
      }
    }

    // 2. Buildings
    for (const bld of world.buildings) {
      const def = getBuilding(bld.defId);
      const size = def?.size || { w: 1, h: 1 };
      items.push({
        depth: bld.x + bld.y + size.w + size.h - 0.4,
        type: 'building',
        data: bld,
      });
    }

    // 3. Units
    for (const unit of world.units) {
      items.push({
        depth: unit.x + unit.y + 0.5,
        type: 'unit',
        data: unit,
      });
    }

    // Sort ascending by depth (Painter's Algorithm)
    items.sort((a, b) => a.depth - b.depth);

    // Draw in sorted order
    for (const item of items) {
      if (item.type === 'feature') {
        this.drawFeature(item.data.x, item.data.y, item.data.feature, item.data.terrain);
      } else if (item.type === 'building') {
        this.drawBuilding(item.data, options.selectedBuildingId === item.data.id);
      } else if (item.type === 'unit') {
        this.drawUnit(item.data, options.selectedUnitId === item.data.id);
      }
    }
  }

  private drawFeature(gx: number, gy: number, feature: string, terrain: string): void {
    const ctx = this.ctx;
    const screen = isoToScreen(gx, gy);
    const centerX = screen.x;
    const centerY = screen.y + TILE_HEIGHT / 2;

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
    } else if (feature === 'coal_seam') {
      // Dark coal crystal vein
      ctx.beginPath();
      ctx.ellipse(centerX, centerY + 4, 14, 7, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(centerX - 12, centerY);
      ctx.lineTo(centerX - 4, centerY - 16);
      ctx.lineTo(centerX + 8, centerY - 14);
      ctx.lineTo(centerX + 14, centerY + 2);
      ctx.closePath();
      ctx.fillStyle = '#1c1917';
      ctx.fill();
      ctx.strokeStyle = '#44403c';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (feature === 'iron_seam') {
      // Rusty metallic iron vein
      ctx.beginPath();
      ctx.ellipse(centerX, centerY + 4, 14, 7, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(centerX - 14, centerY + 2);
      ctx.lineTo(centerX - 6, centerY - 18);
      ctx.lineTo(centerX + 10, centerY - 16);
      ctx.lineTo(centerX + 14, centerY + 4);
      ctx.closePath();
      ctx.fillStyle = '#b45309';
      ctx.fill();
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  private drawBuilding(bld: BuildingInstance, isSelected: boolean): void {
    const ctx = this.ctx;
    const def = getBuilding(bld.defId);
    if (!def) return;

    const screen = isoToScreen(bld.x, bld.y);
    const sizeW = def.size.w;
    const sizeH = def.size.h;

    // Building ground center
    const centerX = screen.x;
    const centerY = screen.y + ((sizeW + sizeH) * TILE_HEIGHT) / 4;

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
      case 'turret':
        this.drawTurretArt(centerX, centerY);
        break;
      default:
        this.drawGenericBuilding(centerX, centerY, def.name);
    }

    ctx.restore();
  }

  private drawScaffolding(cx: number, cy: number, bld: BuildingInstance, def: any): void {
    const ctx = this.ctx;
    const progress = Math.min(1, bld.buildProgressMs / bld.totalBuildMs);

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

    // Progress bar above scaffolding
    const barW = 44;
    const barH = 7;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(cx - barW / 2 - 1, cy - 50 - 1, barW + 2, barH + 2);

    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(cx - barW / 2, cy - 50, barW * progress, barH);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.floor(progress * 100)}%`, cx, cy - 54);
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

  private drawGenericBuilding(cx: number, cy: number, name: string): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#64748b';
    ctx.fillRect(cx - 24, cy - 24, 48, 24);
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(name, cx, cy - 10);
  }

  private drawUnit(unit: Unit, isSelected: boolean): void {
    const ctx = this.ctx;
    const screen = isoToScreen(unit.x, unit.y);
    const cx = screen.x;
    const cy = screen.y + TILE_HEIGHT / 2;

    const isMoving = unit.state.startsWith('move');
    const walkBounce = isMoving ? Math.abs(Math.sin(this.animTimeMs / 120)) * 4 : 0;

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

  private drawBuildPreview(preview: { defId: string; gridX: number; gridY: number; isValid: boolean }): void {
    const ctx = this.ctx;
    const def = getBuilding(preview.defId);
    if (!def) return;

    for (let dy = 0; dy < def.size.h; dy++) {
      for (let dx = 0; dx < def.size.w; dx++) {
        const screen = isoToScreen(preview.gridX + dx, preview.gridY + dy);
        ctx.beginPath();
        ctx.moveTo(screen.x, screen.y);
        ctx.lineTo(screen.x + TILE_WIDTH / 2, screen.y + TILE_HEIGHT / 2);
        ctx.lineTo(screen.x, screen.y + TILE_HEIGHT);
        ctx.lineTo(screen.x - TILE_WIDTH / 2, screen.y + TILE_HEIGHT / 2);
        ctx.closePath();

        ctx.fillStyle = preview.isValid ? 'rgba(74, 222, 128, 0.45)' : 'rgba(239, 68, 68, 0.45)';
        ctx.fill();
        ctx.strokeStyle = preview.isValid ? '#22c55e' : '#ef4444';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }

  private drawSelectionHighlight(gx: number, gy: number): void {
    const ctx = this.ctx;
    const screen = isoToScreen(gx, gy);

    ctx.beginPath();
    ctx.moveTo(screen.x, screen.y);
    ctx.lineTo(screen.x + TILE_WIDTH / 2, screen.y + TILE_HEIGHT / 2);
    ctx.lineTo(screen.x, screen.y + TILE_HEIGHT);
    ctx.lineTo(screen.x - TILE_WIDTH / 2, screen.y + TILE_HEIGHT / 2);
    ctx.closePath();

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private drawFloatingTexts(texts: FloatingText[]): void {
    const ctx = this.ctx;
    for (const ft of texts) {
      const screen = isoToScreen(ft.gridX, ft.gridY);
      const floatUp = (ft.elapsedMs / ft.durationMs) * 35;
      const alpha = 1 - ft.elapsedMs / ft.durationMs;

      ctx.save();
      ctx.fillStyle = ft.color;
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 4;
      ctx.fillText(ft.text, screen.x, screen.y + TILE_HEIGHT / 2 - 10 - floatUp);
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
