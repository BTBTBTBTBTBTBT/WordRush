'use client';

import { CheckCheck, ChevronDown, ChevronRight, PackageCheck, Smartphone } from 'lucide-react';
import type { ArtAsset } from '@/lib/admin/art-library';
import type { ReviewContext, ReviewDecision } from '@/lib/admin/art-review';
import type { ArtSection } from '@/lib/admin/art-sections';
import { MiniCompare } from './preview-panel';
import { ReviewerDiscs, TileActions } from './review-panel';
import { CHECKER, Thumb, type Signer } from './thumbs';
import { wiredFor } from '@/lib/admin/season-preview-wired';

// admin > Art Library: one section of the sectioned view (sticky header with its counts, "See it in the app",
// "Approve all" with an in-page confirmation, and the tiles with inline review). page.tsx owns the state.

export type SectionMode = 'grid' | 'compare';

export interface SectionActions {
  onToggle: () => void;
  onMore: () => void;
  onOpenAsset: (id: string) => void;
  onSeeInApp: () => void;
  onAskApproveAll: () => void;
  onConfirmApproveAll: () => void;
  onCancelApproveAll: () => void;
  onApprove: (id: string) => void;
  onNote: (id: string, decision: 'reject' | 'changes', note: string) => void;
}

export function SectionBlock({ section, ctx, open, mode, limit, signer, summary, plan, confirming, iReview, actions }: {
  section: ArtSection;
  ctx: ReviewContext;
  open: boolean;
  mode: SectionMode;
  limit: number;
  signer: Signer;
  /** The collapsed line ("All approved by you · waiting on JP"). */
  summary: string;
  /** What "Approve all" would do for the viewer. */
  plan: { ids: string[]; flagged: number };
  confirming: boolean;
  iReview: boolean;
  actions: SectionActions;
}) {
  const { counts } = section;
  const shown = section.assets.slice(0, limit);
  const hasPreview = section.assets.some((a) => /^image\//.test(a.mime));
  return (
    <section className="min-w-0" aria-label={section.label}>
      <header className="sticky top-[52px] lg:top-0 z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 bg-gray-50/95 backdrop-blur border-b border-purple-100/70">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={actions.onToggle} className="min-w-0 flex-1 flex items-center gap-2 text-left py-0.5" aria-expanded={open}>
            <span className="w-7 h-7 shrink-0 rounded-lg bg-white shadow-sm text-purple-600 flex items-center justify-center">
              {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </span>
            <span className="min-w-0">
              <span className="block text-sm sm:text-[15px] leading-tight font-black text-gray-900 line-clamp-2 sm:truncate">
                {section.label}
                <span className="ml-1.5 text-xs font-extrabold text-purple-400 tabular-nums">{counts.total.toLocaleString('en-US')}</span>
              </span>
              {open ? (
                <span className="block text-[11px] font-bold text-gray-400 truncate tabular-nums">
                  {counts.toReview > 0 && <span className="text-purple-700">{counts.toReview} to review</span>}
                  {counts.toReview > 0 && (counts.approved > 0 || counts.rejected > 0) && ' · '}
                  {counts.approved > 0 && <span className="text-emerald-700">{counts.approved} approved</span>}
                  {counts.approved > 0 && counts.rejected > 0 && ' · '}
                  {counts.rejected > 0 && <span className="text-rose-600">{counts.rejected} rejected</span>}
                  {counts.toReview === 0 && counts.approved === 0 && counts.rejected === 0 && summary}
                </span>
              ) : (
                <span className={`flex items-center gap-1 text-[11px] font-extrabold truncate ${section.done ? 'text-emerald-700' : 'text-gray-400'}`}>
                  {section.done && (counts.shipped === counts.total ? <PackageCheck className="w-3.5 h-3.5 shrink-0" /> : <CheckCheck className="w-3.5 h-3.5 shrink-0" />)}
                  <span className="truncate">{summary}</span>
                </span>
              )}
            </span>
          </button>
          {open && hasPreview && (
            <button
              onClick={actions.onSeeInApp}
              aria-label="See it in the app"
              title="See it in the app"
              className="shrink-0 h-9 inline-flex items-center gap-1.5 rounded-xl bg-white text-purple-700 hover:bg-purple-50 shadow-sm px-2.5 text-xs font-extrabold"
            >
              <Smartphone className="w-4 h-4" />
              <span className="hidden sm:inline">See it in the app</span>
            </button>
          )}
          {open && iReview && plan.ids.length > 0 && (
            <button
              onClick={confirming ? actions.onCancelApproveAll : actions.onAskApproveAll}
              aria-pressed={confirming}
              className={`shrink-0 h-9 inline-flex items-center gap-1.5 rounded-xl px-3 text-xs font-extrabold transition ${
                confirming ? 'bg-emerald-500 text-white shadow-sm' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              <CheckCheck className="w-4 h-4" />
              Approve all
            </button>
          )}
        </div>
        {confirming && (
          <div className="mt-2 rounded-xl bg-white shadow-sm px-3 py-2.5 flex flex-wrap items-center gap-2">
            <p className="min-w-0 flex-1 text-[13px] font-bold text-gray-800">
              Approve {plan.ids.length} {plan.ids.length === 1 ? 'item' : 'items'} in {section.label}?
              {plan.flagged > 0 && <span className="text-gray-400"> ({plan.flagged} you flagged stay as-is)</span>}
            </p>
            <div className="flex gap-1.5 ml-auto">
              <button onClick={actions.onCancelApproveAll} className="h-9 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 px-3 text-xs font-extrabold">
                Cancel
              </button>
              <button onClick={actions.onConfirmApproveAll} className="h-9 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm px-3.5 text-xs font-extrabold">
                Approve {plan.ids.length}
              </button>
            </div>
          </div>
        )}
      </header>

      {open && (
        <div className="pt-3 pb-6">
          <div className={mode === 'compare'
            ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-5'
            : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-x-3 gap-y-4'}
          >
            {shown.map((a) => (
              <Tile
                key={a.id}
                asset={a}
                ctx={ctx}
                mode={mode}
                signer={signer}
                iReview={iReview}
                onOpen={() => actions.onOpenAsset(a.id)}
                onApprove={() => actions.onApprove(a.id)}
                onNote={(d, n) => actions.onNote(a.id, d, n)}
              />
            ))}
          </div>
          {section.assets.length > shown.length && (
            <div className="mt-4 flex justify-center">
              <button onClick={actions.onMore} className="h-10 rounded-xl bg-white shadow-sm text-purple-700 hover:bg-purple-50 px-4 text-sm font-extrabold">
                Show all {section.assets.length.toLocaleString('en-US')}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** "LIVE IN PREVIEW": the piece is wired into the in-app season preview (lib/admin/season-preview-wired.json). */
export function LiveTag({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-orange-500 text-white px-2 py-0.5 text-[9px] font-black uppercase tracking-wider shadow-sm ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-white" />
      Live in preview
    </span>
  );
}

function Tile({ asset, ctx, mode, signer, iReview, onOpen, onApprove, onNote }: {
  asset: ArtAsset;
  ctx: ReviewContext;
  mode: SectionMode;
  signer: Signer;
  iReview: boolean;
  onOpen: () => void;
  onApprove: () => void;
  onNote: (decision: 'reject' | 'changes', note: string) => void;
}) {
  const reviews = ctx.index.get(asset.id);
  const mine: ReviewDecision | null = ctx.me ? reviews?.get(ctx.me)?.decision ?? null : null;
  const live = wiredFor(asset);
  const image = (
    <div className="absolute inset-0" style={CHECKER}>
      <Thumb asset={asset} signer={signer} />
      {live && <LiveTag className="absolute top-1.5 left-1.5" />}
    </div>
  );
  return (
    <div className="min-w-0">
      {mode === 'compare' ? (
        <MiniCompare asset={asset} fallback={image} onOpen={onOpen} />
      ) : (
        <button onClick={onOpen} className="group relative block w-full aspect-square rounded-xl overflow-hidden shadow-sm transition hover:shadow-md" title={asset.path}>
          {image}
        </button>
      )}
      {mode === 'compare' && live && (
        <p className="mt-1 flex items-center gap-1.5 min-w-0 text-[11px] font-bold text-orange-900">
          <LiveTag className="shrink-0" />
          <span className="truncate" title={live.where}>{live.where}</span>
        </p>
      )}
      <div className="mt-1.5 flex items-center gap-1.5 min-w-0">
        <p className="min-w-0 flex-1 text-xs font-bold text-gray-700 truncate" title={live ? `${asset.title} · ${live.where}` : asset.title}>{asset.title}</p>
        <ReviewerDiscs reviewers={ctx.reviewers} reviews={reviews} />
      </div>
      {iReview && <TileActions mine={mine} shipped={asset.status === 'shipped'} onApprove={onApprove} onNote={onNote} />}
    </div>
  );
}
