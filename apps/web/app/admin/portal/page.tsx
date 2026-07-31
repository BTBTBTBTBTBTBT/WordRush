import { PORTAL_HTML } from '@/lib/portal-html';

// The engineering portal — "how Wordocious is built and works" (Jasson,
// 2026-08-01). Admin-gated by middleware.ts like every /admin route; /portal
// redirects here (next.config.js) so the short URL works.
//
// Rendered in a sandboxed iframe so the document's own styles (it is also
// shipped standalone as WORDOCIOUS_PORTAL.html at the repo root) can't fight
// the admin shell's Tailwind, and vice versa.
export const metadata = { title: 'Portal — Wordocious Admin', robots: { index: false, follow: false } };

export default function PortalPage() {
  return (
    <div className="h-full -m-6">
      <iframe
        srcDoc={PORTAL_HTML}
        sandbox=""
        title="Wordocious Engineering Portal"
        className="w-full border-0"
        style={{ height: 'calc(100vh - 0px)' }}
      />
    </div>
  );
}
