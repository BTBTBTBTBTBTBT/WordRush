import { ArtScene } from '@/components/ui/art-scene';
import { CandyLink } from '@/components/ui/candy-button';
import { BRAND_BAR, StateCard } from '@/components/ui/soft-popup';
import { MASCOT_LINES } from '@/lib/mascots';
import { PAGE_SCENES } from '@/lib/art';
import { softBackground } from '@/lib/soft-surface';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: softBackground('#7c3aed', 0.06) }}>
      {/* G5: a tinted card with the brand top bar and the candy Home button. */}
      <StateCard gradient={BRAND_BAR}>
        {/* O3, the cyclops, looked everywhere with his one big eye (docs/ART_SPEC.md §7). */}
        <div className="flex justify-center mb-3">
          <ArtScene scene={PAGE_SCENES.notFound} priority />
        </div>
        <h1 className="text-2xl font-black mb-2" style={{ color: 'var(--color-text)' }}>Page Not Found</h1>
        <p className="text-sm font-bold mb-5" style={{ color: 'var(--color-text-muted)' }}>{MASCOT_LINES.notFound}</p>
        <CandyLink href="/" color="purple" size="md">
          Back to Home
        </CandyLink>
      </StateCard>
    </div>
  );
}
