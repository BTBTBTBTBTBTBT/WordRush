'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AudioLines, Palette, Play } from 'lucide-react';
import { mediaOf, type ArtAsset, type SignVariant } from '@/lib/admin/art-library';

// admin > Art Library: the signed-URL cache and the thumbnail pieces shared by the page and its sections.

export const FRESH_MS = 50 * 60 * 1000; // signed URLs live 1h; refresh after 50 minutes
const SIGN_BATCH = 120;

/** Soft lavender checkerboard behind transparent art. */
export const CHECKER: React.CSSProperties = {
  backgroundColor: '#faf7ff',
  backgroundImage: 'repeating-conic-gradient(#efe8fd 0% 25%, transparent 0% 50%)',
  backgroundSize: '18px 18px',
};

/* ------------------------------------------------------------------ signing */

export interface Signer {
  get: (variant: SignVariant, id: string) => string | null;
  ensure: (variant: SignVariant, ids: string[]) => void;
}

/** Signed-URL cache (variant:id -> url), batched requests, 50-minute freshness. */
export function useSigner(): Signer {
  const cache = useRef(new Map<string, { url: string; at: number }>());
  const inflight = useRef(new Set<string>());
  const [, setVersion] = useState(0);

  const get = useCallback((variant: SignVariant, id: string) => {
    const e = cache.current.get(`${variant}:${id}`);
    return e ? e.url : null;
  }, []);

  const ensure = useCallback((variant: SignVariant, ids: string[]) => {
    const now = Date.now();
    const need = ids.filter((id) => {
      const k = `${variant}:${id}`;
      const e = cache.current.get(k);
      return !inflight.current.has(k) && (!e || now - e.at > FRESH_MS);
    });
    for (let i = 0; i < need.length; i += SIGN_BATCH) {
      const chunk = need.slice(i, i + SIGN_BATCH);
      chunk.forEach((id) => inflight.current.add(`${variant}:${id}`));
      fetch('/api/admin/art/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: chunk, variant }),
      })
        .then((r) => r.json())
        .then((j: { urls?: Record<string, string> }) => {
          const at = Date.now();
          for (const [id, url] of Object.entries(j.urls ?? {})) cache.current.set(`${variant}:${id}`, { url, at });
          setVersion((v) => v + 1);
        })
        .catch(() => {})
        .finally(() => chunk.forEach((id) => inflight.current.delete(`${variant}:${id}`)));
    }
  }, []);

  return useMemo(() => ({ get, ensure }), [get, ensure]);
}

export function MediaGlyph({ media, size = 'md' }: { media: 'html' | 'audio' | 'other'; size?: 'sm' | 'md' }) {
  const Icon = media === 'html' ? Play : media === 'audio' ? AudioLines : Palette;
  const label = media === 'html' ? 'Animation' : media === 'audio' ? 'Sound' : 'File';
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-purple-100 to-purple-200/70">
      <span className={`${size === 'sm' ? 'w-7 h-7' : 'w-11 h-11'} rounded-full bg-white/90 shadow-sm flex items-center justify-center text-purple-600`}>
        <Icon className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-5 h-5'} />
      </span>
      {size === 'md' && <span className="text-[10px] font-black text-purple-700/80 uppercase tracking-wide">{label}</span>}
    </div>
  );
}

/** A thumbnail that falls back to the full file when the resized render fails. */
export function Thumb({ asset, signer, size = 'md' }: { asset: ArtAsset; signer: Signer; size?: 'sm' | 'md' }) {
  const [fallback, setFallback] = useState(false);
  const media = mediaOf(asset.mime);
  useEffect(() => { if (fallback) signer.ensure('full', [asset.id]); }, [fallback, asset.id, signer]);
  if (media !== 'image') return <MediaGlyph media={media} size={size} />;
  const url = fallback ? signer.get('full', asset.id) : signer.get('thumb', asset.id);
  if (!url) return <div className="absolute inset-0 animate-pulse bg-purple-100/50" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFallback(true)}
      className="absolute inset-0 w-full h-full object-contain p-1.5"
    />
  );
}

