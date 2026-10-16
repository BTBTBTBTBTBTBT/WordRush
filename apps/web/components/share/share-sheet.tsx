'use client';

// The custom share sheet (founder direction A, 2026-10-16): grabber, a swipeable carousel of the real share-card
// images, a slim "No spoilers | Full results" pill, look swatches (in a season only), then the CHANNELS row. The
// model (core shareSheetModel) decides what shows; lib/share-sheet-web.ts maps each tile to its web mechanism.
// A bottom sheet on phones, a centered modal on desktop. Mounted once in the root layout; opened by openShareSheet().

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { LucideIcon } from 'lucide-react';
import { Link2, MessageCircle, Phone, Pencil, ThumbsUp, Download, Ellipsis } from 'lucide-react';
import { shareSheetModel, type ShareCardKind, type ShareChannelId, type ShareSheetChannel } from '@wordle-duel/core';
import { castImageSources } from '@/lib/season';
import { logShareEvent } from '@/lib/share-events';
import { shareFileName } from '@/lib/share-utils';
import {
  channelEventKind, channelEventSurface, channelIntent, isMobileWeb, lookToSeason, sheetBlobKey, visibleChannels,
  type ShareSheetRequest,
} from '@/lib/share-sheet-web';
import type { ShareVariant } from './share-variant-modal';

// ── Open / close (module listener, like SharePreviewHost) ───────────────────

interface SheetState { request: ShareSheetRequest | null; id: number }
let listener: ((s: SheetState) => void) | null = null;
let current: SheetState = { request: null, id: 0 };
/** The element that had focus when the sheet opened (the Share button); focus returns to it on close. */
let opener: HTMLElement | null = null;

/** Open the sheet for a share. A second call while it is up replaces the first. */
export function openShareSheet(request: ShareSheetRequest): void {
  if (!current.request && typeof document !== 'undefined') opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  current = { request, id: current.id + 1 };
  listener?.(current);
}

function closeShareSheet(): void {
  current = { request: null, id: current.id };
  listener?.(current);
  const back = opener;
  opener = null;
  if (back && back.isConnected) setTimeout(() => back.focus(), 0);
}

function toast(title: string): void {
  void import('@/hooks/use-toast').then(({ toast: t }) => t({ title })).catch(() => {});
}

/** Mount-once host: rendered in the root layout. */
export function ShareSheetHost() {
  const [state, setState] = useState<SheetState>(current);
  useEffect(() => {
    listener = setState;
    setState(current); // a sheet opened before the host mounted
    return () => { listener = null; };
  }, []);
  if (!state.request) return null;
  return <ShareSheet key={state.id} request={state.request} onClose={closeShareSheet} />;
}

// ── Channel look: one candy tile per channel ────────────────────────────────

const CHANNEL_STYLE: Record<ShareChannelId, { icon: LucideIcon; top: string; bottom: string }> = {
  copy: { icon: Link2, top: '#a78bfa', bottom: '#6d28d9' },
  messages: { icon: MessageCircle, top: '#4ade80', bottom: '#15a34a' },
  whatsapp: { icon: Phone, top: '#34d399', bottom: '#0f9f6e' },
  stories: { icon: Ellipsis, top: '#f472b6', bottom: '#db2777' },
  x: { icon: Pencil, top: '#4b4b63', bottom: '#1c1c2b' },
  facebook: { icon: ThumbsUp, top: '#60a5fa', bottom: '#2563eb' },
  snapchat: { icon: Ellipsis, top: '#fde047', bottom: '#eab308' },
  tiktok: { icon: Ellipsis, top: '#4b4b63', bottom: '#1c1c2b' },
  save: { icon: Download, top: '#fcd34d', bottom: '#f59e0b' },
  more: { icon: Ellipsis, top: '#c084fc', bottom: '#7c3aed' },
};

function ChannelTile({ ch, onTap }: { ch: ShareSheetChannel; onTap: () => void }) {
  const s = CHANNEL_STYLE[ch.id];
  const Icon = s.icon;
  return (
    <button
      type="button"
      data-squish
      onClick={onTap}
      className="flex flex-1 min-w-0 flex-col items-center gap-1.5 active:scale-95 transition-transform"
      aria-label={ch.label}
    >
      <span
        className="flex h-[46px] w-[46px] items-center justify-center rounded-full"
        style={{
          background: `linear-gradient(180deg, ${s.top}, ${s.bottom})`,
          boxShadow: `inset 0 2px 0 rgba(255,255,255,0.45), inset 0 -3px 0 rgba(0,0,0,0.18), 0 6px 14px rgba(0,0,0,0.35)`,
        }}
      >
        <Icon className="h-[22px] w-[22px] text-white" strokeWidth={2.4} />
      </span>
      <span className="text-[10px] font-bold leading-tight text-center" style={{ color: 'rgba(255,255,255,0.88)' }}>{ch.label}</span>
    </button>
  );
}

// ── The sheet ───────────────────────────────────────────────────────────────

