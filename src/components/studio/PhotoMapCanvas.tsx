import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PlacedMapToken, PlacementZone, Point2D, LoadoutSlot } from '../../types/customDoc';
import { isMapAssetUrl, PhotoAsset } from '../../data/tdsPhotoAssets';
import { compressImageFile } from '../../utils/imageCompressor';
import {
  Upload,
  Trash2,
  X,
  Eye,
  EyeOff,
  MapPin,
  ImageOff,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Hand,
  Maximize2,
  Minimize2,
  Copy,
  Minus,
  Plus,
  Circle,
  Square,
  BoxSelect,
  Pentagon,
  PenTool,
  Tag,
  Undo2,
  Redo2,
  Sliders
} from 'lucide-react';
import { translations, Language } from '../../i18n/translations';
import { useStudioDrag } from './StudioDragContext';
import { LoadoutDock } from './LoadoutDock';
import {
  ramerDouglasPeucker,
  computePolygonCentroid,
  computePolygonBounds,
  isTokenInAnyZone,
  smoothPolygonPoints,
  calculateTokenBadgePositions
} from '../../utils/mapGeometryHelper';

interface PhotoMapCanvasProps {
  photoUrl: string;
  tokens: PlacedMapToken[];
  zones?: PlacementZone[];
  onChangePhoto: (newUrl: string) => void;
  /** Removes the map photo of THIS player only (other variants keep theirs). */
  onRemovePhoto?: () => void;
  onChangeTokens: (newTokens: PlacedMapToken[]) => void;
  onChangeZones?: (newZones: PlacementZone[]) => void;
  /** Tower currently selected in the left panel (never a map). */
  selectedAssetUrl?: string;
  selectedAssetName?: string;
  defaultColor?: string;
  /** width / height of the map image. When set, the whole image is shown (no cropping or stretching). */
  aspectRatio?: number;
  hideMapLabels?: boolean;
  onToggleHideMapLabels?: (hide: boolean) => void;
  lang: Language;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  selectedTokenIds?: string[];
  onSelectTokenIds?: (ids: string[]) => void;
  selectedZoneIds?: string[];
  onSelectZoneIds?: (ids: string[]) => void;
  onDeleteSelected?: () => void;
  /** Loadout towers of the player this map belongs to (shown as a drag bar under the map). */
  loadoutSlots?: LoadoutSlot[];
  loadoutPlayerLabel?: string;
}

/** Outline colours (taken from the reference placement map). */
const PLACEMENT_COLORS = [
  '#f5c518', // yellow
  '#3b82f6', // blue
  '#22c55e', // green
  '#d946ef', // magenta
  '#14b8a6', // teal
  '#f97316', // orange
  '#ef4444', // red
  '#ffffff'  // white
];

/** Default dark zone color and opacity (35–45% range) visible on both light and dark maps */
export const DEFAULT_ZONE_COLOR = '#1f2937';
export const DEFAULT_ZONE_OPACITY = 0.40;

/** Gray shades for placement zones. */
export const ZONE_GRAY_SHADES = [
  { hex: '#d1d5db', label: 'Light' },
  { hex: '#9ca3af', label: 'Medium' },
  { hex: '#6b7280', label: 'Charcoal' },
  { hex: '#4b5563', label: 'Dark' },
  { hex: '#1f2937', label: 'Dark Gray' }
];

/** Base sizing constraints */
const BASE_DIAMETER_FRACTION = 0.05;
const MIN_DIAMETER_PX = 10;
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const DRAG_THRESHOLD_PX = 4;
const FALLBACK_ASPECT = 1.6;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

interface View {
  z: number;
  x: number;
  y: number;
}

interface Geometry {
  vw: number;
  vh: number;
  sw: number;
  sh: number;
  ox: number;
  oy: number;
}

const clampAxis = (pan: number, offset: number, size: number, viewport: number, z: number) => {
  const content = size * z;
  if (content <= viewport + 0.5) return (viewport - content) / 2 - offset;
  return Math.min(-offset, Math.max(viewport - offset - content, pan));
};

const clampView = (v: View, g: Geometry): View => ({
  z: v.z,
  x: clampAxis(v.x, g.ox, g.sw, g.vw, v.z),
  y: clampAxis(v.y, g.oy, g.sh, g.vh, v.z)
});

type DragState =
  | {
      kind: 'group';
      pointerId: number;
      startX: number;
      startY: number;
      origTokens: { id: string; x: number; y: number }[];
      origZones: { id: string; x: number; y: number; origPoints?: Point2D[] }[];
      moved: boolean;
    }
  | {
      kind: 'zone-resize';
      pointerId: number;
      startX: number;
      startY: number;
      zoneId: string;
      handle: 'nw' | 'ne' | 'se' | 'sw';
      origX: number;
      origY: number;
      origW: number;
      origH: number;
      moved: boolean;
    }
  | {
      kind: 'vertex-drag';
      pointerId: number;
      startX: number;
      startY: number;
      zoneId: string;
      vertexIdx: number;
      origPoints: Point2D[];
      moved: boolean;
    }
  | {
      kind: 'freehand-draw';
      pointerId: number;
      startX: number;
      startY: number;
      points: Point2D[];
      moved: boolean;
    }
  | {
      kind: 'marquee';
      pointerId: number;
      startX: number;
      startY: number;
      startPctX: number;
      startPctY: number;
      moved: boolean;
    }
  | {
      kind: 'pan';
      pointerId: number;
      startX: number;
      startY: number;
      panX: number;
      panY: number;
      moved: boolean;
    };

/** Helper to test if a token (pct coordinates) is inside a zone */
export function isTokenInZone(
  tokenX: number,
  tokenY: number,
  zone: PlacementZone,
  aspectRatio: number
): boolean {
  return isTokenInAnyZone(tokenX, tokenY, zone, aspectRatio);
}

