import {
  OG_ALT,
  OG_CONTENT_TYPE,
  OG_SIZE,
  renderSpellstrikeOgImage,
} from '@/lib/og-image-renderer';

// Next.js file-convention Open Graph image. The rendering lives in
// lib/og-image-renderer so the Twitter card sibling can reuse the exact
// same visual without running into the "runtime must be a string literal"
// restriction that blocks re-exports in these metadata files.

export const runtime = 'edge';
export const alt = OG_ALT;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function OpengraphImage() {
  return renderSpellstrikeOgImage();
}
