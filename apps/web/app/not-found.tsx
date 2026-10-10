import { CastLink } from '@/components/ui/cast-button';
import { UtilityCard, UtilityPage } from '@/components/ui/utility-page';
import { MASCOT_LINES } from '@/lib/mascots';
import { PAGE_SCENES } from '@/lib/art';

// 2.8 look: O3, the cyclops, looked everywhere with his one big eye (docs/ART_SPEC.md §7), on the page wall under the
// live cast row, in a soft card with the NOT FOUND lettering and the Home action.
export default function NotFound() {
  return (
    <UtilityPage>
      <UtilityCard scene={PAGE_SCENES.notFound} artSize={140} priority heading="notfound" title="PAGE NOT FOUND" line={MASCOT_LINES.notFound}>
        <CastLink href="/" color="purple" size="lg" block>
          Go to Home
        </CastLink>
      </UtilityCard>
    </UtilityPage>
  );
}
