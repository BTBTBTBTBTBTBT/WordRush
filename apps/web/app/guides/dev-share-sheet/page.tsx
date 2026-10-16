import { notFound } from 'next/navigation';
import { ShareSheetDemoClient } from './client';

// DEV-ONLY: /guides/dev-share-sheet[?sample=quadword][&season=halloween|none][&cards=2][&spoilers=0]. Opens the custom share sheet
// (components/share/share-sheet.tsx) on a sample card so the layout can be looked at. Refused outside `next dev`.
export const dynamic = 'force-dynamic';

export default function Page({ searchParams }: { searchParams: { sample?: string; season?: string; cards?: string; spoilers?: string } }) {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <ShareSheetDemoClient sample={searchParams.sample ?? 'quadword'} season={searchParams.season === 'none' ? null : searchParams.season ?? 'halloween'} cards={Number(searchParams.cards) || 1} spoilers={searchParams.spoilers !== '0'} />;
}
