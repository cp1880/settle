import React, { useState } from 'react';
import { Play, RotateCcw, BookOpen, Layers, Sparkles, Volume2, ShieldCheck, TreePine, Mountain, Compass } from 'lucide-react';
import { globalAudio } from '../core/AudioSystem';

interface MainMenuProps {
  onStartNewGame: (preset: 'valley' | 'mountains' | 'forest') => void;
  onContinueGame: () => void;
  hasSavedGame: boolean;
  onClose: () => void;
  isInitialScreen?: boolean;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  onStartNewGame,
  onContinueGame,
  hasSavedGame,
  onClose,
  isInitialScreen = true,
}) => {
  const [showGuide, setShowGuide] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<'valley' | 'mountains' | 'forest'>('valley');

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-b from-neutral-950 via-neutral-900 to-neutral-950 text-neutral-100 flex flex-col items-center justify-center p-6 overflow-y-auto">
      {/* Visual Ambient Flourish */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(217,119,6,0.15),transparent_60%)] pointer-events-none" />

      <div className="relative z-10 max-w-xl w-full flex flex-col items-center text-center gap-6">
        {/* Title & Badge */}
        <div className="flex flex-col items-center gap-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-300 text-xs font-semibold tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>2D ISOMETRIC COLONY STRATEGY</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-serif font-extrabold tracking-tight text-white drop-shadow-md">
            ISOMETRIC <span className="text-amber-400">SETTLERS</span>
          </h1>

          <p className="text-neutral-400 text-xs sm:text-sm max-w-md leading-relaxed">
            Erect a thriving medieval colony with production chains, road logistics, villager housing, and fortified defenses.
          </p>
        </div>

        {/* Preset Selector */}
        <div className="w-full bg-neutral-900/80 border border-neutral-800 p-3 rounded-2xl flex flex-col gap-2">
          <span className="text-xs font-semibold text-neutral-400">Select Settlement Map:</span>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => {
                setSelectedPreset('valley');
                globalAudio.play('click');
              }}
              className={`p-2.5 rounded-xl border text-xs font-medium flex flex-col items-center gap-1.5 transition ${
                selectedPreset === 'valley'
                  ? 'bg-amber-600/30 border-amber-400 text-amber-200'
                  : 'bg-neutral-800/60 border-neutral-700/60 text-neutral-300 hover:bg-neutral-800'
              }`}
            >
              <TreePine className="w-4 h-4 text-emerald-400" />
              <span>River Valley</span>
            </button>

            <button
              onClick={() => {
                setSelectedPreset('mountains');
                globalAudio.play('click');
              }}
              className={`p-2.5 rounded-xl border text-xs font-medium flex flex-col items-center gap-1.5 transition ${
                selectedPreset === 'mountains'
                  ? 'bg-amber-600/30 border-amber-400 text-amber-200'
                  : 'bg-neutral-800/60 border-neutral-700/60 text-neutral-300 hover:bg-neutral-800'
              }`}
            >
              <Mountain className="w-4 h-4 text-stone-400" />
              <span>Mountains</span>
            </button>

            <button
              onClick={() => {
                setSelectedPreset('forest');
                globalAudio.play('click');
              }}
              className={`p-2.5 rounded-xl border text-xs font-medium flex flex-col items-center gap-1.5 transition ${
                selectedPreset === 'forest'
                  ? 'bg-amber-600/30 border-amber-400 text-amber-200'
                  : 'bg-neutral-800/60 border-neutral-700/60 text-neutral-300 hover:bg-neutral-800'
              }`}
            >
              <Compass className="w-4 h-4 text-amber-400" />
              <span>Dense Forest</span>
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col w-full gap-2.5 max-w-sm">
          <button
            id="start-new-game-btn"
            onClick={() => {
              onStartNewGame(selectedPreset);
              globalAudio.play('fanfare');
            }}
            className="w-full py-3 px-6 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-neutral-950 font-bold rounded-xl shadow-lg border border-amber-300 flex items-center justify-center gap-2 text-sm transition active:scale-95"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>START NEW SETTLEMENT</span>
          </button>

          {hasSavedGame && (
            <button
              id="continue-game-btn"
              onClick={() => {
                onContinueGame();
                globalAudio.play('fanfare');
              }}
              className="w-full py-2.5 px-6 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold rounded-xl border border-neutral-700 flex items-center justify-center gap-2 text-xs transition active:scale-95"
            >
              <RotateCcw className="w-4 h-4" />
              <span>CONTINUE SAVED GAME</span>
            </button>
          )}

          {!isInitialScreen && (
            <button
              onClick={onClose}
              className="w-full py-2.5 px-6 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold rounded-xl border border-neutral-700 text-xs transition"
            >
              Resume Active Game
            </button>
          )}

          <button
            onClick={() => {
              setShowGuide(!showGuide);
              globalAudio.play('click');
            }}
            className="w-full py-2 px-4 bg-transparent hover:bg-neutral-800/40 text-neutral-400 hover:text-neutral-200 font-medium rounded-xl flex items-center justify-center gap-2 text-xs transition"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>{showGuide ? 'Hide Game Guide' : 'How to Play / Controls'}</span>
          </button>
        </div>

        {/* Quick Controls Guide */}
        {showGuide && (
          <div className="w-full bg-neutral-900/90 border border-neutral-800 p-4 rounded-2xl text-left text-xs text-neutral-300 flex flex-col gap-2.5 animate-in fade-in">
            <h3 className="font-bold text-amber-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" /> Controls & Economy Basics
            </h3>
            <ul className="list-disc pl-4 space-y-1 text-[11.5px] text-neutral-400">
              <li><strong className="text-neutral-200">Camera Pan:</strong> Drag with 1 finger / Click & Drag with mouse (or WASD / Arrow Keys).</li>
              <li><strong className="text-neutral-200">Zoom:</strong> Pinch with 2 fingers or scroll mouse wheel.</li>
              <li><strong className="text-neutral-200">Production:</strong> Build Sawmills to convert raw Logs into Wood. Build Quarries to extract Stone.</li>
              <li><strong className="text-neutral-200">Roads (R):</strong> Pave cobblestone roads so your settlers move 3x faster!</li>
              <li><strong className="text-neutral-200">Housing:</strong> Build Houses to increase Bed capacity and welcome new settlers.</li>
              <li><strong className="text-neutral-200">Military:</strong> Mine Coal & Iron Ore, forge weapons at the Smithy, and train Soldiers at the Barracks.</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
