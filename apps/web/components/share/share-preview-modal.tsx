'use client';

import { useEffect, useState } from 'react';

import { Download, Copy, X, Check } from 'lucide-react';
import { HeaderBack } from '@/components/ui/page-header';
import { CandyButton } from '@/components/ui/candy-button';
import { CastButton } from '@/components/ui/cast-button';
import { BRAND_ACCENT, cardBarStyle, softBackground, softBorder } from '@/lib/soft-surface';
import { copyShareToClipboard } from '@/lib/share-utils';

interface ShareModalState {
  open: boolean;
  blob: Blob | null;
  caption: string;
}

let listener: ((state: ShareModalState) => void) | null = null;
let currentState: ShareModalState = { open: false, blob: null, caption: '' };

/**
 * Open the fallback share-preview modal. Called by shareResult when both
 * Web Share and clipboard-image writes are unavailable (older iOS, some
 * desktop browsers). The modal gives the user an image preview plus
 * "Save image" and "Copy caption" buttons so they can still share it.
 */
export function openSharePreview(blob: Blob, caption: string): void {
  currentState = { open: true, blob, caption };
  listener?.(currentState);
}

function closeSharePreview(): void {
  currentState = { open: false, blob: null, caption: '' };
  listener?.(currentState);
}

/**
 * Mount-once modal host rendered at the root layout. Subscribes to the
 * module-level listener set up by openSharePreview / closeSharePreview so
 * any game component's shareResult call can pop it open without having to
 * plumb state through intermediate providers.
 */
export function SharePreviewHost() {
  const [state, setState] = useState<ShareModalState>(currentState);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    listener = setState;
    return () => {
      listener = null;
    };
  }, []);

  const { open, blob, caption } = state;

  const imageUrl = blob ? URL.createObjectURL(blob) : null;
  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  const handleDownload = () => {
    if (!blob || !imageUrl) return;
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `wordocious-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCopyCaption = async () => {
    const ok = await copyShareToClipboard(caption);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <>
      {open && blob && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 animate-modal-overlay"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
          onClick={closeSharePreview}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm p-5 pt-6 animate-modal-content"
            style={{
              // A1: the brand wash (never plain white) + the card's top bar.
              background: softBackground(BRAND_ACCENT),
              border: softBorder(BRAND_ACCENT),
              borderRadius: '24px',
              overflow: 'hidden',
              boxShadow: '0 30px 80px rgba(0,0,0,0.2)',
            }}
          >
            <div aria-hidden="true" style={{ ...cardBarStyle(BRAND_ACCENT), position: 'absolute', top: 0, left: 0, right: 0 }} />
            <HeaderBack kind="close" onClick={closeSharePreview} size={32} className="absolute top-3 right-3" />

            <h3 className="text-lg font-black text-center mb-3" style={{ color: 'var(--color-text)' }}>
              Share your result
            </h3>

            {imageUrl && (
              <img
                src={imageUrl}
                alt="Share preview"
                width={1080}
                height={1350}
                className="w-full rounded-xl mb-3"
                style={{ border: softBorder(BRAND_ACCENT) }}
              />
            )}

            <div className="space-y-2">
              {/* A8: candy buttons — purple primary, pink secondary. */}
              <CastButton onClick={handleDownload} color="purple" size="md" block icon={<Download className="w-4 h-4" aria-hidden="true" />}>
                Save image
              </CastButton>

              <CastButton
                onClick={handleCopyCaption}
                color="pink"
                size="md"
                block
                icon={copied ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
              >
                {copied ? 'Link copied' : 'Copy link'}
              </CastButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
