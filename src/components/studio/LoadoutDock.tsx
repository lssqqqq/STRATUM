import React from 'react';
import { LoadoutSlot } from '../../types/customDoc';
import { PhotoAsset } from '../../data/tdsPhotoAssets';
import { useStudioDrag } from './StudioDragContext';

interface LoadoutDockProps {
  /** Slots of the CURRENT player's loadout row (in slot order). */
  slots: LoadoutSlot[];
  /** e.g. "Player 1" */
  playerLabel?: string;
}

// Outlined white number, like the in-game loadout slots
const NUMBER_STROKE =
  '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 2px 3px rgba(0,0,0,0.6)';

/**
 * Compact bar with the loadout towers of one player.
 * Every filled slot can be dragged straight onto the map through the shared studio drag system,
 * so it behaves exactly like dragging a tower from the left "Towers" panel.
 */
export const LoadoutDock: React.FC<LoadoutDockProps> = ({ slots, playerLabel }) => {
  const { startDrag, draggingAsset } = useStudioDrag();

  const hasAnyTower = slots.some(s => !!s.image);

  const handlePointerDown = (slot: LoadoutSlot, e: React.PointerEvent) => {
    if (e.button !== 0 || !slot.image) return;
    e.preventDefault(); // no text selection / native image drag while grabbing
    const asset: PhotoAsset = {
      id: `loadout-dock:${slot.id}`,
      name: slot.name,
      category: 'towers',
      url: slot.image
    };
    startDrag(asset, e);
  };

  return (
    /*
     * The wrapper is a CSS size container (container-type: inline-size). Two effects:
     *  1) its content can NEVER widen the surrounding table (this is what broke Portrait pages before);
     *  2) the layout reacts to the REAL width of the map cell, not the window width:
     *     < 24rem  : label on its own line above the slots (narrow portrait cells)
     *     >= 24rem : label and slots on one row, compact slots
     *     >= 28rem : roomy slots (landscape / wide cells)
     */
    <div
      className="placement-ui @container shrink-0 w-full bg-neutral-950 border-t border-neutral-800 select-none"
      style={{ containerType: 'inline-size' }}
      data-loadout-dock
    >
      <div className="px-2 py-1.5 @md:px-3 @md:py-2 flex flex-col gap-1 @sm:flex-row @sm:items-center @sm:gap-2.5">
        <div className="shrink-0 flex items-baseline gap-1.5 @sm:block leading-tight">
          <div className="text-[9px] font-mono uppercase tracking-[0.18em] text-neutral-500">Loadout</div>
          {playerLabel && (
            <div className="text-[11px] font-bold text-neutral-200 whitespace-nowrap">{playerLabel}</div>
          )}
        </div>

        <div className="hidden @sm:block w-px self-stretch bg-neutral-800 shrink-0" />

        <div className="flex items-center gap-1.5 @md:gap-2 min-w-0 flex-1">
          {slots.map((slot, i) => {
            const filled = !!slot.image;
            const isBeingDragged = draggingAsset?.id === `loadout-dock:${slot.id}`;
            return (
              <div
                key={slot.id}
                onPointerDown={e => handlePointerDown(slot, e)}
                onDragStart={e => e.preventDefault()}
                title={filled ? `${slot.name || 'Tower'} — drag onto the map` : `Slot ${i + 1} is empty`}
                className={`relative flex-1 basis-0 min-w-0 aspect-square max-w-11 @md:max-w-14 rounded-lg @md:rounded-xl border transition-all ${
                  filled
                    ? 'cursor-grab active:cursor-grabbing border-neutral-700 hover:border-white/70 hover:-translate-y-px'
                    : 'border-neutral-800/80 cursor-default'
                } ${isBeingDragged ? 'opacity-50' : ''}`}
                style={{
                  background: 'linear-gradient(180deg, #2c2b2b 0%, #191818 100%)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07), 0 2px 6px rgba(0,0,0,0.65)',
                  touchAction: filled ? 'none' : 'auto'
                }}
              >
                {filled && (
                  <img
                    src={slot.image}
                    alt={slot.name}
                    draggable={false}
                    className="absolute inset-0 w-full h-full object-contain p-1 @md:p-1.5 pointer-events-none"
                  />
                )}
                <span
                  className="absolute top-0.5 left-1 @md:left-1.5 text-[10px] @md:text-[11px] font-black text-white leading-none pointer-events-none"
                  style={{ textShadow: NUMBER_STROKE }}
                >
                  {i + 1}
                </span>
              </div>
            );
          })}

          {!hasAnyTower && (
            <span className="hidden @md:inline text-[11px] font-mono text-neutral-500 pl-1 whitespace-nowrap">
              Add towers in Loadouts to place them from here
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
