import { describe, expect, it } from 'vitest';
import {
  SHARE_CHANNEL_ORDER, SHARE_CHANNEL_PAYLOADS, SHARE_CHANNEL_SLUGS, SHARE_CARD_ORDER, channelCarriesImage, channelCarriesLink, channelFrame,
  shareChannelLink, shareSheetCards, shareSheetLooks, shareSheetModel, type ShareChannelId, type SharePlatform, type ShareSheetContext,
} from './share-sheet';
import { shareCaption } from './share-captions';

const finished: ShareSheetContext = {
  surface: 'finished', mode: 'regions', play: 'daily', cards: ['streak', 'result'], hasSpoilerVariant: true, season: 'halloween',
  caption: { kind: 'win', date: '2026-10-16', game: 'Starsweep', n: '1', t: '2:10', d: 5 },
};
const PLATFORMS: SharePlatform[] = ['ios', 'android', 'web'];

describe('shareSheetModel', () => {
  it('orders the carousel by the canonical card order and falls back to the surface default', () => {
    expect(shareSheetModel(finished, 'ios').cards.map((c) => c.kind)).toEqual(['result', 'streak']);
    expect(shareSheetCards('leaderboard', []).map((c) => c.kind)).toEqual(['leaderboard']);
    expect(shareSheetCards('vs', ['achievement', 'vs-result']).map((c) => c.kind)).toEqual(['vs-result', 'achievement']);
    for (const c of shareSheetCards('profile', [...SHARE_CARD_ORDER])) { expect(c.frame).toBe('message'); expect(c.title.length).toBeGreaterThan(0); }
  });

  it('shows the spoiler toggle only for a result card with a clean variant, opening on clean', () => {
    const m = shareSheetModel(finished, 'ios');
    expect(m.variant).toEqual({ shown: true, initial: 'clean', copy: { clean: { title: 'No spoilers', subtitle: 'Regions only' }, full: { title: 'Full results', subtitle: 'Stars revealed' } } });
    expect(shareSheetModel({ ...finished, hasSpoilerVariant: false }, 'ios').variant.shown).toBe(false);
    expect(shareSheetModel({ ...finished, surface: 'leaderboard', cards: ['leaderboard'], mode: '' }, 'ios').variant.shown).toBe(false);
  });

  it('shows look swatches only inside a season, season first', () => {
    expect(shareSheetLooks('halloween')).toEqual({ shown: true, options: [{ id: 'halloween', label: 'Halloween' }, { id: 'normal', label: 'Normal' }], initial: 'halloween' });
    expect(shareSheetLooks(null)).toEqual({ shown: false, options: [{ id: 'normal', label: 'Normal' }], initial: 'normal' });
    expect(shareSheetLooks('normal').shown).toBe(false);
    expect(shareSheetLooks('winter').options[0]).toEqual({ id: 'winter', label: 'Winter' });
  });

  it('keeps the MVP channel order per platform and parks the registered kits in hiddenChannels', () => {
    const ids = (p: SharePlatform) => shareSheetModel(finished, p).channels.map((c) => c.id);
    expect(ids('ios')).toEqual(['copy', 'messages', 'whatsapp', 'x', 'facebook', 'save', 'more']);
    expect(ids('android')).toEqual(['copy', 'messages', 'whatsapp', 'x', 'facebook', 'save', 'more']);
    expect(ids('web')).toEqual(['copy', 'messages', 'whatsapp', 'x', 'facebook', 'save', 'more']);
    expect(shareSheetModel(finished, 'ios').hiddenChannels.map((c) => c.id)).toEqual(['stories', 'snapchat', 'tiktok']);
    expect(shareSheetModel(finished, 'web').hiddenChannels.map((c) => c.id)).toEqual(['snapchat']);
    for (const p of PLATFORMS) {
      const m = shareSheetModel(finished, p);
      for (const c of m.channels) expect(c.availability).toBe('ready');
      for (const c of m.hiddenChannels) expect(c.availability).toBe('needsRegistration');
      const all = [...m.channels, ...m.hiddenChannels].map((c) => c.id).sort((a, b) => SHARE_CHANNEL_ORDER.indexOf(a) - SHARE_CHANNEL_ORDER.indexOf(b));
      expect(all).toEqual(SHARE_CHANNEL_ORDER.filter((id) => SHARE_CHANNEL_PAYLOADS[id][p] != null));
    }
  });

  it('messaging channels carry the image alone on the apps (S1), text + link on the web', () => {
    for (const p of ['ios', 'android'] as const) {
      const m = shareSheetModel(finished, p);
      for (const id of ['messages', 'whatsapp', 'more', 'save'] as const) {
        const c = m.channels.find((x) => x.id === id)!;
        expect(c.payload).toBe('image'); expect(c.link).toBeNull(); expect(c.caption).toBeNull(); expect(c.text).toBeNull();
      }
    }
    const web = shareSheetModel(finished, 'web');
    const msg = web.channels.find((c) => c.id === 'messages')!;
    const line = shareCaption('win', { date: '2026-10-16', game: 'Starsweep', n: '1', t: '2:10', d: 5 });
    expect(msg.payload).toBe('text');
    expect(msg.link).toBe('https://wordocious.com/go/msg?s=finished&m=regions');
    expect(msg.caption).toBe(line);
    expect(msg.text).toBe(`${line} https://wordocious.com/go/msg?s=finished&m=regions`);
    expect(msg.mobileOnly).toBe(true);
    expect(web.channels.find((c) => c.id === 'x')!.mobileOnly).toBe(false);
    expect(shareSheetModel(finished, 'ios').channels.find((c) => c.id === 'messages')!.mobileOnly).toBe(false);
  });

  it('copy link carries only the tracked link; Android X carries image + text', () => {
    for (const p of PLATFORMS) {
      const copy = shareSheetModel(finished, p).channels.find((c) => c.id === 'copy')!;
      expect(copy).toMatchObject({ payload: 'link', link: 'https://wordocious.com/go/copy?s=finished&m=regions', caption: null, text: null });
    }
    const x = shareSheetModel(finished, 'android').channels.find((c) => c.id === 'x')!;
    expect(x.payload).toBe('imageText');
    expect(x.link).toBe('https://wordocious.com/go/x?s=finished&m=regions');
    expect(x.text).toContain(x.caption!);
    expect(shareSheetModel(finished, 'ios').channels.find((c) => c.id === 'x')!.payload).toBe('image');
  });

  it('text channels without a caption fall back to the link', () => {
    const noCaption = shareSheetModel({ ...finished, caption: null, surface: 'profile', mode: '', cards: ['profile'] }, 'web');
    const x = noCaption.channels.find((c) => c.id === 'x')!;
    expect(x.caption).toBeNull();
    expect(x.link).toBe('https://wordocious.com/go/x?s=profile');
    expect(x.text).toBe('https://wordocious.com/go/x?s=profile');
  });

  it('links use the seeded + new marketing_links slugs and never leak for image-only channels', () => {
    expect(shareChannelLink('whatsapp', 'sweep', '')).toBe('https://wordocious.com/go/wa?s=sweep');
    expect(shareChannelLink('save', 'finished', 'hub')).toBeNull();
    expect(shareChannelLink('more', 'finished', 'hub')).toBeNull();
    for (const id of SHARE_CHANNEL_ORDER) {
      const slug = SHARE_CHANNEL_SLUGS[id];
      if (slug != null) expect(slug).toMatch(/^[a-z0-9-]{1,40}$/);
      for (const p of PLATFORMS) {
        if (SHARE_CHANNEL_PAYLOADS[id][p] == null) continue;
        expect(channelCarriesImage(id, p) || channelCarriesLink(id, p)).toBe(true);
        if (!channelCarriesLink(id, p)) expect(shareSheetModel(finished, p).channels.concat(shareSheetModel(finished, p).hiddenChannels).find((c) => c.id === id)!.link).toBeNull();
      }
    }
  });

  it('story-shaped channels ask for the story frame', () => {
    const story: ShareChannelId[] = ['stories', 'snapchat', 'tiktok'];
    for (const id of SHARE_CHANNEL_ORDER) expect(channelFrame(id)).toBe(story.includes(id) ? 'story' : 'message');
  });
});
