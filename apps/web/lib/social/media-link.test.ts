import { describe, expect, it, beforeEach } from 'vitest';
import { signedMediaLink, verifyMediaLink } from './media-link';

describe('signed social media links', () => {
  beforeEach(() => { process.env.CRON_SECRET = 'test-secret'; });
  const parts = (url: string) => { const q = new URL(url).searchParams; return [q.get('p'), q.get('e'), q.get('s')] as const; };

  it('round-trips a bucket path on our own domain', () => {
    const url = signedMediaLink('https://wordocious.com/', 'posts/abc/1234-portrait.jpg');
    expect(url.startsWith('https://wordocious.com/api/social/media?')).toBe(true);
    expect(verifyMediaLink(...parts(url))).toBe('posts/abc/1234-portrait.jpg');
  });
  it('rejects a tampered path, a bad signature and an expired link', () => {
    const [, e, s] = parts(signedMediaLink('https://wordocious.com', 'posts/abc/1-portrait.jpg'));
    expect(verifyMediaLink('posts/abc/2-portrait.jpg', e, s)).toBeNull();
    expect(verifyMediaLink('posts/abc/1-portrait.jpg', e, 'nope')).toBeNull();
    const [p2, , s2] = parts(signedMediaLink('https://wordocious.com', 'posts/abc/1-portrait.jpg', -10));
    expect(verifyMediaLink(p2, String(Math.floor(Date.now() / 1000) - 10), s2)).toBeNull();
  });
  it('only serves Studio post images', () => {
    const url = signedMediaLink('https://wordocious.com', '../secrets.jpg');
    expect(verifyMediaLink(...parts(url))).toBeNull();
  });
});
