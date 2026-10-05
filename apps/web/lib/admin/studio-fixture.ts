/**
 * Dev-only Social Studio payload built from studio-seed.json, for local screenshots without a service key
 * (studioFixtureMode in studio-db.ts). Never used in production.
 */
import seed from './studio-seed.json';
import { PLATFORMS, targetSlug, type Platform, type SocialMedia, type SocialPost, type SocialReview, type SocialTarget } from './studio';
import type { StudioPayload } from './studio-types';

const BMT = '00000000-0000-4000-8000-0000000000b1';
const JP = '00000000-0000-4000-8000-0000000000a2';

function at(day: string, time: string): string {
  // CDT (UTC-5) for October.
  return new Date(`${day}T${time}:00-05:00`).toISOString();
}

export function studioFixture(empty = false): StudioPayload {
  const sizes: Array<[SocialMedia['size'], number, number]> = [['portrait', 1080, 1350], ['pin', 1000, 1500], ['landscape', 1600, 900]];
  const posts: SocialPost[] = empty ? [] : seed.posts.map((p) => ({
    id: p.id,
    title: p.title,
    kind: p.kind,
    scheduled_at: at(p.day, p.time),
    hashtags: p.hashtags,
    media: sizes.map(([size, width, height]) => ({ size, src: 'public' as const, path: `/social/seed/${p.kind}-${size}.jpg`, width, height })),
    link_slug: null,
    link_target: p.link_target,
    version: p.kind === 'teaser' ? 2 : 1,
    edited_at: p.kind === 'teaser' ? '2026-10-05T18:40:00.000Z' : null,
    edited_by: p.kind === 'teaser' ? BMT : null,
    paused: false,
    status: 'draft',
    created_at: '2026-10-05T18:00:00.000Z',
    updated_at: '2026-10-05T18:00:00.000Z',
  }));
  const targets: SocialTarget[] = posts.flatMap((p) => {
    const captions = seed.posts.find((s) => s.id === p.id)!.captions as Record<string, string>;
    return Object.entries(captions).map(([platform, caption], i) => ({
      id: `${p.id.slice(0, -2)}${String(10 + i)}`,
      post_id: p.id,
      platform: platform as Platform,
      caption,
      status: 'pending' as const,
      attempts: 0,
      next_attempt_at: null,
      remote_id: null,
      remote_url: null,
      last_error: null,
      posted_at: null,
      link_slug: targetSlug(p.id, platform as Platform),
    }));
  });
  const now = '2026-10-05T18:30:00.000Z';
  const reviews: SocialReview[] = empty ? [] : [
    { post_id: seed.posts[0].id, reviewer_id: JP, decision: 'approve', version: 1, note: null, updated_at: now },
    { post_id: seed.posts[1].id, reviewer_id: JP, decision: 'approve', version: 1, note: null, updated_at: now },
    { post_id: seed.posts[2].id, reviewer_id: BMT, decision: 'approve', version: 1, note: null, updated_at: now },
    { post_id: seed.posts[2].id, reviewer_id: JP, decision: 'approve', version: 1, note: null, updated_at: now },
  ];
  return {
    posts,
    targets,
    reviews,
    reviewers: [{ profile_id: BMT, short_name: 'BMT', sort: 1 }, { profile_id: JP, short_name: 'JP', sort: 2 }],
    me: BMT,
    paused: false,
    accounts: PLATFORMS.map((platform) => ({
      platform,
      provider: platform === 'instagram' || platform === 'facebook' ? 'meta' : platform,
      connected: false,
      configured: false,
      handle: null,
      connected_at: null,
      last_error: null,
    })) as StudioPayload['accounts'],
    urls: Object.fromEntries(posts.flatMap((p) => p.media.map((m) => [m.path, m.path]))),
    links: {},
    feedback: empty ? [] : [{
      id: '00000000-0000-4000-8000-00000000f001', post_id: seed.posts[3].id, author: 'JP',
      body: 'Love the costumes. Can the X version lead with the date?', created_at: now,
    }],
    fixture: true,
  };
}
