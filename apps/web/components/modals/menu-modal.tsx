'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  X,
  ChevronRight,
  HelpCircle,
  BookOpen,
  Lightbulb,
  Calendar,
  Info,
  MessagesSquare,
  ShieldCheck,
  FileText,
} from 'lucide-react';
import { useFocusTrap } from '@/hooks/use-focus-trap';

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
  { href: '/how-to-play', title: 'How to Play', subtitle: 'Rules, tiles & scoring', icon: HelpCircle, accent: '#7C3AED' },
  { href: '/guides', title: 'Guides', subtitle: 'Strategy for all 9 modes', icon: BookOpen, accent: '#3B82F6' },
  { href: '/strategy', title: 'Strategy', subtitle: 'Solve faster, in fewer guesses', icon: Lightbulb, accent: '#F59E0B' },
  { href: '/words', title: 'Words', subtitle: 'Every Word of the Day', icon: Calendar, accent: '#EC4899' },
  { href: '/about', title: 'About', subtitle: 'What is Wordocious?', icon: Info, accent: '#14B8A6' },
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
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        ref={focusRef}
        className="relative w-full max-w-sm animate-modal-content"
        style={{
          background: 'var(--color-surface)',
          border: '1.5px solid var(--color-border)',
          borderRadius: '20px',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
          maxHeight: 'calc(100vh - 60px)',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
      >
        {/* Top accent bar */}
        <div
          className="h-1.5 flex-shrink-0"
          style={{ background: 'linear-gradient(90deg, #a78bfa, #ec4899, #fbbf24)' }}
        />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 flex-shrink-0">
          <h2
            className="text-xl font-black uppercase text-transparent bg-clip-text"
            style={{ backgroundImage: 'linear-gradient(135deg, #a78bfa, #ec4899)' }}
          >
            Menu
          </h2>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-[30px] h-[30px] rounded-full transition-opacity hover:opacity-80"
            style={{ background: 'var(--color-surface-alt)', color: 'var(--color-text-muted)' }}
            aria-label="Close"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Menu rows */}
        <div className="px-4 pb-5 overflow-y-auto flex-1 min-h-0 space-y-2">
          {MENU_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className="flex items-center gap-3 p-3 rounded-2xl transition-transform active:scale-[0.98]"
                style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)' }}
              >
                <span
                  className="flex-shrink-0 w-10 h-10 rounded-[11px] flex items-center justify-center"
                  style={{ background: `${item.accent}24` }}
                >
                  <Icon className="w-4 h-4" style={{ color: item.accent }} />
                </span>
                <span className="min-w-0 flex flex-col">
                  <span className="text-[15px] font-black uppercase leading-tight" style={{ color: 'var(--color-text)' }}>
                    {item.title}
                  </span>
                  <span className="text-[11px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
                    {item.subtitle}
                  </span>
                </span>
                <ChevronRight className="w-[13px] h-[13px] ml-auto flex-shrink-0" style={{ color: 'var(--color-text-muted)' }} />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
