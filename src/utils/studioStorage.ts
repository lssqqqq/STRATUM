import { CustomDocTemplate } from '../types/customDoc';
import { getInitialCustomDoc } from '../data/initialCustomDoc';
import { isMapAssetUrl } from '../data/tdsPhotoAssets';
import { Language } from '../i18n/translations';

/** Current storage key. v3 is the legacy key that is migrated (read-only) on first load. */
export const STORAGE_KEY_STUDIO_DOC = 'tds_studio_doc_template_v4';
const LEGACY_STORAGE_KEY_STUDIO_DOC = 'tds_studio_doc_template_v3';
const STORAGE_KEY_STUDIO_UI = 'tds_studio_ui_v1';

// ---------- IndexedDB Storage Engine ----------
const IDB_NAME = 'stratum_studio_db';
const IDB_VERSION = 1;
const IDB_STORE = 'studio_documents';
const IDB_KEY = 'current_doc';

let cachedDbPromise: Promise<IDBDatabase> | null = null;

function openStudioDb(): Promise<IDBDatabase> {
  if (cachedDbPromise) return cachedDbPromise;

  cachedDbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB is not supported'));
    }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      cachedDbPromise = null;
      reject(req.error || new Error('Failed to open IndexedDB'));
    };
  });

  return cachedDbPromise;
}

export async function getDocFromIdb(): Promise<CustomDocTemplate | null> {
  try {
    const db = await openStudioDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(IDB_KEY);
      req.onsuccess = () => resolve((req.result as CustomDocTemplate) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Read failed:', err);
    return null;
  }
}

export async function putDocToIdb(doc: CustomDocTemplate): Promise<boolean> {
  try {
    const db = await openStudioDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const req = store.put(doc, IDB_KEY);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Write failed:', err);
    return false;
  }
}

/** Request storage persistence silently on launch */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
      return await navigator.storage.persist();
    }
  } catch {}
  return false;
}

/** Get storage usage estimate in MB */
export async function getStorageEstimate(): Promise<{ usageMb: number; quotaMb: number; percent: number } | null> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      const est = await navigator.storage.estimate();
      const usage = est.usage || 0;
      const quota = est.quota || 0;
      if (quota > 0) {
        return {
          usageMb: Number((usage / (1024 * 1024)).toFixed(1)),
          quotaMb: Number((quota / (1024 * 1024)).toFixed(0)),
          percent: Math.min(100, Math.round((usage / quota) * 100))
        };
      }
    }
  } catch {}
  return null;
}

/** Tower names/images that older versions pre-filled into every new strategy. */
const LEGACY_DEFAULT_LOADOUT: Record<string, string> = {
  s1: 'Accelerator',
  s2: 'Commander',
  s3: 'DJ Booth',
  s4: 'Farm',
  s5: 'Minigunner',
  s6: 'Ranger',
  s7: 'Golden Scout',
  s8: 'Brawler',
  s9: 'Medic',
  s10: 'Warden'
};
const LEGACY_DEFAULT_PLAYER_TOWERS: Record<string, string> = {
  pt1: 'Accelerator',
  pt2: 'Commander',
  pt3: 'DJ Booth',
  pt4: 'Farm',
  pt5: 'Minigunner',
  pt6: 'Ranger',
  pt7: 'Golden Scout',
  pt8: 'Brawler',
  pt9: 'Medic',
  pt10: 'Warden'
};

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Fills fields that are missing from a stored document with the defaults, WITHOUT touching anything
 * the user already has (arrays such as players, towers and tokens are kept exactly as saved).
 */
const fillMissing = <T,>(saved: unknown, defaults: T): T => {
  if (Array.isArray(defaults)) return (Array.isArray(saved) ? saved : defaults) as unknown as T;
  if (isPlainObject(defaults)) {
    const src = isPlainObject(saved) ? saved : {};
    const out: Record<string, unknown> = { ...src };
    for (const key of Object.keys(defaults)) {
      out[key] = key in src ? fillMissing(src[key], (defaults as Record<string, unknown>)[key]) : (defaults as Record<string, unknown>)[key];
    }
    return out as T;
  }
  return (saved === undefined || saved === null ? defaults : saved) as T;
};

