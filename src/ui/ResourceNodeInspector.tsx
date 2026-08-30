import React from 'react';
import { Mountain, Flame, Pickaxe, Trees, X, Navigation, Info } from 'lucide-react';
import { FeatureType, TerrainType } from '../types';

export interface ResourceNodeData {
  x: number;
  y: number;
  feature?: FeatureType;
  terrain?: TerrainType;
  remaining: number;
  max: number;
}

interface ResourceNodeInspectorProps {
  node: ResourceNodeData;
  onClose: () => void;
  onDirectWorker?: (x: number, y: number) => void;
}

export const ResourceNodeInspector: React.FC<ResourceNodeInspectorProps> = ({
  node,
  onClose,
  onDirectWorker,
}) => {
  const isRock = node.feature === 'rock_outcrop' || (!node.feature && node.terrain === 'rocky');
  const isIron = node.feature === 'iron_seam';
  const isCoal = node.feature === 'coal_seam';
  const isTree = node.feature === 'tree';

  let title = 'Resource Node';
  let resName = 'Materials';
  let icon = <Mountain className="w-4 h-4 text-stone-300" />;
  let barColor = 'bg-stone-400';
  let glowColor = 'border-stone-500/50';
  let description = 'Natural terrain resource node.';
  let usageHint = 'Can be quarried or gathered by settlement workers.';

  if (isRock) {
    title = 'Rock Outcrop';
    resName = 'Stone';
    icon = <Mountain className="w-4 h-4 text-stone-300" />;
    barColor = 'bg-stone-400';
    glowColor = 'border-stone-500/40';
    description = 'Dense granite rock boulders. Contains stone deposits for masonry and paved roads.';
    usageHint = 'Quarried by Stone Miners (Quarry) or free Settlers. Depletes permanently when 0 stone remains.';
  } else if (isIron) {
    title = 'Iron Ore Seam';
    resName = 'Iron Ore';
    icon = <Pickaxe className="w-4 h-4 text-amber-400" />;
    barColor = 'bg-amber-500';
    glowColor = 'border-amber-500/40';
    description = 'Rich vein of raw iron ore crystals embedded in the rock stratum.';
    usageHint = 'Extracted by Iron Miners (Iron Mine). Refined at the Smithy with Coal into weapons & shields for soldiers.';
  } else if (isCoal) {
    title = 'Coal Deposit';
    resName = 'Coal';
    icon = <Flame className="w-4 h-4 text-zinc-400" />;
    barColor = 'bg-zinc-400';
    glowColor = 'border-zinc-500/40';
    description = 'High-grade carboniferous coal seam. Essential furnace fuel.';
    usageHint = 'Mined by Coal Miners (Coal Mine). Used alongside Iron Ore at the Smithy to forge military arms.';
  } else if (isTree) {
    title = 'Forest Timber';
    resName = 'Logs';
    icon = <Trees className="w-4 h-4 text-emerald-400" />;
    barColor = 'bg-emerald-500';
    glowColor = 'border-emerald-500/40';
    description = 'Mature woodland timber grove.';
    usageHint = 'Felled by Lumberjacks to produce timber logs for Sawmills and building construction.';
  }

  const current = Math.max(0, node.remaining);
  const max = Math.max(1, node.max);
  const percent = Math.min(100, Math.round((current / max) * 100));

  return (
    <aside
      id="resource-node-inspector"
      className={`fixed bottom-20 right-4 z-20 w-80 bg-neutral-900/95 backdrop-blur-xl border ${glowColor} rounded-2xl shadow-2xl p-4 flex flex-col gap-3 text-xs text-neutral-200`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-neutral-800 border border-neutral-700/60">
            {icon}
          </div>
          <div>
            <h3 className="font-serif font-bold text-sm text-neutral-100">{title}</h3>
            <span className="text-[10px] text-neutral-400 font-mono">
              Tile [{node.x}, {node.y}]
            </span>
          </div>
        </div>

        <button
          id="close-resource-inspector"
          onClick={onClose}
          className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition"
          title="Close Inspector (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Description */}
      <p className="text-neutral-400 text-[11px] leading-relaxed">{description}</p>

      {/* Remaining Resource Meter */}
      <div className="bg-neutral-800/70 p-2.5 rounded-xl border border-neutral-700/50 flex flex-col gap-2">
        <div className="flex items-center justify-between font-medium">
          <span className="text-neutral-300 font-semibold">{resName} Remaining</span>
          <span className="font-mono text-neutral-100 font-bold">
            {current} / {max}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-neutral-950/80 h-2.5 rounded-full overflow-hidden border border-neutral-700/40">
          <div
            className={`h-full ${barColor} rounded-full transition-all duration-300`}
            style={{ width: `${percent}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[10px] text-neutral-400">
          <span>{percent}% capacity left</span>
          <span>{current === 0 ? 'Exhausted' : 'Active Deposit'}</span>
        </div>
      </div>

      {/* Usage Guide */}
      <div className="bg-neutral-800/40 p-2.5 rounded-xl border border-neutral-700/30 flex items-start gap-2 text-[10.5px] text-neutral-300">
        <Info className="w-3.5 h-3.5 text-sky-400 flex-shrink-0 mt-0.5" />
        <span className="leading-relaxed">{usageHint}</span>
      </div>

      {/* Direct Worker Action */}
      {onDirectWorker && current > 0 && (
        <button
          id="btn-direct-worker-to-node"
          onClick={() => onDirectWorker(node.x, node.y)}
          className="w-full py-2 px-3 bg-sky-600/90 hover:bg-sky-500 text-white font-medium rounded-xl border border-sky-400/40 transition flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98]"
        >
          <Navigation className="w-3.5 h-3.5" />
          <span>Dispatch Gatherer Here</span>
        </button>
      )}
    </aside>
  );
};
