import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Signed wordocious.com links to Social Studio images (the private 'social-media' bucket), for platforms that pull media
 * from a URL whose domain must be verified with them (TikTok PULL_FROM_URL: only https://wordocious.com/ is verified,
 * a Supabase signed URL is refused). Served by GET /api/social/media. Signed with CRON_SECRET (server-only), short-lived.
 */

const key = () => process.env.CRON_SECRET || '';

function sign(path: string, exp: number): string {
  return createHmac('sha256', key()).update(`${path}\n${exp}`).digest('base64url');
}

export function signedMediaLink(origin: string, path: string, seconds = 3 * 3600): string {
  const exp = Math.floor(Date.now() / 1000) + seconds;
  const q = new URLSearchParams({ p: path, e: String(exp), s: sign(path, exp) });
  return `${origin.replace(/\/$/, '')}/api/social/media?${q}`;
}

/** The bucket path when the link is genuine and unexpired, else null. */
export function verifyMediaLink(path: string | null, exp: string | null, sig: string | null): string | null {
  if (!key() || !path || !exp || !sig || !/^\d+$/.test(exp)) return null;
  if (Number(exp) < Date.now() / 1000) return null;
  if (path.includes('..') || !/^posts\/[\w/-]+\.(jpg|jpeg|png)$/i.test(path)) return null;
  const want = Buffer.from(sign(path, Number(exp)));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got) ? path : null;
}
