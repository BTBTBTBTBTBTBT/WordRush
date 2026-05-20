'use client';

/**
 * Page transition template. Previously used framer-motion (~50KB gzipped)
 * for a simple opacity fade. Replaced with a CSS animation to eliminate
 * the library from the critical path of every route.
 *
 * The `key={pathname}` trick forces React to remount on navigation,
 * replaying the CSS animation. `usePathname()` changes on every
 * client-side navigation — identical behaviour to the old motion.div.
 */

import { usePathname } from 'next/navigation';

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div
      key={pathname}
      className="animate-page-fade-in"
      style={{ animationDuration: '200ms' }}
    >
      {children}
    </div>
  );
}
