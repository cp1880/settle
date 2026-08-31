/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { World } from './core/World';
import { Grid } from './core/Grid';
import { Renderer } from './core/Renderer';
import { SaveSystem } from './core/SaveSystem';
import { globalAudio } from './core/AudioSystem';
import { validateContent } from './core/ContentValidator';
import { Unit } from './core/Unit';
import { GameSpeed, BuildingInstance } from './types';
import { getGridTileAtScreen, isoToScreen } from './iso';
import { BUILDINGS, getBuilding } from './content/buildings';
import { GRID_SIZE_X, GRID_SIZE_Y, TILE_WIDTH, TILE_HEIGHT } from './constants';
import { getUnitAtScreenPos, getUnitScreenPosition } from './core/unitUtils';
import { HUD } from './ui/HUD';
import { BuildMenu } from './ui/BuildMenu';
import { BuildingInspector } from './ui/BuildingInspector';
import { UnitInspector } from './ui/UnitInspector';
import { ProductionChainDiagram } from './ui/ProductionChainDiagram';
import { SaveLoadModal } from './ui/SaveLoadModal';
import { ResourceLedgerModal } from './ui/ResourceLedgerModal';
import { MainMenu } from './ui/MainMenu';
import { NotificationsList } from './ui/NotificationsList';
import { ResourceNodeInspector, ResourceNodeData } from './ui/ResourceNodeInspector';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const worldRef = useRef<World | null>(null);

  // Camera state
  const cameraRef = useRef<{ x: number; y: number; zoom: number }>({
    x: 0,
    y: 0,
    zoom: 1.0,
  });

  // UI state
  const [isMainMenuOpen, setIsMainMenuOpen] = useState(true);
  const [isBuildMenuOpen, setIsBuildMenuOpen] = useState(false);
  const [selectedDefId, setSelectedDefId] = useState<string | null>(null);
  const [roadToolActive, setRoadToolActive] = useState(false);
  const [demolishToolActive, setDemolishToolActive] = useState(false);

  const [selectedGridTile, setSelectedGridTile] = useState<{ x: number; y: number } | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingInstance | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [selectedResourceNode, setSelectedResourceNode] = useState<ResourceNodeData | null>(null);

  const [isChainDiagramOpen, setIsChainDiagramOpen] = useState(false);
  const [isResourceLedgerOpen, setIsResourceLedgerOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);

  const [gameSpeed, setGameSpeed] = useState<GameSpeed>(1);
  const [timeOfDay, setTimeOfDay] = useState<'day' | 'sunset' | 'night'>('day');
  const [isMuted, setIsMuted] = useState(false);

  // Live HUD metrics
  const [hudInventory, setHudInventory] = useState<Record<string, number>>({});
  const [hudStored, setHudStored] = useState(0);
  const [hudCapacity, setHudCapacity] = useState(200);
  const [hudPopulation, setHudPopulation] = useState(0);
  const [hudTotalBeds, setHudTotalBeds] = useState(6);
  const [notifications, setNotifications] = useState<any[]>([]);

  // Dragging & Gesture interaction refs
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const cameraAtDragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const touchDistanceRef = useRef<number | null>(null);
  const hasMovedSignificantlyRef = useRef(false);
  const hoveredUnitIdRef = useRef<string | null>(null);

  // Initialize and validate content on mount
  useEffect(() => {
    validateContent();
  }, []);

  // Initialize or start new game
  const handleStartNewGame = useCallback((preset: 'valley' | 'mountains' | 'forest' = 'valley') => {
    const customGrid = Grid.generateScenario(GRID_SIZE_X, GRID_SIZE_Y, preset);
    const newWorld = new World(customGrid);
    newWorld.initStarterSettlement();

    worldRef.current = newWorld;

    // Center camera on the Town Hall in world coordinates
    const thCenterX = Math.floor(customGrid.width / 2);
    const thCenterY = Math.floor(customGrid.height / 2);
    const thIso = customGrid.getBuildingCenterScreen(thCenterX - 2, thCenterY - 2, 4, 4);
    cameraRef.current = { x: thIso.x, y: thIso.y, zoom: 1.0 };

    setIsMainMenuOpen(false);
    setSelectedDefId(null);
    setRoadToolActive(false);
    setDemolishToolActive(false);
    setSelectedBuilding(null);
    setSelectedUnitId(null);
  }, []);

  // Continue game from autosave
  const handleContinueGame = useCallback(() => {
    const loaded = SaveSystem.loadFromSlot('autosave') || SaveSystem.loadFromSlot('default');
    if (loaded) {
      worldRef.current = loaded.world;
      cameraRef.current = loaded.camera;
      setIsMainMenuOpen(false);
    } else {
      handleStartNewGame('valley');
    }
  }, [handleStartNewGame]);

  // Game Loop (requestAnimationFrame + simulation stepping)
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();
    let autoSaveTimer = 0;

    const loop = (currentTime: number) => {
      const deltaMs = Math.min(100, currentTime - lastTime);
      lastTime = currentTime;

      const world = worldRef.current;
      const canvas = canvasRef.current;

      if (world && canvas) {
        // 1. Advance simulation ticks according to GameSpeed
        if (gameSpeed > 0) {
          const simTimeMs = deltaMs * gameSpeed;
          world.update(simTimeMs);

          // Update React state for HUD
          setHudInventory(world.store.getInventory());
          setHudStored(world.store.currentStoredUnits);
          setHudCapacity(world.store.totalCapacity);
          setHudPopulation(world.population);
          setHudTotalBeds(world.totalBeds);
          setNotifications([...world.notifications]);

          // Periodic Auto-save (every 30s)
          autoSaveTimer += simTimeMs;
          if (autoSaveTimer >= 30000) {
            autoSaveTimer = 0;
            SaveSystem.saveToSlot(world, cameraRef.current, 'autosave');
          }
        }

        // 2. Render Frame
        if (!rendererRef.current && canvas) {
          rendererRef.current = new Renderer(canvas);
        }

        if (rendererRef.current) {
          let buildPreview: any = undefined;
          if (selectedDefId && selectedGridTile) {
            const def = getBuilding(selectedDefId);
            const isValid =
              def !== undefined &&
              world.grid.canPlaceBuilding(selectedGridTile.x, selectedGridTile.y, def.size.w, def.size.h, def.allowedTerrains) &&
              world.store.canAfford(def.cost);

            buildPreview = {
              defId: selectedDefId,
              gridX: selectedGridTile.x,
              gridY: selectedGridTile.y,
              isValid,
            };
          }

          rendererRef.current.render(world, cameraRef.current, {
            selectedGridX: selectedGridTile?.x,
            selectedGridY: selectedGridTile?.y,
            selectedBuildingId: selectedBuilding?.id,
            selectedUnitId: selectedUnitId || undefined,
            hoveredUnitId: hoveredUnitIdRef.current || undefined,
            selectedResourceNode,
            buildPreview,
            roadToolActive,
            timeOfDay,
          });
        }
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [gameSpeed, timeOfDay, selectedDefId, selectedGridTile, selectedBuilding, selectedUnitId, selectedResourceNode, roadToolActive]);

  // Resize canvas to window size
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Camera Centering Helpers
  const centerCameraOnUnit = useCallback((unit: Unit) => {
    const world = worldRef.current;
    const pos = getUnitScreenPosition(unit, world || undefined);
    cameraRef.current.x = pos.cx;
    cameraRef.current.y = pos.cy;
  }, []);

  const centerCameraOnBuilding = useCallback((bld: BuildingInstance) => {
    const world = worldRef.current;
    const def = getBuilding(bld.defId);
    const w = def ? def.size.w : 1;
    const h = def ? def.size.h : 1;
    const pos = world
      ? world.grid.getBuildingCenterScreen(bld.x, bld.y, w, h)
      : isoToScreen(bld.x + w / 2, bld.y + h / 2);
    cameraRef.current.x = pos.x;
    cameraRef.current.y = pos.y;
  }, []);

  // Unit & Building Selection Cyclers
  const handleCycleUnit = useCallback(
    (direction: 1 | -1) => {
      const world = worldRef.current;
      if (!world || world.units.length === 0) return;
      const units = world.units;
      const currentIdx = units.findIndex((u) => u.id === selectedUnitId);
      let nextIdx = 0;
      if (currentIdx >= 0) {
        nextIdx = (currentIdx + direction + units.length) % units.length;
      }
      const nextUnit = units[nextIdx];
      if (nextUnit) {
        setSelectedUnitId(nextUnit.id);
        setSelectedBuilding(null);
        centerCameraOnUnit(nextUnit);
        globalAudio.play('click');
      }
    },
    [selectedUnitId, centerCameraOnUnit]
  );

  const handleCycleBuilding = useCallback(
    (direction: 1 | -1) => {
      const world = worldRef.current;
      if (!world || world.buildings.length === 0) return;
      const allBuildings = world.buildings;

      const isCurrentInfra =
        selectedBuilding &&
        (selectedBuilding.defId === 'road' || selectedBuilding.defId === 'bridge');

      // Filter list depending on whether user was inspecting infrastructure or main buildings
      const targetList = allBuildings.filter((b) =>
        isCurrentInfra
          ? b.defId === 'road' || b.defId === 'bridge'
          : b.defId !== 'road' && b.defId !== 'bridge'
      );

      const listToUse = targetList.length > 0 ? targetList : allBuildings;
      const currentIdx = listToUse.findIndex((b) => b.id === selectedBuilding?.id);
      let nextIdx = 0;
      if (currentIdx >= 0) {
        nextIdx = (currentIdx + direction + listToUse.length) % listToUse.length;
      }
      const nextBld = listToUse[nextIdx];
      if (nextBld) {
        setSelectedBuilding(nextBld);
        setSelectedUnitId(null);
        centerCameraOnBuilding(nextBld);
        globalAudio.play('click');
      }
    },
    [selectedBuilding, centerCameraOnBuilding]
  );

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const panSpeed = 30 / cameraRef.current.zoom;

      if (e.code === 'KeyW' || e.code === 'ArrowUp') {
        cameraRef.current.y -= panSpeed;
      } else if (e.code === 'KeyS' || e.code === 'ArrowDown') {
        cameraRef.current.y += panSpeed;
      } else if (e.code === 'KeyA') {
        cameraRef.current.x -= panSpeed;
      } else if (e.code === 'KeyD') {
        cameraRef.current.x += panSpeed;
      } else if (e.code === 'ArrowLeft') {
        if (selectedUnitId) {
          e.preventDefault();
          handleCycleUnit(-1);
        } else if (selectedBuilding) {
          e.preventDefault();
          handleCycleBuilding(-1);
        } else {
          cameraRef.current.x -= panSpeed;
        }
      } else if (e.code === 'ArrowRight') {
        if (selectedUnitId) {
          e.preventDefault();
          handleCycleUnit(1);
        } else if (selectedBuilding) {
          e.preventDefault();
          handleCycleBuilding(1);
        } else {
          cameraRef.current.x += panSpeed;
        }
      } else if (e.code === 'Space') {
        e.preventDefault();
        setGameSpeed((prev) => (prev === 0 ? 1 : 0));
      } else if (e.code === 'KeyB') {
        setIsBuildMenuOpen((prev) => !prev);
      } else if (e.code === 'KeyR') {
        setRoadToolActive((prev) => !prev);
        setSelectedDefId(null);
      } else if (e.code === 'Escape') {
        setSelectedDefId(null);
        setRoadToolActive(false);
        setDemolishToolActive(false);
        setSelectedBuilding(null);
        setSelectedUnitId(null);
        setSelectedResourceNode(null);
        setIsBuildMenuOpen(false);
        setIsChainDiagramOpen(false);
        setIsSaveModalOpen(false);
      } else if (e.key === '+' || e.key === '=') {
        cameraRef.current.zoom = Math.min(2.5, cameraRef.current.zoom * 1.15);
      } else if (e.key === '-' || e.key === '_') {
        cameraRef.current.zoom = Math.max(0.35, cameraRef.current.zoom / 1.15);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedUnitId, selectedBuilding, handleCycleUnit, handleCycleBuilding]);

  // Pointer & Touch Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    hasMovedSignificantlyRef.current = false;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    cameraAtDragStartRef.current = { ...cameraRef.current };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (isDraggingRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;

      if (Math.hypot(dx, dy) > 5) {
        hasMovedSignificantlyRef.current = true;
      }

      cameraRef.current.x = cameraAtDragStartRef.current.x - dx / cameraRef.current.zoom;
      cameraRef.current.y = cameraAtDragStartRef.current.y - dy / cameraRef.current.zoom;
    }

    // Convert client coords back into world coords
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const worldX = (clientX - canvas.width / 2) / cameraRef.current.zoom + cameraRef.current.x;
    const worldY = (clientY - canvas.height / 2) / cameraRef.current.zoom + cameraRef.current.y;

    const world = worldRef.current;
    if (world) {
      // 1. Check unit hover box for individual settler detection
      const hoveredUnit = getUnitAtScreenPos(worldX, worldY, world);
      hoveredUnitIdRef.current = hoveredUnit ? hoveredUnit.id : null;

      // Update cursor feedback
      if (hoveredUnit && !selectedDefId && !roadToolActive && !demolishToolActive) {
        canvas.style.cursor = 'pointer';
      } else if (selectedDefId || roadToolActive || demolishToolActive) {
        canvas.style.cursor = 'crosshair';
      } else {
        canvas.style.cursor = 'default';
      }

      // 2. Update hovered grid tile
      const elevationGetter = (gx: number, gy: number) => world.grid.getTileCorners(gx, gy);
      const tile = getGridTileAtScreen(worldX, worldY, TILE_WIDTH, TILE_HEIGHT, elevationGetter);
      if (tile.gridX >= 0 && tile.gridX < world.grid.width && tile.gridY >= 0 && tile.gridY < world.grid.height) {
        setSelectedGridTile({ x: tile.gridX, y: tile.gridY });
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = false;
    const canvas = canvasRef.current;

    // If it was a click (not a pan drag)
    if (!hasMovedSignificantlyRef.current && worldRef.current && canvas) {
      const world = worldRef.current;
      const rect = canvas.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;
      const worldX = (clientX - canvas.width / 2) / cameraRef.current.zoom + cameraRef.current.x;
      const worldY = (clientY - canvas.height / 2) / cameraRef.current.zoom + cameraRef.current.y;

      const { x: gx, y: gy } = selectedGridTile || { x: -1, y: -1 };

      // 1. If Placing a Building
      if (selectedDefId && gx >= 0 && gy >= 0) {
        const placed = world.placeBuilding(selectedDefId, gx, gy);
        if (placed) {
          // If placement successful, deselect building
          setSelectedDefId(null);
        } else {
          world.addNotification('Cannot build here! Check space and resources.', 'warn');
        }
        return;
      }

      // 2. If Placing Road
      if (roadToolActive && gx >= 0 && gy >= 0) {
        world.placeRoad(gx, gy);
        return;
      }

      // 3. If Demolishing
      if (demolishToolActive && gx >= 0 && gy >= 0) {
        world.demolish(gx, gy);
        return;
      }

      // 4. Settler / Unit Click Target (Individual settler clickable bounding box)
      const clickedUnit = getUnitAtScreenPos(worldX, worldY, world);
      if (clickedUnit) {
        setSelectedUnitId(clickedUnit.id);
        setSelectedBuilding(null);
        setSelectedResourceNode(null);
        globalAudio.play('click');
        return;
      }

      if (gx < 0 || gy < 0) return;

      // 5. Default: Inspect clicked building
      const tile = world.grid.getTile(gx, gy);
      if (tile?.buildingId) {
        const bld = world.buildings.find((b) => b.id === tile.buildingId);
        if (bld) {
          setSelectedBuilding(bld);
          setSelectedUnitId(null);
          setSelectedResourceNode(null);
          globalAudio.play('click');
          return;
        }
      }

      // 6. Natural resource feature (rocks, iron ore, coal, trees)
      if (tile && (tile.feature || tile.terrain === 'rocky')) {
        const feature = tile.feature || (tile.terrain === 'rocky' ? 'rock_outcrop' : undefined);
        setSelectedResourceNode({
          x: gx,
          y: gy,
          feature,
          terrain: tile.terrain,
          remaining: tile.resourceRemaining ?? (feature === 'tree' ? 4 : 20),
          max: tile.resourceMax ?? (feature === 'tree' ? 4 : 20),
        });
        setSelectedBuilding(null);
        setSelectedUnitId(null);
        globalAudio.play('click');
        return;
      }

      // Deselect inspectors
      setSelectedBuilding(null);
      setSelectedUnitId(null);
      setSelectedResourceNode(null);
    }
  };

  const handleDirectWorkerToNode = useCallback((x: number, y: number) => {
    const world = worldRef.current;
    if (!world) return;
    const tile = world.grid.getTile(x, y);
    if (!tile) return;

    // Find nearest free villager or candidate worker
    const worker =
      world.units.find((u) => u.data.type === 'villager' && u.state === 'idle') ||
      world.units.find((u) => u.data.type === 'villager');
    if (!worker) {
      world.addNotification('No settlers available to harvest this node!', 'warn');
      return;
    }

    const path = world.pathfinder.findPath(worker.gridX, worker.gridY, x, y, true);
    if (path && path.length > 0) {
      if (tile.feature === 'rock_outcrop' || tile.terrain === 'rocky') {
        worker.data.jobId = 'stone_miner';
      } else if (tile.feature === 'iron_seam') {
        worker.data.jobId = 'iron_miner';
      } else if (tile.feature === 'coal_seam') {
        worker.data.jobId = 'coal_miner';
      } else if (tile.feature === 'tree') {
        worker.data.jobId = 'lumberjack';
      }
      worker.data.targetX = x;
      worker.data.targetY = y;
      worker.setPath(path);
      worker.setState('move_to_source');
      world.addFloatingText('Dispatched! 🚶', x, y, '#38bdf8');
      world.addNotification(`Dispatched ${worker.data.name} to harvest [${x}, ${y}].`, 'info');
      globalAudio.play('click');
    } else {
      world.addNotification('No walkable path to this resource node!', 'warn');
    }
  }, []);

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    const currentZoom = cameraRef.current.zoom;
    const newZoom = Math.max(0.35, Math.min(2.5, currentZoom * zoomFactor));
    if (newZoom === currentZoom) return;

    // Zoom anchored smoothly at cursor position / viewport center
    const worldCursorX = (cursorX - canvas.width / 2) / currentZoom + cameraRef.current.x;
    const worldCursorY = (cursorY - canvas.height / 2) / currentZoom + cameraRef.current.y;

    cameraRef.current.x = worldCursorX - (cursorX - canvas.width / 2) / newZoom;
    cameraRef.current.y = worldCursorY - (cursorY - canvas.height / 2) / newZoom;
    cameraRef.current.zoom = newZoom;
  };

  const handleToggleTimeOfDay = () => {
    setTimeOfDay((prev) => (prev === 'day' ? 'sunset' : prev === 'sunset' ? 'night' : 'day'));
  };

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    globalAudio.setMuted(next);
  };

  return (
    <div className="relative w-full h-screen overflow-hidden select-none touch-none bg-neutral-950 font-sans">
      {/* 2D Canvas Renderer */}
      <canvas
        id="game-canvas"
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        className="w-full h-full cursor-grab active:cursor-grabbing block"
      />

      {/* Top HUD */}
      {!isMainMenuOpen && (
        <HUD
          inventory={hudInventory}
          totalStored={hudStored}
          totalCapacity={hudCapacity}
          population={hudPopulation}
          totalBeds={hudTotalBeds}
          gameSpeed={gameSpeed}
          onSetGameSpeed={setGameSpeed}
          timeOfDay={timeOfDay}
          onToggleTimeOfDay={handleToggleTimeOfDay}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onOpenBuildMenu={() => setIsBuildMenuOpen((prev) => !prev)}
          isBuildMenuOpen={isBuildMenuOpen}
          onOpenChainDiagram={() => setIsChainDiagramOpen(true)}
          onOpenResourceLedger={() => setIsResourceLedgerOpen(true)}
          onOpenSaveModal={() => setIsSaveModalOpen(true)}
          onOpenMainMenu={() => setIsMainMenuOpen(true)}
          roadToolActive={roadToolActive}
          onToggleRoadTool={() => {
            setRoadToolActive((prev) => !prev);
            setSelectedDefId(null);
            setDemolishToolActive(false);
          }}
          demolishToolActive={demolishToolActive}
          onToggleDemolishTool={() => {
            setDemolishToolActive((prev) => !prev);
            setSelectedDefId(null);
            setRoadToolActive(false);
          }}
          onCycleVillager={() => handleCycleUnit(1)}
        />
      )}

      {/* Bottom Construction Drawer */}
      {!isMainMenuOpen && (
        <BuildMenu
          isOpen={isBuildMenuOpen}
          onClose={() => setIsBuildMenuOpen(false)}
          onToggleOpen={() => setIsBuildMenuOpen((prev) => !prev)}
          selectedDefId={selectedDefId}
          onSelectBuilding={(defId) => {
            setSelectedDefId(defId);
            if (defId) {
              setRoadToolActive(false);
              setDemolishToolActive(false);
            }
          }}
          currentInventory={hudInventory}
        />
      )}

      {/* Building Inspector Modal */}
      {!isMainMenuOpen && selectedBuilding && worldRef.current && (
        (() => {
          const isInfra = selectedBuilding.defId === 'road' || selectedBuilding.defId === 'bridge';
          const targetList = worldRef.current.buildings.filter((b) =>
            isInfra ? b.defId === 'road' || b.defId === 'bridge' : b.defId !== 'road' && b.defId !== 'bridge'
          );
          const list = targetList.length > 0 ? targetList : worldRef.current.buildings;
          const bldIdx = list.findIndex((b) => b.id === selectedBuilding.id);
          return (
            <BuildingInspector
              building={selectedBuilding}
              onClose={() => setSelectedBuilding(null)}
              onDemolish={(bld) => {
                if (worldRef.current) {
                  worldRef.current.demolish(bld.x, bld.y);
                  setSelectedBuilding(null);
                }
              }}
              onTrainSoldier={(bldId) => {
                if (worldRef.current) {
                  worldRef.current.trainSoldierAtBarracks(bldId);
                }
              }}
              currentInventory={hudInventory}
              currentIndex={bldIdx >= 0 ? bldIdx : undefined}
              totalCount={list.length}
              onPrevBuilding={() => handleCycleBuilding(-1)}
              onNextBuilding={() => handleCycleBuilding(1)}
            />
          );
        })()
      )}

      {/* Unit Inspector Modal */}
      {!isMainMenuOpen && selectedUnitId && worldRef.current && (
        (() => {
          const units = worldRef.current.units;
          const unitIdx = units.findIndex((u) => u.id === selectedUnitId);
          const unit = unitIdx >= 0 ? units[unitIdx] : undefined;
          return unit ? (
            <UnitInspector
              unit={unit}
              onClose={() => setSelectedUnitId(null)}
              onAssignJob={(unitId, jobId) => {
                if (worldRef.current) {
                  worldRef.current.assignUnitJob(unitId, jobId);
                }
              }}
              currentIndex={unitIdx >= 0 ? unitIdx : undefined}
              totalCount={units.length}
              onPrevUnit={() => handleCycleUnit(-1)}
              onNextUnit={() => handleCycleUnit(1)}
            />
          ) : null;
        })()
      )}

      {/* Natural Resource Node Inspector Modal */}
      {!isMainMenuOpen && selectedResourceNode && worldRef.current && (
        (() => {
          const tile = worldRef.current.grid.getTile(selectedResourceNode.x, selectedResourceNode.y);
          const nodeData: ResourceNodeData = {
            ...selectedResourceNode,
            remaining: tile?.resourceRemaining ?? selectedResourceNode.remaining,
            max: tile?.resourceMax ?? selectedResourceNode.max,
          };
          return (
            <ResourceNodeInspector
              node={nodeData}
              onClose={() => setSelectedResourceNode(null)}
              onDirectWorker={handleDirectWorkerToNode}
            />
          );
        })()
      )}

      {/* Production Chains Diagram */}
      <ProductionChainDiagram
        isOpen={isChainDiagramOpen}
        onClose={() => setIsChainDiagramOpen(false)}
        inventory={hudInventory}
      />

      {/* Colony Resource Stockpile Ledger */}
      <ResourceLedgerModal
        isOpen={isResourceLedgerOpen}
        onClose={() => setIsResourceLedgerOpen(false)}
        inventory={hudInventory}
        totalStored={hudStored}
        totalCapacity={hudCapacity}
      />

      {/* Save & Load Modal */}
      {worldRef.current && (
        <SaveLoadModal
          isOpen={isSaveModalOpen}
          onClose={() => setIsSaveModalOpen(false)}
          world={worldRef.current}
          camera={cameraRef.current}
          onLoadGame={(data) => {
            worldRef.current = data.world;
            cameraRef.current = data.camera;
            setIsSaveModalOpen(false);
          }}
          onStartScenario={(preset) => {
            handleStartNewGame(preset);
            setIsSaveModalOpen(false);
          }}
        />
      )}

      {/* Live Event Notifications List */}
      {!isMainMenuOpen && <NotificationsList notifications={notifications} />}

      {/* Main Start / Pause Menu */}
      {isMainMenuOpen && (
        <MainMenu
          onStartNewGame={handleStartNewGame}
          onContinueGame={handleContinueGame}
          hasSavedGame={SaveSystem.listSavedSlots().length > 0}
          onClose={() => setIsMainMenuOpen(false)}
          isInitialScreen={!worldRef.current}
        />
      )}
    </div>
  );
}
