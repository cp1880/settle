import React from 'react';
import {
  Hammer,
  Play,
  Pause,
  FastForward,
  RotateCcw,
  Volume2,
  VolumeX,
  Sun,
  Moon,
  Sunset,
  Save,
  Network,
  Users,
  Box,
  Layers,
  TreePine,
  Mountain,
  Flame,
  Shield,
  Sword,
  Gem,
} from 'lucide-react';
import { GameSpeed, ProductionStats } from '../types';
import { globalAudio } from '../core/AudioSystem';

interface HUDProps {
  inventory: Record<string, number>;
  totalStored: number;
  totalCapacity: number;
  population: number;
  totalBeds: number;
  gameSpeed: GameSpeed;
  onSetGameSpeed: (speed: GameSpeed) => void;
  timeOfDay: 'day' | 'sunset' | 'night';
  onToggleTimeOfDay: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenBuildMenu: () => void;
  isBuildMenuOpen: boolean;
  onOpenChainDiagram: () => void;
  onOpenResourceLedger: () => void;
  onOpenSaveModal: () => void;
  onOpenMainMenu: () => void;
  roadToolActive: boolean;
  onToggleRoadTool: () => void;
  demolishToolActive: boolean;
  onToggleDemolishTool: () => void;
  onCycleVillager?: () => void;
}

