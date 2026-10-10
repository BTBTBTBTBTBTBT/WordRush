import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

// Founder 10-10 (rich push pictures never showed): the mascot SVG references its art by URL path (`/art/x.webp`), and
// sharp (librsvg) cannot load a path — nor WebP — so the render failed and the route 500'd. Every local image is read
// from public/ (traced into the function bundle, next.config.js), converted to PNG and inlined as a data URI first.

const PUBLIC_DIR = path.join(process.cwd(), 'public');

async function pngDataUri(urlPath: string, cache: Map<string, string | null>): Promise<string | null> {
  if (cache.has(urlPath)) return cache.get(urlPath) ?? null;
  let out: string | null = null;
  try {
    const clean = decodeURIComponent(urlPath.split('?')[0]);
    const file = path.join(PUBLIC_DIR, clean);
    if (!file.startsWith(PUBLIC_DIR)) throw new Error('outside public');
    const png = await sharp(await readFile(file)).png().toBuffer();
    out = `data:image/png;base64,${png.toString('base64')}`;
  } catch {
    out = null;
  }
  cache.set(urlPath, out);
  return out;
}

/** The SVG with every `href="/…"` image replaced by an inline PNG data URI (unreadable ones are dropped). */
export async function inlineLocalImages(svg: string): Promise<string> {
  const paths = Array.from(new Set(Array.from(svg.matchAll(/href="(\/[^"]+)"/g), (m) => m[1])));
  const cache = new Map<string, string | null>();
  await Promise.all(paths.map((p) => pngDataUri(p, cache)));
  return svg.replace(/href="(\/[^"]+)"/g, (_m, p: string) => {
    const uri = cache.get(p);
    return uri ? `href="${uri}"` : 'href=""';
  });
}

/** The bundled fallback mascot (the W) at `size` px. */
export async function fallbackMascotPng(size: number): Promise<Buffer> {
  const file = await readFile(path.join(PUBLIC_DIR, 'mascots', 'w.png'));
  return sharp(file).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
}
