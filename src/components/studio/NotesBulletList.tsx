import React, { useLayoutEffect, useRef } from 'react';
import { Plus, X } from 'lucide-react';
import { TableRowItem } from '../../types/customDoc';

interface NotesBulletListProps {
  rows: TableRowItem[];
  /** Called with the full new list on every change (the parent stores it, which also feeds Undo/Redo). */
  onChange: (rows: TableRowItem[]) => void;
  placeholder: string;
  addLabel: string;
  deleteLabel: string;
  /** Larger text/padding variant used for the first-page NOTES block. */
  large?: boolean;
}

const makeId = (): string => `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/**
 * NOTES as a bullet list.
 * - every line is one bullet (• + text field)
 * - Enter creates a new bullet (splitting the text at the cursor), Backspace in an empty bullet removes it
 * - ✕ removes a bullet, "Add bullet" appends one
 * - there is always at least one bullet
 * - pasting several lines creates one bullet per line
 */
export const NotesBulletList: React.FC<NotesBulletListProps> = ({
  rows,
  onChange,
  placeholder,
  addLabel,
  deleteLabel,
  large = false
}) => {
  const fields = useRef(new Map<string, HTMLTextAreaElement>());
  // Which bullet should receive focus after the next render, and where the caret goes
  const pendingFocus = useRef<{ id: string; caret: number | 'end' } | null>(null);

  // Keep every textarea exactly as tall as its text, and move focus after structural changes
  useLayoutEffect(() => {
    fields.current.forEach(el => {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    });
    const target = pendingFocus.current;
    if (target) {
      pendingFocus.current = null;
      const el = fields.current.get(target.id);
      if (el) {
        el.focus();
        const pos = target.caret === 'end' ? el.value.length : target.caret;
        el.setSelectionRange(pos, pos);
      }
    }
  });

  const setText = (id: string, content: string) =>
    onChange(rows.map(r => (r.id === id ? { ...r, label: '', content } : r)));

  const insertAfter = (index: number, before: string, after: string) => {
    const created: TableRowItem = { id: makeId(), label: '', content: after };
    const next = rows.map((r, i) => (i === index ? { ...r, label: '', content: before } : r));
    next.splice(index + 1, 0, created);
    pendingFocus.current = { id: created.id, caret: 0 };
    onChange(next);
  };

  const removeAt = (index: number, focus: 'previous' | 'next' | 'none') => {
    if (rows.length <= 1) {
      // Always keep one bullet: just clear it
      onChange(rows.map(r => ({ ...r, label: '', content: '' })));
      return;
    }
    if (focus === 'previous' && index > 0) pendingFocus.current = { id: rows[index - 1].id, caret: 'end' };
    if (focus === 'next' || (focus === 'previous' && index === 0)) {
      const neighbour = rows[index + 1];
      if (neighbour) pendingFocus.current = { id: neighbour.id, caret: 0 };
    }
    onChange(rows.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, index: number) => {
    if (e.nativeEvent.isComposing) return;
    const el = e.currentTarget;
    if (e.key === 'Enter') {
      e.preventDefault();
      const caret = el.selectionStart ?? el.value.length;
      insertAfter(index, el.value.slice(0, caret), el.value.slice(el.selectionEnd ?? caret));
    } else if (e.key === 'Backspace' && el.value === '' && rows.length > 1) {
      e.preventDefault();
      removeAt(index, 'previous');
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>, index: number) => {
    const text = e.clipboardData.getData('text');
    if (!/[\r\n]/.test(text)) return; // single line: normal paste
    e.preventDefault();
    const lines = text
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;
    const el = e.currentTarget;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const head = el.value.slice(0, start);
    const tail = el.value.slice(end);

    const current = rows[index];
    const created: TableRowItem[] = lines.slice(1).map(l => ({ id: makeId(), label: '', content: l }));
    const merged: TableRowItem[] = [{ ...current, label: '', content: head + lines[0] }, ...created];
    const lastIdx = merged.length - 1;
    const lastText = merged[lastIdx].content;
    merged[lastIdx] = { ...merged[lastIdx], content: lastText + tail };
    pendingFocus.current = { id: merged[lastIdx].id, caret: lastText.length };
    onChange([...rows.slice(0, index), ...merged, ...rows.slice(index + 1)]);
  };

  const addBullet = () => {
    const created: TableRowItem = { id: makeId(), label: '', content: '' };
    pendingFocus.current = { id: created.id, caret: 0 };
    onChange([...rows, created]);
  };

  return (
    <div>
      <div className="rounded-2xl border-2 border-neutral-700 bg-neutral-950 shadow-2xl px-4 py-3 md:px-6 md:py-4">
        <ul className="space-y-1.5">
          {rows.map((row, index) => (
            <li key={row.id} className="group flex items-start gap-3">
              <span
                aria-hidden="true"
                className={`select-none text-white leading-relaxed ${large ? 'text-lg md:text-xl pt-px' : 'text-base md:text-lg'}`}
              >
                •
              </span>
              <textarea
                ref={el => {
                  if (el) fields.current.set(row.id, el);
                  else fields.current.delete(row.id);
                }}
                rows={1}
                value={row.content}
                placeholder={placeholder}
                onChange={e => setText(row.id, e.target.value.replace(/[\r\n]+/g, ' '))}
                onKeyDown={e => handleKeyDown(e, index)}
                onPaste={e => handlePaste(e, index)}
                className={`flex-1 min-w-0 bg-transparent text-neutral-200 placeholder-neutral-600 focus:outline-none focus:bg-neutral-900 rounded px-1 leading-relaxed resize-none overflow-hidden font-display ${
                  large ? 'text-sm md:text-base' : 'text-xs md:text-sm'
                }`}
              />
              <button
                type="button"
                onClick={() => removeAt(index, 'none')}
                className="opacity-40 group-hover:opacity-100 focus:opacity-100 mt-0.5 p-0.5 rounded text-neutral-500 hover:text-red-400 hover:bg-neutral-900 transition-opacity"
                title={deleteLabel}
                aria-label={deleteLabel}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex justify-end pt-3">
        <button
          type="button"
          onClick={addBullet}
          className="px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white text-xs font-bold transition-colors flex items-center gap-1.5 border border-neutral-700 shadow"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{addLabel}</span>
        </button>
      </div>
    </div>
  );
};
