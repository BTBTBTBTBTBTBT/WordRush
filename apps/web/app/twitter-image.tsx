import {
  OG_ALT,
  OG_CONTENT_TYPE,
  OG_SIZE,
  renderSpellstrikeOgImage,
} from '@/lib/og-image-renderer';

// Next.js file-convention Twitter card image. Shares the exact same
// renderer as opengraph-image.tsx — if you change one visual, both update.

export const runtime = 'edge';
export const alt = OG_ALT;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function TwitterImage() {
  return renderSpellstrikeOgImage();
}
