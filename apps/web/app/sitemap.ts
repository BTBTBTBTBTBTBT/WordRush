import { MetadataRoute } from 'next';
import { recentDates, dateKey } from '@/lib/word-of-day';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://wordocious.com';

  // ONLY crawlable, unique-content pages. Game routes serve a UNIQUE
  // mode-specific public landing to logged-out crawlers (auth-gate
  // MODE_LANDING_PATHS → ModeLanding, built from that mode's guide content),
  // so they're indexable pages now, not duplicates of the generic Landing.
  const routes = [
    '/',                       // Landing (marketing content for logged-out crawlers)
    '/practice',               // Per-mode public landings (rules/scoring/strategy)
    '/six',
    '/seven',
    '/quordle',
    '/octordle',
    '/sequence',
    '/rescue',
    '/gauntlet',
    '/propernoundle',
    '/pro',                    // Pro feature overview (now public — see auth-gate PUBLIC_PATHS)
    '/how-to-play',
    '/guides',
    '/guides/classic',
    '/guides/six',
    '/guides/seven',
    '/guides/quadword',
    '/guides/octoword',
    '/guides/succession',
    '/guides/deliverance',
    '/guides/gauntlet',
    '/guides/propernoundle',
    '/words',
    '/strategy',
    '/strategy/best-starting-words',
    '/strategy/solve-faster',
    '/strategy/modes-explained',
    '/strategy/multi-board-mastery',
    '/strategy/gauntlet-survival',
    '/strategy/propernoundle-playbook',
    '/strategy/daily-sweep-guide',
    '/about',
    '/faq',
    '/privacy',
    '/terms',
    '/support',
  ];

  const staticEntries: MetadataRoute.Sitemap = routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === '/' || route === '/words' ? 'daily' : 'weekly',
    priority: route === '/' ? 1 : 0.8,
  }));

  // The last 60 Word of the Day archive pages — unique, indexable content that
  // grows daily. Older pages stay live but drop out of the sitemap.
  const wordEntries: MetadataRoute.Sitemap = recentDates(60).map((d) => ({
    url: `${baseUrl}/word/${dateKey(d)}`,
    lastModified: d,
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  return [...staticEntries, ...wordEntries];
}
