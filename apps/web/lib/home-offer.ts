// One Home offer card at a time (founder 10-05: "First win! Party hat?" and "Dress up for Halloween?" stacked).
// During a season the "Dress up?" nudge goes first; otherwise the party hat. The other one waits for a later open
// (nothing is marked done, so it isn't lost). iOS DressUp.swift PartyHatOffer · Android DressUp.kt PartyHatOffer.

export type HomeOffer = 'season' | 'partyhat';

export function pickHomeOffer({ seasonDue, partyHat }: { seasonDue: boolean; partyHat: boolean }): HomeOffer | null {
  if (seasonDue) return 'season';
  if (partyHat) return 'partyhat';
  return null;
}
