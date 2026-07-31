import { PORTAL_HTML } from '@/lib/portal-html';

// Serves the engineering portal as a real document for the iframe on
// /admin/portal. It must be a URL, not srcDoc: fragment navigation inside a
// srcdoc iframe is broken (sandboxed → opaque origin, anchors blocked;
// unsandboxed → the fragment still fails to resolve against about:srcdoc), so
// every table-of-contents link was dead. Verified in an A/B harness before
// shipping this shape — via a real URL the anchors scroll natively.
//
// Lives under /admin so middleware.ts's admin gate covers it like the page.
export function GET() {
  return new Response(PORTAL_HTML, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
