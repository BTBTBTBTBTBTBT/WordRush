'use client';

// FINISH_SPEC BF2: share an unlocked achievement as a square badge card image
// (the S-style share: cream card, the badge big, "ACHIEVEMENT UNLOCKED!", the
// name + purpose line, the site). Falls back to a text share / clipboard.

import { loadShareImage } from './share-canvas';

export function achievementShareText(name: string, description: string): string {
  return `I unlocked "${name}" in Wordocious! ${description}. wordocious.com`;
}

export async function shareAchievementCard(a: { name: string; description: string; badgeSrcs: string[]; accent: string }): Promise<'shared' | 'copied' | 'failed'> {
  const text = achievementShareText(a.name, a.description);
  try {
    const size = 1080;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, size);
      g.addColorStop(0, '#fffaf3'); g.addColorStop(1, '#f3ecff');
      ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = a.accent; ctx.fillRect(0, 0, size, 28);
      const img = await loadShareImage(a.badgeSrcs);
      if (img) ctx.drawImage(img, size / 2 - 230, 150, 460, 460);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#b45309';
      ctx.font = '900 64px Nunito, system-ui, sans-serif';
      ctx.fillText('ACHIEVEMENT UNLOCKED!', size / 2, 700);
      ctx.fillStyle = '#2a1650';
      ctx.font = '900 76px Nunito, system-ui, sans-serif';
      ctx.fillText(a.name, size / 2, 800);
      ctx.fillStyle = '#5b4a7a';
      ctx.font = '700 40px Nunito, system-ui, sans-serif';
      ctx.fillText(a.description, size / 2, 870);
      ctx.fillStyle = '#7c3aed';
      ctx.font = '900 40px Nunito, system-ui, sans-serif';
      ctx.fillText('wordocious.com', size / 2, 1000);
      const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/png'));
      if (blob && typeof navigator !== 'undefined' && navigator.canShare) {
        const file = new File([blob], `wordocious-${a.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], text });
          return 'shared';
        }
      }
    }
    if (typeof navigator !== 'undefined' && navigator.share) { await navigator.share({ text }); return 'shared'; }
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}
