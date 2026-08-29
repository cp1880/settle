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
import { GameSpeed, BuildingInstance } from './types';
import { getGridTileAtScreen, isoToScreen } from './iso';
import { BUILDINGS, getBuilding } from './content/buildings';
import { GRID_SIZE_X, GRID_SIZE_Y } from './constants';
import { HUD } from './ui/HUD';
import { BuildMenu } from './ui/BuildMenu';
import { BuildingInspector } from './ui/BuildingInspector';
import { UnitInspector } from './ui/UnitInspector';
import { ProductionChainDiagram } from './ui/ProductionChainDiagram';
import { SaveLoadModal } from './ui/SaveLoadModal';
import { ResourceLedgerModal } from './ui/ResourceLedgerModal';
import { MainMenu } from './ui/MainMenu';
import { NotificationsList } from './ui/NotificationsList';

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
    const thIso = isoToScreen(thCenterX, thCenterY);
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
              world.grid.canPlaceBuilding(selectedGridTile.x, selectedGridTile.y, def.size.w, def.size.h) &&
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
  }, [gameSpeed, timeOfDay, selectedDefId, selectedGridTile, selectedBuilding, selectedUnitId, roadToolActive]);

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

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const panSpeed = 30 / cameraRef.current.zoom;

      if (e.code === 'KeyW' || e.code === 'ArrowUp') {
        cameraRef.current.y -= panSpeed;
      } else if (e.code === 'KeyS' || e.code === 'ArrowDown') {
        cameraRef.current.y += panSpeed;
      } else if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        cameraRef.current.x -= panSpeed;
      } else if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        cameraRef.current.x += panSpeed;
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
  }, []);

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

    // Update hovered grid tile
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    // Convert client coords back into world coords
    const worldX = (clientX - canvas.width / 2) / cameraRef.current.zoom + cameraRef.current.x;
    const worldY = (clientY - canvas.height / 2) / cameraRef.current.zoom + cameraRef.current.y;

    const tile = getGridTileAtScreen(worldX, worldY);
    const world = worldRef.current;
    if (world && tile.gridX >= 0 && tile.gridX < world.grid.width && tile.gridY >= 0 && tile.gridY < world.grid.height) {
      setSelectedGridTile({ x: tile.gridX, y: tile.gridY });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = false;

    // If it was a click (not a pan drag)
    if (!hasMovedSignificantlyRef.current && selectedGridTile && worldRef.current) {
      const world = worldRef.current;
      const { x: gx, y: gy } = selectedGridTile;

      // 1. If Placing a Building
      if (selectedDefId) {
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
      if (roadToolActive) {
        world.placeRoad(gx, gy);
        return;
      }

      // 3. If Demolishing
      if (demolishToolActive) {
        world.demolish(gx, gy);
        return;
      }

      // 4. Default: Inspect clicked building or unit
      const tile = world.grid.getTile(gx, gy);
      if (tile?.buildingId) {
        const bld = world.buildings.find((b) => b.id === tile.buildingId);
        if (bld) {
          setSelectedBuilding(bld);
          setSelectedUnitId(null);
          globalAudio.play('click');
          return;
        }
      }

      // Check unit near tile
      const clickedUnit = world.units.find((u) => u.gridX === gx && u.gridY === gy);
      if (clickedUnit) {
        setSelectedUnitId(clickedUnit.id);
        setSelectedBuilding(null);
        globalAudio.play('click');
        return;
      }

      // Deselect inspectors
      setSelectedBuilding(null);
      setSelectedUnitId(null);
    }
  };

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
      {!isMainMenuOpen && selectedBuilding && (
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
        />
      )}

      {/* Unit Inspector Modal */}
      {!isMainMenuOpen && selectedUnitId && worldRef.current && (
        (() => {
          const unit = worldRef.current.units.find((u) => u.id === selectedUnitId);
          return unit ? (
            <UnitInspector
              unit={unit}
              onClose={() => setSelectedUnitId(null)}
              onAssignJob={(unitId, jobId) => {
                if (worldRef.current) {
                  worldRef.current.assignUnitJob(unitId, jobId);
                }
              }}
            />
          ) : null;
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
