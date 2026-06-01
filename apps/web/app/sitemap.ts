import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://wordocious.com';

  const routes = [
    '/',
    '/daily',
    '/practice',
    '/quordle',
    '/octordle',
    '/sequence',
    '/rescue',
    '/six',
    '/seven',
    '/gauntlet',
    '/propernoundle',
    '/pro',
    '/how-to-play',
    '/about',
    '/faq',
    '/privacy',
    '/terms',
    '/support',
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === '/' ? 'daily' : 'weekly',
    priority: route === '/' ? 1 : 0.8,
  }));
}
