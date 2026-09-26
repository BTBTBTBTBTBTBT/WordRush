import { redirect } from 'next/navigation';

// D1 of the Stats + Friends redesign (founder, 2026-09-26): Profile and Records
// merged into the Stats tab. Every old /profile link (header avatar, post-game
// links, pushes) lands on /stats; public profiles stay at /profile/[id].
export default function ProfileRedirect() {
  redirect('/stats');
}