export const HUD: React.FC<HUDProps> = ({
  inventory,
  totalStored,
  totalCapacity,
  population,
  totalBeds,
  gameSpeed,
  onSetGameSpeed,
  timeOfDay,
  onToggleTimeOfDay,
  isMuted,
  onToggleMute,
  onOpenBuildMenu,
  isBuildMenuOpen,
  onOpenChainDiagram,
  onOpenResourceLedger,
  onOpenSaveModal,
  onOpenMainMenu,
  roadToolActive,
  onToggleRoadTool,
  demolishToolActive,
  onToggleDemolishTool,
  onCycleVillager,
}) => {
  return (
    <header className="absolute top-0 left-0 right-0 p-3 pointer-events-none flex flex-col gap-2 z-20">
      {/* Top Navbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {/* Left: Settlement Branding & Controls */}
        <div className="flex items-center gap-2 bg-neutral-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-neutral-700/60 shadow-lg pointer-events-auto">
          <button
            id="hud-menu-btn"
            onClick={onOpenMainMenu}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 font-semibold text-xs rounded-lg border border-amber-500/40 transition active:scale-95"
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="font-serif tracking-wide hidden sm:inline">SETTLEMENT</span>
          </button>

          <div className="h-4 w-px bg-neutral-700" />

          {/* Speed Controls */}
          <div className="flex items-center gap-0.5 bg-neutral-800/80 p-0.5 rounded-lg border border-neutral-700/50">
            <button
              id="speed-pause-btn"
              onClick={() => onSetGameSpeed(0)}
              className={`p-1.5 rounded-md transition ${gameSpeed === 0 ? 'bg-amber-500 text-neutral-950 font-bold' : 'text-neutral-400 hover:text-neutral-200'}`}
              title="Pause (Space)"
            >
              <Pause className="w-3.5 h-3.5" />
            </button>
            <button
              id="speed-1x-btn"
              onClick={() => onSetGameSpeed(1)}
              className={`px-2 py-1 rounded-md text-xs transition ${gameSpeed === 1 ? 'bg-amber-500 text-neutral-950 font-bold' : 'text-neutral-400 hover:text-neutral-200'}`}
              title="Normal Speed (1x)"
            >
              1x
            </button>
            <button
              id="speed-2x-btn"
              onClick={() => onSetGameSpeed(2)}
              className={`px-2 py-1 rounded-md text-xs transition ${gameSpeed === 2 ? 'bg-amber-500 text-neutral-950 font-bold' : 'text-neutral-400 hover:text-neutral-200'}`}
              title="Fast Speed (2x)"
            >
              2x
            </button>
            <button
              id="speed-5x-btn"
              onClick={() => onSetGameSpeed(5)}
              className={`px-2 py-1 rounded-md text-xs transition ${gameSpeed === 5 ? 'bg-amber-500 text-neutral-950 font-bold' : 'text-neutral-400 hover:text-neutral-200'}`}
              title="Hyper Speed (5x)"
            >
              5x
            </button>
          </div>

          <div className="h-4 w-px bg-neutral-700" />

          {/* Time of Day & Audio */}
          <button
            id="hud-time-btn"
            onClick={onToggleTimeOfDay}
            className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg border border-neutral-700/50 transition"
            title={`Time: ${timeOfDay}`}
          >
            {timeOfDay === 'day' ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : timeOfDay === 'sunset' ? <Sunset className="w-3.5 h-3.5 text-orange-400" /> : <Moon className="w-3.5 h-3.5 text-sky-400" />}
          </button>

          <button
            id="hud-audio-btn"
            onClick={onToggleMute}
            className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg border border-neutral-700/50 transition"
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
          </button>
        </div>

        {/* Center: Vital Resource Strip (Clickable to open detailed Ledger) */}
        <div
          onClick={onOpenResourceLedger}
          className="flex items-center gap-3 bg-neutral-900/95 hover:bg-neutral-850 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-neutral-700/70 hover:border-amber-500/50 shadow-lg pointer-events-auto cursor-pointer transition active:scale-[0.99] overflow-x-auto max-w-full"
          title="Click to open Colony Resource Stockpile Ledger"
        >
          {/* Wood Planks */}
          <div className="flex items-center gap-1.5 text-xs text-amber-200 font-medium" title="Finished Wood Planks (Sawmill)">
            <Hammer className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-mono font-bold">{inventory.wood || 0}</span>
          </div>

          {/* Logs */}
          <div className="flex items-center gap-1.5 text-xs text-amber-500 font-medium" title="Raw Timber Logs (Lumberjack)">
            <TreePine className="w-3.5 h-3.5 text-amber-500" />
            <span className="font-mono font-bold">{inventory.log || 0}</span>
          </div>

          {/* Stone */}
          <div className="flex items-center gap-1.5 text-xs text-stone-300 font-medium" title="Quarried Stone (Stone Quarry)">
            <Mountain className="w-3.5 h-3.5 text-stone-400" />
            <span className="font-mono font-bold">{inventory.stone || 0}</span>
          </div>

          {/* Coal */}
          <div className="flex items-center gap-1.5 text-xs text-neutral-300 font-medium" title="Coal Fuel (Coal Mine)">
            <Flame className="w-3.5 h-3.5 text-neutral-400" />
            <span className="font-mono font-bold">{inventory.coal || 0}</span>
          </div>

          {/* Iron Ore */}
          <div className="flex items-center gap-1.5 text-xs text-orange-300 font-medium" title="Raw Iron Ore (Iron Mine)">
            <Gem className="w-3.5 h-3.5 text-orange-400" />
            <span className="font-mono font-bold">{inventory.iron_ore || 0}</span>
          </div>

          {/* Weapons */}
          <div className="flex items-center gap-1.5 text-xs text-sky-300 font-medium" title="Swords & Shields (Smithy)">
            <Sword className="w-3.5 h-3.5 text-sky-400" />
            <span className="font-mono font-bold">{inventory.sword || 0}</span>
            <Shield className="w-3.5 h-3.5 text-yellow-400 ml-1" />
            <span className="font-mono font-bold">{inventory.shield || 0}</span>
          </div>

          <div className="h-4 w-px bg-neutral-700" />

          {/* Population & Beds (Clickable to cycle & focus camera on villagers) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCycleVillager && onCycleVillager();
            }}
            className={`flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-lg transition hover:bg-neutral-800 active:scale-95 ${
              population >= totalBeds ? 'text-amber-400' : 'text-emerald-400'
            }`}
            title={`Population: ${population} / Beds: ${totalBeds} (Click to cycle and center camera on villagers)`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>{population}/{totalBeds} Beds</span>
          </button>

          {/* Storage Meter */}
          <div
            className={`flex items-center gap-1.5 text-xs font-semibold ${totalStored >= totalCapacity ? 'text-rose-400' : 'text-sky-400'}`}
            title={`Storage capacity: ${totalStored} / ${totalCapacity} (Click for Stockpile Ledger)`}
          >
            <Box className="w-3.5 h-3.5" />
            <span>{totalStored}/{totalCapacity}</span>
          </div>
        </div>

        {/* Right: Tools & Overlays */}
        <div className="flex items-center gap-1.5 bg-neutral-900/90 backdrop-blur-md p-1.5 rounded-xl border border-neutral-700/60 shadow-lg pointer-events-auto">
          {/* Stockpile Ledger Button */}
          <button
            id="hud-stockpile-btn"
            onClick={onOpenResourceLedger}
            className="flex items-center gap-1 px-2.5 py-1 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 text-xs font-medium rounded-lg border border-amber-500/40 transition active:scale-95"
            title="Open Stockpile & Resource Inventory Ledger"
          >
            <Box className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Stockpile</span>
          </button>

          {/* Production Chains Visualizer */}
          <button
            id="hud-chains-btn"
            onClick={onOpenChainDiagram}
            className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-medium rounded-lg border border-indigo-500/40 transition active:scale-95"
            title="Production Chains Flowchart"
          >
            <Network className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Chains</span>
          </button>

          {/* Road Placement Quick Tool */}
          <button
            id="hud-road-tool-btn"
            onClick={onToggleRoadTool}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border transition active:scale-95 ${
              roadToolActive
                ? 'bg-amber-500 text-neutral-950 font-bold border-amber-400 shadow-md'
                : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-neutral-700/50'
            }`}
            title="Pave Cobblestone Roads (Cost: 1 Stone)"
          >
            <span>Road (R)</span>
          </button>

          {/* Demolish Tool */}
          <button
            id="hud-demolish-btn"
            onClick={onToggleDemolishTool}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border transition active:scale-95 ${
              demolishToolActive
                ? 'bg-red-500 text-white font-bold border-red-400 shadow-md'
                : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-neutral-700/50'
            }`}
            title="Demolish Building or Clear Road"
          >
            <span>Demolish</span>
          </button>

          {/* Save / Load */}
          <button
            id="hud-save-btn"
            onClick={onOpenSaveModal}
            className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg border border-neutral-700/50 transition"
            title="Save / Load Game"
          >
            <Save className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
