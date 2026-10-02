'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Lightbulb,
  Calendar,
  MessagesSquare,
  ShieldCheck,
  FileText,
} from 'lucide-react';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { Help3D } from '@/components/ui/icon3d';
import { PageHeader } from '@/components/ui/page-header';
import { PAGE_HOSTS } from '@/lib/mascots';
import { POPUP_ACCENT, POPUP_DIM, PopupBar, popupCard, softRow } from '@/components/ui/soft-popup';
import { softIconTile } from '@/lib/soft-surface';

interface MenuModalProps {
  open: boolean;
  onClose: () => void;
}

// The header "?" menu — 1:1 parity with the native MenuSheet (InfoMenu.swift):
// same items, order, subtitles, icons, and per-item accents. Native presents
// sheets; the web equivalents are real routes, so rows are plain links.
const MENU_ITEMS: {
  href: string;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  accent: string;
}[] = [
  { href: '/how-to-play', title: 'How to Play', subtitle: 'Rules, tiles & scoring', icon: Help3D, accent: '#7C3AED' },
  { href: '/guides', title: 'Guides', subtitle: 'Strategy for every mode', icon: BookOpen, accent: '#3B82F6' },
  { href: '/strategy', title: 'Strategy', subtitle: 'Solve faster, in fewer guesses', icon: Lightbulb, accent: '#F59E0B' },
  { href: '/words', title: 'Words', subtitle: 'Every Word of the Day', icon: Calendar, accent: '#EC4899' },
  // "About" sat here until 2026-07-31 — it restated How to Play in older, dryer
  // copy, so two adjacent rows answered the same question. The page still exists
  // and is still in the sitemap; it is only unlinked from navigation.
  { href: '/faq', title: 'FAQ', subtitle: 'Common questions', icon: MessagesSquare, accent: '#8B5CF6' },
  { href: '/privacy', title: 'Privacy', subtitle: 'How we handle your data', icon: ShieldCheck, accent: '#10B981' },
  { href: '/terms', title: 'Terms', subtitle: 'Terms of service', icon: FileText, accent: '#6B7280' },
];

export function MenuModal({ open, onClose }: MenuModalProps) {
  const focusRef = useRef<HTMLDivElement>(null);
  useFocusTrap(focusRef, open);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-modal-overlay"
      style={{ backgroundColor: POPUP_DIM }}
      onClick={onClose}
    >
      <div
        ref={focusRef}
        // §255: max-h-modal (dvh with a vh fallback) instead of an inline
        // calc(100vh - 60px) — on iOS Safari 100vh includes the collapsed
        // toolbar, so the panel's top sat under the browser chrome.
        className="relative w-full max-w-sm animate-modal-content max-h-modal"
        style={{
          ...popupCard(POPUP_ACCENT.brand, { share: 0.09 }),
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
      >
        {/* Top accent bar (A1: the 10 px card bar). */}
        <PopupBar accent={POPUP_ACCENT.brand} gradient="linear-gradient(90deg, #a78bfa, #ec4899, #fbbf24)" />

        {/* Header (HEADER_SPEC §4): gradient caps title with C (Help / Guides) beside it, white close circle. */}
        <PageHeader
          className="px-5 pt-3 pb-2 flex-shrink-0"
          title="Menu"
          titleTag="h2"
          titleSize={20}
          host={PAGE_HOSTS.guides}
          hostSize={36}
          close={{ onClick: onClose }}
        />

        {/* Menu rows */}
        <div className="px-4 pb-5 overflow-y-auto flex-1 min-h-0 space-y-2">
          {MENU_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className="flex items-center gap-3 p-3"
                style={softRow(item.accent, { radius: 18 })}
              >
                <span
                  className="flex-shrink-0 w-10 h-10 flex items-center justify-center"
                  style={softIconTile(item.accent, { radius: 11 })}
                >
                  <Icon className="w-4 h-4" style={{ color: item.accent }} />
                </span>
                <span className="min-w-0 flex-1 flex flex-col">
                  <span className="text-[15px] font-black uppercase leading-tight" style={{ color: 'var(--color-text)' }}>
                    {item.title}
                  </span>
                  <span className="text-[11px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
                    {item.subtitle}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