/** True when every hero slot of a legacy document is still exactly the old pre-filled default. */
const isUntouchedLegacyTowerSet = (doc: CustomDocTemplate): boolean => {
  const rows = doc.tab2?.loadoutRows ?? [];
  const players = doc.tab2?.players ?? [];
  const slots = rows.flatMap(r => r.slots);
  const towers = players.flatMap(p => p.towers);
  if (slots.length === 0 && towers.length === 0) return false;
  const slotsPristine = slots.every(s => LEGACY_DEFAULT_LOADOUT[s.id] === s.name);
  const towersPristine = towers.every(t => LEGACY_DEFAULT_PLAYER_TOWERS[t.id] === t.name);
  return slotsPristine && towersPristine;
};

const clearHeroSlots = (doc: CustomDocTemplate): CustomDocTemplate => ({
  ...doc,
  tab2: {
    ...doc.tab2,
    loadoutRows: doc.tab2.loadoutRows.map(r => ({ ...r, slots: r.slots.map(s => ({ ...s, name: '', image: '' })) })),
    players: doc.tab2.players.map(p => ({ ...p, towers: p.towers.map(t => ({ ...t, name: '', image: '' })) }))
  }
});

/** A map image must never live in a hero (tower) slot. Everything else is left as the user saved it. */
const stripMapsFromHeroSlots = (doc: CustomDocTemplate): CustomDocTemplate => ({
  ...doc,
  tab2: {
    ...doc.tab2,
    loadoutRows: (doc.tab2.loadoutRows ?? []).map(r => ({
      ...r,
      slots: (r.slots ?? []).map(s => (isMapAssetUrl(s.image) ? { ...s, name: '', image: '' } : s))
    })),
    players: (doc.tab2.players ?? []).map(p => ({
      ...p,
      towers: (p.towers ?? []).map(t => (isMapAssetUrl(t.image) ? { ...t, name: '', image: '' } : t))
    }))
  }
});

const readJson = (key: string): unknown => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error(`Failed to read "${key}" from storage:`, e);
    return null;
  }
};

const looksLikeDoc = (v: unknown): v is CustomDocTemplate => isPlainObject(v) && isPlainObject(v.tab1) && isPlainObject(v.tab2);

/** Migrates legacy note rows with label/content into bullet list items with text */
export const migrateLegacyNotesRows = (rows: any[] | undefined): { id: string; text: string }[] => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [{ id: `nr-${Date.now()}`, text: '' }];
  }

  const migrated: { id: string; text: string }[] = [];

  for (const row of rows) {
    if (!row) continue;
    if (typeof row.text === 'string') {
      migrated.push({ id: row.id || `nr-${Date.now()}-${Math.random()}`, text: row.text });
      continue;
    }
    const label = (row.label ?? '').trim();
    const content = (row.content ?? '').trim();

    const validLabel = label && label.toLowerCase() !== 'title' ? label : '';
    const validContent = content && content !== '-' && content.toLowerCase() !== 'write here...' ? content : '';

    if (validLabel && validContent) {
      migrated.push({ id: row.id || `nr-${Date.now()}-${Math.random()}`, text: `${validLabel}: ${validContent}` });
    } else if (validContent) {
      migrated.push({ id: row.id || `nr-${Date.now()}-${Math.random()}`, text: validContent });
    } else if (validLabel) {
      migrated.push({ id: row.id || `nr-${Date.now()}-${Math.random()}`, text: validLabel });
    }
  }

  return migrated.length > 0 ? migrated : [{ id: `nr-${Date.now()}`, text: '' }];
};

const normalizeNotes = (doc: CustomDocTemplate): CustomDocTemplate => ({
  ...doc,
  tab1: {
    ...doc.tab1,
    notesRows: migrateLegacyNotesRows(doc.tab1?.notesRows)
  },
  tab2: {
    ...doc.tab2,
    topNotesRows: migrateLegacyNotesRows(doc.tab2?.topNotesRows)
  }
});