function ShareSheet({ request, onClose }: { request: ShareSheetRequest; onClose: () => void }) {
  const model = useMemo(() => shareSheetModel(request.ctx, 'web'), [request]);
  const [variant, setVariant] = useState<ShareVariant>(model.variant.initial);
  const [look, setLook] = useState<string>(model.looks.initial);
  const [cardIndex, setCardIndex] = useState(0);
  const [urls, setUrls] = useState<Record<string, string | 'failed'>>({});
  const [mobile, setMobile] = useState(false);
  const cache = useRef(new Map<string, Promise<Blob | null>>());
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const objectUrls = useRef<string[]>([]);
  const scroller = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('');
  const say = useCallback((msg: string) => { setStatus(''); setTimeout(() => setStatus(msg), 30); toast(msg); }, []);

  useEffect(() => {
    setMobile(isMobileWeb(navigator.userAgent, navigator.maxTouchPoints || 0));
  }, []);

  // Renders go one at a time (the canvas renderers share fonts and image caches) and are cached per (card, variant, look).
  const blobFor = useCallback((card: ShareCardKind, v: ShareVariant, l: string): Promise<Blob | null> => {
    const key = sheetBlobKey(card, v, l);
    let p = cache.current.get(key);
    if (!p) {
      const run = () => request.render(card, v, l).catch(() => null);
      p = queue.current.then(run, run);
      queue.current = p;
      cache.current.set(key, p);
    }
    return p;
  }, [request]);

  // Lazily produce every card of the current (variant, look); each preview pops in as it finishes.
  useEffect(() => {
    let live = true;
    for (const c of model.cards) {
      const key = sheetBlobKey(c.kind, variant, look);
      void blobFor(c.kind, variant, look).then((blob) => {
        if (!live) return;
        let url: string | 'failed' = 'failed';
        if (blob) { url = URL.createObjectURL(blob); objectUrls.current.push(url); }
        setUrls((u) => (u[key] ? u : { ...u, [key]: url }));
      });
    }
    return () => { live = false; };
  }, [model, variant, look, blobFor]);

  useEffect(() => () => { for (const u of objectUrls.current) URL.revokeObjectURL(u); }, []);

  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const root = dialogRef.current;
      if (!root) return;
      const items = [...root.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')].filter((el) => el.offsetParent !== null);
      if (items.length === 0) { e.preventDefault(); root.focus(); return; }
      const first = items[0], last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === root)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
      else if (!root.contains(active)) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el || el.children.length === 0) return;
    const first = el.children[0] as HTMLElement;
    const step = first.offsetWidth + 12;
    setCardIndex(Math.max(0, Math.min(model.cards.length - 1, Math.round(el.scrollLeft / step))));
  };

  const activeCard = model.cards[cardIndex]?.kind ?? model.cards[0]?.kind;
  const channels = visibleChannels(model.channels, mobile);

  const tap = async (ch: ShareSheetChannel) => {
    const intent = channelIntent(ch);
    if (intent.kind === 'none') return;
    logShareEvent(channelEventKind(ch), request.fileMode, channelEventSurface(ch.id));
    if (intent.kind === 'copy') {
      try { await navigator.clipboard.writeText(intent.text); say('Link copied'); }
      catch { say('Could not copy the link'); }
      return;
    }
    if (intent.kind === 'sms') { window.location.href = intent.url; return; }
    if (intent.kind === 'open') { window.open(intent.url, '_blank', 'noopener,noreferrer'); return; }
    // save / more both carry the card on screen.
    const blob = activeCard ? await blobFor(activeCard, variant, look) : null;
    if (!blob) { say('The card is not ready yet'); return; }
    const file = new File([blob], shareFileName(request.fileMode), { type: 'image/png' });
    if (intent.kind === 'more' && typeof navigator.share === 'function' && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      try { await navigator.share({ files: [file] }); return; }
      catch (err) { if (err instanceof DOMException && err.name === 'AbortError') return; }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = file.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    say('Saved! Share it anywhere');
  };

  const sheet = (
    <div
      className="fixed inset-0 z-[75] flex items-end md:items-center justify-center animate-modal-overlay"
      style={{ backgroundColor: 'rgba(8,4,24,0.62)', backdropFilter: 'blur(3px)' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-sheet-title"
        tabIndex={-1}
        ref={dialogRef}
        data-testid="share-sheet"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full md:max-w-[460px] max-h-[94vh] overflow-y-auto overscroll-contain rounded-t-[28px] md:rounded-[28px] animate-modal-content"
        style={{
          // In a season the sheet is the season's glass (raised -> card -> hero, so it follows the time of day); else the night violet.
          background: 'linear-gradient(180deg, var(--season-sheet-top, #34206f) 0%, var(--season-sheet-mid, #1f1248) 55%, var(--season-sheet-bot, #170d38) 100%)',
          boxShadow: '0 -10px 50px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.16)',
          paddingBottom: 'max(18px, env(safe-area-inset-bottom))',
        }}
      >
        <h2 id="share-sheet-title" className="sr-only">Share your result</h2>
        <div aria-live="polite" role="status" className="sr-only" data-testid="share-status">{status}</div>
        <div className="flex justify-center pt-2.5 pb-1">
          <span className="h-1.5 w-11 rounded-full" style={{ background: 'rgba(196,181,253,0.55)' }} />
        </div>

        {/* Carousel of the real cards */}
        <div
          ref={scroller}
          onScroll={onScroll}
          data-testid="share-carousel"
          role="region"
          aria-roledescription="carousel"
          aria-label="Share cards"
          className="flex gap-3 overflow-x-auto px-[14%] pt-2 pb-3"
          style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
        >
          {model.cards.map((c, idx) => {
            const u = urls[sheetBlobKey(c.kind, variant, look)];
            const caption = c.kind === 'result' ? (model.channels.find((ch) => ch.caption)?.caption ?? null) : null;
            const alt = caption ? `${c.title} share card. ${caption}` : `${c.title} share card`;
            return (
              <div key={c.kind} role="group" aria-roledescription="slide" aria-label={`${idx + 1} of ${model.cards.length}`} className="shrink-0 w-full flex items-center justify-center" style={{ scrollSnapAlign: 'center', minHeight: 'min(46vh, 380px)' }}>
                {u && u !== 'failed' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={u}
                    alt={alt}
                    draggable={false}
                    className="rounded-[18px] object-contain"
                    style={{ maxHeight: 'min(46vh, 380px)', maxWidth: '100%', boxShadow: '0 10px 30px rgba(0,0,0,0.45)' }}
                  />
                ) : u === 'failed' ? (
                  <span className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.7)' }}>Could not draw this card</span>
                ) : (
                  <span className="h-[min(46vh,380px)] w-[70%] rounded-[18px] animate-pulse" style={{ background: 'rgba(255,255,255,0.08)' }} aria-label="Drawing the card" />
                )}
              </div>
            );
          })}
        </div>
        {model.cards.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 pb-2" aria-hidden="true">
            {model.cards.map((c, i) => (
              <span key={c.kind} className="h-1.5 rounded-full transition-all" style={{ width: i === cardIndex ? 16 : 6, background: i === cardIndex ? '#c4b5fd' : 'rgba(255,255,255,0.25)' }} />
            ))}
          </div>
        )}

        {/* No spoilers | Full results */}
        {model.variant.shown && (
          <div className="flex justify-center px-6 pt-1 pb-3">
            <div role="radiogroup" aria-label="Share style" className="flex w-full max-w-[340px] rounded-full p-1" style={{ background: 'rgba(255,255,255,0.08)', boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.3)' }}>
              {(['clean', 'full'] as const).map((v) => {
                const on = variant === v;
                const c = model.variant.copy[v];
                return (
                  <button
                    key={v}
                    type="button"
                    data-squish
                    role="radio"
                    aria-checked={on}
                    title={c.subtitle}
                    onClick={() => setVariant(v)}
                    className="relative flex-1 rounded-full py-2 text-[14px] font-extrabold transition-all"
                    style={on
                      ? { color: '#fff', background: 'linear-gradient(180deg, #a78bfa, #7c3aed)', boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.4), 0 3px 8px rgba(0,0,0,0.35)' }
                      : { color: 'rgba(255,255,255,0.72)', background: 'transparent' }}
                  >
                    {c.title}
                    {/* 44 px hit height; the pill's look is unchanged. */}
                    <span aria-hidden="true" className="absolute inset-x-0 -inset-y-1" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Look swatches (a season only) */}
        {model.looks.shown && (
          <div className="flex justify-center gap-5 pb-3" role="radiogroup" aria-label="Card look">
            {model.looks.options.map((o) => {
              const on = look === o.id;
              const season = lookToSeason(o.id);
              const src = castImageSources('w', season ?? null)[0];
              return (
                <button key={o.id} type="button" data-squish role="radio" aria-checked={on} onClick={() => setLook(o.id)} className="flex flex-col items-center gap-1 active:scale-95 transition-transform">
                  <span
                    className="flex h-[54px] w-[54px] items-center justify-center overflow-hidden rounded-full"
                    style={{
                      background: o.id === 'normal' ? 'linear-gradient(180deg, #5b4bb5, #2b1d6b)' : 'linear-gradient(180deg, #6d3a9c, #2b1255)',
                      boxShadow: on ? '0 0 0 3px #fbbf24, 0 0 16px rgba(251,191,36,0.55)' : '0 0 0 2px rgba(255,255,255,0.18)',
                    }}
                  >
                    {/* W in that look: the hero W for Normal, the costumed W for the season. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" draggable={false} className="h-[46px] w-[46px] object-contain" />
                  </span>
                  <span className="text-[12px] font-bold" style={{ color: on ? '#fde68a' : 'rgba(255,255,255,0.78)' }}>{o.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Channels */}
        <div className="mx-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="pb-2 text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: '#c4b5fd' }}>Channels</div>
          <div className="flex gap-0.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }} data-testid="share-channels">
            {channels.map((ch) => <ChannelTile key={ch.id} ch={ch} onTap={() => void tap(ch)} />)}
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document === 'undefined' ? null : createPortal(sheet, document.body);
}
