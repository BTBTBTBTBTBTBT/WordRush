import { redirect } from 'next/navigation';
import { vsHrefForMode } from '@/lib/invite-service';

// The "someone's looking" push lands here (VS overhaul spec §13): straight
// into that mode's live queue, where the waiting player is.
export default function VsLivePing({ params }: { params: { mode: string } }) {
  redirect(`${vsHrefForMode((params.mode ?? '').toUpperCase())}?live=1`);
}