const normalizePlayerTitles = (doc: CustomDocTemplate): CustomDocTemplate => {
  if (!doc.tab2) return doc;
  const loadoutRows = (doc.tab2.loadoutRows ?? []).map((row, idx) => ({
    ...row,
    playerTitle: (row.playerTitle && row.playerTitle.trim()) ? row.playerTitle : `Player ${idx + 1}`
  }));
  const players = (doc.tab2.players ?? []).map((p, idx) => ({
    ...p,
    playerTitle: (p.playerTitle && p.playerTitle.trim()) ? p.playerTitle : `PLAYER ${idx + 1}`
  }));
  return {
    ...doc,
    tab2: {
      ...doc.tab2,
      loadoutRows: loadoutRows.length > 0 ? loadoutRows : [
        {
          id: 'lr1',
          playerTitle: 'Player 1',
          slots: Array.from({ length: 5 }, (_, k) => ({ id: `s1-${k + 1}`, name: '', image: '' }))
        }
      ],
      players: players.length > 0 ? players : [
        {
          id: 'p1',
          playerTitle: 'PLAYER 1',
          difficultyBadge: 'Difficulty: Normal',
          towers: Array.from({ length: 5 }, (_, k) => ({ id: `pt1-${k + 1}`, name: '', image: '' })),
          mapPhoto: '',
          tokens: [],
          zones: [],
          hideMapLabels: true,
          notes: '',
          waveRows: [{ wave: '', instructions: '' }, { wave: '', instructions: '' }]
        }
      ]
    }
  };
};

/**
 * Synchronizes loaded Loadouts with corresponding players in Strategies.
 */
export const syncLoadoutsToStrategies = (doc: CustomDocTemplate): CustomDocTemplate => {
  if (!doc.tab2?.loadoutRows || !doc.tab2?.players) return doc;

  let changed = false;
  const newPlayers = doc.tab2.players.map((player, pIdx) => {
    const pDigits = player.playerTitle.match(/\d+/);
    const lRow = pDigits
      ? doc.tab2.loadoutRows.find(r => {
          const rDigits = r.playerTitle.match(/\d+/);
          return rDigits && rDigits[0] === pDigits[0];
        })
      : doc.tab2.loadoutRows[pIdx];

    if (!lRow) return player;

    const currentTowers = [...player.towers];
    while (currentTowers.length < 5) {
      currentTowers.push({
        id: `pt-${player.id}-${currentTowers.length + 1}-${Date.now()}`,
        name: '',
        image: ''
      });
      changed = true;
    }

    let towersChanged = false;
    const updatedTowers = currentTowers.slice(0, 5).map((tw, tIdx) => {
      const slot = lRow.slots[tIdx];
      if (!tw.image && !tw.name && slot && (slot.image || slot.name)) {
        towersChanged = true;
        return {
          ...tw,
          name: slot.name || '',
          image: slot.image || ''
        };
      }
      return tw;
    });

    if (towersChanged) {
      changed = true;
      return { ...player, towers: updatedTowers };
    }
    return player;
  });

  return changed ? { ...doc, tab2: { ...doc.tab2, players: newPlayers } } : doc;
};

const applyDefaultPortrait = (doc: CustomDocTemplate): CustomDocTemplate => {
  try {
    const explicit = localStorage.getItem('tds_orientation_explicit_v1');
    if (!explicit && doc.canvasSettings) {
      doc.canvasSettings.orientation = 'portrait';
    }
  } catch {}
  return doc;
};

/**
 * Asynchronously loads the latest saved Strategy Studio document.
 * 1. Checks IndexedDB first.
 * 2. If absent from IndexedDB, checks localStorage (v4 and legacy v3).
 *    Migrates to IndexedDB, awaits success, and only then cleans up localStorage.
 * 3. Falls back safely without data loss.
 */
export async function loadStudioDocAsync(lang?: Language): Promise<{ doc: CustomDocTemplate; isFallback: boolean }> {
  const defaults = getInitialCustomDoc(lang);

  // Silently request persistent storage
  requestPersistentStorage();

  // 1. Try reading from IndexedDB
  try {
    const idbDoc = await getDocFromIdb();
    if (looksLikeDoc(idbDoc)) {
      return {
        doc: normalizePlayerTitles(syncLoadoutsToStrategies(normalizeNotes(applyDefaultPortrait(stripMapsFromHeroSlots(fillMissing(idbDoc, defaults)))))),
        isFallback: false
      };
    }
  } catch (err) {
    console.warn('[StudioStorage] Failed reading from IndexedDB, checking localStorage fallback:', err);
  }

  // 2. Migration: Check localStorage (v4 and legacy v3)
  const currentLocal = readJson(STORAGE_KEY_STUDIO_DOC);
  if (looksLikeDoc(currentLocal)) {
    const normalized = normalizePlayerTitles(syncLoadoutsToStrategies(normalizeNotes(applyDefaultPortrait(stripMapsFromHeroSlots(fillMissing(currentLocal, defaults))))));
    const ok = await putDocToIdb(normalized);
    if (ok) {
      // Safe to clean up localStorage once confirmed written in IndexedDB
      try {
        localStorage.removeItem(STORAGE_KEY_STUDIO_DOC);
        localStorage.removeItem(LEGACY_STORAGE_KEY_STUDIO_DOC);
      } catch {}
    }
    return { doc: normalized, isFallback: !ok };
  }

  const legacyLocal = readJson(LEGACY_STORAGE_KEY_STUDIO_DOC);
  if (looksLikeDoc(legacyLocal)) {
    let migrated = stripMapsFromHeroSlots(fillMissing(legacyLocal, defaults));
    if (isUntouchedLegacyTowerSet(migrated)) migrated = clearHeroSlots(migrated);
    migrated = normalizePlayerTitles(syncLoadoutsToStrategies(normalizeNotes(applyDefaultPortrait(migrated))));
    const ok = await putDocToIdb(migrated);
    if (ok) {
      try {
        localStorage.removeItem(LEGACY_STORAGE_KEY_STUDIO_DOC);
        localStorage.removeItem(STORAGE_KEY_STUDIO_DOC);
      } catch {}
    }
    return { doc: migrated, isFallback: !ok };
  }

  return { doc: defaults, isFallback: false };
}