export const PhotoMapCanvas: React.FC<PhotoMapCanvasProps> = ({
  photoUrl,
  tokens,
  zones = [],
  onChangePhoto,
  onRemovePhoto,
  onChangeTokens,
  onChangeZones,
  selectedAssetUrl,
  selectedAssetName,
  aspectRatio,
  hideMapLabels = true,
  onToggleHideMapLabels,
  lang,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  selectedTokenIds: propSelectedTokenIds,
  onSelectTokenIds,
  selectedZoneIds: propSelectedZoneIds,
  onSelectZoneIds,
  onDeleteSelected,
  loadoutSlots,
  loadoutPlayerLabel
}) => {
  const t = translations[lang].studio;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);

  // Generate unique canvas drop target id
  const canvasId = useRef(`map-canvas-${Math.random().toString(36).slice(2, 9)}`).current;
  const { registerDropTarget, hoveredTargetId, draggingAsset } = useStudioDrag();
  const isDropTargetActive = hoveredTargetId === canvasId;

  const [vpEl, setVpEl] = useState<HTMLDivElement | null>(null);
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View>({ z: 1, x: 0, y: 0 });

  // Selection state supporting multi-selection of towers and zones
  const [localSelectedTokenIds, setLocalSelectedTokenIds] = useState<string[]>([]);
  const [localSelectedZoneIds, setLocalSelectedZoneIds] = useState<string[]>([]);

  const selectedTokenIds = propSelectedTokenIds !== undefined ? propSelectedTokenIds : localSelectedTokenIds;
  const selectedZoneIds = propSelectedZoneIds !== undefined ? propSelectedZoneIds : localSelectedZoneIds;

  const setSelectedTokenIds = useCallback(
    (updater: React.SetStateAction<string[]>) => {
      const next = typeof updater === 'function' ? updater(selectedTokenIds) : updater;
      if (onSelectTokenIds) {
        onSelectTokenIds(next);
      } else {
        setLocalSelectedTokenIds(next);
      }
    },
    [selectedTokenIds, onSelectTokenIds]
  );

  const setSelectedZoneIds = useCallback(
    (updater: React.SetStateAction<string[]>) => {
      const next = typeof updater === 'function' ? updater(selectedZoneIds) : updater;
      if (onSelectZoneIds) {
        onSelectZoneIds(next);
      } else {
        setLocalSelectedZoneIds(next);
      }
    },
    [selectedZoneIds, onSelectZoneIds]
  );

  // Dragging transient positions for smooth group movement
  const [dragTokenPositions, setDragTokenPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [dragZonePositions, setDragZonePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [resizingZone, setResizingZone] = useState<{ id: string; x: number; y: number; width: number; height: number } | null>(null);

  // Dragging transient points for smooth polygon vertex movement (isolated from global state)
  const [dragPolyPoints, setDragPolyPoints] = useState<{ zoneId: string; points: Point2D[] } | null>(null);
  const dragPolyPointsRef = useRef<{ zoneId: string; points: Point2D[] } | null>(null);
  dragPolyPointsRef.current = dragPolyPoints;

  const dragZonePositionsRef = useRef<Record<string, { x: number; y: number }>>({});
  dragZonePositionsRef.current = dragZonePositions;

  const dragTokenPositionsRef = useRef<Record<string, { x: number; y: number }>>({});
  dragTokenPositionsRef.current = dragTokenPositions;

  // Cached smoothed points and centroids for polygon zones to avoid recalculation on drag
  const polyCacheRef = useRef<Map<string, { key: string; pts: Point2D[]; centroid: Point2D }>>(new Map());

  const rafIdRef = useRef<number | null>(null);
  const pendingMoveCoordsRef = useRef<{ clientX: number; clientY: number; shiftKey: boolean } | null>(null);

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  // Marquee rectangle in percent of stage coordinates
  const [marqueeBox, setMarqueeBox] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  const [panning, setPanning] = useState(false);
  const [handTool, setHandTool] = useState(false);
  const [boxSelectTool, setBoxSelectTool] = useState(false);
  const [spaceDown, setSpaceDown] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [tokensEnabled, setTokensEnabled] = useState(true);
  const [tokensVisible, setTokensVisible] = useState(true);
  const [showLabels, setShowLabels] = useState(!hideMapLabels);

  useEffect(() => {
    setShowLabels(!hideMapLabels);
  }, [hideMapLabels]);

  const toggleLabels = () => {
    const next = !showLabels;
    setShowLabels(next);
    onToggleHideMapLabels?.(!next);
  };
  const [polyDrawMode, setPolyDrawMode] = useState<'none' | 'click' | 'freehand'>('none');
  const [activePolyPoints, setActivePolyPoints] = useState<Point2D[]>([]);
  const [hoverCursorPoint, setHoverCursorPoint] = useState<Point2D | null>(null);
  const [naturalAr, setNaturalAr] = useState<{ url: string; ar: number } | null>(null);

  // Internal clipboard for copying and pasting towers on map
  const copiedTokensRef = useRef<PlacedMapToken[]>([]);
  const pasteCountRef = useRef<number>(0);
  const isMouseOverCanvasRef = useRef<boolean>(false);
  const cursorMapPercentRef = useRef<Point2D | null>(null);

  // Helper checking if text editing is focused
  const isEditingText = (target: EventTarget | null) => {
    if (!target || !(target instanceof HTMLElement)) return false;
    const tag = target.tagName.toLowerCase();
    return (
      tag === 'input' ||
      tag === 'textarea' ||
      target.isContentEditable ||
      Boolean(target.closest('[contenteditable="true"]'))
    );
  };

  // The last colour / size the user picked are reused for the next placed tower.
  const lastColorRef = useRef<string>(PLACEMENT_COLORS[0]);
  const lastSizeRef = useRef<number>(1);

  // A map must never be used as a tower image.
  const towerUrl = selectedAssetUrl && !isMapAssetUrl(selectedAssetUrl) ? selectedAssetUrl : undefined;

  const ar =
    aspectRatio ?? (naturalAr && naturalAr.url === photoUrl ? naturalAr.ar : undefined) ?? FALLBACK_ASPECT;

  // ---------- geometry ----------
  const fitW = Math.min(vp.w, vp.h * ar);
  const geom: Geometry = {
    vw: vp.w,
    vh: vp.h,
    sw: fitW,
    sh: fitW / ar,
    ox: (vp.w - fitW) / 2,
    oy: (vp.h - fitW / ar) / 2
  };
  const geomRef = useRef(geom);
  geomRef.current = geom;

  useLayoutEffect(() => {
    if (!vpEl) return;
    const measure = () => setVp({ w: vpEl.clientWidth, h: vpEl.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(vpEl);
    return () => ro.disconnect();
  }, [vpEl]);

  // A different map was chosen: show new map fitted
  useEffect(() => {
    setView({ z: 1, x: 0, y: 0 });
    setDragTokenPositions({});
    setDragZonePositions({});
    setResizingZone(null);
    setMarqueeBox(null);
    dragRef.current = null;
    setPanning(false);
    setSelectedTokenIds([]);
    setSelectedZoneIds([]);
  }, [photoUrl]);

  // Keep pan inside the map whenever the viewport, aspect ratio or zoom changes.
  useEffect(() => {
    if (vp.w === 0) return;
    setView(v => {
      const next = clampView(v, geomRef.current);
      return next.x === v.x && next.y === v.y ? v : next;
    });
  }, [vp.w, vp.h, ar]);

  const baseDiameter = Math.max(MIN_DIAMETER_PX, geom.sw * BASE_DIAMETER_FRACTION);

  // Helper converting mouse screen coordinates to percent on stage (accounting for zoom and pan)
  const pointToPercent = useCallback((clientX: number, clientY: number) => {
    const stage = stageRef.current;
    if (!stage) return null;
    const r = stage.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return null;
    return {
      x: clamp(((clientX - r.left) / r.width) * 100, 0, 100),
      y: clamp(((clientY - r.top) / r.height) * 100, 0, 100)
    };
  }, []);

  const tokensRef = useRef(tokens);
  tokensRef.current = tokens;
  const zonesRef = useRef(zones);
  zonesRef.current = zones;
  const arRef = useRef(ar);
  arRef.current = ar;
  const onChangeTokensRef = useRef(onChangeTokens);
  onChangeTokensRef.current = onChangeTokens;
  const onChangeZonesRef = useRef(onChangeZones);
  onChangeZonesRef.current = onChangeZones;
  const onChangePhotoRef = useRef(onChangePhoto);
  onChangePhotoRef.current = onChangePhoto;
  const selectedTokenIdsRef = useRef(selectedTokenIds);
  selectedTokenIdsRef.current = selectedTokenIds;
  const selectedZoneIdsRef = useRef(selectedZoneIds);
  selectedZoneIdsRef.current = selectedZoneIds;
  // History push delegates directly to document state updater callbacks
  const pushHistory = useCallback(
    (newTokens?: PlacedMapToken[], newZones?: PlacementZone[]) => {
      if (newTokens !== undefined) {
        onChangeTokensRef.current(newTokens);
      }
      if (newZones !== undefined && onChangeZonesRef.current) {
        onChangeZonesRef.current(newZones);
      }
    },
    []
  );

  const handleUndo = useCallback(() => {
    if (onUndo) {
      onUndo();
      return true;
    }
    return false;
  }, [onUndo]);

  const handleRedo = useCallback(() => {
    if (onRedo) {
      onRedo();
      return true;
    }
    return false;
  }, [onRedo]);

  const pushTokenHistory = useCallback(
    (newTokens: PlacedMapToken[]) => {
      pushHistory(newTokens, undefined);
    },
    [pushHistory]
  );

  const pushZoneHistory = useCallback(
    (newZones: PlacementZone[]) => {
      pushHistory(undefined, newZones);
    },
    [pushHistory]
  );

  // Register canvas as drop target for towers and maps
  useEffect(() => {
    return registerDropTarget({
      type: 'map-canvas',
      id: canvasId,
      handleDrop: (asset: PhotoAsset, clientX: number, clientY: number) => {
        if (asset.category === 'maps') {
          onChangePhotoRef.current(asset.url);
          return;
        }
        if (asset.category === 'towers') {
          const currentTokens = tokensRef.current;
          const currentZones = zonesRef.current;
          const currentAr = arRef.current;

          const pos = pointToPercent(clientX, clientY);
          if (!pos) return;
          const matchingZone = currentZones.find(z => isTokenInZone(pos.x, pos.y, z, currentAr));
          const size = lastSizeRef.current;
          const newToken: PlacedMapToken = {
            id: `tok-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            x: pos.x,
            y: pos.y,
            label: asset.name ? asset.name.slice(0, 4) : `${currentTokens.length + 1}`,
            towerName: asset.name || `Tower ${currentTokens.length + 1}`,
            towerImage: asset.url,
            color: lastColorRef.current,
            ...(size !== 1 ? { size } : {}),
            ...(matchingZone ? { zoneId: matchingZone.id } : {})
          };
          setTokensVisible(true);
          pushHistory([...currentTokens, newToken], undefined);
          setSelectedTokenIds([newToken.id]);
          setSelectedZoneIds([]);
        }
      }
    });
  }, [canvasId, registerDropTarget, pointToPercent, pushHistory]);

  // ---------- zoom ----------
  const zoomAt = useCallback(
    (factor: number, clientX?: number, clientY?: number) => {
      const el = vpEl;
      if (!el) return;
      const g = geomRef.current;
      if (g.vw === 0) return;
      const rect = el.getBoundingClientRect();
      const k = rect.width / g.vw || 1;
      const px = clientX === undefined ? g.vw / 2 : (clientX - rect.left) / k;
      const py = clientY === undefined ? g.vh / 2 : (clientY - rect.top) / k;
      setView(v => {
        const nz = clamp(v.z * factor, MIN_ZOOM, MAX_ZOOM);
        const qx = (px - g.ox - v.x) / v.z;
        const qy = (py - g.oy - v.y) / v.z;
        return clampView({ z: nz, x: px - g.ox - qx * nz, y: py - g.oy - qy * nz }, g);
      });
    },
    [vpEl]
  );

  const resetView = () => setView(clampView({ z: 1, x: 0, y: 0 }, geomRef.current));

  // Ctrl/Cmd + wheel (or pinch) zooms
  useEffect(() => {
    if (!vpEl) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey || expanded)) return;
      e.preventDefault();
      const dy = clamp(e.deltaY, -120, 120);
      const factor = Math.exp(-dy * (Math.abs(dy) < 50 ? 0.01 : 0.0025));
      zoomAt(factor, e.clientX, e.clientY);
    };
    vpEl.addEventListener('wheel', onWheel, { passive: false });
    return () => vpEl.removeEventListener('wheel', onWheel);
  }, [vpEl, expanded, zoomAt]);

  // ---------- helpers ----------
  const selectedTokens = tokens.filter(tok => selectedTokenIds.includes(tok.id));
  const primarySelectedToken = selectedTokens[0] || null;

  const selectedZonesList = zones.filter(z => selectedZoneIds.includes(z.id));
  const primarySelectedZone = selectedZonesList[0] || null;

  const totalSelectedCount = selectedTokenIds.length + selectedZoneIds.length;

  const handleCopyTokens = useCallback(() => {
    const selTokens = selectedTokenIdsRef.current;
    if (selTokens.length === 0) return false;
    const currentTokens = tokensRef.current;
    const toCopy = currentTokens.filter(tok => selTokens.includes(tok.id));
    if (toCopy.length === 0) return false;
    copiedTokensRef.current = toCopy.map(tok => ({ ...tok }));
    pasteCountRef.current = 0;
    return true;
  }, []);

  const handlePasteTokens = useCallback(() => {
    const copied = copiedTokensRef.current;
    if (!copied || copied.length === 0) return false;

    pasteCountRef.current += 1;
    const pasteCount = pasteCountRef.current;

    // Calculate center of original copied group
    const minX = Math.min(...copied.map(t => t.x));
    const maxX = Math.max(...copied.map(t => t.x));
    const minY = Math.min(...copied.map(t => t.y));
    const maxY = Math.max(...copied.map(t => t.y));
    const groupCenterX = (minX + maxX) / 2;
    const groupCenterY = (minY + maxY) / 2;

    const g = geomRef.current;
    const offsetPxX = 20;
    const offsetPxY = 20;
    const shiftPctX = g.sw > 0 ? (offsetPxX / g.sw) * 100 : 2.5;
    const shiftPctY = g.sh > 0 ? (offsetPxY / g.sh) * 100 : 2.5;

    let deltaX = 0;
    let deltaY = 0;

    if (isMouseOverCanvasRef.current && cursorMapPercentRef.current) {
      const mouseX = cursorMapPercentRef.current.x;
      const mouseY = cursorMapPercentRef.current.y;
      deltaX = (mouseX - groupCenterX) + (pasteCount - 1) * shiftPctX;
      deltaY = (mouseY - groupCenterY) + (pasteCount - 1) * shiftPctY;
    } else {
      deltaX = pasteCount * shiftPctX;
      deltaY = pasteCount * shiftPctY;
    }

    const currentAr = arRef.current;
    const currentZones = zonesRef.current;
    const currentTokens = tokensRef.current;

    const newTokens: PlacedMapToken[] = copied.map((orig, i) => {
      const nx = clamp(orig.x + deltaX, 0, 100);
      const ny = clamp(orig.y + deltaY, 0, 100);
      const matchingZone = currentZones.find(z => isTokenInZone(nx, ny, z, currentAr));
      return {
        ...orig,
        id: `tok-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
        x: nx,
        y: ny,
        zoneId: matchingZone ? matchingZone.id : undefined
      };
    });

    pushHistory([...currentTokens, ...newTokens], undefined);
    setSelectedTokenIds(newTokens.map(t => t.id));
    setSelectedZoneIds([]);
    setTokensVisible(true);
    return true;
  }, [pushHistory]);

  const updateToken = (id: string, patch: Partial<PlacedMapToken>) => {
    pushHistory(tokensRef.current.map(tok => (tok.id === id ? { ...tok, ...patch } : tok)), undefined);
  };

  const updateAllSelectedTokens = (patch: Partial<PlacedMapToken>) => {
    const selTokens = selectedTokenIdsRef.current;
    if (selTokens.length === 0) return;
    pushHistory(
      tokensRef.current.map(tok => (selTokens.includes(tok.id) ? { ...tok, ...patch } : tok)),
      undefined
    );
  };

  const removeSelectedObjects = useCallback(() => {
    if (onDeleteSelected) {
      onDeleteSelected();
      return true;
    }
    const curTokens = tokensRef.current;
    const curZones = zonesRef.current;
    const selTokens = selectedTokenIdsRef.current;
    const selZones = selectedZoneIdsRef.current;

    if (selTokens.length === 0 && selZones.length === 0) return false;

    const nextTokens = selTokens.length > 0
      ? curTokens.filter(tok => !selTokens.includes(tok.id))
      : curTokens;
    const nextZones = selZones.length > 0 && onChangeZonesRef.current
      ? curZones.filter(z => !selZones.includes(z.id))
      : curZones;

    pushHistory(nextTokens, onChangeZonesRef.current ? nextZones : undefined);
    setSelectedTokenIds([]);
    setSelectedZoneIds([]);
    return true;
  }, [onDeleteSelected, pushHistory, setSelectedTokenIds, setSelectedZoneIds]);

  const duplicateSelectedObjects = () => {
    const currentTokens = tokensRef.current;
    const currentZones = zonesRef.current;
    const selTokens = selectedTokenIdsRef.current;
    const selZones = selectedZoneIdsRef.current;

    const newTokens = [...currentTokens];
    const newSelectedTokenIds: string[] = [];
    currentTokens
      .filter(t => selTokens.includes(t.id))
      .forEach(tok => {
        const copy: PlacedMapToken = {
          ...tok,
          id: `tok-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          x: clamp(tok.x + 2.5, 0, 100),
          y: clamp(tok.y + 2.5, 0, 100)
        };
        newTokens.push(copy);
        newSelectedTokenIds.push(copy.id);
      });

    let newZones = [...currentZones];
    const newSelectedZoneIds: string[] = [];
    if (onChangeZonesRef.current) {
      currentZones
        .filter(z => selZones.includes(z.id))
        .forEach(z => {
          const newId = `zone-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          let copy: PlacementZone;
          if (z.type === 'polygon' && z.points && z.points.length >= 3) {
            // Polygon points are stored as fractions (0..1): shift the whole shape uniformly
            const xs = z.points.map(pt => pt.x);
            const ys = z.points.map(pt => pt.y);
            const off = 0.03;
            const dx = Math.max(...xs) + off <= 1 ? off : Math.min(...xs) - off >= 0 ? -off : 0;
            const dy = Math.max(...ys) + off <= 1 ? off : Math.min(...ys) - off >= 0 ? -off : 0;
            copy = {
              ...z,
              id: newId,
              points: z.points.map(pt => ({ x: pt.x + dx, y: pt.y + dy })),
              x: z.x + dx * 100,
              y: z.y + dy * 100
            };
          } else {
            copy = {
              ...z,
              id: newId,
              x: clamp(z.x + 3, 0, 100),
              y: clamp(z.y + 3, 0, 100)
            };
          }
          newZones.push(copy);
          newSelectedZoneIds.push(copy.id);
        });
    }

    pushHistory(newTokens, onChangeZonesRef.current ? newZones : undefined);
    setSelectedTokenIds(newSelectedTokenIds);
    setSelectedZoneIds(newSelectedZoneIds);
  };

  // Place a new token
  const placeToken = (clientX: number, clientY: number) => {
    const pos = pointToPercent(clientX, clientY);
    if (!pos) return;
    if (!towerUrl) {
      setSelectedTokenIds([]);
      setSelectedZoneIds([]);
      return;
    }
    const size = lastSizeRef.current;
    const currentZones = zonesRef.current;
    const currentTokens = tokensRef.current;
    const matchingZone = currentZones.find(z => isTokenInZone(pos.x, pos.y, z, arRef.current));

    const newToken: PlacedMapToken = {
      id: `tok-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      x: pos.x,
      y: pos.y,
      label: selectedAssetName ? selectedAssetName.slice(0, 4) : `${currentTokens.length + 1}`,
      towerName: selectedAssetName || `Tower ${currentTokens.length + 1}`,
      towerImage: towerUrl,
      color: lastColorRef.current,
      ...(size !== 1 ? { size } : {}),
      ...(matchingZone ? { zoneId: matchingZone.id } : {})
    };
    setTokensVisible(true);
    pushHistory([...currentTokens, newToken], undefined);
    setSelectedTokenIds([newToken.id]);
    setSelectedZoneIds([]);
  };

  const addZone = (type: 'circle' | 'rect') => {
    if (!onChangeZones) return;
    const newZone: PlacementZone = {
      id: `zone-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      x: 50,
      y: 50,
      width: type === 'circle' ? 22 : 26,
      height: type === 'circle' ? 22 : 18,
      label: `Zone ${zones.length + 1}`,
      color: DEFAULT_ZONE_COLOR,
      fillOpacity: DEFAULT_ZONE_OPACITY
    };
    pushZoneHistory([...zones, newZone]);
    setSelectedZoneIds([newZone.id]);
    setSelectedTokenIds([]);
  };

  const finishClickPolygon = () => {
    if (activePolyPoints.length < 3 || !onChangeZones) return;
    const centroid = computePolygonCentroid(activePolyPoints);
    const bounds = computePolygonBounds(activePolyPoints);
    const newZone: PlacementZone = {
      id: `zone-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'polygon',
      points: activePolyPoints,
      smoothing: 0,
      x: centroid.x * 100,
      y: centroid.y * 100,
      width: Math.max(10, bounds.width * 100),
      height: Math.max(10, bounds.height * 100),
      label: `Zone ${zones.length + 1}`,
      color: DEFAULT_ZONE_COLOR,
      fillOpacity: DEFAULT_ZONE_OPACITY
    };
    pushZoneHistory([...zones, newZone]);
    setSelectedZoneIds([newZone.id]);
    setSelectedTokenIds([]);
    setActivePolyPoints([]);
    setHoverCursorPoint(null);
    setPolyDrawMode('none');
  };

  const cancelPolyDrawing = () => {
    setActivePolyPoints([]);
    setHoverCursorPoint(null);
    setPolyDrawMode('none');
  };

  const insertVertex = (zoneId: string, afterIdx: number, pt: Point2D) => {
    const z = zones.find(item => item.id === zoneId);
    if (!z || !z.points || !onChangeZones) return;
    const newPoints = [
      ...z.points.slice(0, afterIdx + 1),
      pt,
      ...z.points.slice(afterIdx + 1)
    ];
    const centroid = computePolygonCentroid(newPoints);
    const bounds = computePolygonBounds(newPoints);
    const updated: PlacementZone = {
      ...z,
      points: newPoints,
      x: centroid.x * 100,
      y: centroid.y * 100,
      width: Math.max(10, bounds.width * 100),
      height: Math.max(10, bounds.height * 100)
    };
    pushZoneHistory(zones.map(item => (item.id === zoneId ? updated : item)));
  };

  const deleteVertex = (zoneId: string, idx: number) => {
    const z = zones.find(item => item.id === zoneId);
    if (!z || !z.points || z.points.length <= 3 || !onChangeZones) return;
    const newPoints = z.points.filter((_, i) => i !== idx);
    const centroid = computePolygonCentroid(newPoints);
    const bounds = computePolygonBounds(newPoints);
    const updated: PlacementZone = {
      ...z,
      points: newPoints,
      x: centroid.x * 100,
      y: centroid.y * 100,
      width: Math.max(10, bounds.width * 100),
      height: Math.max(10, bounds.height * 100)
    };
    pushZoneHistory(zones.map(item => (item.id === zoneId ? updated : item)));
  };

  const updateZone = (id: string, patch: Partial<PlacementZone>) => {
    if (!onChangeZones) return;
    pushZoneHistory(zones.map(z => (z.id === id ? { ...z, ...patch } : z)));
  };

  const removeZone = (id: string) => {
    if (!onChangeZones) return;
    pushZoneHistory(zones.filter(z => z.id !== id));
    setSelectedZoneIds(prev => prev.filter(x => x !== id));
  };

  // Check which zone a token is currently inside
  const getTokenActiveZone = (tok: PlacedMapToken, currentX: number, currentY: number): PlacementZone | null => {
    for (const z of zones) {
      const activeZonePos = dragZonePositions[z.id] || z;
      const zoneToCheck: PlacementZone = { ...z, x: activeZonePos.x, y: activeZonePos.y };
      if (resizingZone && resizingZone.id === z.id) {
        zoneToCheck.x = resizingZone.x;
        zoneToCheck.y = resizingZone.y;
        zoneToCheck.width = resizingZone.width;
        zoneToCheck.height = resizingZone.height;
      }
      if (isTokenInZone(currentX, currentY, zoneToCheck, ar)) {
        return z;
      }
    }
    return null;
  };

  // ---------- pointer interaction ----------
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.button !== 1) return;
    if (document.activeElement instanceof HTMLElement && isEditingText(document.activeElement)) {
      document.activeElement.blur();
    }
    vpEl?.focus({ preventScroll: true });

    const forcePan = e.button === 1 || spaceDown || handTool;
    if (e.button === 1) e.preventDefault();

    // 0. Active Polygon Click-to-Point Mode
    if (polyDrawMode === 'click' && !forcePan) {
      const pt = pointToPercent(e.clientX, e.clientY);
      if (pt) {
        const curP: Point2D = { x: pt.x / 100, y: pt.y / 100 };
        // Check if clicked close to start point (within 3% radius) to close polygon
        if (activePolyPoints.length >= 3) {
          const startPt = activePolyPoints[0];
          const dist = Math.hypot(curP.x - startPt.x, curP.y - startPt.y);
          if (dist < 0.035) {
            finishClickPolygon();
            return;
          }
        }
        setActivePolyPoints(prev => [...prev, curP]);
      }
      return;
    }

    // 0b. Active Polygon Freehand Mode
    if (polyDrawMode === 'freehand' && !forcePan) {
      const pt = pointToPercent(e.clientX, e.clientY);
      if (pt) {
        const curP: Point2D = { x: pt.x / 100, y: pt.y / 100 };
        dragRef.current = {
          kind: 'freehand-draw',
          pointerId: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          points: [curP],
          moved: false
        };
        e.currentTarget.setPointerCapture(e.pointerId);
      }
      return;
    }

    // 1a. Check for polygon vertex handle click
    const vtxEl = (e.target as HTMLElement).closest('[data-vertex-handle]') as HTMLElement | null;
    if (vtxEl && !forcePan) {
      const zoneId = vtxEl.dataset.zoneId as string;
      const vtxIdx = Number(vtxEl.dataset.vertexIdx);
      const targetZone = zones.find(z => z.id === zoneId);
      if (targetZone && targetZone.points) {
        dragRef.current = {
          kind: 'vertex-drag',
          pointerId: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          zoneId,
          vertexIdx: vtxIdx,
          origPoints: targetZone.points.map(p => ({ ...p })),
          moved: false
        };
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
    }

    // 1b. Check for zone resize handle click (circle/rect)
    const handleEl = (e.target as HTMLElement).closest('[data-zone-handle]') as HTMLElement | null;
    if (handleEl && !forcePan) {
      const zoneId = handleEl.dataset.zoneId as string;
      const handle = handleEl.dataset.zoneHandle as 'nw' | 'ne' | 'se' | 'sw';
      const targetZone = zones.find(z => z.id === zoneId);
      if (targetZone) {
        dragRef.current = {
          kind: 'zone-resize',
          pointerId: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          zoneId,
          handle,
          origX: targetZone.x,
          origY: targetZone.y,
          origW: targetZone.width,
          origH: targetZone.height,
          moved: false
        };
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
    }

    // 2. Check for token click
    const tokenEl = (e.target as HTMLElement).closest('[data-token-id]') as HTMLElement | null;
    if (tokenEl && !forcePan && tokensEnabled && tokensVisible) {
      const id = tokenEl.dataset.tokenId as string;
      const tok = tokens.find(x => x.id === id);
      if (!tok) return;

      let nextTokenIds = selectedTokenIds;
      let nextZoneIds = selectedZoneIds;

      if (e.shiftKey || e.ctrlKey) {
        nextTokenIds = selectedTokenIds.includes(id)
          ? selectedTokenIds.filter(x => x !== id)
          : [...selectedTokenIds, id];
      } else if (!selectedTokenIds.includes(id)) {
        nextTokenIds = [id];
        nextZoneIds = [];
      }

      setSelectedTokenIds(nextTokenIds);
      setSelectedZoneIds(nextZoneIds);

      const dragTokens = tokens.filter(t => nextTokenIds.includes(t.id));
      const dragZones = zones.filter(z => nextZoneIds.includes(z.id));

      dragRef.current = {
        kind: 'group',
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        origTokens: dragTokens.map(t => ({ id: t.id, x: t.x, y: t.y })),
        origZones: dragZones.map(z => ({
          id: z.id,
          x: z.x,
          y: z.y,
          origPoints: z.points ? z.points.map(p => ({ ...p })) : undefined
        })),
        moved: false
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    // 3. Check for zone click
    const zoneEl = (e.target as HTMLElement).closest('[data-zone-id]') as HTMLElement | null;
    if (zoneEl && !forcePan) {
      const id = zoneEl.dataset.zoneId as string;
      const z = zones.find(x => x.id === id);
      if (z) {
        let nextZoneIds = selectedZoneIds;
        let nextTokenIds = selectedTokenIds;

        if (e.shiftKey || e.ctrlKey) {
          nextZoneIds = selectedZoneIds.includes(id)
            ? selectedZoneIds.filter(x => x !== id)
            : [...selectedZoneIds, id];
        } else if (!selectedZoneIds.includes(id)) {
          nextZoneIds = [id];
          nextTokenIds = [];
        }

        setSelectedZoneIds(nextZoneIds);
        setSelectedTokenIds(nextTokenIds);

        const dragTokens = tokens.filter(t => nextTokenIds.includes(t.id));
        const dragZones = zones.filter(zi => nextZoneIds.includes(zi.id));

        dragRef.current = {
          kind: 'group',
          pointerId: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          origTokens: dragTokens.map(t => ({ id: t.id, x: t.x, y: t.y })),
          origZones: dragZones.map(zi => ({
            id: zi.id,
            x: zi.x,
            y: zi.y,
            origPoints: zi.points ? zi.points.map(p => ({ ...p })) : undefined
          })),
          moved: false
        };
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
    }

    // 4. Clicked on empty canvas
    if (forcePan || (view.z > 1 && !boxSelectTool)) {
      dragRef.current = {
        kind: 'pan',
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        panX: view.x,
        panY: view.y,
        moved: false
      };
    } else {
      const pt = pointToPercent(e.clientX, e.clientY) || { x: 50, y: 50 };
      dragRef.current = {
        kind: 'marquee',
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startPctX: pt.x,
        startPctY: pt.y,
        moved: false
      };
    }
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const processDragMove = (clientX: number, clientY: number, shiftKey = false) => {
    const d = dragRef.current;
    if (!d) return;

    const dx = clientX - d.startX;
    const dy = clientY - d.startY;

    if (!d.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      d.moved = true;
      if (d.kind === 'pan') setPanning(true);
    }

    if (d.kind === 'freehand-draw') {
      const pt = pointToPercent(clientX, clientY);
      if (pt) {
        const curP: Point2D = { x: pt.x / 100, y: pt.y / 100 };
        const last = d.points[d.points.length - 1];
        if (!last || Math.hypot(curP.x - last.x, curP.y - last.y) > 0.005) {
          d.points.push(curP);
          setActivePolyPoints([...d.points]);
        }
      }
      return;
    }

    if (d.kind === 'vertex-drag') {
      const stage = stageRef.current;
      if (!stage) return;
      const r = stage.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const dxFrac = dx / r.width;
      const dyFrac = dy / r.height;

      const newPoints = d.origPoints.map((p, i) =>
        i === d.vertexIdx
          ? { x: clamp(p.x + dxFrac, 0, 1), y: clamp(p.y + dyFrac, 0, 1) }
          : p
      );
      setDragPolyPoints({ zoneId: d.zoneId, points: newPoints });
      return;
    }

    if (d.kind === 'group') {
      const stage = stageRef.current;
      if (!stage) return;
      const r = stage.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const dxPct = (dx / r.width) * 100;
      const dyPct = (dy / r.height) * 100;

      const newTokPos: Record<string, { x: number; y: number }> = {};
      d.origTokens.forEach(t => {
        newTokPos[t.id] = {
          x: clamp(t.x + dxPct, 0, 100),
          y: clamp(t.y + dyPct, 0, 100)
        };
      });
      setDragTokenPositions(newTokPos);

      const newZonePos: Record<string, { x: number; y: number }> = {};
      d.origZones.forEach(z => {
        newZonePos[z.id] = {
          x: clamp(z.x + dxPct, 0, 100),
          y: clamp(z.y + dyPct, 0, 100)
        };
      });
      setDragZonePositions(newZonePos);
      return;
    } else if (d.kind === 'zone-resize') {
      const stage = stageRef.current;
      if (!stage) return;
      const r = stage.getBoundingClientRect();
      const dxPct = (dx / r.width) * 100;
      const dyPct = (dy / r.height) * 100;

      let nw = d.origW;
      let nh = d.origH;
      let nx = d.origX;
      let ny = d.origY;

      if (d.handle === 'se') {
        nw = Math.max(4, d.origW + dxPct * 2);
        nh = Math.max(4, d.origH + dyPct * 2);
      } else if (d.handle === 'sw') {
        nw = Math.max(4, d.origW - dxPct * 2);
        nh = Math.max(4, d.origH + dyPct * 2);
      } else if (d.handle === 'ne') {
        nw = Math.max(4, d.origW + dxPct * 2);
        nh = Math.max(4, d.origH - dyPct * 2);
      } else if (d.handle === 'nw') {
        nw = Math.max(4, d.origW - dxPct * 2);
        nh = Math.max(4, d.origH - dyPct * 2);
      }

      const targetZ = zones.find(zi => zi.id === d.zoneId);
      if (targetZ?.type === 'circle') {
        const avg = Math.max(4, (nw + nh) / 2);
        nw = avg;
        nh = avg;
      }

      setResizingZone({ id: d.zoneId, x: nx, y: ny, width: nw, height: nh });
    } else if (d.kind === 'marquee') {
      const curPt = pointToPercent(clientX, clientY);
      if (curPt) {
        const x1 = Math.min(d.startPctX, curPt.x);
        const y1 = Math.min(d.startPctY, curPt.y);
        const x2 = Math.max(d.startPctX, curPt.x);
        const y2 = Math.max(d.startPctY, curPt.y);

        setMarqueeBox({ x1, y1, x2, y2 });

        const matchedTokens = tokens
          .filter(t => t.x >= x1 && t.x <= x2 && t.y >= y1 && t.y <= y2)
          .map(t => t.id);

        const matchedZones = zones
          .filter(z => {
            const zx1 = z.x - z.width / 2;
            const zx2 = z.x + z.width / 2;
            const zy1 = z.y - z.height / 2;
            const zy2 = z.y + z.height / 2;
            return !(zx2 < x1 || zx1 > x2 || zy2 < y1 || zy1 > y2);
          })
          .map(z => z.id);

        if (shiftKey) {
          setSelectedTokenIds(prev => Array.from(new Set([...prev, ...matchedTokens])));
          setSelectedZoneIds(prev => Array.from(new Set([...prev, ...matchedZones])));
        } else {
          setSelectedTokenIds(matchedTokens);
          setSelectedZoneIds(matchedZones);
        }
      }
    } else if (d.kind === 'pan' && vpEl) {
      const k = vpEl.getBoundingClientRect().width / (geomRef.current.vw || 1) || 1;
      setView(v => clampView({ z: v.z, x: d.panX + dx / k, y: d.panY + dy / k }, geomRef.current));
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    isMouseOverCanvasRef.current = true;
    const pt = pointToPercent(e.clientX, e.clientY);
    if (pt) cursorMapPercentRef.current = pt;

    // Tracking cursor position during polygon click-to-point mode
    if (polyDrawMode === 'click') {
      if (pt) setHoverCursorPoint({ x: pt.x / 100, y: pt.y / 100 });
    }

    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;

    pendingMoveCoordsRef.current = { clientX: e.clientX, clientY: e.clientY, shiftKey: e.shiftKey };
    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        if (!dragRef.current || !pendingMoveCoordsRef.current) return;
        const { clientX, clientY, shiftKey } = pendingMoveCoordsRef.current;
        processDragMove(clientX, clientY, shiftKey);
      });
    }
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (pendingMoveCoordsRef.current && dragRef.current && !cancelled) {
      processDragMove(
        pendingMoveCoordsRef.current.clientX,
        pendingMoveCoordsRef.current.clientY,
        pendingMoveCoordsRef.current.shiftKey
      );
      pendingMoveCoordsRef.current = null;
    }

    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    setPanning(false);
    setMarqueeBox(null);

    if (d.kind === 'freehand-draw') {
      if (!cancelled && d.points.length >= 3 && onChangeZones) {
        const simplified = ramerDouglasPeucker(d.points, 0.015);
        if (simplified.length >= 3) {
          const centroid = computePolygonCentroid(simplified);
          const bounds = computePolygonBounds(simplified);
          const newZone: PlacementZone = {
            id: `zone-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            type: 'polygon',
            points: simplified,
            smoothing: 0.2,
            x: centroid.x * 100,
            y: centroid.y * 100,
            width: Math.max(10, bounds.width * 100),
            height: Math.max(10, bounds.height * 100),
            label: `Zone ${zones.length + 1}`,
            color: DEFAULT_ZONE_COLOR,
            fillOpacity: DEFAULT_ZONE_OPACITY
          };
          pushZoneHistory([...zones, newZone]);
          setSelectedZoneIds([newZone.id]);
          setSelectedTokenIds([]);
        }
      }
      setActivePolyPoints([]);
      setPolyDrawMode('none');
      return;
    }

    if (d.kind === 'vertex-drag') {
      const activePoly = dragPolyPointsRef.current;
      if (!cancelled && d.moved && activePoly && activePoly.zoneId === d.zoneId && onChangeZones) {
        const finalPoints = activePoly.points;
        const centroid = computePolygonCentroid(finalPoints);
        const bounds = computePolygonBounds(finalPoints);
        const updatedZones = zones.map(z =>
          z.id === d.zoneId
            ? {
                ...z,
                points: finalPoints,
                x: centroid.x * 100,
                y: centroid.y * 100,
                width: Math.max(10, bounds.width * 100),
                height: Math.max(10, bounds.height * 100)
              }
            : z
        );
        pushZoneHistory(updatedZones);
      }
      setDragPolyPoints(null);
      return;
    }

    if (d.kind === 'group') {
      if (!cancelled && d.moved) {
        let updatedTokens: PlacedMapToken[] | undefined = undefined;
        let updatedZones: PlacementZone[] | undefined = undefined;

        if (Object.keys(dragTokenPositions).length > 0) {
          updatedTokens = tokens.map(tok => {
            const pos = dragTokenPositions[tok.id];
            if (!pos) return tok;
            const activeZone = getTokenActiveZone(tok, pos.x, pos.y);
            return {
              ...tok,
              x: pos.x,
              y: pos.y,
              zoneId: activeZone?.id
            };
          });
        }

        if (Object.keys(dragZonePositions).length > 0 && onChangeZones) {
          updatedZones = zones.map(z => {
            const pos = dragZonePositions[z.id];
            if (!pos) return z;
            if (z.type === 'polygon' && z.points) {
              const dxFrac = (pos.x - z.x) / 100;
              const dyFrac = (pos.y - z.y) / 100;
              const shifted = z.points.map(pt => ({
                x: clamp(pt.x + dxFrac, 0, 1),
                y: clamp(pt.y + dyFrac, 0, 1)
              }));
              const centroid = computePolygonCentroid(shifted);
              return { ...z, x: centroid.x * 100, y: centroid.y * 100, points: shifted };
            }
            return { ...z, x: pos.x, y: pos.y };
          });
        }

        if (updatedTokens !== undefined || updatedZones !== undefined) {
          pushHistory(updatedTokens, updatedZones);
        }
      }
      setDragTokenPositions({});
      setDragZonePositions({});
      return;
    }

    if (d.kind === 'zone-resize') {
      if (!cancelled && resizingZone && onChangeZones) {
        pushZoneHistory(
          zones.map(z =>
            z.id === resizingZone.id
              ? { ...z, width: resizingZone.width, height: resizingZone.height }
              : z
          )
        );
      }
      setResizingZone(null);
      return;
    }

    if (d.kind === 'marquee') {
      if (!d.moved && !cancelled && e.button === 0 && tokensEnabled) {
        if (towerUrl) {
          placeToken(e.clientX, e.clientY);
        } else {
          setSelectedTokenIds([]);
          setSelectedZoneIds([]);
        }
      }
    }
  };

  // ---------- keyboard ----------
  const handleEscape = () => {
    if (polyDrawMode !== 'none') {
      cancelPolyDrawing();
      return;
    }
    if (dragRef.current) {
      dragRef.current = null;
      setDragTokenPositions({});
      setDragZonePositions({});
      setResizingZone(null);
      setMarqueeBox(null);
      setPanning(false);
      return;
    }
    if (selectedTokenIds.length > 0 || selectedZoneIds.length > 0) {
      setSelectedTokenIds([]);
      setSelectedZoneIds([]);
      return;
    }
    if (expanded) setExpanded(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') {
      if (polyDrawMode === 'click' && activePolyPoints.length >= 3) {
        e.preventDefault();
        finishClickPolygon();
        return;
      }
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      handleEscape();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault();
      if (e.shiftKey) {
        handleRedo();
      } else {
        handleUndo();
      }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
      e.preventDefault();
      handleRedo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
      if (!isEditingText(document.activeElement)) {
        if (handleCopyTokens()) e.preventDefault();
      }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
      if (!isEditingText(document.activeElement)) {
        if (handlePasteTokens()) e.preventDefault();
      }
      return;
    }
    if (e.key === ' ') {
      e.preventDefault();
      setSpaceDown(true);
      return;
    }
    if (e.key === 'Escape') {
      if (!expanded) handleEscape();
      return;
    }
    if (e.key === '+' || e.key === '=') return zoomAt(1.25);
    if (e.key === '-') return zoomAt(1 / 1.25);
    if (e.key === '0') return resetView();

    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedTokenIds.length > 0 || selectedZoneIds.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        removeSelectedObjects();
        return;
      }
    }

    const step = e.shiftKey ? 1 : 0.1;
    const nudge: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step]
    };
    const n = nudge[e.key];
    if (n && (selectedTokenIds.length > 0 || selectedZoneIds.length > 0)) {
      e.preventDefault();
      if (selectedTokenIds.length > 0) {
        onChangeTokens(
          tokens.map(tok => {
            if (!selectedTokenIds.includes(tok.id)) return tok;
            const nx = clamp(tok.x + n[0], 0, 100);
            const ny = clamp(tok.y + n[1], 0, 100);
            const inZone = getTokenActiveZone(tok, nx, ny);
            return { ...tok, x: nx, y: ny, zoneId: inZone?.id };
          })
        );
      }
      if (selectedZoneIds.length > 0 && onChangeZones) {
        onChangeZones(
          zones.map(z => {
            if (!selectedZoneIds.includes(z.id)) return z;
            return {
              ...z,
              x: clamp(z.x + n[0], 0, 100),
              y: clamp(z.y + n[1], 0, 100)
            };
          })
        );
      }
    }
  };

  const onKeyUp = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === ' ') setSpaceDown(false);
  };

  const onDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // 1. Double click on a vertex handle deletes that vertex (if > 3 vertices)
    const vtxEl = (e.target as HTMLElement).closest('[data-vertex-handle]') as HTMLElement | null;
    if (vtxEl) {
      e.stopPropagation();
      const zoneId = vtxEl.dataset.zoneId as string;
      const vtxIdx = Number(vtxEl.dataset.vertexIdx);
      deleteVertex(zoneId, vtxIdx);
      return;
    }

    // 2. Double click during polygon drawing closes and finishes polygon
    if (polyDrawMode === 'click' && activePolyPoints.length >= 3) {
      e.stopPropagation();
      finishClickPolygon();
    }
  };

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      handleEscape();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, selectedTokenIds, selectedZoneIds]);

  // ---------- photo upload ----------
  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await compressImageFile(file, { maxDimension: 2000, quality: 0.85 });
      if (result) onChangePhoto(result);
    } catch (err) {
      console.error('Failed to compress map photo:', err);
    }
    e.target.value = '';
  };

  // ---------- rendering styling ----------
  const btn =
    'px-2.5 py-1 rounded-lg border text-[11px] font-mono flex items-center gap-1.5 transition-colors bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white border-neutral-700';
  const iconBtn =
    'p-1.5 rounded-lg border bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border-neutral-700 transition-colors disabled:opacity-40 disabled:pointer-events-none';

  // ---------- toolbar ----------
  const toolbar = (
    <div className="placement-ui flex flex-wrap items-center justify-between gap-2 px-2.5 py-2 bg-neutral-950 border-b border-neutral-800">
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={() => fileInputRef.current?.click()} className={btn} title={t.mapUploadBtn}>
          <Upload className="w-3 h-3" />
          <span>{t.mapUploadBtn}</span>
        </button>
        {photoUrl && onRemovePhoto && (
          <button type="button" onClick={onRemovePhoto} className={btn} title={t.removeMapPhoto}>
            <ImageOff className="w-3 h-3" />
            <span>{t.removeMapPhoto}</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            const next = !tokensEnabled;
            setTokensEnabled(next);
            setTokensVisible(next);
            if (!next) {
              setSelectedTokenIds([]);
              setSelectedZoneIds([]);
            }
          }}
          className={`px-2.5 py-1 rounded-lg border text-[11px] font-mono flex items-center gap-1.5 transition-colors ${
            tokensEnabled
              ? 'bg-neutral-800 text-white border-neutral-600'
              : 'bg-white text-black border-white font-bold'
          }`}
          title={tokensEnabled ? t.markersOn : t.cleanPhoto}
        >
          {tokensEnabled ? <MapPin className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          <span>{tokensEnabled ? t.markersOn : t.cleanPhoto}</span>
        </button>
        {tokens.length > 0 && tokensEnabled && (
          <button
            type="button"
            onClick={() => setTokensVisible(v => !v)}
            className={iconBtn}
            title={tokensVisible ? t.hideMarkers : t.showMarkers}
          >
            {tokensVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>
        )}

        {/* Placement Zones buttons */}
        {onChangeZones && (
          <div className="flex items-center gap-1 pl-1 border-l border-neutral-800">
            <button
              type="button"
              onClick={() => {
                cancelPolyDrawing();
                addZone('circle');
              }}
              className={btn}
              title={t.addCircleZone}
            >
              <Circle className="w-3 h-3 text-neutral-400" />
              <span>{t.addCircleZone}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                cancelPolyDrawing();
                addZone('rect');
              }}
              className={btn}
              title={t.addRectZone}
            >
              <Square className="w-3 h-3 text-neutral-400" />
              <span>{t.addRectZone}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (polyDrawMode === 'click') {
                  cancelPolyDrawing();
                } else {
                  setSelectedTokenIds([]);
                  setSelectedZoneIds([]);
                  setPolyDrawMode('click');
                  setActivePolyPoints([]);
                  setHoverCursorPoint(null);
                }
              }}
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-mono flex items-center gap-1.5 transition-colors ${
                polyDrawMode === 'click'
                  ? 'bg-white text-black font-bold border-white'
                  : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white border-neutral-700'
              }`}
              title={t.addPolygonZone}
            >
              <Pentagon className="w-3 h-3 text-neutral-400" />
              <span>{t.addPolygonZone}</span>
            </button>
          </div>
        )}

        {/* Labels on map toggle button */}
        <button
          type="button"
          onClick={toggleLabels}
          className={`px-2.5 py-1 rounded-lg border text-[11px] font-mono flex items-center gap-1.5 transition-colors ${
            showLabels
              ? 'bg-neutral-800 text-white border-neutral-600'
              : 'bg-neutral-900 text-neutral-400 border-neutral-700'
          }`}
          title={showLabels ? t.labelsOn : t.labelsOff}
        >
          <Tag className="w-3 h-3" />
          <span>{showLabels ? t.labelsOn : t.labelsOff}</span>
        </button>

        {polyDrawMode === 'click' && (
          <div className="flex items-center gap-1.5 pl-1 border-l border-neutral-800">
            <span className="text-[11px] font-mono text-amber-300">
              {activePolyPoints.length === 0
                ? 'Click map to place points'
                : `${activePolyPoints.length} pts`}
            </span>
            {activePolyPoints.length >= 3 && (
              <button
                type="button"
                onClick={finishClickPolygon}
                className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-[10px] font-bold"
              >
                {t.finishPolygon}
              </button>
            )}
            <button
              type="button"
              onClick={cancelPolyDrawing}
              className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-mono text-[10px]"
            >
              {t.cancelPolygon}
            </button>
          </div>
        )}

        {/* Undo and Redo actions */}
        <div className="flex items-center gap-1 pl-1 border-l border-neutral-800">
          <button
            type="button"
            onClick={handleUndo}
            disabled={!canUndo}
            className={iconBtn}
            title={canUndo ? `${t.undo} (Ctrl+Z)` : t.undo}
            aria-label={t.undo}
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={!canRedo}
            className={iconBtn}
            title={canRedo ? `${t.redo} (Ctrl+Shift+Z)` : t.redo}
            aria-label={t.redo}
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setBoxSelectTool(b => !b)}
          className={`${iconBtn} ${boxSelectTool ? '!bg-white !text-black !border-white' : ''}`}
          title={t.selectTool}
          aria-pressed={boxSelectTool}
        >
          <BoxSelect className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => setHandTool(h => !h)}
          className={`${iconBtn} ${handTool ? '!bg-white !text-black !border-white' : ''}`}
          title={t.panTool}
          aria-pressed={handTool}
        >
          <Hand className="w-3.5 h-3.5" />
        </button>

        <button type="button" onClick={() => zoomAt(1 / 1.25)} className={iconBtn} title={t.zoomOut} disabled={view.z <= MIN_ZOOM}>
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <span className="w-11 text-center text-[11px] font-mono text-neutral-300 select-none">
          {Math.round(view.z * 100)}%
        </span>
        <button type="button" onClick={() => zoomAt(1.25)} className={iconBtn} title={t.zoomIn} disabled={view.z >= MAX_ZOOM}>
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={resetView} className={iconBtn} title={t.resetView}>
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className={iconBtn}
          title={expanded ? t.collapseEditor : t.expandEditor}
        >
          {expanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );

  // ---------- render zone ----------
  const renderZone = (zone: PlacementZone, index: number) => {
    const isSelected = selectedZoneIds.includes(zone.id);
    const isResizing = resizingZone?.id === zone.id;
    const curX = isResizing ? resizingZone.x : dragZonePositions[zone.id]?.x ?? zone.x;
    const curY = isResizing ? resizingZone.y : dragZonePositions[zone.id]?.y ?? zone.y;
    const curW = isResizing ? resizingZone.width : zone.width;
    const curH = isResizing ? resizingZone.height : zone.height;

    const color = zone.color || DEFAULT_ZONE_COLOR;
    const opacity = zone.fillOpacity ?? (zone.color && zone.color !== DEFAULT_ZONE_COLOR ? 0.16 : DEFAULT_ZONE_OPACITY);
    const alphaHex = Math.round(opacity * 255).toString(16).padStart(2, '0');

    // 1. Polygon Zone Rendering
    if (zone.type === 'polygon' && zone.points && zone.points.length >= 3) {
      const isThisZoneDragging = (dragPolyPoints && dragPolyPoints.zoneId === zone.id) || Boolean(dragZonePositions[zone.id]);
      let effectivePoints = zone.points;
      if (dragPolyPoints && dragPolyPoints.zoneId === zone.id) {
        effectivePoints = dragPolyPoints.points;
      } else if (dragZonePositions[zone.id]) {
        const dxFrac = (dragZonePositions[zone.id].x - zone.x) / 100;
        const dyFrac = (dragZonePositions[zone.id].y - zone.y) / 100;
        effectivePoints = zone.points.map(pt => ({
          x: clamp(pt.x + dxFrac, 0, 1),
          y: clamp(pt.y + dyFrac, 0, 1)
        }));
      }

      const smoothing = zone.smoothing ?? 0;
      let pts: Point2D[];
      let centroid: Point2D;

      if (!isThisZoneDragging) {
        const cacheKey = `${zone.id}-${smoothing}-${zone.points.map(pt => `${pt.x},${pt.y}`).join(';')}`;
        let cached = polyCacheRef.current.get(zone.id);
        if (!cached || cached.key !== cacheKey) {
          pts = smoothing > 0 ? smoothPolygonPoints(zone.points, smoothing) : zone.points;
          centroid = computePolygonCentroid(zone.points);
          cached = { key: cacheKey, pts, centroid };
          polyCacheRef.current.set(zone.id, cached);
        } else {
          pts = cached.pts;
          centroid = cached.centroid;
        }
      } else {
        pts = smoothing > 0 ? smoothPolygonPoints(effectivePoints, smoothing) : effectivePoints;
        centroid = computePolygonCentroid(effectivePoints);
      }

      const pathD = 'M ' + pts.map(p => `${p.x * 100} ${p.y * 100}`).join(' L ') + ' Z';

      // Clamped centroid position for label
      const tagLeft = clamp(centroid.x * 100, 6, 94);
      const tagTop = clamp(centroid.y * 100, 5, 95);

      return (
        <React.Fragment key={zone.id}>
          {/* SVG Shape Layer */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{ zIndex: 5 + index }}
          >
            <path
              d={pathD}
              data-zone-id={zone.id}
              fill={`${color}${alphaHex}`}
              stroke={color}
              strokeWidth="0.5"
              vectorEffect="non-scaling-stroke"
              strokeDasharray="5,5"
              style={{
                pointerEvents: 'auto',
                cursor: handTool || spaceDown ? 'grab' : 'move',
                transition: 'none',
                filter: isSelected
                  ? 'drop-shadow(0 0 4px rgba(255,255,255,0.4))'
                  : 'drop-shadow(0 0 1px rgba(255,255,255,0.35)) drop-shadow(0 0 1px rgba(0,0,0,0.8))'
              }}
            />
          </svg>

          {/* Centroid Tag (if showLabels is true) */}
          {showLabels && (
            <div
              className="placement-ui absolute px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase text-neutral-200 border pointer-events-none select-none flex items-center gap-1 shadow-md"
              style={{
                left: `${tagLeft}%`,
                top: `${tagTop}%`,
                transform: 'translate(-50%, -50%)',
                backgroundColor: '#171717',
                borderColor: color,
                zIndex: 12 + index,
                transition: 'none'
              }}
            >
              <Pentagon className="w-2.5 h-2.5 text-neutral-400" />
              <span>{zone.label || 'Polygon Zone'}</span>
            </div>
          )}

          {/* Vertex handles and edge insertion points when selected */}
          {isSelected && (
            <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 50 }}>
              {/* Vertex handles */}
              {effectivePoints.map((pt, vIdx) => (
                <div
                  key={`vtx-${vIdx}`}
                  data-vertex-handle="true"
                  data-zone-id={zone.id}
                  data-vertex-idx={vIdx}
                  title="Drag vertex • Double-click to remove"
                  className="placement-ui pointer-events-auto absolute w-3 h-3 bg-white border border-neutral-900 rounded-sm shadow-md cursor-grab active:cursor-grabbing hover:scale-125"
                  style={{
                    left: `${pt.x * 100}%`,
                    top: `${pt.y * 100}%`,
                    transform: 'translate(-50%, -50%)',
                    transition: 'none'
                  }}
                />
              ))}

              {/* Edge midpoint add-vertex handles */}
              {effectivePoints.map((pt, vIdx) => {
                const nextPt = effectivePoints[(vIdx + 1) % effectivePoints.length];
                const midX = (pt.x + nextPt.x) / 2;
                const midY = (pt.y + nextPt.y) / 2;
                return (
                  <button
                    key={`edge-mid-${vIdx}`}
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      insertVertex(zone.id, vIdx, { x: midX, y: midY });
                    }}
                    title="Click to add vertex on this edge"
                    className="placement-ui pointer-events-auto absolute w-2 h-2 rounded-full bg-neutral-400 hover:bg-white border border-black hover:scale-125 cursor-pointer"
                    style={{
                      left: `${midX * 100}%`,
                      top: `${midY * 100}%`,
                      transform: 'translate(-50%, -50%)',
                      transition: 'none'
                    }}
                  />
                );
              })}
            </div>
          )}
        </React.Fragment>
      );
    }

    // 2. Circle or Rect Zone Rendering
    const widthStyle = `${curW}%`;
    const heightStyle = zone.type === 'circle' ? `calc(${curW}% * ${ar})` : `${curH}%`;
    const labelInZone = curY - curH / 2 < 6;

    return (
      <div
        key={zone.id}
        data-zone-id={zone.id}
        style={{
          position: 'absolute',
          left: `${curX}%`,
          top: `${curY}%`,
          width: widthStyle,
          height: heightStyle,
          transform: 'translate(-50%, -50%)',
          borderRadius: zone.type === 'circle' ? '9999px' : '10px',
          backgroundColor: `${color}${alphaHex}`,
          border: `2px dashed ${color}`,
          boxShadow: isSelected
            ? '0 0 0 2px #ffffff, 0 0 15px rgba(255,255,255,0.3), inset 0 0 20px rgba(0,0,0,0.4)'
            : '0 0 0 1px rgba(255,255,255,0.25), 0 0 0 2px rgba(0,0,0,0.65), inset 0 0 12px rgba(0,0,0,0.4)',
          zIndex: 5 + index,
          cursor: handTool || spaceDown ? 'grab' : 'move',
          touchAction: 'none'
        }}
      >
        {showLabels && (
          <div
            className={`placement-ui absolute ${labelInZone ? 'top-2' : '-top-3'} left-3 px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase text-neutral-200 border pointer-events-none select-none flex items-center gap-1 shadow-md`}
            style={{
              backgroundColor: '#171717',
              borderColor: color
            }}
          >
            {zone.type === 'circle' ? <Circle className="w-2.5 h-2.5 text-neutral-400" /> : <Square className="w-2.5 h-2.5 text-neutral-400" />}
            <span>{zone.label || (zone.type === 'circle' ? 'Circle Zone' : 'Placement Zone')}</span>
          </div>
        )}

        {isSelected && (
          <>
            {(['nw', 'ne', 'se', 'sw'] as const).map(h => {
              const posStyles = {
                nw: { top: -5, left: -5, cursor: 'nwse-resize' },
                ne: { top: -5, right: -5, cursor: 'nesw-resize' },
                se: { bottom: -5, right: -5, cursor: 'nwse-resize' },
                sw: { bottom: -5, left: -5, cursor: 'nesw-resize' }
              }[h];
              return (
                <div
                  key={h}
                  data-zone-handle={h}
                  data-zone-id={zone.id}
                  className="placement-ui absolute w-3 h-3 bg-white border border-black rounded-sm shadow-md transition-transform hover:scale-125 z-50"
                  style={posStyles}
                />
              );
            })}
          </>
        )}
      </div>
    );
  };

  // ---------- render token ----------
  const renderToken = (token: PlacedMapToken, index: number) => {
    const isSelected = selectedTokenIds.includes(token.id);
    const pos = dragTokenPositions[token.id] || token;

    const activeZone = getTokenActiveZone(token, pos.x, pos.y);
    const inZone = Boolean(activeZone);

    const color = inZone ? '#9ca3af' : token.color || '#ffffff';
    const d = Math.max(8, baseDiameter * (token.size ?? 1));
    const border = Math.max(1.5, d * 0.07);
    const isDragging = Boolean(dragTokenPositions[token.id]);

    return (
      <div
        key={token.id}
        data-token-id={token.id}
        title={inZone ? `${token.towerName || 'Tower'} (${t.zoneActiveBadge}: ${activeZone?.label || 'Zone'})` : token.towerName || token.label}
        style={{
          position: 'absolute',
          left: `${pos.x}%`,
          top: `${pos.y}%`,
          width: d,
          height: d,
          transform: 'translate(-50%, -50%)',
          borderRadius: '9999px',
          zIndex: isSelected ? 40 : 15 + index,
          touchAction: 'none',
          cursor: handTool || spaceDown ? 'grab' : isDragging ? 'grabbing' : 'grab'
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '9999px',
            border: `${border}px solid ${color}`,
            backgroundColor: inZone
              ? 'rgba(156, 163, 175, 0.32)'
              : `${color.length === 7 ? color : '#ffffff'}2e`,
            boxShadow: inZone
              ? '0 0 0 1px rgba(0,0,0,0.7), inset 0 0 4px rgba(0,0,0,0.5)'
              : '0 0 0 1px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(0,0,0,0.4)',
            pointerEvents: 'none'
          }}
        />

        {token.towerImage ? (
          <img
            src={token.towerImage}
            alt=""
            draggable={false}
            style={{
              position: 'absolute',
              inset: border + d * 0.03,
              width: `calc(100% - ${2 * (border + d * 0.03)}px)`,
              height: `calc(100% - ${2 * (border + d * 0.03)}px)`,
              objectFit: 'contain',
              pointerEvents: 'none',
              userSelect: 'none',
              filter: inZone ? 'grayscale(100%) contrast(1.15) brightness(0.92)' : 'none',
              transition: 'filter 0.15s ease'
            }}
          />
        ) : (
          <span
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color,
              fontWeight: 700,
              fontSize: d * 0.34,
              pointerEvents: 'none',
              filter: inZone ? 'grayscale(100%)' : 'none'
            }}
          >
            {token.label}
          </span>
        )}

        {isSelected && (
          <div
            className="placement-ui"
            style={{
              position: 'absolute',
              inset: -Math.max(4, d * 0.12),
              borderRadius: '9999px',
              border: '2px dashed #ffffff',
              boxShadow: '0 0 0 1px rgba(0,0,0,0.8), 0 0 10px rgba(255,255,255,0.4)',
              pointerEvents: 'none'
            }}
          />
        )}
      </div>
    );
  };

  const tokenBadges = React.useMemo(() => {
    if (!showLabels || !tokensEnabled || !tokensVisible || tokens.length === 0) return [];
    return calculateTokenBadgePositions(
      tokens,
      zones,
      geom.sw,
      geom.sh,
      ar,
      Math.max(10, Math.round(geom.sw * 0.012))
    );
  }, [showLabels, tokensEnabled, tokensVisible, tokens, zones, geom.sw, geom.sh, ar]);

  const cursor = panning
    ? 'grabbing'
    : handTool || spaceDown
    ? 'grab'
    : boxSelectTool
    ? 'crosshair'
    : view.z > 1
    ? 'default'
    : tokensEnabled && towerUrl
    ? 'crosshair'
    : 'default';

  // ---------- viewport ----------
  const viewport = (
    <div
      ref={setVpEl}
      tabIndex={0}
      role="application"
      aria-label="Placement map editor"
      data-drop-target-id={canvasId}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerEnter={() => {
        isMouseOverCanvasRef.current = true;
      }}
      onPointerLeave={() => {
        isMouseOverCanvasRef.current = false;
        cursorMapPercentRef.current = null;
      }}
      onPointerUp={e => endDrag(e, false)}
      onPointerCancel={e => endDrag(e, true)}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onBlur={() => setSpaceDown(false)}
      onDragStart={e => e.preventDefault()}
      onContextMenu={e => {
        if (panning) e.preventDefault();
      }}
      className={`placement-viewport relative w-full overflow-hidden select-none bg-neutral-950 outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
        expanded ? 'flex-1 min-h-0' : ''
      } ${
        isDropTargetActive
          ? 'ring-2 ring-white/80 shadow-[0_0_30px_rgba(255,255,255,0.25)]'
          : ''
      }`}
      style={{
        ...(expanded ? {} : { aspectRatio: String(ar) }),
        cursor,
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: view.z > 1 || expanded || handTool ? 'none' : 'pan-y'
      }}
    >
      {vp.w > 0 && (
        <div
          ref={stageRef}
          className="placement-stage absolute"
          style={{
            left: geom.ox,
            top: geom.oy,
            width: geom.sw,
            height: geom.sh,
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})`,
            transformOrigin: '0 0',
            willChange:
              panning ||
              Object.keys(dragTokenPositions).length > 0 ||
              Object.keys(dragZonePositions).length > 0 ||
              dragPolyPoints !== null ||
              marqueeBox
                ? 'transform'
                : undefined
          }}
        >
          {photoUrl ? (
            <img
              src={photoUrl}
              alt="Placement Map"
              draggable={false}
              onLoad={e => {
                const img = e.currentTarget;
                if (img.naturalWidth && img.naturalHeight) {
                  setNaturalAr({ url: photoUrl, ar: img.naturalWidth / img.naturalHeight });
                }
              }}
              className="absolute inset-0 w-full h-full pointer-events-none select-none"
              style={{ objectFit: 'fill' }}
            />
          ) : (
            <div className="placement-ui absolute inset-0 flex flex-col items-center justify-center text-center space-y-2.5 pointer-events-none">
              <div className="w-14 h-14 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center">
                <MapPin className="w-7 h-7 text-neutral-500" />
              </div>
              <span className="text-xs font-mono text-neutral-500 px-4">{t.mapEmptyHint}</span>
            </div>
          )}

          {/* Zones rendered under towers */}
          {zones.map(renderZone)}

          {/* Towers */}
          {tokensEnabled && tokensVisible && tokens.map(renderToken)}

          {/* Active Polygon Drawing Preview */}
          {polyDrawMode === 'click' && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ zIndex: 60 }}
              viewBox={`0 0 ${geom.sw} ${geom.sh}`}
            >
              {activePolyPoints.length > 1 && (
                <polyline
                  points={activePolyPoints.map(p => `${p.x * geom.sw},${p.y * geom.sh}`).join(' ')}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2"
                  strokeDasharray="4,4"
                />
              )}
              {activePolyPoints.length > 0 && hoverCursorPoint && (
                <line
                  x1={activePolyPoints[activePolyPoints.length - 1].x * geom.sw}
                  y1={activePolyPoints[activePolyPoints.length - 1].y * geom.sh}
                  x2={hoverCursorPoint.x * geom.sw}
                  y2={hoverCursorPoint.y * geom.sh}
                  stroke="#fbbf24"
                  strokeWidth="2"
                  strokeDasharray="3,3"
                />
              )}
              {activePolyPoints.map((p, idx) => (
                <circle
                  key={idx}
                  cx={p.x * geom.sw}
                  cy={p.y * geom.sh}
                  r={idx === 0 ? 6 : 4}
                  fill={idx === 0 ? '#22c55e' : '#ffffff'}
                  stroke="#000000"
                  strokeWidth="2"
                />
              ))}
            </svg>
          )}

          {/* Token Badges (smart layout matching exported image) */}
          {tokenBadges.map(b => (
            <div
              key={`badge-${b.id}`}
              className="placement-ui absolute pointer-events-none select-none px-1.5 py-0.5 rounded-full border font-mono font-bold tracking-wide flex items-center justify-center shadow-md"
              style={{
                left: b.bx,
                top: b.by,
                transform: 'translate(-50%, -50%)',
                backgroundColor: '#09090b',
                borderColor: b.color,
                color: '#ffffff',
                fontSize: `${Math.max(9, Math.round(geom.sw * 0.012))}px`,
                lineHeight: 1,
                zIndex: 42
              }}
            >
              {b.text}
            </div>
          ))}

          {/* Rubber band / Marquee selection box */}
          {marqueeBox && (
            <div
              className="placement-ui absolute border-2 border-dashed border-sky-400 bg-sky-500/20 pointer-events-none shadow-sm"
              style={{
                left: `${marqueeBox.x1}%`,
                top: `${marqueeBox.y1}%`,
                width: `${marqueeBox.x2 - marqueeBox.x1}%`,
                height: `${marqueeBox.y2 - marqueeBox.y1}%`,
                borderRadius: '4px',
                zIndex: 100
              }}
            />
          )}

          {/* Drag over canvas indicator */}
          {isDropTargetActive && draggingAsset && (
            <div className="placement-ui absolute inset-0 pointer-events-none border-2 border-white/60 bg-white/5 flex items-center justify-center">
              <div className="px-3 py-1.5 rounded-xl bg-black/80 border border-white/40 text-xs font-mono text-white flex items-center gap-1.5 shadow-xl">
                {draggingAsset.category === 'towers' ? (
                  <span>Release to place {draggingAsset.name}</span>
                ) : (
                  <span>Release to set {draggingAsset.name} as map</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const SIZE_PRESETS = [0.25, 0.5, 0.75, 1.0, 1.5, 2.0];

  // ---------- statusBar / Inspector ----------
  const statusBar = (
    <div className="placement-ui px-2.5 py-2 bg-neutral-900 border-t border-neutral-800 text-xs min-h-[3rem] flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      {/* 1. Zone Selected */}
      {primarySelectedZone && selectedZoneIds.length === 1 && selectedTokenIds.length === 0 ? (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-neutral-800 text-white font-mono font-bold text-[11px] border border-neutral-700 flex items-center gap-1.5">
                {primarySelectedZone.type === 'circle' ? (
                  <Circle className="w-3 h-3 text-neutral-400" />
                ) : primarySelectedZone.type === 'polygon' ? (
                  <Pentagon className="w-3 h-3 text-neutral-400" />
                ) : (
                  <Square className="w-3 h-3 text-neutral-400" />
                )}
                {t.zoneLabel}
              </span>
              <input
                type="text"
                value={primarySelectedZone.label || ''}
                onChange={e => updateZone(primarySelectedZone.id, { label: e.target.value })}
                placeholder="Zone label (e.g. Cliff A)"
                className="bg-neutral-950 border border-neutral-700 text-white px-2 py-0.5 rounded text-xs font-mono focus:outline-none focus:border-white w-32"
              />
            </div>

            <div className="flex items-center gap-1 bg-neutral-950 p-0.5 rounded-lg border border-neutral-800">
              <button
                type="button"
                onClick={() => updateZone(primarySelectedZone.id, { type: 'circle' })}
                className={`px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 transition-colors ${
                  primarySelectedZone.type === 'circle' ? 'bg-white text-black font-bold' : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Circle className="w-2.5 h-2.5" />
                <span>{t.zoneCircle}</span>
              </button>
              <button
                type="button"
                onClick={() => updateZone(primarySelectedZone.id, { type: 'rect' })}
                className={`px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 transition-colors ${
                  primarySelectedZone.type === 'rect' ? 'bg-white text-black font-bold' : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Square className="w-2.5 h-2.5" />
                <span>{t.zoneRect}</span>
              </button>
              {primarySelectedZone.type === 'polygon' && (
                <div className="px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 bg-white text-black font-bold">
                  <Pentagon className="w-2.5 h-2.5" />
                  <span>{t.zonePolygon}</span>
                </div>
              )}
            </div>

            {/* Smoothing slider for polygon zones */}
            {primarySelectedZone.type === 'polygon' && (
              <div className="flex items-center gap-2 pl-2 border-l border-neutral-800">
                <Sliders className="w-3 h-3 text-neutral-400" />
                <span className="text-[11px] font-mono text-neutral-400">
                  {t.smoothingLabel}: {Math.round((primarySelectedZone.smoothing ?? 0) * 100)}%
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={Math.round((primarySelectedZone.smoothing ?? 0) * 100)}
                  onChange={e =>
                    updateZone(primarySelectedZone.id, {
                      smoothing: Number(e.target.value) / 100
                    })
                  }
                  className="w-24 accent-white cursor-pointer"
                  title="Corner smoothing percentage (Chaikin curve)"
                />
              </div>
            )}

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-mono text-neutral-400">Tone</span>
              {ZONE_GRAY_SHADES.map(s => (
                <button
                  key={s.hex}
                  type="button"
                  onClick={() => updateZone(primarySelectedZone.id, { color: s.hex })}
                  className={`w-4 h-4 rounded-full border transition-transform ${
                    (primarySelectedZone.color || DEFAULT_ZONE_COLOR).toLowerCase() === s.hex.toLowerCase()
                      ? 'border-white scale-125 ring-2 ring-white/50'
                      : 'border-neutral-600 hover:scale-110'
                  }`}
                  style={{ backgroundColor: s.hex }}
                  title={s.label}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => removeZone(primarySelectedZone.id)}
              className={`${btn} hover:!text-red-400`}
              title={t.deleteZone}
            >
              <Trash2 className="w-3 h-3" />
              <span>{t.deleteZone}</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedZoneIds([])}
              className={iconBtn}
              title={t.deselectMarker}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </>
      ) : totalSelectedCount > 1 ? (
        /* 2. Multi-selection Bar */
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-white text-black font-mono font-bold text-[11px]">
                {totalSelectedCount} selected
              </span>
              <span className="text-neutral-400 font-mono text-xs">
                ({selectedTokenIds.length} towers, {selectedZoneIds.length} zones)
              </span>
            </div>

            {selectedTokenIds.length > 0 && (
              <div className="flex items-center gap-1.5 pl-2 border-l border-neutral-800">
                <span className="text-[11px] font-mono text-neutral-400">{t.markerSizeLabel}</span>
                {SIZE_PRESETS.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      lastSizeRef.current = p;
                      updateAllSelectedTokens({ size: p });
                    }}
                    className="px-1.5 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 text-[10px] font-mono"
                  >
                    {Math.round(p * 100)}%
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={removeSelectedObjects}
              className={`${btn} hover:!text-red-400`}
              title={t.deleteSelected}
            >
              <Trash2 className="w-3 h-3" />
              <span>{t.deleteMarker}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedTokenIds([]);
                setSelectedZoneIds([]);
              }}
              className={iconBtn}
              title={t.deselectMarker}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </>
      ) : primarySelectedToken && tokensEnabled ? (
        /* 3. Single Token Selected */
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-2 min-w-0">
              {primarySelectedToken.towerImage && (
                <img
                  src={primarySelectedToken.towerImage}
                  alt=""
                  className="w-7 h-7 object-contain shrink-0"
                  draggable={false}
                  style={
                    primarySelectedToken.zoneId ||
                    getTokenActiveZone(primarySelectedToken, primarySelectedToken.x, primarySelectedToken.y)
                      ? { filter: 'grayscale(100%)' }
                      : undefined
                  }
                />
              )}
              <span className="font-mono font-bold text-white truncate max-w-[10rem]">
                {primarySelectedToken.towerName || primarySelectedToken.label}
              </span>
              {(primarySelectedToken.zoneId ||
                getTokenActiveZone(primarySelectedToken, primarySelectedToken.x, primarySelectedToken.y)) && (
                <span className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700 font-mono text-[9px] uppercase tracking-wide">
                  {t.zoneActiveBadge}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-mono text-neutral-400">{t.markerOutlineLabel}</span>
              {PLACEMENT_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    lastColorRef.current = c;
                    updateToken(primarySelectedToken.id, { color: c });
                  }}
                  className={`w-5 h-5 rounded-full border-2 transition-transform ${
                    (primarySelectedToken.color || '#ffffff').toLowerCase() === c.toLowerCase()
                      ? 'border-white scale-110'
                      : 'border-neutral-700 hover:scale-110'
                  }`}
                  style={{ backgroundColor: c }}
                  title={c}
                  aria-label={`${t.markerOutlineLabel} ${c}`}
                />
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-mono text-neutral-400">{t.markerSizeLabel}</span>
              <button
                type="button"
                className={iconBtn}
                onClick={() => {
                  const s = clamp(Math.round(((primarySelectedToken.size ?? 1) - 0.05) * 100) / 100, 0.2, 3);
                  lastSizeRef.current = s;
                  updateToken(primarySelectedToken.id, { size: s });
                }}
              >
                <Minus className="w-3 h-3" />
              </button>
              <input
                type="range"
                min={0.2}
                max={3}
                step={0.05}
                value={primarySelectedToken.size ?? 1}
                onChange={e => {
                  const s = Number(e.target.value);
                  lastSizeRef.current = s;
                  updateToken(primarySelectedToken.id, { size: s });
                }}
                className="w-20 accent-white"
              />
              <button
                type="button"
                className={iconBtn}
                onClick={() => {
                  const s = clamp(Math.round(((primarySelectedToken.size ?? 1) + 0.05) * 100) / 100, 0.2, 3);
                  lastSizeRef.current = s;
                  updateToken(primarySelectedToken.id, { size: s });
                }}
              >
                <Plus className="w-3 h-3" />
              </button>

              <div className="flex items-center bg-neutral-950 border border-neutral-700 rounded px-1.5 py-0.5">
                <input
                  type="number"
                  min={20}
                  max={300}
                  step={5}
                  value={Math.round((primarySelectedToken.size ?? 1) * 100)}
                  onChange={e => {
                    const pct = Number(e.target.value);
                    if (!isNaN(pct) && pct >= 15 && pct <= 350) {
                      const s = Math.round((pct / 100) * 100) / 100;
                      lastSizeRef.current = s;
                      updateToken(primarySelectedToken.id, { size: s });
                    }
                  }}
                  className="w-8 text-right bg-transparent text-white font-mono text-[11px] focus:outline-none"
                />
                <span className="text-neutral-400 font-mono text-[11px] ml-0.5">%</span>
              </div>

              <div className="hidden sm:flex items-center gap-1 pl-1">
                {SIZE_PRESETS.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      lastSizeRef.current = p;
                      updateToken(primarySelectedToken.id, { size: p });
                    }}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition-colors ${
                      Math.abs((primarySelectedToken.size ?? 1) - p) < 0.03
                        ? 'bg-white text-black font-bold border-white'
                        : 'bg-neutral-800 text-neutral-300 hover:text-white border-neutral-700'
                    }`}
                  >
                    {Math.round(p * 100)}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={removeSelectedObjects}
              className={`${btn} hover:!text-red-400`}
              title={t.deleteMarker}
            >
              <Trash2 className="w-3 h-3" />
              <span>{t.deleteMarker}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedTokenIds([]);
                setSelectedZoneIds([]);
              }}
              className={iconBtn}
              title={t.deselectMarker}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </>
      ) : (
        /* 4. Default hint */
        <div className="flex items-center gap-2">
          <span className="font-mono text-neutral-400">
            {!tokensEnabled || !tokensVisible
              ? t.placeHintHidden
              : towerUrl
              ? `${t.placeHintReady}: ${selectedAssetName ?? ''}`
              : t.placeHintNoTower}
          </span>
          <span className="hidden md:inline-block text-[11px] text-neutral-500 font-mono pl-2 border-l border-neutral-800">
            Drag towers/maps from sidebar or loadout bar to drop • Drag box to select • Space+Drag to pan
          </span>
        </div>
      )}
    </div>
  );

  const editor = (
    <div
      className={`relative border-neutral-700 bg-neutral-950 ${
        expanded
          ? 'w-full h-full min-w-0 max-w-[1800px] flex flex-col rounded-2xl border-2 overflow-hidden shadow-2xl'
          : 'rounded-2xl overflow-hidden border-2 shadow-2xl'
      }`}
    >
      {toolbar}
      {viewport}
      {loadoutSlots && loadoutSlots.length > 0 && (
        <LoadoutDock slots={loadoutSlots} playerLabel={loadoutPlayerLabel} />
      )}
      {statusBar}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUploadPhoto} />
    </div>
  );

  if (expanded) {
    return createPortal(
      <div className="placement-ui placement-expanded-layer rounded-3xl bg-black/85 backdrop-blur-sm flex items-stretch justify-center p-2 sm:p-3">
        {editor}
      </div>,
      document.body
    );
  }
  return editor;
};
