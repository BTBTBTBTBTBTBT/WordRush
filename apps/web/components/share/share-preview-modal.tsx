'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Copy, X, Check } from 'lucide-react';
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
    <AnimatePresence>
      {open && blob && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
          onClick={closeSharePreview}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: 'spring', damping: 22, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm p-5"
            style={{
              background: '#ffffff',
              borderRadius: '24px',
              boxShadow: '0 30px 80px rgba(0,0,0,0.2)',
            }}
          >
            <button
              onClick={closeSharePreview}
              aria-label="Close"
              className="absolute top-3 right-3 p-1.5 rounded-full transition-colors hover:bg-gray-100"
              style={{ color: '#9ca3af' }}
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-black text-center mb-3" style={{ color: '#1a1a2e' }}>
              Share your result
            </h3>

            {imageUrl && (
              <img
                src={imageUrl}
                alt="Share preview"
                className="w-full rounded-xl mb-3"
                style={{ border: '1.5px solid #ede9f6' }}
              />
            )}

            <div className="space-y-2">
              <button
                onClick={handleDownload}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm text-white btn-3d"
                style={{
                  background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                  boxShadow: '0 4px 0 #4c1d95',
                }}
              >
                <Download className="w-4 h-4" />
                Save image
              </button>

              <button
                onClick={handleCopyCaption}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-extrabold text-sm transition-colors"
                style={{
                  background: '#f8f7ff',
                  border: '1.5px solid #ede9f6',
                  color: '#1a1a2e',
                }}
              >
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Caption copied' : 'Copy caption'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
