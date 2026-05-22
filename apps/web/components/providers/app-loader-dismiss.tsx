'use client';

import { useEffect } from 'react';

/**
 * Tiny client component that dismisses the static HTML loading overlay
 * once React has hydrated. Placed inside the layout so it fires after
 * the first meaningful render.
 */
export function AppLoaderDismiss() {
  useEffect(() => {
    const el = document.getElementById('app-loader');
    if (el) {
      el.classList.add('loaded');
      // Remove from DOM after fade-out completes
      setTimeout(() => el.remove(), 400);
    }
  }, []);
  return null;
}
