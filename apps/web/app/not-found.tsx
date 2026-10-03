import { BrandEmptyState } from '@/components/ui/brand-empty-state';
import { MASCOT_LINES } from '@/lib/mascots';
import { PAGE_SCENES } from '@/lib/art';
import { softBackground } from '@/lib/soft-surface';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: softBackground('#7c3aed', 0.06) }}>
      {/* BI24: O3, the cyclops, looked everywhere with his one big eye (docs/ART_SPEC.md §7),
          over the gradient caps headline and the candy Home. No box. */}
      <BrandEmptyState
        scene={PAGE_SCENES.notFound}
        artHeight={140}
        priority
        title="PAGE NOT FOUND"
        line={MASCOT_LINES.notFound}
        actionLabel="Back to Home"
        actionHref="/"
        actionIcon="arrow"
      />
    </div>
  );
}
