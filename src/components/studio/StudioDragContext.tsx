import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { PhotoAsset } from '../../data/tdsPhotoAssets';
import { Shield, MapPin, Check, Crosshair } from 'lucide-react';

export type DropTargetType = 'loadout-slot' | 'player-tower-slot' | 'map-canvas';

export interface DropTargetInfo {
  type: DropTargetType;
  id: string; // identifier, e.g. "loadout:r1:s1" or "map-canvas-p1"
  handleDrop: (asset: PhotoAsset, clientX: number, clientY: number) => void;
}

interface StudioDragContextValue {
  draggingAsset: PhotoAsset | null;
  dragPos: { x: number; y: number } | null;
  hoveredTargetId: string | null;
  hoveredTargetType: DropTargetType | null;
  startDrag: (asset: PhotoAsset, e: React.PointerEvent | React.MouseEvent) => void;
  registerDropTarget: (info: DropTargetInfo) => () => void;
  setHoveredTarget: (id: string | null, type?: DropTargetType | null) => void;
}

const StudioDragContext = createContext<StudioDragContextValue | null>(null);

export const useStudioDrag = () => {
  const ctx = useContext(StudioDragContext);
  if (!ctx) {
    throw new Error('useStudioDrag must be used within StudioDragProvider');
  }
  return ctx;
};

