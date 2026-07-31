// The engineering portal — "how Wordocious is built and works" (Jasson,
// 2026-08-01). Admin-gated by middleware.ts like every /admin route; /portal
// redirects here (next.config.js) so the short URL works.
//
// The document is iframed BY URL (./doc), never via srcDoc: fragment
// navigation inside a srcdoc iframe is broken — sandboxed it has an opaque
// origin and anchors are blocked outright; unsandboxed the fragment still
// fails to resolve against about:srcdoc — which killed every table-of-contents
// link on first contact (Jasson, minutes after getting in). A real URL gives
// the anchors a real document to navigate; verified in an A/B harness.
// The iframe still isolates the doc's own styles (it also ships standalone as
// WORDOCIOUS_PORTAL.html) from the admin shell's Tailwind.
export const metadata = { title: 'Portal — Wordocious Admin', robots: { index: false, follow: false } };

export default function PortalPage() {
  return (
    <div className="h-full -m-6">
      <iframe
        src="/admin/portal/doc"
        title="Wordocious Engineering Portal"
        className="w-full border-0"
        style={{ height: 'calc(100vh - 0px)' }}
      />
    </div>
  );
}
