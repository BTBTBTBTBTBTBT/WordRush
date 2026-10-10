'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { FamIcon, QuietButton, HelperButton } from '@/components/ui/family-button';

// Item 35: the designed edit mode for a Home game list. Long-press a tile (or tap the pencil built
// into the section title) -> tiles wiggle, drag one over another to move it, the drop target glows,
// a family Done / Reset bar replaces nothing on the page (it sits under the title). Pointer events,
// so it works with touch, mouse and pen alike; Classic (pinned) neither wiggles nor moves.

const LONG_PRESS_MS = 480;
const MOVE_SLOP = 8;

export interface ReorderBind {
  'data-order-id': string;
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => void;
  className: string;
  style: CSSProperties;
}

export function useReorder({ ids, pinned, editing, onEnterEdit, onMove, canEdit }: {
  ids: readonly string[];
  pinned: string | null;
  editing: boolean;
  canEdit: boolean;
  onEnterEdit: () => void;
  onMove: (from: number, to: number) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const press = useRef<{ id: string; x: number; y: number; timer: ReturnType<typeof setTimeout> | null } | null>(null);
  const suppressClick = useRef(false);

  const clearPress = () => {
    if (press.current?.timer) clearTimeout(press.current.timer);
    press.current = null;
  };
  useEffect(() => clearPress, []);

  const idUnder = useCallback((x: number, y: number): string | null => {
    const el = document.elementFromPoint(x, y)?.closest('[data-order-id]') as HTMLElement | null;
    return el?.dataset.orderId ?? null;
  }, []);

  const bind = useCallback((id: string): ReorderBind => {
    const isPinned = id === pinned;
    const dragging = dragId === id;
    const target = !!dragId && overId === id && overId !== dragId && !isPinned;
    return {
      'data-order-id': id,
      onPointerDown: (e) => {
        if (!canEdit) return;
        if (editing) {
          if (isPinned) return;
          (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
          press.current = { id, x: e.clientX, y: e.clientY, timer: null };
          setDragId(id); setOverId(id); setOffset({ x: 0, y: 0 });
          return;
        }
        clearPress();
        press.current = {
          id, x: e.clientX, y: e.clientY,
          timer: setTimeout(() => { suppressClick.current = true; press.current = null; onEnterEdit(); try { navigator.vibrate?.(12); } catch { /* no haptics */ } }, LONG_PRESS_MS),
        };
      },
      onPointerMove: (e) => {
        const p = press.current;
        if (!p) return;
        if (!editing) {
          if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > MOVE_SLOP) clearPress();
          return;
        }
        if (dragId !== id) return;
        setOffset({ x: e.clientX - p.x, y: e.clientY - p.y });
        const under = idUnder(e.clientX, e.clientY);
        setOverId(under && under !== pinned ? under : id);
      },
      onPointerUp: () => {
        if (editing && dragId === id) {
          const from = ids.indexOf(id);
          const to = overId ? ids.indexOf(overId) : from;
          if (from >= 0 && to >= 0 && from !== to) onMove(from, to);
          setDragId(null); setOverId(null); setOffset({ x: 0, y: 0 });
          suppressClick.current = true;
        }
        clearPress();
      },
      onPointerCancel: () => { clearPress(); setDragId(null); setOverId(null); setOffset({ x: 0, y: 0 }); },
      className: `${editing && !isPinned ? 'order-wiggle' : ''}${dragging ? ' order-drag' : ''}${target ? ' order-target' : ''}`.trim(),
      style: dragging ? { transform: `translate(${offset.x}px, ${offset.y}px) scale(1.06)`, zIndex: 5, touchAction: 'none' } : editing && !isPinned ? { touchAction: 'none' } : {},
    };
  }, [canEdit, dragId, editing, idUnder, ids, offset.x, offset.y, onEnterEdit, onMove, overId, pinned]);

  /** Call from a tile's onClick: true = swallow the click (it ended a long press / drag, or edit mode is on). */
  const swallowClick = useCallback((): boolean => {
    if (suppressClick.current) { suppressClick.current = false; return true; }
    return editing;
  }, [editing]);

  return { bind, swallowClick, dragId, overId };
}

/**
 * The pencil glyph built into a section title (the title art stays centered; the pencil sits at its
 * trailing edge in a tinted family circle). Hidden while editing (the Done bar takes over).
 */
export function TitlePencil({ onClick, label }: { onClick: () => void; label: string; tint?: string }) {
  // Founder 10-09 ("an eyesore"): a quiet frosted coin with the soft clay shuffle mark, not the season helper pill: present, but it
  // never competes with the section art. 30px coin, 44px hit area, 80% opacity (iOS GameOrderTitleAccessory).
  return (
    <button type="button" data-squish aria-label={label} onClick={onClick} className="order-pencil order-coin">
      <span aria-hidden="true" className="order-coin-face"><FamIcon name="refresh" size={15} ink="var(--order-coin-ink)" /></span>
    </button>
  );
}

/** Done / Reset family bar shown under a section title while its list is being reordered. */
export function EditBar({ onDone, onReset, resetDisabled, hint }: { onDone: () => void; onReset: () => void; resetDisabled: boolean; hint: string }) {
  return (
    <div className="order-bar flex items-center justify-center gap-2" role="group" aria-label="Reorder games">
      <span className="order-hint">{hint}</span>
      <QuietButton size="sm" icon="refresh" onClick={onReset} disabled={resetDisabled}>Reset</QuietButton>
      <HelperButton tint="#7c3aed" icon="check" on onClick={onDone}>Done</HelperButton>
    </div>
  );
}
