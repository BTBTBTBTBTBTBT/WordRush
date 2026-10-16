import { describe, expect, it } from 'vitest';
import { shareSheetModel } from '@wordle-duel/core';
import {
  channelEventKind, channelEventSurface, channelIntent, finishedSheetContext, isMobileWeb, lookToSeason, sheetBlobKey, visibleChannels, xIntentUrl,
} from './share-sheet-web';

const ctx = (over: Partial<Parameters<typeof finishedSheetContext>[0]> = {}) => finishedSheetContext({
  catalogMode: 'quordle', gameName: 'QuadWord', isDaily: true, won: true, multi: true, guesses: 6, time: '1:12', boardsTotal: 4, date: '2026-10-16', season: 'halloween', ...over,
});

describe('finishedSheetContext', () => {
  it('builds the one-card finished context with a win / multiWin / lose caption', () => {
    expect(ctx()).toMatchObject({ surface: 'finished', mode: 'quordle', play: 'daily', cards: ['result'], hasSpoilerVariant: true, season: 'halloween' });
    expect(ctx().caption).toMatchObject({ kind: 'multiWin', game: 'QuadWord', n: '6', t: '1:12', b: '4' });
    expect(ctx({ multi: false }).caption?.kind).toBe('win');
    expect(ctx({ won: false }).caption?.kind).toBe('lose');
    expect(ctx({ isDaily: false }).play).toBe('unlimited');
  });

  it('opens on No spoilers, shows swatches only in a season', () => {
    const m = shareSheetModel(ctx(), 'web');
    expect(m.variant).toMatchObject({ shown: true, initial: 'clean' });
    expect(m.looks).toMatchObject({ shown: true, initial: 'halloween' });
    expect(shareSheetModel(ctx({ season: null }), 'web').looks.shown).toBe(false);
  });
});

describe('web channel wiring', () => {
  const model = shareSheetModel(ctx(), 'web');
  const by = (id: string) => model.channels.find((c) => c.id === id)!;

  it('renders the MVP channels in model order, hiding the phone-only ones on desktop', () => {
    expect(model.channels.map((c) => c.id)).toEqual(['copy', 'messages', 'whatsapp', 'x', 'facebook', 'save', 'more']);
    expect(visibleChannels(model.channels, true).map((c) => c.id)).toEqual(['copy', 'messages', 'whatsapp', 'x', 'facebook', 'save', 'more']);
    expect(visibleChannels(model.channels, false).map((c) => c.id)).toEqual(['copy', 'x', 'facebook', 'save', 'more']);
  });

  it('maps each tile to its mechanism with the tracked link', () => {
    expect(channelIntent(by('copy'))).toEqual({ kind: 'copy', text: 'https://wordocious.com/go/copy?s=finished&m=quordle' });
    const sms = channelIntent(by('messages'));
    expect(sms.kind).toBe('sms');
    expect((sms as { url: string }).url.startsWith('sms:?&body=')).toBe(true);
    expect(decodeURIComponent((sms as { url: string }).url.slice('sms:?&body='.length))).toBe(by('messages').text);
    const wa = channelIntent(by('whatsapp')) as { url: string };
    expect(wa.url.startsWith('https://wa.me/?text=')).toBe(true);
    expect(decodeURIComponent(wa.url.split('text=')[1])).toContain('https://wordocious.com/go/wa?s=finished&m=quordle');
    const x = channelIntent(by('x')) as { url: string };
    expect(x.url.startsWith('https://x.com/intent/post?text=')).toBe(true);
    expect(x.url).toContain(`&url=${encodeURIComponent('https://wordocious.com/go/x?s=finished&m=quordle')}`);
    expect(channelIntent(by('facebook'))).toEqual({
      kind: 'open', url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://wordocious.com/go/facebook?s=finished&m=quordle')}`,
    });
    expect(channelIntent(by('save'))).toEqual({ kind: 'save' });
    expect(channelIntent(by('more'))).toEqual({ kind: 'more' });
  });

  it('X without a caption carries just the link; no link and no caption does nothing', () => {
    const noCap = shareSheetModel({ ...ctx(), caption: null }, 'web').channels.find((c) => c.id === 'x')!;
    expect(xIntentUrl(noCap)).toBe(`https://x.com/intent/post?url=${encodeURIComponent(noCap.link!)}`);
    expect(channelIntent({ ...noCap, link: null, caption: null })).toEqual({ kind: 'none' });
  });

  it('logs image channels as image, link channels as text, Copy as other', () => {
    expect(channelEventKind(by('save'))).toBe('image');
    expect(channelEventKind(by('more'))).toBe('image');
    expect(channelEventKind(by('whatsapp'))).toBe('text');
    expect(channelEventKind(by('copy'))).toBe('other');
    expect(channelEventSurface('facebook')).toBe('post_game:facebook');
  });
});

describe('small helpers', () => {
  it('keys the preview cache by card, variant and look', () => {
    expect(sheetBlobKey('result', 'clean', 'halloween')).toBe('result|clean|halloween');
    expect(sheetBlobKey('result', 'full', 'halloween')).not.toBe(sheetBlobKey('result', 'clean', 'halloween'));
  });
  it('turns a look id into the renderer season', () => {
    expect(lookToSeason('normal')).toBeNull();
    expect(lookToSeason('halloween')).toBe('halloween');
  });
  it('detects phones, including iPadOS', () => {
    expect(isMobileWeb('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 5)).toBe(true);
    expect(isMobileWeb('Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile', 5)).toBe(true);
    expect(isMobileWeb('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(true);
    expect(isMobileWeb('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe(false);
    expect(isMobileWeb('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 0)).toBe(false);
  });
});