/**
 * Synchronous load helper (fallback for immediate initial render or tests)
 */
export const loadStudioDoc = (lang?: Language): CustomDocTemplate => {
  const defaults = getInitialCustomDoc(lang);

  const current = readJson(STORAGE_KEY_STUDIO_DOC);
  if (looksLikeDoc(current)) {
    return normalizePlayerTitles(syncLoadoutsToStrategies(normalizeNotes(applyDefaultPortrait(stripMapsFromHeroSlots(fillMissing(current, defaults))))));
  }

  const legacy = readJson(LEGACY_STORAGE_KEY_STUDIO_DOC);
  if (looksLikeDoc(legacy)) {
    let migrated = stripMapsFromHeroSlots(fillMissing(legacy, defaults));
    if (isUntouchedLegacyTowerSet(migrated)) migrated = clearHeroSlots(migrated);
    migrated = normalizePlayerTitles(syncLoadoutsToStrategies(normalizeNotes(applyDefaultPortrait(migrated))));
    saveStudioDoc(migrated);
    return migrated;
  }

  return defaults;
};

export interface SaveResult {
  ok: boolean;
  error?: string;
  fallback?: boolean;
}

/**
 * Asynchronously saves the document to IndexedDB with automatic localStorage fallback.
 */
export async function saveStudioDocAsync(doc: CustomDocTemplate): Promise<SaveResult> {
  const ok = await putDocToIdb(doc);
  if (ok) {
    return { ok: true, fallback: false };
  }

  // Fallback to localStorage if IndexedDB is blocked / unavailable
  try {
    localStorage.setItem(STORAGE_KEY_STUDIO_DOC, JSON.stringify(doc));
    return { ok: true, fallback: true };
  } catch (e) {
    console.error('Failed to save studio doc draft to fallback storage:', e);
    return { ok: false, error: e instanceof Error ? e.message : String(e), fallback: true };
  }
}

/**
 * Writes the document. Calls async IndexedDB in background, with synchronous localStorage safety.
 */
export const saveStudioDoc = (doc: CustomDocTemplate): SaveResult => {
  // Trigger async save
  saveStudioDocAsync(doc).catch(err => console.warn('[saveStudioDoc] Async save failed:', err));

  // Also write to localStorage if feasible (for sync fallback)
  try {
    localStorage.setItem(STORAGE_KEY_STUDIO_DOC, JSON.stringify(doc));
    return { ok: true };
  } catch {
    // If localStorage is full, IndexedDB handles it anyway
    return { ok: true };
  }
};

// ---------- small UI state (which page tab the user was on) ----------

export type StudioPageTab = 'tab1' | 'tab2';

export const loadStudioActiveTab = (): StudioPageTab => {
  const ui = readJson(STORAGE_KEY_STUDIO_UI);
  return isPlainObject(ui) && (ui.activeTab === 'tab1' || ui.activeTab === 'tab2') ? ui.activeTab : 'tab1';
};

export const saveStudioActiveTab = (activeTab: StudioPageTab): void => {
  try {
    localStorage.setItem(STORAGE_KEY_STUDIO_UI, JSON.stringify({ activeTab }));
  } catch (e) {
    console.error('Failed to save studio UI state:', e);
  }
};
