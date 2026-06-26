import { MetadataRoute } from 'next';
import { recentDates, dateKey } from '@/lib/word-of-day';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://wordocious.com';

  // ONLY crawlable, unique-content pages. The game routes (/six, /quordle, /daily,
  // …) are login-gated and serve the SAME Landing to logged-out crawlers — listing
  // them created ~10 duplicate pages, which reads as "low value content" to AdSense.
  const routes = [
    '/',                       // Landing (marketing content for logged-out crawlers)
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
