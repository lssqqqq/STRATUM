import { TableRowItem } from '../types/customDoc';

/**
 * NOTES blocks are bullet lists: one row = one bullet, and the text of the bullet lives in `content`.
 * Older projects stored "Title | value" pairs (`label` + `content`); `migrateNotesRows` converts them.
 */

const isBlank = (s: string | undefined | null): boolean => {
  const v = (s ?? '').trim();
  return v === '' || v === '-';
};

const newId = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/** The text(s) one stored row turns into. A legacy "Title | value" pair becomes "Title: value". */
const rowToTexts = (row: TableRowItem): string[] => {
  const label = isBlank(row.label) ? '' : row.label.trim();
  const lines = (row.content ?? '')
    .split('\n')
    .map(l => l.trim())
    .filter(l => !isBlank(l));

  if (label && lines.length > 0) {
    // "Title: first line", the remaining lines stay their own bullets.
    return [`${label}: ${lines[0]}`, ...lines.slice(1)];
  }
  if (label) return [label];
  return lines;
};

/**
 * Converts stored notes rows (old pairs or new bullets) into a clean bullet list.
 * - label + value are merged as "Label: value"
 * - multi-line values are split into one bullet per line
 * - empty rows (nothing, or only "-") are dropped
 * - the result always has at least one (empty) bullet so the editor has a line to type in
 * Nothing the user wrote is lost.
 */
export function migrateNotesRows(rows: TableRowItem[] | undefined | null, idPrefix = 'note'): TableRowItem[] {
  const source = Array.isArray(rows) ? rows : [];
  const out: TableRowItem[] = [];
  source.forEach((row, i) => {
    const texts = rowToTexts(row);
    texts.forEach((text, j) => {
      // Keep the original id for the first bullet of a row so React keys/history stay stable.
      out.push({ id: j === 0 && row.id ? row.id : newId(`${idPrefix}${i}`), label: '', content: text });
    });
  });
  if (out.length === 0) out.push({ id: source[0]?.id || newId(idPrefix), label: '', content: '' });
  return out;
}

/** Non-empty bullet texts, in order. Safe to call on old-format rows too. Used by the DOCX and HTML exports. */
export function getNoteBullets(rows: TableRowItem[] | undefined | null): string[] {
  const out: string[] = [];
  (Array.isArray(rows) ? rows : []).forEach(row => out.push(...rowToTexts(row)));
  return out;
}

/** True when a stored rows array still has the old "Title | value" shape and should be migrated. */
export function notesRowsNeedMigration(rows: TableRowItem[] | undefined | null): boolean {
  if (!Array.isArray(rows)) return false;
  return rows.some(r => !isBlank(r.label) || (r.content ?? '').includes('\n'));
}
