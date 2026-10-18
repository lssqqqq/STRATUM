import React, { useCallback, useLayoutEffect, useRef } from 'react';

interface WrapTitleInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Single-line-looking title field that wraps long text onto the next line(s) instead of cutting it off
 * (e.g. "Placement Map" -> "Placement" / "Map"). It grows in height with its content, also when the
 * table is resized. Enter confirms the title (no manual line breaks).
 */
export const WrapTitleInput: React.FC<WrapTitleInputProps> = ({ value, onChange, placeholder, className }) => {
  const ref = useRef<HTMLTextAreaElement>(null);

  const fit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useLayoutEffect(() => {
    fit();
  }, [value, fit]);

  // Re-fit when the available width changes (table resize, zoom, page format)
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let lastW = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth !== lastW) {
        lastW = el.clientWidth;
        fit();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value.replace(/[\r\n]+/g, ' '))}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          (e.target as HTMLTextAreaElement).blur();
        }
      }}
      spellCheck={false}
      className={`resize-none overflow-hidden block min-w-0 whitespace-pre-wrap break-words leading-tight ${className ?? ''}`}
    />
  );
};