export const StudioDragProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [draggingAsset, setDraggingAsset] = useState<PhotoAsset | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [hoveredTargetId, setHoveredTargetId] = useState<string | null>(null);
  const [hoveredTargetType, setHoveredTargetType] = useState<DropTargetType | null>(null);

  const targetsRef = useRef<Map<string, DropTargetInfo>>(new Map());
  const ghostRef = useRef<HTMLDivElement | null>(null);

  const activeDragRef = useRef<{
    asset: PhotoAsset;
    startX: number;
    startY: number;
    isDragging: boolean;
  } | null>(null);

  const registerDropTarget = useCallback((info: DropTargetInfo) => {
    targetsRef.current.set(info.id, info);
    return () => {
      targetsRef.current.delete(info.id);
    };
  }, []);

  const setHoveredTarget = useCallback((id: string | null, type: DropTargetType | null = null) => {
    setHoveredTargetId(id);
    setHoveredTargetType(type);
  }, []);

  // Safe element finder that hides the ghost element during elementFromPoint
  const findDropTargetAtPoint = useCallback((x: number, y: number): { id: string; target: DropTargetInfo } | null => {
    const ghost = ghostRef.current;
    if (ghost) ghost.style.display = 'none';
    const el = document.elementFromPoint(x, y);
    if (ghost) ghost.style.display = '';

    const dropEl = el?.closest('[data-drop-target-id]') as HTMLElement | null;
    if (dropEl && dropEl.dataset.dropTargetId) {
      const id = dropEl.dataset.dropTargetId;
      const target = targetsRef.current.get(id);
      if (target) return { id, target };
    }
    return null;
  }, []);

  const startDrag = useCallback((asset: PhotoAsset, e: React.PointerEvent | React.MouseEvent) => {
    // Only drag on primary left button
    if (e.button !== 0) return;

    activeDragRef.current = {
      asset,
      startX: e.clientX,
      startY: e.clientY,
      isDragging: false
    };

    const handlePointerMove = (ev: PointerEvent) => {
      if (!activeDragRef.current) return;
      const dx = ev.clientX - activeDragRef.current.startX;
      const dy = ev.clientY - activeDragRef.current.startY;

      if (!activeDragRef.current.isDragging) {
        if (Math.hypot(dx, dy) >= 4) {
          activeDragRef.current.isDragging = true;
          setDraggingAsset(activeDragRef.current.asset);
        } else {
          return;
        }
      }

      setDragPos({ x: ev.clientX, y: ev.clientY });

      const found = findDropTargetAtPoint(ev.clientX, ev.clientY);
      if (found) {
        setHoveredTargetId(found.id);
        setHoveredTargetType(found.target.type);
      } else {
        setHoveredTargetId(null);
        setHoveredTargetType(null);
      }
    };

    const handlePointerUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', handlePointerMove, { capture: true });
      window.removeEventListener('pointerup', handlePointerUp, { capture: true });
      window.removeEventListener('pointercancel', handlePointerUp, { capture: true });

      const dragInfo = activeDragRef.current;
      activeDragRef.current = null;

      if (!dragInfo || !dragInfo.isDragging) {
        setDraggingAsset(null);
        setDragPos(null);
        setHoveredTargetId(null);
        setHoveredTargetType(null);
        return;
      }

      // Check drop target under release cursor
      const found = findDropTargetAtPoint(ev.clientX, ev.clientY);
      if (found) {
        found.target.handleDrop(dragInfo.asset, ev.clientX, ev.clientY);
      }

      setDraggingAsset(null);
      setDragPos(null);
      setHoveredTargetId(null);
      setHoveredTargetType(null);
    };

    window.addEventListener('pointermove', handlePointerMove, { capture: true, passive: true });
    window.addEventListener('pointerup', handlePointerUp, { capture: true, passive: true });
    window.addEventListener('pointercancel', handlePointerUp, { capture: true, passive: true });
  }, [findDropTargetAtPoint]);

  return (
    <StudioDragContext.Provider
      value={{
        draggingAsset,
        dragPos,
        hoveredTargetId,
        hoveredTargetType,
        startDrag,
        registerDropTarget,
        setHoveredTarget
      }}
    >
      {children}

      {/* Floating Ghost Cursor Follower */}
      {draggingAsset && dragPos && typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={ghostRef}
            style={{
              position: 'fixed',
              left: dragPos.x,
              top: dragPos.y,
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
              zIndex: 99999,
              willChange: 'transform, left, top'
            }}
            className="flex flex-col items-center pointer-events-none select-none transition-transform duration-75"
          >
            {draggingAsset.category === 'towers' ? (
              /* Tower Marker Follower (Centered exactly on the cursor) */
              <div className="flex flex-col items-center pointer-events-none">
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: '9999px',
                    border: '3px solid #ffffff',
                    backgroundColor: 'rgba(20, 20, 20, 0.9)',
                    boxShadow: '0 8px 25px rgba(0,0,0,0.8), 0 0 15px rgba(255,255,255,0.4)',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none'
                  }}
                  className="animate-in zoom-in-75 duration-100"
                >
                  <img
                    src={draggingAsset.url}
                    alt=""
                    className="w-10 h-10 object-contain pointer-events-none select-none"
                    draggable={false}
                  />

                  {/* Crosshair indicator at exact center */}
                  <div
                    style={{
                      position: 'absolute',
                      width: 6,
                      height: 6,
                      borderRadius: '9999px',
                      backgroundColor: '#ffffff',
                      boxShadow: '0 0 4px #000000',
                      pointerEvents: 'none'
                    }}
                  />
                </div>

                {/* Status / Hint Badge */}
                <div
                  style={{
                    marginTop: 8,
                    padding: '3px 10px',
                    borderRadius: 9999,
                    backgroundColor: 'rgba(0, 0, 0, 0.88)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11,
                    fontFamily: 'monospace',
                    color: '#ffffff',
                    pointerEvents: 'none',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <span className="font-bold">{draggingAsset.name}</span>
                  {hoveredTargetType === 'map-canvas' ? (
                    <span className="text-sky-300 flex items-center gap-1 font-semibold">
                      <Crosshair className="w-3 h-3" /> Release to place on map
                    </span>
                  ) : hoveredTargetType === 'loadout-slot' || hoveredTargetType === 'player-tower-slot' ? (
                    <span className="text-emerald-300 flex items-center gap-1 font-semibold">
                      <Check className="w-3 h-3" /> Drop into slot
                    </span>
                  ) : (
                    <span className="text-neutral-400">Drag to map or loadout</span>
                  )}
                </div>
              </div>
            ) : (
              /* Map Card Follower */
              <div className="flex flex-col items-center pointer-events-none">
                <div
                  style={{
                    width: 90,
                    height: 56,
                    borderRadius: 12,
                    border: '2px solid #ffffff',
                    overflow: 'hidden',
                    backgroundColor: '#171717',
                    boxShadow: '0 8px 25px rgba(0,0,0,0.8), 0 0 15px rgba(255,255,255,0.3)',
                    pointerEvents: 'none'
                  }}
                  className="animate-in zoom-in-75 duration-100 flex items-center justify-center p-1"
                >
                  <img
                    src={draggingAsset.url}
                    alt=""
                    className="max-w-full max-h-full object-contain pointer-events-none"
                    draggable={false}
                  />
                </div>

                <div
                  style={{
                    marginTop: 6,
                    padding: '3px 10px',
                    borderRadius: 9999,
                    backgroundColor: 'rgba(0, 0, 0, 0.88)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11,
                    fontFamily: 'monospace',
                    color: '#ffffff',
                    pointerEvents: 'none',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <span className="font-bold">{draggingAsset.name}</span>
                  {hoveredTargetType === 'map-canvas' ? (
                    <span className="text-amber-300 flex items-center gap-1 font-semibold">
                      <MapPin className="w-3 h-3" /> Release to set map
                    </span>
                  ) : (
                    <span className="text-neutral-400">Drag to map canvas</span>
                  )}
                </div>
              </div>
            )}
          </div>,
          document.body
        )}
    </StudioDragContext.Provider>
  );
};
