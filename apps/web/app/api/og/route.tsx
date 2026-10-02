import { renderWordociousOgImage } from '@/lib/og-image-renderer';

export const runtime = 'edge';

// The generic brand card: the same finishing-look image as the root
// opengraph-image / twitter-image (lib/og-image-renderer.tsx), 1200×630.
export async function GET() {
  return renderWordociousOgImage();
}
